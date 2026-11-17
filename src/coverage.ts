/**
 * How much of a corpus the grammar actually resolves.
 *
 * One implementation, used by both the coverage test (which writes
 * docs/coverage.md and holds the ratchet) and the coverage page. Counting it
 * twice would let the published figures drift apart from the measured ones.
 */
import type { MissingFactKind } from "./applicability/ast";
import { deferrals } from "./applicability/ast";
import { parseApplicability } from "./applicability/parse";

/** Only the fields coverage needs, so the corpus JSON and `Directive` both fit. */
export interface CoverageInput {
  readonly documentNumber: string;
  readonly applicability: string;
}

export interface DeferralTally {
  readonly kind: MissingFactKind;
  /** Deferral nodes, not directives: one clause can defer more than once. */
  readonly count: number;
}

export interface CoverageSummary {
  readonly total: number;
  readonly parsed: number;
  readonly fullyResolvable: number;
  /** Parsed, but resting on at least one fact the engine does not hold. */
  readonly deferred: number;
  readonly deferralsByKind: readonly DeferralTally[];
  /** Document numbers the grammar could not extract anything from. */
  readonly unparsed: readonly string[];
}

export function summarizeCoverage(corpus: readonly CoverageInput[]): CoverageSummary {
  let parsed = 0;
  let fullyResolvable = 0;
  const counts = new Map<MissingFactKind, number>();
  const unparsed: string[] = [];

  for (const directive of corpus) {
    const result = parseApplicability(directive.applicability);
    if (!result.node) {
      unparsed.push(directive.documentNumber);
      continue;
    }
    parsed += 1;
    const missing = deferrals(result.node);
    if (missing.length === 0) {
      fullyResolvable += 1;
      continue;
    }
    for (const deferral of missing) {
      counts.set(deferral.missing, (counts.get(deferral.missing) ?? 0) + 1);
    }
  }

  return {
    total: corpus.length,
    parsed,
    fullyResolvable,
    deferred: parsed - fullyResolvable,
    deferralsByKind: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => ({ kind, count })),
    unparsed,
  };
}
