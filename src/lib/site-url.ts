// URL pubblico del sito, usato per metadata/SEO (canonical, sitemap,
// robots, OG, JSON-LD) — centralizzato qui così tutti i punti restano
// sincronizzati sullo stesso dominio. Il fallback al vecchio dominio
// Vercel non è un placeholder a caso: se NEXT_PUBLIC_APP_URL non è
// ancora impostata (es. build locale, o dimenticata su Vercel dopo la
// migrazione dominio), il sito deve continuare a generare URL validi e
// funzionanti sul dominio corrente, non rompersi o puntare a un
// dominio non ancora esistente.
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://job-sb.vercel.app";
