// Intestazione con il logo, condivisa da tutte le email rivolte agli utenti (attivazione, conferme,
// promemoria, fine Trial, pagamento fallito, cancellazione account, segnalazioni, notifica Termini).
// Gli avvisi interni per l'amministratore NON la usano (vedi email-calls.test.mjs).
//
// Uso: `html: withEmailHeader(html)` nella chiamata a sendEmail().
//
// Nessun import relativo di proposito: testabile direttamente con Node (email-layout.test.mjs).

/** Percorso pubblico del logo: public/jsb-logo-email.png (PNG 320x173, sfondo bianco), servito alla radice del sito. */
export const EMAIL_LOGO_PATH = "/jsb-logo-email.png";
export const EMAIL_LOGO_ALT = "Job Search Bridge";
export const EMAIL_LOGO_WIDTH = 160;
/** 320x173 px ridotto a 160 di larghezza = 86,5 -> 87. L'attributo serve a Outlook, che ignora `height:auto`. */
export const EMAIL_LOGO_HEIGHT = 87;
/** Segnaposto all'inizio dell'intestazione: evita di applicarla due volte alla stessa email. */
export const EMAIL_HEADER_MARKER = "<!--jsb-email-header-->";

const DEFAULT_SITE_URL = "https://jobsearchbridge.com";

/**
 * Origine del sito con cui costruire l'indirizzo ASSOLUTO del logo: i client di posta non risolvono
 * percorsi relativi e non caricano immagini http. Come SITE_URL (site-url.ts) legge NEXT_PUBLIC_APP_URL
 * e ripiega sul dominio di produzione; in più accetta solo https (es. un http://localhost nelle variabili
 * locali darebbe un logo che nessun destinatario può vedere) e scarta eventuali percorsi.
 */
export function emailSiteUrl(siteUrl?: string | null): string {
  const candidate = (siteUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:") return url.origin;
  } catch {
    // vuoto o non valido: si usa il dominio di produzione
  }
  return DEFAULT_SITE_URL;
}

export function emailLogoUrl(siteUrl?: string | null): string {
  return `${emailSiteUrl(siteUrl)}${EMAIL_LOGO_PATH}`;
}

/** HTML dell'intestazione: il logo con testo alternativo e larghezza fissa. */
export function emailHeader(siteUrl?: string | null): string {
  return (
    `${EMAIL_HEADER_MARKER}<div style="margin:0 0 24px 0;">` +
    `<img src="${emailLogoUrl(siteUrl)}" alt="${EMAIL_LOGO_ALT}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" ` +
    `style="display:block;border:0;outline:none;text-decoration:none;width:${EMAIL_LOGO_WIDTH}px;max-width:100%;height:auto;">` +
    `</div>`
  );
}

/** Antepone l'intestazione al corpo dell'email. Idempotente: se c'è già, restituisce il corpo com'è. */
export function withEmailHeader(html: string, siteUrl?: string | null): string {
  if (html.includes(EMAIL_HEADER_MARKER)) return html;
  return emailHeader(siteUrl) + html;
}
