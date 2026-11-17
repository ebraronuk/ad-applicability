import { byPublicationDateDescending, fleet } from "../src/corpus";
import { DirectiveSearch, type DirectiveRow } from "./directive-search";

const TITLE_PREFIX = /^Airworthiness Directives;\s*/;

export default function DirectiveListPage() {
  const rows: readonly DirectiveRow[] = byPublicationDateDescending().map((directive) => ({
    documentNumber: directive.documentNumber,
    publicationDate: directive.publicationDate,
    subject: directive.title.replace(TITLE_PREFIX, ""),
  }));

  return (
    <div className="stack">
      <section className="intro">
        <h1>Bu direktif hangi uçaklarımızı kapsıyor?</h1>
        <p>
          FAA bir <strong>uçuşa elverişlilik direktifi</strong> yayınladığında, yani bir uçak
          tipinde giderilmesi zorunlu bir emniyet sorunu tespit ettiğinde, her işletmeci ve bakım
          kuruluşu tek bir soruyu cevaplamak zorunda kalıyor: bu bizi bağlıyor mu, bağlıyorsa hangi
          kuyruklarımızı?
        </p>
        <p>
          Cevap, direktifin <strong>(c) Applicability</strong> maddesinde düzyazı olarak yazılı.
          Bugün bunu biri elle okuyup filo listesiyle karşılaştırıyor, her direktif için, sürekli.
          Bu araç o maddeyi çözümleyip filodaki her uçak için cevabı ve gerekçesini veriyor.
        </p>
        <ul className="legend">
          <li>
            <span className="verdict verdict-applies">▲ Kapsamda</span>
            <span>Madde bu uçağı kapsıyor, eşleşen ölçüt gerekçede yazılı</span>
          </li>
          <li>
            <span className="verdict verdict-clear">○ Kapsam dışı</span>
            <span>Madde bu uçağı dışarıda bırakıyor</span>
          </li>
          <li>
            <span className="verdict verdict-unknown">◆ Belirsiz</span>
            <span>
              Madde, motorun elinde olmayan bir belgeye dayanıyor. Tahmin etmek yerine neyin eksik
              olduğunu söylüyor
            </span>
          </li>
        </ul>
        <p className="muted small">
          Korpus: FAA&apos;nın {rows.at(-1)?.publicationDate} ile {rows[0]?.publicationDate}{" "}
          arasında yayınladığı {rows.length} direktif. Filo: {fleet.aircraft.length} gerçek uçak.
          İkisi de repoya işlenmiş, sayfa her açıldığında aynı sonucu veriyor.
        </p>
      </section>

      <DirectiveSearch rows={rows} />
    </div>
  );
}
