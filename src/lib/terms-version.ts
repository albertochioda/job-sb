/**
 * Versione corrente dei Termini di Servizio e dell'Informativa Privacy.
 *
 * Alzare questo valore attiva il banner di ri-accettazione bloccante per
 * ogni utente il cui profiles.terms_version è diverso da questo valore.
 *
 * "3.0-2026-09-25" pubblicata il 2026-09-25 — revisione sostanziale
 * successiva all'audit privacy/sicurezza del 2026-09-24/25 (vedi memoria
 * di sessione): riflette il motore Gemini come motore di scoring attivo
 * (non più solo Anthropic), il nuovo Trial a pagamento one-time (€3,49,
 * non più gratuito), i flussi di pagamento/rinnovo per Individual e
 * Professional, la regione Supabase (eu-west-1/Irlanda) e i dettagli di
 * retention verificati punto per punto nell'audit. Testo finale in
 * C:\Users\proprietario\Downloads\Job_Search_Bridge_Privacy_Policy_V3_aggiornata.docx
 * e Job_Search_Bridge_Termini_Condizioni_V3.docx.
 *
 * IMPORTANTE — versione "2.0-2026-09-07" non è mai stata notificata: il
 * passo 3 della procedura sotto non era mai stato lanciato per quella
 * versione (era rimasto "in attesa di conferma esplicita di Alberto").
 * Passando direttamente a 3.0, gli utenti che hanno accettato 1.0-beta o
 * 2.0-2026-09-07 vedranno comunque il banner di ri-accettazione al primo
 * accesso (confronto sempre contro l'ultimo valore), quindi tecnicamente
 * nessuno "salta" un'accettazione — ma nessuno è mai stato informato via
 * email del contenuto della versione 2.0. Da tenere presente prima di
 * lanciare la notifica per la 3.0.
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
 *    3.0-2026-09-25: NON ancora lanciato, in attesa di conferma esplicita
 *    di Alberto dopo aver verificato che le pagine siano corrette.
 */
export const CURRENT_TERMS_VERSION = "3.0-2026-09-25";
