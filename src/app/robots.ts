import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Deve riflettere lo stato ATTUALE, non anticiparlo: la landing ha ancora
// noindex esplicito (src/app/[locale]/page.tsx) e nessun'altra pagina
// pubblica esiste oggi (il resto richiede autenticazione). Disallow
// globale — un robots.txt permissivo che contraddicesse il noindex
// per-pagina sarebbe fuorviante per i crawler, non solo inutile.
//
// Da allentare SOLO insieme alla rimozione del noindex sulla landing
// (mai prima), quando si deciderà di pubblicare.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
