/**
 * Does this directive apply to this aircraft?
 *
 * Verdicts compose under Kleene's strong three-valued logic, so an unknown fact
 * can only widen an answer to undetermined and never flip a definite verdict.
 * Treating undetermined as false would report aircraft as out of scope when the
 * truth is that nobody knows. Totality is a compile-time guarantee: the switch
 * is exhaustive and ends in a `never` assignment.
 */
import type { Aircraft } from "../domain/aircraft";
import { manufacturerMatches, modelMatches } from "../domain/aircraft";
import type { ApplicabilityNode, MissingFactKind } from "./ast";
import { compareSerial } from "./serial";

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
 * One definite refutation settles the expression: no unknown elsewhere can
 * bring the aircraft back into scope. This short-circuit is why only 0.6% of
 * decisions end up undetermined while 35% of clauses defer.
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
 * `base` minus `exclusion`. An unverifiable exclusion leaves the aircraft
 * undetermined rather than in scope, which puts it in front of an engineer
 * instead of silently clearing or condemning it.
 */
export function exclude(base: Verdict, exclusion: Verdict): Verdict {
  if (base.kind === "does_not_apply") return base;
  if (exclusion.kind === "applies") {
    return doesNotApply(`istisna kapsamında: ${exclusion.because.join("; ")}`);
  }
  if (base.kind === "undetermined" || exclusion.kind === "undetermined") {
    return undetermined(...missingFacts([base, exclusion]));
  }
  return applies(...base.because, `istisna dışında: ${exclusion.because.join("; ")}`);
}

export function evaluate(node: ApplicabilityNode, aircraft: Aircraft): Verdict {
  switch (node.kind) {
    case "all":
      return applies("madde başka bir kısıt getirmiyor");

    case "models": {
      if (node.manufacturer && !manufacturerMatches(node.manufacturer, aircraft.manufacturer)) {
        return doesNotApply(
          `üretici ${aircraft.manufacturer}, ${node.manufacturer} değil`,
        );
      }
      const matched = node.models.find((m) => modelMatches(m, aircraft.model));
      if (!matched) {
        return doesNotApply(
          `${aircraft.model} modeli şunlar arasında değil: ${node.models.join(", ")}`,
        );
      }
      return applies(`${matched} modeli maddede adı geçiyor`);
    }

    case "manufacturer": {
      if (!manufacturerMatches(node.name, aircraft.manufacturer)) {
        return doesNotApply(`üretici ${aircraft.manufacturer}, ${node.name} değil`);
      }
      // The manufacturer matches but the clause named no model, so this node
      // alone cannot confirm scope. It narrows; it does not decide.
      return applies(`üretici ${node.name} ile eşleşiyor`);
    }

    case "serial_range": {
      const low = compareSerial(aircraft.serialNumber, node.from);
      const high = compareSerial(aircraft.serialNumber, node.to);
      if (low === null || high === null) {
        return undetermined({
          kind: "modification_state",
          detail: `${aircraft.serialNumber} seri numarası ${node.from}-${node.to} aralığıyla karşılaştırılamıyor`,
        });
      }
      const withinLow = low >= 0;
      const withinHigh = node.inclusive ? high <= 0 : high < 0;
      if (withinLow && withinHigh) {
        return applies(
          `${aircraft.serialNumber} seri numarası ${node.from}-${node.to} aralığında`,
        );
      }
      return doesNotApply(
        `${aircraft.serialNumber} seri numarası ${node.from}-${node.to} aralığı dışında`,
      );
    }

    case "serial_bound": {
      const comparison = compareSerial(aircraft.serialNumber, node.bound);
      if (comparison === null) {
        return undetermined({
          kind: "modification_state",
          detail: `${aircraft.serialNumber} seri numarası ${node.bound} ile karşılaştırılamıyor`,
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
      const wording = `${node.bound} ${node.direction === "up_to" ? "ve öncesi" : "ve sonrası"}`;
      return inScope
        ? applies(`${aircraft.serialNumber} seri numarası ${wording} aralığında`)
        : doesNotApply(`${aircraft.serialNumber} seri numarası ${wording} aralığında değil`);
    }

    case "serial_list": {
      const listed = node.serials.some(
        (s) => compareSerial(aircraft.serialNumber, s) === 0,
      );
      return listed
        ? applies(`${aircraft.serialNumber} seri numarası maddede sayılıyor`)
        : doesNotApply(`${aircraft.serialNumber} seri numarası maddede sayılmıyor`);
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
