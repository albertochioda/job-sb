"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { track } from "@vercel/analytics";
import { useBlockingModal } from "@/contexts/blocking-modal-context";
import { CANCELLATION_REASONS } from "@/lib/cancellation-reasons";
import { PLAN_PRICES, CADENCE_LABELS, type Tier, type Cadence } from "@/lib/billing/plans";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

type TrialStep = "info" | "feedback" | "thanks";

export default function TrialExpiredModal({ locale }: { locale: string }) {
  const { reason, details, showBlockingModal, dismissBlockingModal } = useBlockingModal();
  const [trialStep, setTrialStep] = useState<TrialStep>("info");
  const [selectedReason, setSelectedReason] = useState("");
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cadenceByTier, setCadenceByTier] = useState<Record<Tier, Cadence>>({
    individual: "monthly",
    professional: "monthly",
  });
  const [checkoutTier, setCheckoutTier] = useState<Tier | null>(null);
  const [checkoutConsent, setCheckoutConsent] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  // Check iniziale al mount — stesso comportamento di prima per trial_expired,
  // ma ora passa lo stato attraverso il context invece che come stato locale
  // isolato. NON TOCCARE: data?.tier === "trial" è l'unica condizione che
  // decide se mostrare quel modale — i beta tester hanno tier='professional'
  // assegnato manualmente via SQL, quindi non intercettano mai questo check.
  // payment_failed ha priorità inferiore (else if): uno stato past_due
  // riguarda solo utenti con abbonamento Stripe reale, mai in trial.
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
        } else if (data?.status === "past_due") {
          showBlockingModal("payment_failed");
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

  // paywall_visualizzato copre i due casi che mostrano davvero un upsell
  // (sottoscrivi / aggiorna piano) — payment_failed è un avviso di
  // fatturazione, non un paywall, quindi resta escluso.
  useEffect(() => {
    if (reason === "trial_expired" || reason === "limit_reached") {
      track("paywall_visualizzato", { reason });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason]);

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
    setCheckoutTier(null);
    setCheckoutConsent(false);
    setCheckoutLoading(false);
    setCheckoutError("");
    setPortalLoading(false);
    setPortalError("");
  }, [reason]);

  if (!reason) return null;

  const isTrialExpired = reason === "trial_expired";
  const isPaymentFailed = reason === "payment_failed";

  const openBillingPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await fetch("/api/billing/portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setPortalError(data.error ?? "Errore nell'apertura del portale di fatturazione");
        setPortalLoading(false);
      }
    } catch {
      setPortalError("Errore di rete, riprova");
      setPortalLoading(false);
    }
  };

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

  const startCheckout = async () => {
    if (!checkoutTier || !checkoutConsent || checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    track("checkout_iniziato", { tier: checkoutTier, cadence: cadenceByTier[checkoutTier] });
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: checkoutTier,
          cadence: cadenceByTier[checkoutTier],
          locale,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error ?? "Errore nella creazione della sessione di pagamento");
        setCheckoutLoading(false);
      }
    } catch {
      setCheckoutError("Errore di rete, riprova");
      setCheckoutLoading(false);
    }
  };

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

                {!checkoutTier ? (
                  <div className="space-y-3 text-left">
                    {(["individual", "professional"] as const).map((tier) => (
                      <div key={tier} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{tier}</span>
                          <span className="text-sm text-muted-foreground">
                            €{PLAN_PRICES[tier][cadenceByTier[tier]]}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          {(["monthly", "quarterly", "annual"] as const).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCadenceByTier((prev) => ({ ...prev, [tier]: c }))}
                              className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                                cadenceByTier[tier] === c
                                  ? "border-primary bg-primary/5 font-medium"
                                  : "border-border text-muted-foreground hover:border-foreground/40"
                              }`}
                            >
                              {CADENCE_LABELS[c]}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCheckoutTier(tier)}
                          className="w-full bg-foreground text-background text-sm py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
                        >
                          Sottoscrivi
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 text-left">
                    <p className="text-sm">
                      <span className="font-medium capitalize">{checkoutTier}</span>
                      {" — "}
                      {CADENCE_LABELS[cadenceByTier[checkoutTier]]}, €{PLAN_PRICES[checkoutTier][cadenceByTier[checkoutTier]]}
                    </p>
                    <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkoutConsent}
                        onChange={(e) => setCheckoutConsent(e.target.checked)}
                        className="mt-0.5 accent-primary shrink-0"
                      />
                      <span>
                        Richiedo che l&apos;esecuzione del Servizio abbia inizio immediatamente, anche prima della
                        scadenza del termine di 14 giorni per l&apos;esercizio del diritto di recesso, e sono
                        consapevole che, qualora inizi a utilizzare il Servizio durante tale periodo, perderò il
                        diritto di recesso e al connesso rimborso.
                      </span>
                    </label>
                    {checkoutError && <p className="text-xs text-destructive">{checkoutError}</p>}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCheckoutTier(null)}
                        className="text-sm text-muted-foreground hover:text-foreground px-2"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={startCheckout}
                        disabled={!checkoutConsent || checkoutLoading}
                        className="flex-1 bg-foreground text-background text-sm py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {checkoutLoading ? "Attendere..." : "Procedi al pagamento"}
                      </button>
                    </div>
                  </div>
                )}

                {!checkoutTier && (
                  <button
                    onClick={() => setTrialStep("feedback")}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Non intendo proseguire
                  </button>
                )}
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
                    : "Il tuo feedback ci aiuta a migliorare Job Search Bridge."}
                </p>
              </div>
            )}
          </>
        ) : isPaymentFailed ? (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Pagamento non riuscito</h2>
              <p className="text-sm text-muted-foreground">
                L&apos;ultimo addebito del tuo abbonamento non è andato a buon fine. Stripe ritenterà
                automaticamente il pagamento nei prossimi giorni: nel frattempo il tuo accesso resta attivo,
                nessuna azione è strettamente necessaria. Per evitare interruzioni, ti consigliamo comunque di
                aggiornare il metodo di pagamento il prima possibile.
              </p>
            </div>

            {portalError && <p className="text-xs text-destructive">{portalError}</p>}

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {portalLoading ? "Attendere..." : "Aggiorna metodo di pagamento"}
              </button>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Problema pagamento Job Search Bridge`}
                className="inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Contatta Alberto
              </a>
            </div>
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
                href={`mailto:${SUPPORT_EMAIL}?subject=Upgrade Job SSB`}
                className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Contatta Alberto
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
