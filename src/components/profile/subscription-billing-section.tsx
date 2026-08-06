"use client";

import { useState } from "react";
import SubscriptionCancelModal from "./subscription-cancel-modal";
import SubscriptionChangePlanModal from "./subscription-change-plan-modal";
import { CADENCE_LABELS, type Tier, type Cadence } from "@/lib/billing/plans";

type PendingTierChange = { tier: Tier; cadence: Cadence; effective_at: string } | null;

export default function SubscriptionBillingSection({
  locale,
  stripeCustomerId,
  stripeSubscriptionId,
  initialCancelAtPeriodEnd,
  periodEnd,
  currentTier,
  initialPendingTierChange,
}: {
  locale: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  initialCancelAtPeriodEnd: boolean;
  periodEnd: string | null;
  currentTier: Tier | "trial";
  initialPendingTierChange: PendingTierChange;
}) {
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(initialCancelAtPeriodEnd);
  const [effectivePeriodEnd, setEffectivePeriodEnd] = useState(periodEnd);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [pendingTierChange, setPendingTierChange] = useState<PendingTierChange>(initialPendingTierChange);
  const [displayedTier, setDisplayedTier] = useState<Tier | "trial">(currentTier);
  const [immediateChangeNotice, setImmediateChangeNotice] = useState<string | null>(null);
  const [immediateChangeIsWarning, setImmediateChangeIsWarning] = useState(false);
  const [showNoSubscriptionNotice, setShowNoSubscriptionNotice] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState("");

  const openPortal = async () => {
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

  const reactivate = async () => {
    if (reactivating) return;
    setReactivating(true);
    setReactivateError("");
    try {
      const res = await fetch("/api/billing/reactivate-subscription", { method: "POST" });
      if (res.ok) {
        setCancelAtPeriodEnd(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setReactivateError(data.error ?? "Errore nella riattivazione, riprova");
      }
    } catch {
      setReactivateError("Errore di rete, riprova");
    } finally {
      setReactivating(false);
    }
  };

  const onCancelClick = () => {
    if (!stripeSubscriptionId) {
      setShowNoSubscriptionNotice(true);
      return;
    }
    setShowCancelModal(true);
  };

  const onChangePlanClick = () => {
    if (!stripeSubscriptionId) {
      setShowNoSubscriptionNotice(true);
      return;
    }
    setShowChangePlanModal(true);
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-lg">Fatturazione e abbonamento</h2>

      {immediateChangeNotice && (
        <p
          className={`text-sm rounded-md px-4 py-3 border ${
            immediateChangeIsWarning
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          {immediateChangeNotice}
        </p>
      )}

      {pendingTierChange && (
        <p className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-md px-4 py-3">
          Il tuo piano cambierà a <strong className="capitalize">{pendingTierChange.tier}</strong> (
          {CADENCE_LABELS[pendingTierChange.cadence]}) dal{" "}
          {new Date(pendingTierChange.effective_at).toLocaleDateString("it-IT")}.
        </p>
      )}

      {stripeCustomerId && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Metodo di pagamento, fatture e cronologia degli addebiti.
          </p>
          <button
            type="button"
            onClick={openPortal}
            disabled={portalLoading}
            className="shrink-0 text-sm border rounded-md px-4 py-2 font-medium hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {portalLoading ? "Attendere..." : "Gestisci pagamento e fatture"}
          </button>
        </div>
      )}
      {portalError && <p className="text-xs text-destructive">{portalError}</p>}

      <div className="pt-2 border-t space-y-3">
        {cancelAtPeriodEnd ? (
          <>
            <p className="text-sm text-muted-foreground">
              Il tuo abbonamento è stato cancellato e non si rinnoverà.
              {effectivePeriodEnd && (
                <> Manterrai l&apos;accesso fino al {new Date(effectivePeriodEnd).toLocaleDateString("it-IT")}.</>
              )}
            </p>
            <button
              type="button"
              onClick={reactivate}
              disabled={reactivating}
              className="text-sm border rounded-md px-4 py-2 font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {reactivating ? "Attendere..." : "Riattiva abbonamento"}
            </button>
            {reactivateError && <p className="text-xs text-destructive">{reactivateError}</p>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onChangePlanClick}
                className="text-sm border rounded-md px-4 py-2 font-medium hover:bg-muted transition-colors"
              >
                Cambia piano
              </button>
              <button
                type="button"
                onClick={onCancelClick}
                className="text-sm text-muted-foreground hover:text-destructive underline"
              >
                Cancella abbonamento
              </button>
            </div>
            {showNoSubscriptionNotice && (
              <p className="text-sm text-muted-foreground">
                Per gestire il tuo abbonamento contattaci a{" "}
                <a href="mailto:albertochioda@gmail.com" className="underline hover:text-foreground">
                  albertochioda@gmail.com
                </a>
                .
              </p>
            )}
          </>
        )}
      </div>

      {showCancelModal && (
        <SubscriptionCancelModal
          onClose={() => setShowCancelModal(false)}
          onCancelled={(newPeriodEnd) => {
            setCancelAtPeriodEnd(true);
            if (newPeriodEnd) setEffectivePeriodEnd(newPeriodEnd);
          }}
        />
      )}

      {showChangePlanModal && (
        <SubscriptionChangePlanModal
          currentTier={displayedTier}
          onClose={() => setShowChangePlanModal(false)}
          onChanged={(result) => {
            if (result.immediate) {
              setDisplayedTier(result.tier);
              setPendingTierChange(null);
              setImmediateChangeIsWarning(!!result.invoiceWarning);
              setImmediateChangeNotice(
                result.invoiceWarning
                  ? `Piano aggiornato a ${result.tier} (${CADENCE_LABELS[result.cadence]}). ${result.invoiceWarning}`
                  : `Piano aggiornato a ${result.tier} (${CADENCE_LABELS[result.cadence]}) — differenza addebitata.`
              );
            } else if (result.effective_at) {
              setPendingTierChange({ tier: result.tier, cadence: result.cadence, effective_at: result.effective_at });
            }
            setShowChangePlanModal(false);
          }}
        />
      )}
    </div>
  );
}
