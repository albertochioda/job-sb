"use client";

import { useState } from "react";
import SubscriptionCancelModal from "./subscription-cancel-modal";

export default function SubscriptionBillingSection({
  locale,
  stripeCustomerId,
  stripeSubscriptionId,
  initialCancelAtPeriodEnd,
  periodEnd,
}: {
  locale: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  initialCancelAtPeriodEnd: boolean;
  periodEnd: string | null;
}) {
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(initialCancelAtPeriodEnd);
  const [effectivePeriodEnd, setEffectivePeriodEnd] = useState(periodEnd);
  const [showCancelModal, setShowCancelModal] = useState(false);
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

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-lg">Fatturazione e abbonamento</h2>

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
            <button
              type="button"
              onClick={onCancelClick}
              className="text-sm text-muted-foreground hover:text-destructive underline"
            >
              Cancella abbonamento
            </button>
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
    </div>
  );
}
