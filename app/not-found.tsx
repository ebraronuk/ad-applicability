import Link from "next/link";
import { directives } from "../src/corpus";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Böyle bir direktif yok</h1>
      <p className="notice notice-info">
        The committed corpus holds {directives.length} directives. A document number outside it
        cannot be assessed, because the engine never guesses at a clause it does not have.
      </p>
      <p>
        <Link href="/">Direktif listesine dön</Link>
      </p>
    </div>
  );
}
