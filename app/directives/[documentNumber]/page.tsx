import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assessDirective } from "../../../src/assess";
import { findDirective, fleet } from "../../../src/corpus";
import { countVerdicts } from "../../../src/domain/directive";
import type { AircraftAssessment } from "../../../src/domain/directive";
import { VerdictMark, VerdictReasons } from "../../verdict";
import { RecordRun } from "./record-run";

interface PageProps {
  readonly params: Promise<{ readonly documentNumber: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { documentNumber } = await params;
  return { title: `AD ${decodeURIComponent(documentNumber)}` };
}

function AircraftTable({
  rows,
  caption,
}: {
  readonly rows: readonly AircraftAssessment[];
  readonly caption: string;
}) {
  return (
    <div className="scroller" tabIndex={0} role="region" aria-label={caption}>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Karar</th>
            <th scope="col">Tescil</th>
            <th scope="col">Üretici</th>
            <th scope="col">Model</th>
            <th scope="col">Seri No</th>
            <th scope="col">Gerekçe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ aircraft, verdict }) => (
            <tr key={aircraft.nNumber}>
              <td>
                <VerdictMark kind={verdict.kind} />
              </td>
              <td className="mono">{aircraft.nNumber}</td>
              <td>{aircraft.manufacturer}</td>
              <td>{aircraft.model}</td>
              <td className="mono">{aircraft.serialNumber}</td>
              <td>
                <VerdictReasons verdict={verdict} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DirectivePage({ params }: PageProps) {
  const { documentNumber } = await params;
  const directive = findDirective(decodeURIComponent(documentNumber));
  if (!directive) notFound();

  const assessment = assessDirective(directive, fleet.aircraft);
  const counts = countVerdicts(assessment);

  // In scope first, undetermined next: that is the order someone works down.
  const needsAttention = assessment.assessments
    .filter(({ verdict }) => verdict.kind !== "does_not_apply")
    .sort((a, b) => (a.verdict.kind === b.verdict.kind ? 0 : a.verdict.kind === "applies" ? -1 : 1));
  const cleared = assessment.assessments.filter(
    ({ verdict }) => verdict.kind === "does_not_apply",
  );

  return (
    <div className="stack">
      <h1 className="mono">AD {directive.documentNumber}</h1>
      <p className="prose">{directive.title}</p>
      <p className="muted">
        Yayın {directive.publicationDate}.{" "}
        <a href={directive.sourceUrl}>Federal Register’da oku</a>
      </p>

      <h2>Paragraf (c), yayınlandığı hâliyle</h2>
      <blockquote className="clause">{directive.applicability}</blockquote>

      <h2>Parser ne anladı</h2>
      {assessment.parsed === null ? (
        <p className="notice notice-info">
          The grammar could not extract a single constraint from this clause, so no aircraft was
          evaluated against it. This directive has to be read by a person. It is counted as
          unparsed on the coverage page.
        </p>
      ) : (
        <ul className="recognized">
          {assessment.recognized.map((phrase, index) => (
            <li key={index}>{phrase}</li>
          ))}
        </ul>
      )}

      <h2>Filoya karşı</h2>
      {assessment.parsed === null ? (
        <p className="muted">
          Nothing to show: an unparsed clause produces no verdicts rather than a default one.
        </p>
      ) : (
        <>
          <ul className="counts">
            <li>
              <span className="n">{counts.applies}</span>
              kapsamda
            </li>
            <li>
              <span className="n">{counts.undetermined}</span>
              belirsiz
            </li>
            <li>
              <span className="n">{counts.doesNotApply}</span>
              kapsam dışı
            </li>
          </ul>

          {needsAttention.length === 0 ? (
            <p className="notice notice-ok">
              Bu filoda kapsamda ya da belirsiz tek bir uçak yok. {counts.doesNotApply} uçağın hepsi
              kesin olarak kapsam dışı.
            </p>
          ) : (
            <AircraftTable
              rows={needsAttention}
              caption={`Bu direktifin temize çıkarmadığı ${needsAttention.length} uçak`}
            />
          )}

          {/* Collapsed, because nobody acts on a cleared aircraft. Present,
              because the reasoning for clearing one is what an audit asks for. */}
          {cleared.length > 0 && (
            <details>
              <summary>Kapsam dışı kalan {cleared.length} uçağı göster</summary>
              <AircraftTable rows={cleared} caption={`${cleared.length} aircraft out of scope`} />
            </details>
          )}

          <h2>Kaydet</h2>
          <p className="prose muted">
            Stores this run with the parser version that produced it, so the verdicts can be
            defended later. Needs Postgres: <code>docker compose up -d</code>.
          </p>
          <RecordRun documentNumber={directive.documentNumber} />
        </>
      )}
    </div>
  );
}
