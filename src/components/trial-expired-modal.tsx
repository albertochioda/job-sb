"use client";

import { useEffect, useState } from "react";

export default function TrialExpiredModal() {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (
          data?.tier === "trial" &&
          data?.period_end &&
          new Date(data.period_end) < new Date()
        ) {
          setExpired(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!expired) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 bg-background border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Il tuo trial è scaduto</h2>
          <p className="text-sm text-muted-foreground">
            Hai usato il tuo periodo di prova gratuito di 14 giorni.
          </p>
        </div>

        <p className="text-sm">
          Per continuare ad usare Job SSB e accedere a tutte le funzionalità,
          contattami per attivare il tuo piano.
        </p>

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
      </div>
    </div>
  );
}
