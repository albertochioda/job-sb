"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Step = "warn" | "sent";

export default function AccountDangerZone({ userEmail, locale }: { userEmail: string; locale: string }) {
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<Step>("warn");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = confirmationEmail.trim().toLowerCase() === userEmail.toLowerCase();

  const closeModal = () => {
    setShowModal(false);
    setStep("warn");
    setConfirmationEmail("");
    setError("");
  };

  const requestDeletion = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation_email: confirmationEmail, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Errore durante la richiesta, riprova");
        setSubmitting(false);
        return;
      }
      setStep("sent");
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-destructive/30 rounded-lg p-6 space-y-3">
      <h2 className="font-semibold text-lg text-destructive">Zona pericolosa</h2>
      <p className="text-sm text-muted-foreground">
        Elimina definitivamente il tuo account e tutti i dati collegati — CV, lettere generate, cronologia ricerche e candidature. Azione irreversibile.
      </p>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="text-sm text-destructive hover:opacity-80 underline"
      >
        Elimina account
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 bg-background border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-5">
            <button
              onClick={closeModal}
              aria-label="Chiudi"
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {step === "warn" && (
              <>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Elimina account</h2>
                  <p className="text-sm text-muted-foreground">
                    Verranno eliminati definitivamente CV, lettere generate, cronologia ricerche e candidature. Se hai un abbonamento attivo verrà cancellato immediatamente (con rimborso automatico solo se sei ancora entro i 14 giorni dal primo pagamento).
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ti manderemo un&apos;email con un link di conferma valido 1 ora — la cancellazione avviene solo dopo il click su quel link.
                  </p>
                </div>

                <div className="text-left space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Digita la tua email (<strong>{userEmail}</strong>) per confermare
                  </label>
                  <input
                    type="email"
                    value={confirmationEmail}
                    onChange={(e) => setConfirmationEmail(e.target.value)}
                    placeholder={userEmail}
                    className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-destructive"
                  />
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button onClick={closeModal} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">
                    Annulla
                  </button>
                  <button
                    onClick={requestDeletion}
                    disabled={!canSubmit || submitting}
                    className="bg-destructive text-destructive-foreground text-sm px-5 py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {submitting ? "Invio..." : "Invia email di conferma"}
                  </button>
                </div>
              </>
            )}

            {step === "sent" && (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Controlla la tua email</h2>
                <p className="text-sm text-muted-foreground">
                  Ti abbiamo mandato un link di conferma a {userEmail}, valido per 1 ora. Clicca sul link per eliminare definitivamente il tuo account.
                </p>
                <button onClick={closeModal} className="mt-2 text-sm text-muted-foreground hover:text-foreground underline">
                  Chiudi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
