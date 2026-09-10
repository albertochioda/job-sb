import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Sito indicizzabile (decisione di Alberto, 2026-09-10) ma solo per le
// pagine pubbliche pensate per la ricerca: landing, Privacy Policy,
// Termini di Servizio (vedi commento gemello in
// src/app/[locale]/page.tsx). Disallow globale di base + Allow mirato
// solo su quei percorsi esatti — "/it"/"/en" sono ancorati con "$" per
// non far match anche sui prefissi (altrimenti "Allow: /it" aprirebbe
// anche "/it/dashboard" essendo un prefisso più corto e quindi "meno
// specifico" del Disallow generale, ma pur sempre un match).
// Dashboard/onboarding/profilo restano fuori (già protette da
// autenticazione via src/proxy.ts, ma un Disallow esplicito evita che un
// crawler le segua comunque da link scoperti altrove); login,
// registrazione, checkout, account e l'accordo di riservatezza beta
// restano fuori perché non fanno parte della decisione odierna, non
// perché sensibili — vanno riconsiderati singolarmente se in futuro si
// vorrà indicizzarli.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
      allow: [
        "/it$",
        "/en$",
        "/it/privacy-policy",
        "/en/privacy-policy",
        "/it/termini-di-servizio",
        "/en/termini-di-servizio",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
