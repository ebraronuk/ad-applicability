/**
 * Parse paragraph (c) of an Airworthiness Directive into an applicability tree.
 *
 * The patterns here are measured, not guessed. Across the 196 directives in
 * `data/corpus/ads.json`:
 *
 *   98.5%  name at least one "Model ..." designation
 *   83.2%  carry the boilerplate "certificated in any category"
 *   58.7%  airplanes, 26.5% helicopters, 15.8% engines
 *   34.7%  defer applicability to a manufacturer bulletin or foreign AD
 *   16.3%  refer to their own sub-paragraphs, (c)(1), (c)(2), ...
 *   15.8%  contain a range ("through")
 *    9.7%  mention serial numbers
 *    6.6%  add an installed-part condition
 *    2.6%  carry an "except" clause
 *    1.5%  refer to a table
 *
 * Re-run `scripts/report-coverage.ts` after changing anything here: the figure
 * in the README is produced from this parser against that corpus, so it is a
 * measurement rather than a claim.
 */
import type { AircraftCategory, ApplicabilityNode } from "./ast.js";
import { and, or } from "./ast.js";

export interface ParseResult {
  readonly node: ApplicabilityNode | null;
  /** Phrases the parser understood, for the explanation trail. */
  readonly recognized: readonly string[];
  /** Set when nothing could be extracted at all. */
  readonly unparsed?: string;
}

const LEAD_IN = /^this\s+ad\s+applies\s+to\s+(?:all\s+)?/i;

const CATEGORY_WORDS: ReadonlyArray<readonly [RegExp, AircraftCategory]> = [
  [/\bairplanes?\b/i, "airplanes"],
  [/\bhelicopters?\b/i, "helicopters"],
  [/\bengines?\b/i, "engines"],
  [/\bpropellers?\b/i, "propellers"],
];

/**
 * Phrases that hand applicability to a document this engine does not hold.
 *
 * Order matters: a clause can both name models and defer, and the deferral has
 * to be recognised even when the model list parses cleanly. That combination is
 * the single most common shape in the corpus, so getting it wrong would make
 * the engine confidently wrong on a third of all directives.
 */
const DEFERRALS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly missing: "service_bulletin" | "installed_part" | "referenced_table";
}> = [
  // "as identified in Boeing Alert Requirements Bulletin B787-81205-SB340062-00 RB"
  // Also catches foreign ADs ("as identified in Transport Canada AD CF-2025-60R1"),
  // which are equally unavailable to the engine.
  { pattern: /\b(?:as\s+)?identified\s+in\s+([^.;]{3,160})/i, missing: "service_bulletin" },
  { pattern: /\bwith\s+an\s+installed\s+([^.;]{3,160})/i, missing: "installed_part" },
  { pattern: /\btable\s+\d+\s+to\s+paragraph\s*\([a-z]\)/i, missing: "referenced_table" },
];

function stripBoilerplate(text: string): string {
  return text
    .replace(/,?\s*certificated\s+in\s+any\s+category,?/gi, " ")
    .replace(/\s*of\s+this\s+AD\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(text: string): AircraftCategory | null {
  for (const [pattern, category] of CATEGORY_WORDS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

const CATEGORY_ALTERNATION = "airplanes?|helicopters?|engines?|propellers?";

/**
 * Pull the model designations out of one "Model A, B, and C <category>" run.
 *
 * Two bugs shaped this pattern, both found by running it over the corpus
 * rather than over examples chosen by hand.
 *
 * First version split the whole clause on commas, which merged the model list
 * with everything after it and produced designations such as
 * "787-10 airplanes certificated in any".
 *
 * Second version anchored on the terminating category word but matched lazily
 * across any distance, so AD 2026-22785 ("Lycoming Engines (Lycoming) Model
 * engines identified in table 1 ...") ran past the immediately following
 * category word to one much later in the document and captured a stretch of
 * table rule characters as a model name. The run is now TEMPERED: it cannot
 * contain a category word, so "Model engines" correctly yields no designation
 * at all. Both cases are pinned in `tests/parse.test.ts`.
 */
const MODEL_RUN = new RegExp(
  String.raw`\bModels?\s+((?:(?!\b(?:${CATEGORY_ALTERNATION})\b)[^.;]){0,160}?)(?=\s+(?:${CATEGORY_ALTERNATION})\b)`,
  "gi",
);

const MODEL_SEPARATOR = /\s*(?:,|\band\b|\bor\b)\s*/i;

function parseModelRun(run: string): readonly string[] {
  return run
    .split(MODEL_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && /[0-9A-Z]/.test(part))
    // Directives embed ASCII tables, whose rule lines survive whitespace
    // normalisation as long dash runs. A designation is never mostly dashes.
    .filter((part) => !/^[-\u2010-\u2015\s]+$/.test(part) && !/-{4,}/.test(part))
    // "series", "and later", "variants" are qualifiers, not designations.
    .filter((part) => !/^(series|variants?|later|earlier|all)$/i.test(part));
}

/** Everything before the first "Model" is where the manufacturer sits, if named. */
function detectManufacturer(text: string): string | undefined {
  const index = text.search(/\bModels?\s/i);
  if (index <= 0) return undefined;
  const candidate = text
    .slice(0, index)
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(?:specified|identified|listed)\b.*$/i, " ")
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!candidate || candidate.length > 80) return undefined;
  return candidate;
}

const SERIAL_RANGE =
  /serial\s+numbers?\s+\(?(?:S\/N|MSN)?\)?\s*([A-Z0-9-]+)\s+(?:through|thru|to)\s+([A-Z0-9-]+)(\s+inclusive)?/i;
const SERIAL_BOUND =
  /serial\s+numbers?\s+\(?(?:S\/N|MSN)?\)?\s*(up\s+to\s+and\s+including|up\s+to|and\s+subsequent)\s+([A-Z0-9-]+)/i;

function parseSerialConstraint(text: string): {
  readonly node: ApplicabilityNode;
  readonly phrase: string;
} | null {
  const range = SERIAL_RANGE.exec(text);
  if (range) {
    return {
      node: {
        kind: "serial_range",
        from: range[1]!,
        to: range[2]!,
        inclusive: range[3] !== undefined,
      },
      phrase: range[0],
    };
  }
  const bound = SERIAL_BOUND.exec(text);
  if (bound) {
    const wording = bound[1]!.toLowerCase();
    return {
      node: {
        kind: "serial_bound",
        direction: wording.startsWith("and subsequent") ? "from" : "up_to",
        bound: bound[2]!,
        inclusive: wording !== "up to",
      },
      phrase: bound[0],
    };
  }
  return null;
}

export function parseApplicability(applicability: string): ParseResult {
  const text = stripBoilerplate(applicability.replace(LEAD_IN, ""));
  if (!text) return { node: null, recognized: [], unparsed: applicability };

  const recognized: string[] = [];
  const constraints: ApplicabilityNode[] = [];

  // A clause may carry several "Model ... airplanes" runs, because directives
  // that say "specified in paragraphs (c)(1) and (2)" then spell those
  // sub-paragraphs out in the same paragraph. Those are alternatives, so they
  // compose with OR rather than AND. Treating them as AND was the first
  // version's bug: no aircraft is simultaneously an A330-243 and an A330-941,
  // so every such directive resolved to "does not apply" for the whole fleet.
  const modelGroups: ApplicabilityNode[] = [];
  const manufacturer = detectManufacturer(text);
  for (const match of text.matchAll(MODEL_RUN)) {
    const models = parseModelRun(match[1] ?? "");
    if (models.length === 0) continue;
    const category = detectCategory(text.slice(match.index ?? 0)) ?? detectCategory(text);
    if (!category) continue;
    modelGroups.push({
      kind: "models",
      ...(manufacturer === undefined ? {} : { manufacturer }),
      models,
      category,
    });
    recognized.push(`models: ${models.join(", ")}`);
  }
  if (modelGroups.length > 0) constraints.push(or(...modelGroups));

  const serial = parseSerialConstraint(text);
  if (serial) {
    constraints.push(serial.node);
    recognized.push(`serial constraint: ${serial.phrase}`);
  }

  for (const { pattern, missing } of DEFERRALS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const detail = (match[1] ?? match[0]).trim();
    constraints.push({ kind: "deferred", missing, detail });
    recognized.push(`deferred to ${missing.replace(/_/g, " ")}: ${detail}`);
  }

  if (constraints.length === 0) {
    return { node: null, recognized: [], unparsed: text };
  }
  return { node: and(...constraints), recognized };
}
