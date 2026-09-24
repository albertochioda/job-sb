"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { CURRENT_TERMS_VERSION } from "@/lib/terms-version";
import { TRIAL_PRICE_EUR } from "@/lib/billing/plans";

interface Props {
  locale: string;
  t: Record<string, string>;
}

// 2026-09-23 — Opzione A ("paga-prima"): il Trial è ora un pagamento one-time
// di TRIAL_PRICE_EUR, non più un accesso gratuito istantaneo. Questo form non
// crea più l'account Supabase direttamente (niente più supabase.auth.signUp()
// né campo password qui): raccoglie solo nome/email/consensi, apre una
// sessione di checkout Stripe (api/checkout/create-trial-signup-session) e
// naviga via verso Stripe. L'account viene creato SOLO dal webhook dopo il
// pagamento confermato (api/webhooks/stripe/route.ts, ramo "trial_signup"),
// che manda all'utente un'email con un magic link per accedere — vedi
// checkout/trial-success/page.tsx per la pagina di destinazione post-pagamento.
//
// Perché non si può fare altrimenti: public.handle_new_user() (trigger su
// auth.users) crea la riga subscriptions tier='trial'/status='active' NEL
// MOMENTO STESSO in cui un utente Supabase viene creato — un signUp() qui,
// anche seguito da un blocco "a valle", avrebbe già regalato il Trial prima
// che qualunque controllo potesse scattare.
export default function RegisterForm({ locale, t }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    track("trial_checkout_iniziato");

    try {
      const res = await fetch("/api/checkout/create-trial-signup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          termsAccepted,
          termsAcceptedAt: new Date().toISOString(),
          termsVersion: CURRENT_TERMS_VERSION,
          marketingConsent,
          locale,
        }),
      });
      const data = await res.json();

      if (res.ok && data.url) {
        // Navigazione intera verso Stripe Checkout (hosted) — stesso pattern
        // già usato per l'upgrade a Individual/Professional
        // (trial-expired-modal.tsx / api/checkout/create-session).
        window.location.href = data.url;
        return;
      }

      setError(data.error === "email_already_registered" ? t.emailAlreadyRegistered : t.genericError);
      setLoading(false);
    } catch (err) {
      console.error("[register-form] errore avvio checkout trial:", err);
      setError(t.genericError);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">{t.fullName}</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t.email}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={e => setTermsAccepted(e.target.checked)}
          className="mt-0.5 rounded border-border accent-primary shrink-0"
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          Ho letto e accetto i{" "}
          <a href={`/${locale}/termini-di-servizio`} target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:no-underline">Termini di Servizio</a>
          {" "}e la{" "}
          <a href={`/${locale}/privacy-policy`} target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:no-underline">Privacy Policy</a>
          {" "}di Job Search Bridge.
        </span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={e => setMarketingConsent(e.target.checked)}
          className="mt-0.5 rounded border-border accent-primary shrink-0"
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          Acconsento a ricevere comunicazioni promozionali via email (facoltativo)
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading || !termsAccepted}
        className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "..." : `${t.registerLink} — €${TRIAL_PRICE_EUR.toFixed(2).replace(".", ",")}`}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Reindirizzamento sicuro a Stripe per il pagamento. Nessun rinnovo automatico.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        {t.alreadyAccount}{" "}
        <Link href={`/${locale}/login`} className="underline text-foreground">
          {t.loginLink}
        </Link>
      </p>
    </form>
  );
}
