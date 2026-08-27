import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// La sitemap può esistere anche con robots.ts che blocca tutto (vedi
// robots.ts) — sono due segnali indipendenti, il controllo reale
// sull'indicizzazione resta il noindex per-pagina. Elenca solo la
// landing, le uniche pagine pubbliche oggi (tutto il resto richiede
// autenticazione).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL;
  return [
    { url: `${base}/it`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/en`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];
}
