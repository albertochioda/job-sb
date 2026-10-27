import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";

/**
 * Canale di invio email server-side, generico e riusabile per qualunque
 * notifica futura (monitoraggio scraper, promemoria rinnovo, comunicazione
 * modifiche prezzo, ecc.) — non specifico per un solo caso d'uso.
 *
 * Richiede RESEND_API_KEY e EMAIL_FROM in .env.local / Vercel. Finché
 * RESEND_API_KEY è vuota, sendEmail() logga un avviso e non tenta l'invio
 * (fail-safe: nessun errore che blocca il chiamante, ma nessuna email parte
 * silenziosamente in un ambiente non configurato).
 */

/**
 * Escape dei caratteri con significato speciale in HTML. Da applicare a
 * QUALUNQUE valore proveniente da input utente o dal database prima di
 * interpolarlo nel corpo di un'email: senza, un utente può iniettare
 * markup arbitrario (link di phishing, immagini remote che tracciano
 * l'apertura) nell'email che riceviamo noi.
 *
 * L'ordine conta: & va sostituito per primo, altrimenti ri-escaperebbe
 * le entità generate dalle sostituzioni successive.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

/**
 * Indirizzo "nudo" del mittente reale (EMAIL_FROM può essere "Nome <indirizzo>"),
 * da mostrare all'utente perché sappia quale mittente cercare nella posta
 * indesiderata. Letto dalla stessa variabile usata da sendEmail(), così non
 * può divergere dall'indirizzo con cui le email partono davvero. null se
 * EMAIL_FROM non è configurata.
 */
export function getSenderAddress(): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) return null;
  const bracketed = from.match(/<([^<>]+)>/);
  return (bracketed ? bracketed[1] : from).trim() || null;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /**
   * Chiave di idempotenza di Resend (header Idempotency-Key, valida 24 ore): una seconda
   * richiesta con la stessa chiave e lo stesso contenuto NON spedisce un'altra email e
   * restituisce lo stesso id. Serve agli avvisi "al massimo uno al giorno" anche tra istanze
   * serverless diverse e senza un database. Con la stessa chiave il contenuto deve restare
   * identico, altrimenti Resend risponde con un errore.
   */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, text, from, replyTo, idempotencyKey } = params;

  if (!html && !text) {
    return { success: false, error: "sendEmail: serve almeno uno tra 'html' e 'text'" };
  }

  const resend = getClient();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY non configurata — invio saltato (nessuna email inviata). " +
      `Destinatario previsto: ${Array.isArray(to) ? to.join(", ") : to}, oggetto: "${subject}"`
    );
    return { success: false, error: "RESEND_API_KEY non configurata" };
  }

  const fromAddress = from || process.env.EMAIL_FROM;
  if (!fromAddress) {
    console.error("[email] EMAIL_FROM non configurata — impossibile inviare senza un mittente verificato");
    return { success: false, error: "EMAIL_FROM non configurata" };
  }

  try {
    // Il cast è sicuro: la validazione "almeno uno tra html/text" è già
    // fatta a runtime sopra — il tipo union di CreateEmailOptions (richiede
    // esplicitamente html/text/react) non è esprimibile con una spread
    // condizionale senza perdere quella garanzia già verificata.
    const { data, error } = await resend.emails.send(
      {
        from: fromAddress,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(replyTo ? { replyTo } : {}),
      } as CreateEmailOptions,
      idempotencyKey ? { idempotencyKey } : undefined
    );

    if (error) {
      console.error("[email] invio fallito:", error);
      return { success: false, error: error.message ?? String(error) };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[email] errore invio:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
