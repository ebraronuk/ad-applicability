/**
 * The evaluator: does this directive apply to this aircraft?
 *
 * Two properties matter more than anything else here.
 *
 * TOTALITY. Every aircraft receives exactly one of three verdicts: applies,
 * does not apply, or undetermined. Never two, never none. The switch below is
 * exhaustive over `ApplicabilityNode` and ends in a `never` check, so totality
 * is enforced by the compiler rather than hoped for by a test.
 *
 * THREE-VALUED LOGIC. "Undetermined" is not a failure path bolted on at the
 * edges, it is a value that composes. The combinators follow Kleene's strong
 * three-valued logic, which has the property that actually matters for a
 * compliance tool: an unknown fact can only ever widen the answer to
 * undetermined, it can never turn a definite yes into a definite no or the
 * reverse. A naive implementation that treated undetermined as false would
 * quietly report aircraft as out of scope when the truth is that nobody knows,
 * which in this domain is the difference between a grounded fleet and an
 * unairworthy one flying.
 */
import type { Aircraft } from "../domain/aircraft.js";
import { manufacturerMatches, modelMatches } from "../domain/aircraft.js";
import type { ApplicabilityNode, MissingFactKind } from "./ast.js";
import { compareSerial } from "./serial.js";

export interface MissingFact {
  readonly kind: MissingFactKind;
  readonly detail: string;
}

export type Verdict =
  | { readonly kind: "applies"; readonly because: readonly string[] }
  | { readonly kind: "does_not_apply"; readonly because: readonly string[] }
  | { readonly kind: "undetermined"; readonly missing: readonly MissingFact[] };

export const applies = (...because: readonly string[]): Verdict => ({ kind: "applies", because });

export const doesNotApply = (...because: readonly string[]): Verdict => ({
  kind: "does_not_apply",
  because,
});

export const undetermined = (...missing: readonly MissingFact[]): Verdict => ({
  kind: "undetermined",
  missing,
});

function missingFacts(verdicts: readonly Verdict[]): readonly MissingFact[] {
  return verdicts.flatMap((v) => (v.kind === "undetermined" ? v.missing : []));
}

function reasons(verdicts: readonly Verdict[]): readonly string[] {
  return verdicts.flatMap((v) => (v.kind === "undetermined" ? [] : v.because));
}

/**
 * Kleene conjunction. One definite "does not apply" settles the whole
 * expression, because no unknown elsewhere can bring the aircraft back into
 * scope. That short-circuit is the reason this engine resolves far more of the
 * corpus than the share of fully-parseable clauses would suggest.
 */
export function conjoin(verdicts: readonly Verdict[]): Verdict {
  const refuting = verdicts.find((v) => v.kind === "does_not_apply");
  if (refuting) return refuting;
  const unknown = missingFacts(verdicts);
  if (unknown.length > 0) return undetermined(...unknown);
  return applies(...reasons(verdicts));
}

/** Kleene disjunction: the mirror image, one definite "applies" settles it. */
export function disjoin(verdicts: readonly Verdict[]): Verdict {
  const confirming = verdicts.find((v) => v.kind === "applies");
  if (confirming) return confirming;
  const unknown = missingFacts(verdicts);
  if (unknown.length > 0) return undetermined(...unknown);
  return doesNotApply(...reasons(verdicts));
}

/**
 * `base` except `exclusion`, which is conjunction with a negation. Negating an
 * undetermined exclusion leaves it undetermined, so an aircraft inside the base
 * set whose exclusion cannot be checked is reported as undetermined rather than
 * as in scope. That is the conservative direction: it puts the aircraft in front
 * of an engineer instead of silently clearing or condemning it.
 */
export function exclude(base: Verdict, exclusion: Verdict): Verdict {
  if (base.kind === "does_not_apply") return base;
  if (exclusion.kind === "applies") {
    return doesNotApply(`excluded: ${exclusion.because.join("; ")}`);
  }
  if (base.kind === "undetermined" || exclusion.kind === "undetermined") {
    return undetermined(...missingFacts([base, exclusion]));
  }
  return applies(...base.because, `not excluded: ${exclusion.because.join("; ")}`);
}

export function evaluate(node: ApplicabilityNode, aircraft: Aircraft): Verdict {
  switch (node.kind) {
    case "all":
      return applies("clause places no further restriction");

    case "models": {
      if (node.manufacturer && !manufacturerMatches(node.manufacturer, aircraft.manufacturer)) {
        return doesNotApply(
          `manufacturer ${aircraft.manufacturer} is not ${node.manufacturer}`,
        );
      }
      const matched = node.models.find((m) => modelMatches(m, aircraft.model));
      if (!matched) {
        return doesNotApply(
          `model ${aircraft.model} is not among ${node.models.join(", ")}`,
        );
      }
      return applies(`model ${matched} is named in the clause`);
    }

    case "serial_range": {
      const low = compareSerial(aircraft.serialNumber, node.from);
      const high = compareSerial(aircraft.serialNumber, node.to);
      if (low === null || high === null) {
        return undetermined({
          kind: "modification_state",
          detail: `serial ${aircraft.serialNumber} is not comparable with the range ${node.from}-${node.to}`,
        });
      }
      const withinLow = low >= 0;
      const withinHigh = node.inclusive ? high <= 0 : high < 0;
      if (withinLow && withinHigh) {
        return applies(
          `serial ${aircraft.serialNumber} falls in ${node.from}-${node.to}`,
        );
      }
      return doesNotApply(
        `serial ${aircraft.serialNumber} is outside ${node.from}-${node.to}`,
      );
    }

    case "serial_bound": {
      const comparison = compareSerial(aircraft.serialNumber, node.bound);
      if (comparison === null) {
        return undetermined({
          kind: "modification_state",
          detail: `serial ${aircraft.serialNumber} is not comparable with ${node.bound}`,
        });
      }
      const inScope =
        node.direction === "up_to"
          ? node.inclusive
            ? comparison <= 0
            : comparison < 0
          : node.inclusive
            ? comparison >= 0
            : comparison > 0;
      const wording = `${node.direction === "up_to" ? "up to" : "from"} ${node.bound}`;
      return inScope
        ? applies(`serial ${aircraft.serialNumber} is ${wording}`)
        : doesNotApply(`serial ${aircraft.serialNumber} is not ${wording}`);
    }

    case "serial_list": {
      const listed = node.serials.some(
        (s) => compareSerial(aircraft.serialNumber, s) === 0,
      );
      return listed
        ? applies(`serial ${aircraft.serialNumber} is listed in the clause`)
        : doesNotApply(`serial ${aircraft.serialNumber} is not listed in the clause`);
    }

    case "deferred":
      return undetermined({ kind: node.missing, detail: node.detail });

    case "and":
      return conjoin(node.operands.map((o) => evaluate(o, aircraft)));

    case "or":
      return disjoin(node.operands.map((o) => evaluate(o, aircraft)));

    case "except":
      return exclude(evaluate(node.base, aircraft), evaluate(node.exclusion, aircraft));

    default: {
      // Totality, enforced at compile time: adding a node kind without handling
      // it here fails `tsc` rather than producing a fourth, undefined verdict.
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}
