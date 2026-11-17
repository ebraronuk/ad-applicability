import type { Pool } from "pg";
import type { Aircraft } from "../domain/aircraft.js";
import type { Directive } from "../domain/directive.js";
import type { ApplicabilityNode } from "../applicability/ast.js";
import type { Verdict } from "../applicability/evaluate.js";

export interface RunInput {
  readonly directive: Directive;
  readonly parserVersion: string;
  readonly parsed: ApplicabilityNode | null;
  readonly verdicts: ReadonlyArray<{ readonly aircraft: Aircraft; readonly verdict: Verdict }>;
}

/**
 * Persist one assessment run. Written as a single transaction because a run
 * with only some of its aircraft recorded is worse than no run: it reads as a
 * complete answer.
 */
export async function recordRun(pool: Pool, input: RunInput): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { directive } = input;
    await client.query(
      `INSERT INTO directive (document_number, title, publication_date, source_url, applicability)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (document_number) DO NOTHING`,
      [
        directive.documentNumber,
        directive.title,
        directive.publicationDate,
        directive.sourceUrl,
        directive.applicability,
      ],
    );

    const run = await client.query<{ id: string }>(
      `INSERT INTO assessment_run (document_number, parser_version, parsed_clause)
       VALUES ($1, $2, $3) RETURNING id`,
      [directive.documentNumber, input.parserVersion, input.parsed ? JSON.stringify(input.parsed) : null],
    );
    const runId = Number(run.rows[0]!.id);

    for (const { aircraft, verdict } of input.verdicts) {
      await client.query(
        `INSERT INTO aircraft (registration, manufacturer, model, serial_number, type_designator)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (registration) DO NOTHING`,
        [aircraft.nNumber, aircraft.manufacturer, aircraft.model, aircraft.serialNumber, aircraft.typeDesignator ?? null],
      );
      await client.query(
        `INSERT INTO assessment (run_id, registration, verdict, reasoning, missing)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          runId,
          aircraft.nNumber,
          verdict.kind,
          verdict.kind === "undetermined" ? [] : verdict.because,
          JSON.stringify(verdict.kind === "undetermined" ? verdict.missing : []),
        ],
      );
    }
    await client.query("COMMIT");
    return runId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface AffectedRow {
  readonly registration: string;
  readonly verdict: string;
  readonly reasoning: readonly string[];
}

/** The aircraft a run did not clear, which is the only list anyone acts on. */
export async function affectedByRun(pool: Pool, runId: number): Promise<readonly AffectedRow[]> {
  const result = await pool.query<AffectedRow>(
    `SELECT registration, verdict::text, reasoning
       FROM assessment
      WHERE run_id = $1 AND verdict <> 'does_not_apply'
      ORDER BY verdict, registration`,
    [runId],
  );
  return result.rows;
}
