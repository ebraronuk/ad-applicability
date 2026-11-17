import type { Verdict } from "../src/applicability/evaluate.js";
import { missingLabel } from "./labels";

/**
 * A verdict mark carries a word and a glyph, not just a colour.
 *
 * Colour-blind readers and greyscale printouts are the ordinary case in a
 * hangar, and this is the one element a reader acts on.
 */
const MARKS = {
  applies: { className: "verdict-applies", glyph: "▲", label: "Kapsamda" },
  does_not_apply: { className: "verdict-clear", glyph: "○", label: "Kapsam dışı" },
  undetermined: { className: "verdict-unknown", glyph: "◆", label: "Belirsiz" },
} as const;

export function VerdictMark({ kind }: { readonly kind: Verdict["kind"] }) {
  const mark = MARKS[kind];
  return (
    <span className={`verdict ${mark.className}`}>
      <span aria-hidden="true">{mark.glyph}</span>
      {mark.label}
    </span>
  );
}

export function verdictLabel(kind: Verdict["kind"]): string {
  return MARKS[kind].label;
}

/** The sentences behind a definite verdict, or the facts missing behind an open one. */
export function VerdictReasons({ verdict }: { readonly verdict: Verdict }) {
  const lines =
    verdict.kind === "undetermined"
      ? verdict.missing.map((fact) => `${missingLabel(fact.kind)}: ${fact.detail}`)
      : verdict.because;
  return (
    <ul className="reason">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}
