/**
 * Versione corrente dei Termini di Servizio e dell'Informativa Privacy.
 *
 * Alzare questo valore attiva il banner di ri-accettazione bloccante per
 * ogni utente il cui profiles.terms_version è diverso da questo valore.
 *
 * "2.0-2026-09-07" pubblicata il 2026-09-07 (ToS: docs/drafts/
 * termini-di-servizio-draft-v2-abbonamento-e-cancellazione-account.tsx;
 * Privacy Policy: docs/drafts/privacy-policy-draft-stripe.tsx) — SENZA
 * revisione legale formale, scelta consapevole del Titolare (vedi nota in
 * testa a entrambi i file di bozza). I 6 utenti esistenti a quella data
 * avevano tutti terms_version="1.0-beta" e vedranno quindi il banner al
 * primo accesso successivo.
 *
 * PROCEDURA COMPLETA per pubblicare una nuova versione dei documenti legali:
 * 1. Pubblicare il nuovo testo in src/app/[locale]/termini-di-servizio/page.tsx
 *    e/o privacy-policy/page.tsx (partendo dalla bozza approvata in
 *    docs/drafts/).
 * 2. Alzare CURRENT_TERMS_VERSION qui sotto al nuovo valore — attiva il
 *    banner di ri-accettazione per ogni utente esistente.
 * 3. Notificare via email gli utenti esistenti: da loggato come Alberto
 *    (OWNER_EMAIL), dalla console del browser sul sito:
 *      fetch('/api/admin/notify-terms-change', {
 *        method: 'POST',
 *        headers: { 'Content-Type': 'application/json' },
 *        body: JSON.stringify({ effective_date: 'GG/MM/AAAA' }) // opzionale, default oggi
 *      }).then(r => r.json()).then(console.log)
 *    Endpoint protetto dalla stessa identità OWNER_EMAIL già usata per la
 *    dashboard KPI (src/app/api/admin/notify-terms-change/route.ts) — non
 *    va mai chiamato dal worker Python. Invia un'unica email a ogni utente
 *    registrato, in batch con un piccolo ritardo tra un invio e l'altro per
 *    rispettare i rate limit di Resend. Mai automatico: va lanciato a mano,
 *    solo quando si decide davvero di pubblicare. Per la versione
 *    2.0-2026-09-07: NON ancora lanciato, in attesa di conferma esplicita
 *    di Alberto dopo aver verificato che il resto funzioni correttamente.
 */
export const CURRENT_TERMS_VERSION = "2.0-2026-09-07";
