import { Pool } from "pg";

/**
 * Connection comes from the environment only, read in one place, so no module
 * reaches for process.env on its own.
 */
export function connectionString(): string {
  return (
    process.env["DATABASE_URL"] ??
    "postgres://ad:ad_local_only@localhost:5432/ad_applicability"
  );
}

export function createPool(): Pool {
  return new Pool({ connectionString: connectionString(), max: 4 });
}

export async function isReachable(pool: Pool): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
