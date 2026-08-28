// URL pubblico del sito, usato per metadata/SEO (canonical, sitemap,
// robots, OG, JSON-LD) — centralizzato qui così tutti i punti restano
// sincronizzati sullo stesso dominio. Il fallback al dominio custom non
// è un placeholder a caso: se NEXT_PUBLIC_APP_URL non è ancora impostata
// (es. build locale, o dimenticata su Vercel), il sito deve continuare a
// generare URL validi e funzionanti sul dominio corrente, non rompersi o
// puntare a un dominio ormai dismesso (job-sb.vercel.app, che oggi fa un
// redirect 308 — rotto per qualunque consumatore che non segue redirect,
// vedi il bug reale del webhook Stripe).
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jobsearchbridge.com";
