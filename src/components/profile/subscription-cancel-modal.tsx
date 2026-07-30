"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CANCELLATION_REASONS } from "@/lib/cancellation-reasons";

type Step = "reason" | "done";

export default function SubscriptionCancelModal({
  onClose,
  onCancelled,
}: {
  onClose: () => void;
  onCancelled: (periodEnd: string | null) => void;
}) {
  const [step, setStep] = useState<Step>("reason");
  const [selectedReason, setSelectedReason] = useState("");
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);

  const isFoundJob = selectedReason === "🎉 Ho trovato lavoro";

  const confirmCancellation = async () => {
    if (!selectedReason || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason,
          free_text: selectedReason === "Altro" ? (freeText || null) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Errore durante la cancellazione, riprova");
        setSubmitting(false);
        return;
      }
      setPeriodEnd(data.period_end ?? null);
      onCancelled(data.period_end ?? null);
      setStep("done");
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-background border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-5">
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {step === "reason" && (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Perché vuoi cancellare?</h2>
              <p className="text-sm text-muted-foreground">
                Aiutaci a capire il motivo — ci vuole un secondo.
              </p>
            </div>

            <div className="text-left space-y-2">
              {CANCELLATION_REASONS.map((r) => (
                <label key={r} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="subscription_cancellation_reason"
                    value={r}
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                    className="mt-0.5 accent-primary shrink-0"
                  />
                  <span>{r}</span>
                </label>
              ))}
              {selectedReason === "Altro" && (
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Raccontaci di più (opzionale)"
                  rows={3}
                  className="w-full text-sm border rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
              >
                Indietro
              </button>
              <button
                onClick={confirmCancellation}
                disabled={!selectedReason || submitting}
                className="bg-destructive text-destructive-foreground text-sm px-5 py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? "Annullamento..." : "Annulla abbonamento"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              {isFoundJob ? "Congratulazioni! 🎉" : "Abbonamento cancellato"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isFoundJob
                ? "Congratulazioni! Grazie per averci provato — il tuo abbonamento resta attivo fino a fine periodo."
                : periodEnd
                  ? `Il tuo abbonamento è stato cancellato. Manterrai l'accesso alle funzionalità del tuo piano fino al ${new Date(periodEnd).toLocaleDateString("it-IT")}.`
                  : "Il tuo abbonamento è stato cancellato. Manterrai l'accesso fino alla fine del periodo già pagato."}
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-sm text-muted-foreground hover:text-foreground underline"
            >
              Chiudi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
