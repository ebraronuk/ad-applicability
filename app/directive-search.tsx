"use client";

import { useMemo, useState } from "react";
import Link, { useLinkStatus } from "next/link";

export interface DirectiveRow {
  readonly documentNumber: string;
  readonly publicationDate: string;
  /** The title with the "Airworthiness Directives;" prefix dropped: manufacturer and category. */
  readonly subject: string;
}

/**
 * The wait after a click, named where it happens.
 *
 * The detail page assesses 400 aircraft on the server, so there is a pause
 * before it replaces this one. A full-page skeleton would hide a list the
 * reader is still using; a mark on the row they clicked does not.
 */
function Opening() {
  const { pending } = useLinkStatus();
  return pending ? <span className="pending">opening…</span> : null;
}

/**
 * Filtering runs in the browser because the whole corpus is 196 rows.
 *
 * A round trip per keystroke would be slower and would need a loading state
 * for something that is already in memory.
 */
export function DirectiveSearch({ rows }: { readonly rows: readonly DirectiveRow[] }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.documentNumber.toLowerCase().includes(needle) ||
        row.subject.toLowerCase().includes(needle),
    );
  }, [query, rows]);

  return (
    <>
      <label className="search" htmlFor="directive-search">
        <span>Belge numarası, üretici veya başlığa göre ara</span>
        <input
          id="directive-search"
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Boeing, 2026-22310, helicopters"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <p aria-live="polite" className="muted">
        {matches.length} of {rows.length} directives
      </p>

      {matches.length === 0 ? (
        <p className="notice notice-info">
          No directive matches <strong>{query.trim()}</strong>. Try a document number such as
          2026-22310, or a manufacturer name.
        </p>
      ) : (
        <div className="scroller" tabIndex={0} role="region" aria-label="Direktifler">
          <table>
            <thead>
              <tr>
                <th scope="col">Yayın</th>
                <th scope="col">Belge</th>
                <th scope="col">Konu</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((row) => (
                <tr key={row.documentNumber}>
                  <td>{row.publicationDate}</td>
                  <td className="mono">
                    <Link href={`/directives/${row.documentNumber}`}>
                      {row.documentNumber}
                      <Opening />
                    </Link>
                  </td>
                  <td>{row.subject}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
