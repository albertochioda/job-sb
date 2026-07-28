"use client";

import { useState } from "react";

export default function MarketingConsentToggle({ initialConsent }: { initialConsent: boolean }) {
  const [consent, setConsent] = useState(initialConsent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    if (saving) return;
    const next = !consent;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/marketing-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketing_consent: next }),
      });
      if (res.ok) {
        setConsent(next);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Errore salvataggio");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-3">
      <h2 className="font-semibold text-lg">Comunicazioni promozionali</h2>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-xs">
          Ricevi via email aggiornamenti su nuove funzionalità e offerte promozionali di Job SB.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={consent}
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            consent ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              consent ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
