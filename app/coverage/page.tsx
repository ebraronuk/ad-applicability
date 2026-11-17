import Link from "next/link";
import { directives } from "../../src/corpus";
import { summarizeCoverage } from "../../src/coverage";
import { missingLabel } from "../labels";

const KIND_WORDING: Record<string, string> = {
  service_bulletin: "üretici servis bülteni ya da yabancı bir otoritenin direktifi",
  installed_part: "uçağa takılı bir parça numarası",
  referenced_table: "direktifin içinde basılı bir tablo",
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
      <h1>Parser kapsaması</h1>
      <p className="prose muted">
        Bu sayfada, repoya işlenmiş korpustaki {coverage.total} direktif üzerinden, siz sayfayı
        açtığınız anda ölçüldü. Buradaki hiçbir sayı kayıtlı değil.
      </p>

      <ul className="counts">
        <li>
          <span className="n">{coverage.parsed}</span>
          çözümlendi, {share(coverage.parsed)}
        </li>
        <li>
          <span className="n">{coverage.fullyResolvable}</span>
          tam çözülebilir, {share(coverage.fullyResolvable)}
        </li>
        <li>
          <span className="n">{coverage.deferred}</span>
          devredildi, {share(coverage.deferred)}
        </li>
        <li>
          <span className="n">{coverage.unparsed.length}</span>
          çözümlenemedi, {share(coverage.unparsed.length)}
        </li>
      </ul>

      <h2>Motorun elinde olmayan bilgiye devredilenler</h2>
      <p className="prose muted">
        Devir, çözümleme hatası değil. Madde anlaşıldı; ama hiçbir sicil kaydının taşımadığı bir
        belgeye işaret ediyor, bu yüzden kapsadığı uçaklar tahmin edilmek yerine belirsiz
        kalıyor. Devir başına sayılıyor, iki kez devreden bir madde iki kez görünüyor.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th scope="col">Tür</th>
              <th scope="col">Eksik olan</th>
              <th scope="col">Devir</th>
            </tr>
          </thead>
          <tbody>
            {coverage.deferralsByKind.map(({ kind, count }) => (
              <tr key={kind}>
                <td className="mono">{missingLabel(kind)}</td>
                <td>{KIND_WORDING[kind] ?? kind}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Çözümlenemeyen maddeler</h2>
      {coverage.unparsed.length === 0 ? (
        <p className="notice notice-ok">Dilbilgisi her maddeden bir kısıt çıkarabildi.</p>
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
