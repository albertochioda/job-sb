-- Cancellazione account completa (GDPR art. 17) — due tabelle di supporto.
-- Nessuna delle due ha RLS permissiva: sono scritte/lette SOLO dal service
-- role (endpoint server-side con createAdminClient()), mai da PostgREST
-- lato client — abilitare RLS senza policy blocca esplicitamente qualunque
-- accesso anon/authenticated diretto a queste righe.

-- ============================================================================
-- account_deletion_requests — token monouso per il flusso a doppia conferma
-- (Opzione B): /api/account/delete/request genera il token e manda l'email
-- con il link; /api/account/delete/confirm lo consuma. Il token grezzo non
-- viene MAI salvato — solo il suo hash SHA-256, stesso principio di un
-- token di reset password: chi legge il DB non deve poter riusare il link.
-- ============================================================================
create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists idx_account_deletion_requests_token_hash
  on account_deletion_requests(token_hash);

alter table account_deletion_requests enable row level security;

-- ============================================================================
-- account_deletions — audit trail permanente della cancellazione avvenuta.
-- NON referenzia auth.users(id) con FK: deve sopravvivere alla riga utente
-- che documenta essere stata cancellata (altrimenti un CASCADE la
-- spazzerebbe via insieme al resto, vanificando la promessa della privacy
-- policy "dati eliminati entro 30gg dalla richiesta" — senza questa
-- tabella non ci sarebbe modo di dimostrare quando/se è stato rispettato).
-- user_id qui è quindi un uuid libero, solo per riferimento, non un vincolo.
-- ============================================================================
create table if not exists account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  had_active_subscription boolean not null default false,
  stripe_subscription_id text,
  stripe_customer_id text,
  refund_issued boolean not null default false,
  refund_amount_cents integer,
  requested_at timestamptz not null,
  completed_at timestamptz not null default now()
);

alter table account_deletions enable row level security;
