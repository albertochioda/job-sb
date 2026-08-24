"use client";

import { useEffect, useState } from "react";
import { CURRENT_TERMS_VERSION } from "@/lib/terms-version";

export default function TermsReacceptanceModal({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/profile/terms-status")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        // Fail-safe: se terms_version è assente (colonna non ancora
        // popolata, profilo mancante, ecc.) NON mostriamo il banner —
        // uno stato dati incompleto non deve mai bloccare un utente.
        if (data?.terms_version && data.terms_version !== CURRENT_TERMS_VERSION) {
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!visible) return null;

  const handleAccept = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/accept-terms", { method: "POST" });
      if (res.ok) {
        setVisible(false);
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Accept terms failed:", data.error);
      }
    } catch (err) {
      console.error("Accept terms network error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop volutamente non cliccabile — nessun onClick qui:
          il consenso legale non è saltabile né chiudibile. */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Nessun bottone X, nessun handler Escape: unico modo di procedere
          è accettare tramite il bottone in fondo. */}
      <div className="relative z-10 bg-background border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-5">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold">
            Abbiamo aggiornato i Termini di Servizio e l&apos;Informativa Privacy
          </h2>
          <p className="text-sm text-muted-foreground">
            Abbiamo introdotto piani di abbonamento a pagamento e aggiornato i documenti legali di conseguenza.
            Per continuare a usare Job Search Bridge ti chiediamo di leggerli e accettarli.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <a
            href={`/${locale}/termini-di-servizio`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-center hover:no-underline"
          >
            Leggi i Termini di Servizio →
          </a>
          <a
            href={`/${locale}/privacy-policy`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-center hover:no-underline"
          >
            Leggi l&apos;Informativa Privacy →
          </a>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 accent-primary shrink-0"
          />
          <span>Ho letto e accetto i nuovi Termini di Servizio e l&apos;Informativa Privacy</span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!checked || submitting}
          className="w-full bg-foreground text-background py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? "Attendere..." : "Accetto e continuo"}
        </button>
      </div>
    </div>
  );
}
