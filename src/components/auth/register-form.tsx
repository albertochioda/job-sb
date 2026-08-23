"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Props {
  locale: string;
  t: Record<string, string>;
}

export default function RegisterForm({ locale, t }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Requisito lato client, più severo del minimo reale imposto da Supabase
    // Auth (verificato: solo 6 caratteri, nessuna complessità richiesta) —
    // vedi commento su passwordRequirements per il dettaglio.
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError(t.passwordTooWeak);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, terms_accepted_at: new Date().toISOString(), terms_version: "1.0-beta" },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message && error.message !== "{}" ? error.message : "Registrazione fallita. Riprova.");
    } else {
      // Il consenso marketing di default è già false lato DB — scriviamo
      // esplicitamente solo se l'utente lo ha attivato. Nessuna sincronizzazione
      // da metadata auth a profiles è confermata esistere nel codice, quindi
      // scriviamo direttamente qui (stesso pattern fail-safe già usato per
      // terms_version). Un fallimento non deve bloccare la registrazione.
      if (marketingConsent) {
        try {
          await fetch("/api/profile/marketing-consent", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marketing_consent: true }),
          });
        } catch (err) {
          console.error("Marketing consent save failed:", err);
        }
      }
      router.push(`/${locale}/onboarding`);
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
      <div className="space-y-1">
        <label className="text-sm font-medium">{t.password}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t.passwordRequirements}</p>
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
          {", "}la{" "}
          <a href={`/${locale}/privacy-policy`} target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:no-underline">Privacy Policy</a>
          {" "}e l&apos;
          <a href={`/${locale}/accordo-riservatezza-beta`} target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:no-underline">Accordo di Riservatezza Beta</a>
          {" "}di Job SB.
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
        {loading ? "..." : t.registerLink}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {t.alreadyAccount}{" "}
        <Link href={`/${locale}/login`} className="underline text-foreground">
          {t.loginLink}
        </Link>
      </p>
    </form>
  );
}
