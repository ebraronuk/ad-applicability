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
  return pending ? <span className="pending">açılıyor…</span> : null;
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
      <div className="searchrow">
        <label className="visually-hidden" htmlFor="directive-search">
          Belge numarası, üretici veya başlığa göre ara
        </label>
        <input
          id="directive-search"
          className="search"
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Ara: Boeing, Airbus Helicopters, 2026-22310…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <p aria-live="polite" className="muted small count">
          {matches.length === rows.length
            ? `${rows.length} direktif`
            : `${rows.length} direktifin ${matches.length} tanesi`}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="notice notice-info">
          <strong>{query.trim()}</strong> ile eşleşen direktif yok. Bir belge numarası
          (2026-22310 gibi) ya da üretici adı deneyin.
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
