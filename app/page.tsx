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
      <h1>Airworthiness Directives</h1>
      <p className="prose muted">
        {rows.length} directives published by the FAA between {rows.at(-1)?.publicationDate} and{" "}
        {rows[0]?.publicationDate}. Open one to see which of the {fleet.aircraft.length} aircraft in
        the fleet it applies to, and why.
      </p>
      <DirectiveSearch rows={rows} />
    </div>
  );
}
