/**
 * Parse one directive and evaluate it against a fleet.
 *
 * The parse result travels with the verdicts because a reader who cannot see
 * what the grammar understood cannot judge whether to trust the verdicts.
 */
import { evaluate } from "./applicability/evaluate";
import { parseApplicability } from "./applicability/parse";
import type { Aircraft } from "./domain/aircraft";
import type { Directive, DirectiveAssessment } from "./domain/directive";

export interface DirectiveAssessmentResult extends DirectiveAssessment {
  /** Phrases the grammar recognised, in the order it recognised them. */
  readonly recognized: readonly string[];
  /** Set only when the clause yielded no constraint at all. */
  readonly unparsed?: string;
}

export function assessDirective(
  directive: Directive,
  fleet: readonly Aircraft[],
): DirectiveAssessmentResult {
  const parse = parseApplicability(directive.applicability);
  const assessments = parse.node
    ? fleet.map((aircraft) => ({ aircraft, verdict: evaluate(parse.node!, aircraft) }))
    : [];
  return {
    directive,
    parsed: parse.node,
    recognized: parse.recognized,
    assessments,
    ...(parse.unparsed === undefined ? {} : { unparsed: parse.unparsed }),
  };
}
