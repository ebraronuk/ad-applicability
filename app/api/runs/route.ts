import type { Pool } from "pg";
import { assessDirective } from "../../../src/assess";
import { findDirective, fleet } from "../../../src/corpus";
import { PARSER_VERSION } from "../../../src/applicability/parse";
import { affectedByRun, recordRun } from "../../../src/db/assessments";
import { createPool, isReachable } from "../../../src/db/client";

export const runtime = "nodejs";

/**
 * One pool for the process, kept on globalThis.
 *
 * The dev server re-evaluates this module on every edit, and a fresh pool per
 * reload exhausts Postgres connections within a few saves.
 */
const cache = globalThis as typeof globalThis & { adApplicabilityPool?: Pool };

function pool(): Pool {
  if (!cache.adApplicabilityPool) {
    const created = createPool();
    // An idle client dropped by a database that went away emits on the pool.
    // Unhandled, that event takes the whole server down, and a stopped
    // Postgres is an expected state in this project.
    created.on("error", (error) => {
      console.error("postgres pool error", error.message);
    });
    cache.adApplicabilityPool = created;
  }
  return cache.adApplicabilityPool;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function POST(request: Request): Promise<Response> {
  let documentNumber: unknown;
  try {
    const body: unknown = await request.json();
    documentNumber = body && typeof body === "object" ? Reflect.get(body, "documentNumber") : null;
  } catch {
    return json({ error: "Expected a JSON body with a documentNumber." }, 400);
  }
  if (typeof documentNumber !== "string") {
    return json({ error: "Expected a JSON body with a documentNumber." }, 400);
  }

  const directive = findDirective(documentNumber);
  if (!directive) {
    return json({ error: `${documentNumber} is not in the corpus.` }, 404);
  }

  const connection = pool();
  if (!(await isReachable(connection))) {
    return json(
      {
        error:
          "Postgres is not reachable, so nothing was recorded. Start it with `docker compose up -d` and try again.",
      },
      503,
    );
  }

  const assessment = assessDirective(directive, fleet.aircraft);
  try {
    const runId = await recordRun(connection, {
      directive,
      parserVersion: PARSER_VERSION,
      parsed: assessment.parsed,
      verdicts: assessment.assessments,
    });
    const affected = await affectedByRun(connection, runId);
    return json({ runId, affected: affected.length }, 201);
  } catch (error) {
    // The transaction rolled back, so there is no half-written run. Say which
    // write failed rather than returning a bare 500.
    const detail = error instanceof Error ? error.message : "unknown error";
    return json({ error: `The database rejected this run: ${detail}` }, 500);
  }
}
