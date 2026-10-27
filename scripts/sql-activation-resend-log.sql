-- Contatori anti-abuso del reinvio dell'email di attivazione del Trial
-- (POST /api/trial/resend-activation, vedi lib/activation-resend.ts).
--
-- Una riga per richiesta: viene inserita con outcome 'pending' PRIMA dei controlli e
-- chiusa con l'esito finale (il limite conta solo le righe con id minore del proprio:
-- così richieste parallele non lo aggirano — vedi processResend()).
--
-- PRIVACY: nessuna email e nessun IP in chiaro. email_hash e ip_hash sono HMAC-SHA256
-- con una chiave derivata dalla service role key (un hash non reversibile, ma resta un
-- dato personale ai fini GDPR perché permette di riconoscere la stessa persona).
-- Conservazione: 7 giorni, cancellati dal cron giornaliero trial-end-check (vercel.json
-- ha già 2 cron, il massimo del piano Hobby: nessun cron nuovo).
-- NOTA: scripts/sql-terms-acceptances.sql afferma che nessun IP viene raccolto altrove;
-- con questa tabella non è più vero (solo come hash) — aggiornare l'informativa privacy.
--
-- Accesso: solo service role (che bypassa RLS). RLS attiva e NESSUNA policy: né anon né
-- authenticated possono leggere o scrivere la tabella.
--
-- ESECUZIONE: a mano dal SQL Editor di Supabase, UNA volta. Idempotente (if not exists).
-- Finché la tabella non esiste, la route risponde comunque 200 ma NON invia nessuna email
-- (fail closed), scrive un ERRORE nei log di Vercel ("[activation-resend] ERRORE: contatori ...")
-- e manda un avviso a ALERT_EMAIL_TO, al massimo uno al giorno. Il cron registra solo un errore
-- nei log, senza interrompersi.

create table if not exists activation_resend_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email_hash text not null,
  ip_hash text not null,
  outcome text not null default 'pending'
    check (outcome in ('pending', 'sent', 'not_eligible', 'rate_limited_email', 'rate_limited_ip', 'global_cap', 'error'))
);

-- Finestre di conteggio: per email (solo pending/sent), per IP (tutti), globale (ultima ora) e pulizia.
create index if not exists idx_activation_resend_log_email on activation_resend_log (email_hash, created_at desc);
create index if not exists idx_activation_resend_log_ip on activation_resend_log (ip_hash, created_at desc);
create index if not exists idx_activation_resend_log_created on activation_resend_log (created_at desc);

alter table activation_resend_log enable row level security;
revoke all on activation_resend_log from anon, authenticated;

-- Verifica dopo l'esecuzione (devono tornare: 1 tabella, rls = true, 0 righe):
--   select c.relname, c.relrowsecurity from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relname = 'activation_resend_log';
--   select count(*) from activation_resend_log;

-- Rollback (cancella anche lo storico dei contatori; la route torna a non inviare nulla):
--   drop table if exists activation_resend_log;
