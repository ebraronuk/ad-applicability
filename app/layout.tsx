import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { fleet } from "../src/corpus";
import "./globals.css";

export const metadata: Metadata = {
  title: "Direktif Kapsam Kontrolü",
  description: "Which aircraft an Airworthiness Directive applies to, and why.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <div className="shell">
            <strong>Direktif Kapsam Kontrolü</strong>
            <span className="tagline">
              Bir direktif hangi uçaklarımızı kapsıyor, ve neden?
            </span>
            <nav aria-label="Bölümler">
              <Link href="/">Direktifler</Link>
              <Link href="/coverage">Çözüm oranı</Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
        {/* The fleet snapshot is CC-BY-SA, so the attribution belongs on every page. */}
        <footer className="pagefoot">
          <div className="shell">
            Filo: {fleet.name}, {fleet.aircraft.length} uçak.{" "}
            <a href={fleet.source}>Kaynak</a>, {fleet.licence}.
          </div>
        </footer>
      </body>
    </html>
  );
}
