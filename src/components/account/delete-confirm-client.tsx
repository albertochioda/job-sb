"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "confirm" | "loading" | "done" | "error";

// Il click è l'unico punto che esegue davvero la cancellazione — la pagina
// che lo contiene (page.tsx) non fa alcuna chiamata al caricamento: un
// eventuale prefetch automatico del link (es. scanner antivirus aziendali
// che "visitano" i link nelle email) non deve poter innescare la
// cancellazione da solo.
export default function DeleteConfirmClient({ token }: { token: string | null }) {
  const [step, setStep] = useState<Step>(token ? "confirm" : "error");
  const [error, setError] = useState("");

  const confirmDeletion = async () => {
    if (!token || step === "loading") return;
    setStep("loading");
    setError("");
    try {
      const res = await fetch("/api/account/delete/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Si è verificato un errore, riprova più tardi");
        setStep("error");
        return;
      }
      setStep("done");
    } catch {
      setError("Errore di rete, riprova");
      setStep("error");
    }
  };

  if (step === "done") {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">Account eliminato</h1>
        <p className="text-sm text-muted-foreground">
          Il tuo account e tutti i dati collegati sono stati eliminati definitivamente. Grazie per aver provato Job Search Bridge.
        </p>
      </div>
    );
  }

  if (step === "error" || !token) {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">Link non valido</h1>
        <p className="text-sm text-muted-foreground">
          {error || "Questo link non è valido o è scaduto. Richiedi di nuovo la cancellazione dal tuo profilo."}
        </p>
        <Link href="/it/login" className="text-sm underline">
          Torna al login
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <h1 className="text-xl font-semibold">Conferma cancellazione account</h1>
      <p className="text-sm text-muted-foreground">
        Stai per eliminare definitivamente il tuo account Job Search Bridge e tutti i dati collegati — CV, lettere generate, cronologia ricerche e candidature. Questa azione non può essere annullata.
      </p>
      <button
        type="button"
        onClick={confirmDeletion}
        disabled={step === "loading"}
        className="bg-destructive text-destructive-foreground text-sm px-5 py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {step === "loading" ? "Eliminazione in corso..." : "Elimina definitivamente il mio account"}
      </button>
    </div>
  );
}
