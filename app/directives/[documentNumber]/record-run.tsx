"use client";

import { useState } from "react";

interface RunRecorded {
  readonly runId: number;
  readonly affected: number;
}

type State =
  | { readonly status: "idle" }
  | { readonly status: "saving" }
  | { readonly status: "saved"; readonly run: RunRecorded }
  | { readonly status: "failed"; readonly message: string };

/**
 * Writing a run is the one action on this page, and Postgres is optional here.
 *
 * A stopped database is an expected state, not an error to hide: it gets its
 * own message naming how to start it, and the page stays usable either way.
 */
export function RecordRun({ documentNumber }: { readonly documentNumber: string }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function record(): Promise<void> {
    setState({ status: "saving" });
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentNumber }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : `Sunucu ${response.status} döndü.`;
        setState({ status: "failed", message });
        return;
      }
      setState({ status: "saved", run: body as RunRecorded });
    } catch {
      setState({
        status: "failed",
        message: "Uygulama sunucusuna ulaşılamadı. `npm run dev` hâlâ çalışıyor mu?",
      });
    }
  }

  return (
    <div className="stack">
      <button type="button" onClick={record} disabled={state.status === "saving"}>
        {state.status === "saving" ? "Kaydediliyor…" : "Bu değerlendirmeyi kaydet"}
      </button>

      {state.status === "saving" && (
        <p className="muted small" role="status">
          Uçak başına bir satır, tek bir işlemde yazılıyor.
        </p>
      )}

      {state.status === "saved" && (
        <p className="notice notice-ok" role="status">
          #{state.run.runId} numaralı kayıt oluşturuldu. İçinde, bu koşumun temize çıkarmadığı{" "}
          {state.run.affected} uçak var.
        </p>
      )}

      {state.status === "failed" && (
        <p className="notice notice-bad" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
