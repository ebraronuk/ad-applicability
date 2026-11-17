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
      <h1>Uçuşa elverişlilik direktifleri</h1>
      <p className="prose muted">
        FAA&apos;nın {rows.at(-1)?.publicationDate} ile {rows[0]?.publicationDate} arasında
        yayınladığı {rows.length} zorunlu teknik talimat. Birini açın: filodaki{" "}
        {fleet.aircraft.length} uçaktan hangilerini kapsadığını ve her birinde neden o kararın
        verildiğini gösterir.
      </p>
      <DirectiveSearch rows={rows} />
    </div>
  );
}
