"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useBlockingModal } from "@/contexts/blocking-modal-context";

const CANCELLATION_REASONS = [
  "🎉 Ho trovato lavoro",
  "Non riesco a ottenere colloqui nonostante le candidature",
  "Non trovo abbastanza offerte rilevanti per il mio profilo",
  "Il prezzo non è adatto a me al momento",
  "Non ho più tempo per la ricerca attiva ora",
  "Preferisco proseguire senza uno strumento come questo",
  "Ho avuto problemi tecnici con la piattaforma",
  "Altro",
];

type TrialStep = "info" | "feedback" | "thanks";

export default function TrialExpiredModal() {
  const { reason, details, showBlockingModal, dismissBlockingModal } = useBlockingModal();
  const [trialStep, setTrialStep] = useState<TrialStep>("info");
  const [selectedReason, setSelectedReason] = useState("");
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check iniziale al mount per trial_expired — stesso comportamento di prima,
  // ma ora passa lo stato attraverso il context invece che come stato locale
  // isolato. NON TOCCARE: data?.tier === "trial" è l'unica condizione che
  // decide se mostrare il modale — i beta tester hanno tier='professional'
  // assegnato manualmente via SQL, quindi non intercettano mai questo check.
  useEffect(() => {
    fetch("/api/subscription")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (
          data?.tier === "trial" &&
          data?.period_end &&
          new Date(data.period_end) < new Date()
        ) {
          showBlockingModal("trial_expired");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reason) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissBlockingModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reason, dismissBlockingModal]);

  // Reset dello state locale del flow trial ogni volta che `reason` cambia
  // (chiusura → null, o riapertura → nuovo valore): il componente non si
  // smonta mai (resta montato in dashboard/layout.tsx), quindi senza questo
  // reset trialStep restava bloccato su "thanks" da una sessione precedente
  // e riappariva su quello schermo per qualsiasi altra azione bloccata.
  useEffect(() => {
    setTrialStep("info");
    setSelectedReason("");
    setFreeText("");
    setSubmitting(false);
  }, [reason]);

  if (!reason) return null;

  const isTrialExpired = reason === "trial_expired";

  const submitCancellationFeedback = async () => {
    if (!selectedReason || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback/cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: "trial_declined",
          reason: selectedReason,
          free_text: selectedReason === "Altro" ? (freeText || null) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Feedback submission failed:", data.error);
        // Mostra comunque "thanks" ma logga l'errore — il feedback è
        // opzionale, non blocchiamo l'utente con un errore visibile, ma
        // l'insert fallito va tracciato per non nasconderlo di nuovo.
      }
    } catch (err) {
      console.error("Feedback submission network error:", err);
    } finally {
      setSubmitting(false);
      setTrialStep("thanks");
    }
  };

  const isFoundJob = selectedReason === "🎉 Ho trovato lavoro";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={dismissBlockingModal}
      />

      {/* Modal */}
      <div className="relative z-10 bg-background border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-5">
        <button
          onClick={dismissBlockingModal}
          aria-label="Chiudi"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {isTrialExpired ? (
          <>
            {trialStep === "info" && (
              <>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Il tuo trial è scaduto</h2>
                  <p className="text-sm text-muted-foreground">
                    Hai usato il tuo periodo di prova gratuito di 14 giorni.
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <div className="border rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Individual</span>
                    <span className="text-sm text-muted-foreground">€19/mese</span>
                  </div>
                  <div className="border rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Professional</span>
                    <span className="text-sm text-muted-foreground">€29/mese</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  {/* TODO(Track B2): sostituire questi 2 link con il vero checkout
                      Stripe per il piano selezionato, non appena disponibile.
                      Nel frattempo restano le CTA email/WhatsApp esistenti. */}
                  <a
                    href="mailto:albertochioda@gmail.com?subject=Upgrade Job SSB"
                    className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Contatta Alberto
                  </a>
                  <a
                    href="https://wa.me/393332854256"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Scrivi su WhatsApp
                  </a>
                </div>

                <button
                  onClick={() => setTrialStep("feedback")}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Non intendo proseguire
                </button>
              </>
            )}

            {trialStep === "feedback" && (
              <>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Perché non proseguire?</h2>
                  <p className="text-sm text-muted-foreground">
                    Aiutaci a capire il motivo — ci vuole un secondo.
                  </p>
                </div>

                <div className="text-left space-y-2">
                  {CANCELLATION_REASONS.map((r) => (
                    <label key={r} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="cancellation_reason"
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

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={dismissBlockingModal}
                    className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
                  >
                    Salta
                  </button>
                  <button
                    onClick={submitCancellationFeedback}
                    disabled={!selectedReason || submitting}
                    className="bg-foreground text-background text-sm px-5 py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {submitting ? "Invio..." : "Invia"}
                  </button>
                </div>
              </>
            )}

            {trialStep === "thanks" && (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">
                  {isFoundJob ? "Congratulazioni! 🎉" : "Grazie per il feedback"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isFoundJob
                    ? "Congratulazioni! Grazie per averci provato."
                    : "Il tuo feedback ci aiuta a migliorare Job SB."}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Limite raggiunto</h2>
              <p className="text-sm text-muted-foreground">
                {details?.tier === "professional" ? (
                  <>
                    Hai raggiunto il limite di {details?.limit ?? "-"} {details?.resource ?? "azioni"} del tuo piano
                    Professional questo mese. Riprova quando il conteggio si azzera, oppure scrivici se ti serve un
                    limite più alto per questo mese.
                  </>
                ) : (
                  <>
                    Hai raggiunto il limite di {details?.limit ?? "-"} {details?.resource ?? "azioni"} del tuo piano{" "}
                    {details?.tier ?? ""} questo mese. Aggiorna il piano per continuare, oppure riprova quando il
                    conteggio si azzera.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <a
                href="mailto:albertochioda@gmail.com?subject=Upgrade Job SSB"
                className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Contatta Alberto
              </a>
              <a
                href="https://wa.me/393332854256"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Scrivi su WhatsApp
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
