/**
 * The applicability expression tree.
 *
 * An Airworthiness Directive scopes itself in one clause of prose, paragraph
 * (c). That prose is not free-form: across the corpus in `data/corpus/ads.json`
 * it decomposes into a small number of shapes, and this file is that grammar
 * written down. Every node here was added because a real AD needed it, and
 * `docs/applicability-patterns.md` records which document first motivated each.
 *
 * The important design choice is the `Deferred` node. Roughly a third of real
 * ADs do not state their own applicability: they point at a manufacturer
 * service bulletin, an installed part number, or a table this engine does not
 * have. Those are not parse failures and they are not "false" either. Treating
 * them as a node in the tree is what lets the evaluator stay total and answer
 * "undetermined, and here is the fact I am missing" rather than guessing.
 */

/** What the directive calls the thing it applies to. */
export type AircraftCategory = "airplanes" | "helicopters" | "engines" | "propellers";

/** A fact the engine does not hold, and therefore cannot resolve. */
export type MissingFactKind =
  | "service_bulletin"
  | "installed_part"
  | "referenced_table"
  | "referenced_paragraph"
  | "modification_state";

export interface ModelsNode {
  readonly kind: "models";
  /** As written, e.g. "The Boeing Company". Absent when the text names only models. */
  readonly manufacturer?: string;
  /** Model designations exactly as the directive writes them, e.g. ["787-8", "787-9"]. */
  readonly models: readonly string[];
  readonly category: AircraftCategory;
}

/**
 * A serial-number constraint.
 *
 * Serials are compared as strings, not numbers, and that is deliberate: real
 * designations include "29000", "0001-0450", "S-123" and "MSN 41925". A numeric
 * parse silently reorders anything non-decimal, so comparison is delegated to a
 * per-manufacturer scheme in `serial.ts` and anything unrecognised resolves to
 * undetermined instead of to a wrong answer.
 */
export interface SerialRangeNode {
  readonly kind: "serial_range";
  readonly from: string;
  readonly to: string;
  /** "through X inclusive" versus "up to but not including X". */
  readonly inclusive: boolean;
}

export interface SerialBoundNode {
  readonly kind: "serial_bound";
  readonly direction: "up_to" | "from";
  readonly bound: string;
  readonly inclusive: boolean;
}

export interface SerialListNode {
  readonly kind: "serial_list";
  readonly serials: readonly string[];
}

/**
 * A manufacturer with no model designation behind it.
 *
 * Needed because some clauses name a manufacturer and then hand the model set
 * to a table: "Lycoming Engines (Lycoming) Model engines identified in table 1
 * ...". Without this node the whole clause reduced to its deferrals, so every
 * aircraft came back undetermined even though a Boeing is obviously not a
 * Lycoming engine. Keeping the manufacturer lets the Kleene short-circuit do
 * its job and settle those aircraft definitively.
 */
export interface ManufacturerNode {
  readonly kind: "manufacturer";
  readonly name: string;
  readonly category?: AircraftCategory;
}

/** Applies to every aircraft the rest of the expression admits, with no further narrowing. */
export interface AllNode {
  readonly kind: "all";
}

/** A fact the engine cannot resolve from a registry record alone. */
export interface DeferredNode {
  readonly kind: "deferred";
  readonly missing: MissingFactKind;
  /** The phrase from the directive that caused the deferral, for the explanation trail. */
  readonly detail: string;
}

export interface AndNode {
  readonly kind: "and";
  readonly operands: readonly ApplicabilityNode[];
}

export interface OrNode {
  readonly kind: "or";
  readonly operands: readonly ApplicabilityNode[];
}

/** `base` narrowed by removing everything `exclusion` admits: the "except" clause. */
export interface ExceptNode {
  readonly kind: "except";
  readonly base: ApplicabilityNode;
  readonly exclusion: ApplicabilityNode;
}

export type ApplicabilityNode =
  | ModelsNode
  | ManufacturerNode
  | SerialRangeNode
  | SerialBoundNode
  | SerialListNode
  | AllNode
  | DeferredNode
  | AndNode
  | OrNode
  | ExceptNode;

export function and(...operands: readonly ApplicabilityNode[]): ApplicabilityNode {
  const flattened = operands.flatMap((o) => (o.kind === "and" ? o.operands : [o]));
  const significant = flattened.filter((o) => o.kind !== "all");
  if (significant.length === 0) return { kind: "all" };
  if (significant.length === 1) return significant[0]!;
  return { kind: "and", operands: significant };
}

export function or(...operands: readonly ApplicabilityNode[]): ApplicabilityNode {
  const flattened = operands.flatMap((o) => (o.kind === "or" ? o.operands : [o]));
  if (flattened.length === 0) return { kind: "all" };
  if (flattened.length === 1) return flattened[0]!;
  return { kind: "or", operands: flattened };
}

export function except(
  base: ApplicabilityNode,
  exclusion: ApplicabilityNode,
): ApplicabilityNode {
  return { kind: "except", base, exclusion };
}

/** Every `Deferred` node in the tree, for reporting why an AD could not be resolved. */
export function deferrals(node: ApplicabilityNode): readonly DeferredNode[] {
  switch (node.kind) {
    case "deferred":
      return [node];
    case "and":
    case "or":
      return node.operands.flatMap(deferrals);
    case "except":
      return [...deferrals(node.base), ...deferrals(node.exclusion)];
    case "models":
    case "manufacturer":
    case "serial_range":
    case "serial_bound":
    case "serial_list":
    case "all":
      return [];
  }
}
