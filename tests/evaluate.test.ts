import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Aircraft } from "../src/domain/aircraft.js";
import type { ApplicabilityNode } from "../src/applicability/ast.js";
import { and, deferrals, except, or } from "../src/applicability/ast.js";
import { evaluate } from "../src/applicability/evaluate.js";
import { compareSerial } from "../src/applicability/serial.js";

const boeing787: Aircraft = {
  nNumber: "12345",
  manufacturer: "BOEING",
  model: "787-9",
  serialNumber: "41925",
};

describe("compareSerial", () => {
  it("orders plain decimal serials numerically, not lexically", () => {
    // "9" > "10" lexically, which is the bug this function exists to avoid.
    expect(compareSerial("9", "10")).toBe(-1);
    expect(compareSerial("41925", "41925")).toBe(0);
    expect(compareSerial("30500", "29000")).toBe(1);
  });

  it("ignores leading zeros in the value while keeping the comparison defined", () => {
    expect(compareSerial("0450", "450")).toBe(0);
  });

  it("compares serials that share a prefix", () => {
    expect(compareSerial("S-100", "S-200")).toBe(-1);
    expect(compareSerial("MSN 41925", "MSN41925")).toBe(0);
  });

  it("refuses to compare serials from different prefix blocks", () => {
    // "S-100" and "T-100" have no defined order. Returning 0 or -1 here would
    // let a directive about one block silently capture the other.
    expect(compareSerial("S-100", "T-100")).toBeNull();
  });

  it("refuses to compare shapes it does not understand", () => {
    expect(compareSerial("41925A", "41925")).toBeNull();
    expect(compareSerial("", "1")).toBeNull();
  });
});

describe("evaluate: single clauses", () => {
  it("applies when the manufacturer and model are named", () => {
    const node: ApplicabilityNode = {
      kind: "models",
      manufacturer: "The Boeing Company",
      models: ["787-8", "787-9", "787-10"],
      category: "airplanes",
    };
    const verdict = evaluate(node, boeing787);
    expect(verdict.kind).toBe("applies");
  });

  it("does not apply when the model is not named", () => {
    const node: ApplicabilityNode = {
      kind: "models",
      manufacturer: "The Boeing Company",
      models: ["737-800"],
      category: "airplanes",
    };
    expect(evaluate(node, boeing787).kind).toBe("does_not_apply");
  });

  it("is undetermined when the clause defers to a service bulletin", () => {
    const verdict = evaluate(
      { kind: "deferred", missing: "service_bulletin", detail: "Boeing ARB B787-81205" },
      boeing787,
    );
    expect(verdict.kind).toBe("undetermined");
    if (verdict.kind === "undetermined") {
      expect(verdict.missing[0]?.kind).toBe("service_bulletin");
    }
  });

  it("reports an incomparable serial as undetermined rather than out of scope", () => {
    const verdict = evaluate(
      { kind: "serial_range", from: "S-100", to: "S-200", inclusive: true },
      boeing787,
    );
    expect(verdict.kind).toBe("undetermined");
  });
});

describe("evaluate: three-valued composition", () => {
  const modelMatches: ApplicabilityNode = {
    kind: "models",
    manufacturer: "The Boeing Company",
    models: ["787-9"],
    category: "airplanes",
  };
  const modelDoesNotMatch: ApplicabilityNode = {
    kind: "models",
    manufacturer: "The Boeing Company",
    models: ["737-800"],
    category: "airplanes",
  };
  const unknown: ApplicabilityNode = {
    kind: "deferred",
    missing: "installed_part",
    detail: "part number LW-13445",
  };

  it("a definite refutation settles a conjunction even with an unknown present", () => {
    // This short-circuit is why the engine resolves more of the corpus than the
    // share of fully parseable clauses: an aircraft of the wrong model is out
    // of scope no matter what the unresolvable part condition says.
    expect(evaluate(and(modelDoesNotMatch, unknown), boeing787).kind).toBe("does_not_apply");
  });

  it("a match plus an unknown is undetermined, never a bare yes", () => {
    expect(evaluate(and(modelMatches, unknown), boeing787).kind).toBe("undetermined");
  });

  it("a definite confirmation settles a disjunction", () => {
    expect(evaluate(or(modelMatches, unknown), boeing787).kind).toBe("applies");
  });

  it("an unresolvable exception leaves an in-scope aircraft undetermined", () => {
    // The conservative direction: the aircraft goes in front of an engineer
    // rather than being silently cleared or silently condemned.
    expect(evaluate(except(modelMatches, unknown), boeing787).kind).toBe("undetermined");
  });

  it("a satisfied exception removes the aircraft from scope", () => {
    expect(evaluate(except(modelMatches, modelMatches), boeing787).kind).toBe("does_not_apply");
  });
});

/* ---------------------------------------------------------------------------
 * Property-based invariants.
 *
 * These are the tests worth having. The unit tests above check cases I thought
 * of; these check the two properties the whole design rests on, over trees I
 * did not think of.
 * ------------------------------------------------------------------------- */

const arbAircraft: fc.Arbitrary<Aircraft> = fc.record({
  nNumber: fc.stringMatching(/^[0-9]{3,5}$/),
  manufacturer: fc.constantFrom("BOEING", "AIRBUS", "BELL", "LYCOMING"),
  model: fc.constantFrom("787-9", "737-800", "A330-243", "429", "IO-540"),
  serialNumber: fc.oneof(
    fc.stringMatching(/^[0-9]{4,5}$/),
    fc.constantFrom("S-100", "T-100", "41925A", "MSN 41925"),
  ),
});

const arbLeaf: fc.Arbitrary<ApplicabilityNode> = fc.oneof(
  fc.constant<ApplicabilityNode>({ kind: "all" }),
  fc.record({
    kind: fc.constant<"models">("models"),
    manufacturer: fc.constantFrom("The Boeing Company", "Airbus SAS", "Bell Textron"),
    models: fc.uniqueArray(fc.constantFrom("787-9", "737-800", "A330-243", "429"), {
      minLength: 1,
      maxLength: 3,
    }),
    category: fc.constantFrom<"airplanes" | "helicopters">("airplanes", "helicopters"),
  }),
  fc.record({
    kind: fc.constant<"serial_range">("serial_range"),
    from: fc.constantFrom("29000", "0450", "S-100"),
    to: fc.constantFrom("30500", "41925", "S-200"),
    inclusive: fc.boolean(),
  }),
  fc.record({
    kind: fc.constant<"serial_list">("serial_list"),
    serials: fc.uniqueArray(fc.constantFrom("41925", "29000", "S-100"), { minLength: 1, maxLength: 3 }),
  }),
  fc.record({
    kind: fc.constant<"deferred">("deferred"),
    missing: fc.constantFrom<"service_bulletin" | "installed_part" | "referenced_table">(
      "service_bulletin",
      "installed_part",
      "referenced_table",
    ),
    detail: fc.constant("unresolvable fact"),
  }),
);

const arbNode: fc.Arbitrary<ApplicabilityNode> = fc.letrec<{ node: ApplicabilityNode }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    arbLeaf,
    fc.tuple(tie("node"), tie("node")).map(([a, b]) => and(a, b)),
    fc.tuple(tie("node"), tie("node")).map(([a, b]) => or(a, b)),
    fc.tuple(tie("node"), tie("node")).map(([a, b]) => except(a, b)),
  ),
})).node;

/** Replace every deferred node with a concrete one, simulating the fact becoming known. */
function resolveDeferrals(node: ApplicabilityNode, resolution: ApplicabilityNode): ApplicabilityNode {
  switch (node.kind) {
    case "deferred":
      return resolution;
    case "and":
      return and(...node.operands.map((o) => resolveDeferrals(o, resolution)));
    case "or":
      return or(...node.operands.map((o) => resolveDeferrals(o, resolution)));
    case "except":
      return except(
        resolveDeferrals(node.base, resolution),
        resolveDeferrals(node.exclusion, resolution),
      );
    default:
      return node;
  }
}

describe("invariants", () => {
  it("is total: every aircraft gets exactly one of three verdicts", () => {
    fc.assert(
      fc.property(arbNode, arbAircraft, (node, aircraft) => {
        const verdict = evaluate(node, aircraft);
        expect(["applies", "does_not_apply", "undetermined"]).toContain(verdict.kind);
      }),
      { numRuns: 500 },
    );
  });

  it("is monotonic: resolving an unknown never flips a definite verdict", () => {
    // The property that matters most. If this fails, the engine can report an
    // aircraft as out of scope and then, once the missing fact arrives, as in
    // scope, which is the exact failure a compliance tool must not have.
    fc.assert(
      fc.property(
        arbNode,
        arbAircraft,
        fc.constantFrom<ApplicabilityNode>({ kind: "all" }, {
          kind: "models",
          manufacturer: "Nonexistent Manufacturer",
          models: ["NO-SUCH-MODEL"],
          category: "airplanes",
        }),
        (node, aircraft, resolution) => {
          const before = evaluate(node, aircraft);
          if (before.kind === "undetermined") return; // may sharpen either way
          const after = evaluate(resolveDeferrals(node, resolution), aircraft);
          expect(after.kind).toBe(before.kind);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("gives a definite verdict whenever the clause holds no deferred facts", () => {
    fc.assert(
      fc.property(arbNode, arbAircraft, (node, aircraft) => {
        if (deferrals(node).length > 0) return;
        const verdict = evaluate(node, aircraft);
        // A serial we cannot order is the one other source of uncertainty, so
        // it is excluded rather than asserted away.
        if (verdict.kind === "undetermined") {
          expect(verdict.missing.every((m) => m.kind === "modification_state")).toBe(true);
          return;
        }
        expect(["applies", "does_not_apply"]).toContain(verdict.kind);
      }),
      { numRuns: 500 },
    );
  });

  it("conjunction is order independent", () => {
    fc.assert(
      fc.property(arbNode, arbNode, arbAircraft, (a, b, aircraft) => {
        expect(evaluate(and(a, b), aircraft).kind).toBe(evaluate(and(b, a), aircraft).kind);
      }),
      { numRuns: 300 },
    );
  });
});
