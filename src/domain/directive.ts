/**
 * An Airworthiness Directive, and the result of assessing one against a fleet.
 *
 * Every assessment carries the directive's own identifier and source URL. A
 * fleet engineer cannot act on "this aircraft is affected" without being able
 * to open the regulation and read the clause, so an unsourced verdict is not a
 * useful output and the types here make one impossible to construct.
 */
import type { Aircraft } from "./aircraft.js";
import type { ApplicabilityNode } from "../applicability/ast.js";
import type { Verdict } from "../applicability/evaluate.js";

export interface Directive {
  /** Federal Register document number, e.g. "2026-22817". */
  readonly documentNumber: string;
  readonly title: string;
  /** ISO date, as published. */
  readonly publicationDate: string;
  readonly sourceUrl: string;
  /** Paragraph (c) verbatim. Kept so a verdict can always be traced to the wording. */
  readonly applicability: string;
}

export interface AircraftAssessment {
  readonly aircraft: Aircraft;
  readonly verdict: Verdict;
}

export interface DirectiveAssessment {
  readonly directive: Directive;
  /** The parsed clause, or null when the grammar could not parse it at all. */
  readonly parsed: ApplicabilityNode | null;
  readonly assessments: readonly AircraftAssessment[];
}

export interface AssessmentCounts {
  readonly applies: number;
  readonly doesNotApply: number;
  readonly undetermined: number;
}

export function countVerdicts(assessment: DirectiveAssessment): AssessmentCounts {
  let appliesCount = 0;
  let doesNotApplyCount = 0;
  let undeterminedCount = 0;
  for (const { verdict } of assessment.assessments) {
    if (verdict.kind === "applies") appliesCount += 1;
    else if (verdict.kind === "does_not_apply") doesNotApplyCount += 1;
    else undeterminedCount += 1;
  }
  return {
    applies: appliesCount,
    doesNotApply: doesNotApplyCount,
    undetermined: undeterminedCount,
  };
}
