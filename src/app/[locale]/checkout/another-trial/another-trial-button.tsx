"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

export default function AnotherTrialButton({ locale }: { locale: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    track("altro_giro_trial_iniziato");
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "trial", locale }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Errore nella creazione della sessione di pagamento");
      setLoading(false);
    } catch (err) {
      console.error("[another-trial-button] errore avvio checkout:", err);
      setError("Si è verificato un errore, riprova più tardi");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "..." : "Paga e continua"}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
