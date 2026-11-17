/**
 * The applicability expression tree: the grammar of paragraph (c), written down.
 *
 * Every node exists because a real directive needed it. `Deferred` is the one
 * that shapes the design: a third of directives point at a service bulletin or
 * part number this engine does not hold, which is neither a parse failure nor a
 * "false", so it has to be a value in the tree.
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
 * A manufacturer with no model designation behind it, as in "Lycoming Engines
 * ... Model engines identified in table 1". Without this node the clause
 * reduced to its deferrals and every aircraft came back undetermined.
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
