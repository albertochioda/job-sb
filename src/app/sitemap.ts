import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Elenca le sole pagine pubbliche pensate per la ricerca, coerenti con
// gli Allow mirati in robots.ts: landing, Privacy Policy, Termini di
// Servizio (decisione di Alberto, 2026-09-10 — vedi commento gemello in
// src/app/[locale]/page.tsx). Il resto del sito richiede autenticazione
// o non fa parte di questa decisione.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL;
  return [
    { url: `${base}/it`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/en`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/it/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/en/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/it/termini-di-servizio`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/en/termini-di-servizio`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
