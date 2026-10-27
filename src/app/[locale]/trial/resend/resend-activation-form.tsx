"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

// CAPTCHA (Cloudflare Turnstile): DISATTIVATO finché NEXT_PUBLIC_TURNSTILE_SITE_KEY non è
// impostata. Va attivato insieme a TURNSTILE_SECRET_KEY sul server (lib/captcha.ts).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    el: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface Props {
  locale: string;
  t: Record<string, string>;
}

export default function ResendActivationForm({ locale, t }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const widgetBox = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;

    function mount() {
      if (cancelled || !widgetBox.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(widgetBox.current, {
        sitekey: TURNSTILE_SITE_KEY as string,
        callback: setCaptchaToken,
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    }

    if (window.turnstile) {
      mount();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount);
    }

    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("sending");

    try {
      const res = await fetch("/api/trial/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, captchaToken }),
      });
      if (res.ok) {
        setStatus("done");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error === "captcha_failed" ? t.captchaFailed : t.error);
    } catch {
      setError(t.error);
    }

    if (TURNSTILE_SITE_KEY) {
      window.turnstile?.reset(widgetId.current);
      setCaptchaToken("");
    }
    setStatus("idle");
  }

  if (status === "done") {
    // Stesso messaggio per qualunque email: non rivela se l'account esiste.
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          {t.done}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline text-foreground">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="text-xs text-muted-foreground">{t.newLinkWarning}</p>
        <Link href={`/${locale}/login`} className="text-sm underline text-foreground">
          {t.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="resend-email" className="text-sm font-medium">
          {t.email}
        </label>
        <input
          id="resend-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {TURNSTILE_SITE_KEY && <div ref={widgetBox} className="flex justify-center" />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending" || (!!TURNSTILE_SITE_KEY && !captchaToken)}
        className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {status === "sending" ? "..." : t.submit}
      </button>
      <p className="text-center text-xs text-muted-foreground">{t.newLinkWarning}</p>
      <p className="text-center text-sm">
        <Link href={`/${locale}/login`} className="text-muted-foreground hover:text-foreground">
          ← {t.backToLogin}
        </Link>
      </p>
    </form>
  );
}
