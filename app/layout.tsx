import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { fleet } from "../src/corpus";
import "./globals.css";

export const metadata: Metadata = {
  title: "AD applicability",
  description: "Which aircraft an Airworthiness Directive applies to, and why.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="shell">
            <strong>AD applicability</strong>
            <nav aria-label="Sections">
              <Link href="/">Directives</Link>
              <Link href="/coverage">Coverage</Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
        {/* The fleet snapshot is CC-BY-SA, so the attribution belongs on every page. */}
        <footer className="pagefoot">
          <div className="shell">
            Fleet: {fleet.name}, {fleet.aircraft.length} aircraft.{" "}
            <a href={fleet.source}>Source</a>, {fleet.licence}.
          </div>
        </footer>
      </body>
    </html>
  );
}
