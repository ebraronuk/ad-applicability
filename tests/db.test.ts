import { afterAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createPool, isReachable } from "../src/db/client.js";
import { affectedByRun, recordRun } from "../src/db/assessments.js";
import { parseApplicability } from "../src/applicability/parse.js";
import { evaluate } from "../src/applicability/evaluate.js";
import type { Aircraft } from "../src/domain/aircraft.js";
import type { Directive } from "../src/domain/directive.js";

// Reachability is resolved at module scope, with top-level await, because
// `describe.skipIf` is evaluated during collection: a flag set in `beforeAll`
// is still false by then and every case here silently skipped while reporting
// green. A test that skips quietly is worse than one that fails.
const pool: Pool = createPool();
const available = await isReachable(pool);

afterAll(async () => {
  await pool.end();
});

// Skipped rather than failed without a database, so `npm test` passes on a
// clean clone. `docker compose up -d` enables these.
const withDb = describe.skipIf(!available);

const directive: Directive = {
  documentNumber: "TEST-0001",
  title: "Airworthiness Directives; Test Manufacturer Airplanes",
  publicationDate: "2026-11-17",
  sourceUrl: "https://www.federalregister.gov/documents/test",
  applicability:
    "This AD applies to The Boeing Company Model 717-200 airplanes, certificated in any category.",
};

const fleet: readonly Aircraft[] = [
  { nNumber: "N798BC", manufacturer: "BOEING", model: "717-200", serialNumber: "55169" },
  { nNumber: "N628AC", manufacturer: "AIRBUS", model: "A330-243", serialNumber: "1191" },
];

withDb("assessment records", () => {
  it("stores a run and returns only the aircraft it did not clear", async () => {
    const parsed = parseApplicability(directive.applicability);
    const runId = await recordRun(pool, {
      directive,
      parserVersion: "0.1.0",
      parsed: parsed.node,
      verdicts: fleet.map((aircraft) => ({
        aircraft,
        verdict: evaluate(parsed.node!, aircraft),
      })),
    });

    const affected = await affectedByRun(pool, runId);
    expect(affected).toHaveLength(1);
    expect(affected[0]?.registration).toBe("N798BC");
    expect(affected[0]?.verdict).toBe("applies");
    expect(affected[0]?.reasoning.join(" ")).toContain("717-200");
  });

  it("refuses a definite verdict with no reasoning", async () => {
    // The schema, not the application, is what makes an unexplainable verdict
    // impossible to store. Asserted here so the constraint is covered by the
    // suite rather than by having been checked once by hand.
    await expect(
      pool.query(
        `INSERT INTO assessment (run_id, registration, verdict, reasoning, missing)
         SELECT max(id), 'N798BC', 'applies', '{}', '[]' FROM assessment_run`,
      ),
    ).rejects.toThrow(/definite_verdict_has_reasoning/);
  });

  it("refuses an undetermined verdict that does not name what is missing", async () => {
    await expect(
      pool.query(
        `INSERT INTO assessment (run_id, registration, verdict, reasoning, missing)
         SELECT max(id), 'N628AC', 'undetermined', '{}', '[]' FROM assessment_run`,
      ),
    ).rejects.toThrow(/undetermined_names_what_is_missing/);
  });

  it("rejects a malformed registration at the database boundary", async () => {
    await expect(
      pool.query(`INSERT INTO aircraft VALUES ('n798bc', 'BOEING', '717-200', '1', NULL)`),
    ).rejects.toThrow(/aircraft_registration_check/);
  });
});
