import Link from "next/link";
import { directives } from "../../src/corpus";
import { summarizeCoverage } from "../../src/coverage";

const KIND_WORDING: Record<string, string> = {
  service_bulletin: "a manufacturer service bulletin or a foreign authority's directive",
  installed_part: "a part number installed on the aircraft",
  referenced_table: "a table printed inside the directive",
  referenced_paragraph: "another paragraph of the directive",
  modification_state: "whether a modification has been carried out",
};

export default function CoveragePage() {
  // Measured here rather than read from docs/coverage.md: a page that quotes a
  // generated file can show a figure the current grammar no longer produces.
  const coverage = summarizeCoverage(directives);
  const share = (n: number): string => `${((100 * n) / coverage.total).toFixed(1)}%`;

  return (
    <div className="stack">
      <h1>Parser coverage</h1>
      <p className="prose muted">
        Measured on this page from the {coverage.total} directives in the committed corpus, at the
        moment you loaded it. Nothing here is a stored number.
      </p>

      <ul className="counts">
        <li>
          <span className="n">{coverage.parsed}</span>
          parsed, {share(coverage.parsed)}
        </li>
        <li>
          <span className="n">{coverage.fullyResolvable}</span>
          fully resolvable, {share(coverage.fullyResolvable)}
        </li>
        <li>
          <span className="n">{coverage.deferred}</span>
          deferred, {share(coverage.deferred)}
        </li>
        <li>
          <span className="n">{coverage.unparsed.length}</span>
          unparsed, {share(coverage.unparsed.length)}
        </li>
      </ul>

      <h2>Deferred to a fact the engine does not hold</h2>
      <p className="prose muted">
        A deferral is not a parse failure. The clause was understood; it points at a document no
        registry carries, so the aircraft it names stay undetermined rather than being guessed
        either way. Counted per deferral, so a clause that defers twice appears twice.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th scope="col">Kind</th>
              <th scope="col">What is missing</th>
              <th scope="col">Deferrals</th>
            </tr>
          </thead>
          <tbody>
            {coverage.deferralsByKind.map(({ kind, count }) => (
              <tr key={kind}>
                <td className="mono">{kind.replace(/_/g, " ")}</td>
                <td>{KIND_WORDING[kind] ?? kind}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Unparsed clauses</h2>
      {coverage.unparsed.length === 0 ? (
        <p className="notice notice-ok">The grammar extracted a constraint from every clause.</p>
      ) : (
        <ul>
          {coverage.unparsed.map((documentNumber) => (
            <li key={documentNumber} className="mono">
              <Link href={`/directives/${documentNumber}`}>{documentNumber}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
