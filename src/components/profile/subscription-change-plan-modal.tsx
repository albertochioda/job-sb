"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { VALID_TIERS, VALID_CADENCES, PLAN_PRICES, CADENCE_LABELS, type Tier, type Cadence } from "@/lib/billing/plans";

export default function SubscriptionChangePlanModal({
  currentTier,
  onClose,
  onChanged,
}: {
  currentTier: Tier | "trial";
  onClose: () => void;
  onChanged: (result: { tier: Tier; cadence: Cadence; effective_at: string }) => void;
}) {
  const [tier, setTier] = useState<Tier>(currentTier === "professional" ? "individual" : "professional");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isSameAsCurrent = tier === currentTier; // la cadenza attuale non è nota lato client, il backend verifica comunque il price esatto

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTier: tier, newCadence: cadence }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onChanged({ tier: data.tier, cadence: data.cadence, effective_at: data.effective_at });
      } else {
        setError(data.error ?? "Errore nella pianificazione del cambio piano");
      }
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-background border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-5">
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold">Cambia piano</h2>
          <p className="text-sm text-muted-foreground">
            Il nuovo piano parte dal prossimo rinnovo — resti sul piano attuale fino alla fine del periodo già pagato, nessun addebito ora.
          </p>
        </div>

        <div className="space-y-3 text-left">
          {VALID_TIERS.map((t) => (
            <div
              key={t}
              className={`border rounded-lg p-3 space-y-2 cursor-pointer transition-colors ${
                tier === t ? "border-primary bg-primary/5" : "border-border"
              }`}
              onClick={() => setTier(t)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {t}
                  {t === currentTier && <span className="text-xs text-muted-foreground font-normal"> (piano attuale)</span>}
                </span>
                <span className="text-sm text-muted-foreground">€{PLAN_PRICES[t][cadence]}</span>
              </div>
              {tier === t && (
                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {VALID_CADENCES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCadence(c)}
                      className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                        cadence === c
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border text-muted-foreground hover:border-foreground/40"
                      }`}
                    >
                      {CADENCE_LABELS[c]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {isSameAsCurrent && (
          <p className="text-xs text-muted-foreground">
            Hai selezionato il piano già attivo — scegli una cadenza diversa o l&apos;altro piano per procedere.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-2">
            Annulla
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 bg-foreground text-background text-sm py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Attendere..." : "Conferma cambio piano"}
          </button>
        </div>
      </div>
    </div>
  );
}
