-- Storico append-only delle accettazioni ToS/Privacy Policy — prerequisito
-- per l'attivazione del flusso di ri-accettazione basato su
-- CURRENT_TERMS_VERSION (vedi lib/terms-version.ts).
--
-- profiles.terms_version/terms_accepted_at restano lo stato "corrente"
-- veloce da leggere (usato da TermsReacceptanceModal per decidere se
-- mostrare il blocco) — vengono sovrascritti ad ogni accettazione, come
-- oggi. Questa tabella invece non viene MAI aggiornata dopo l'inserimento:
-- una riga per ogni accettazione realmente avvenuta, per sempre. Nessuna
-- policy UPDATE o DELETE per authenticated: l'append-only è garantito dal
-- database, non solo per convenzione nel codice applicativo.
--
-- Nessun indirizzo IP o altro metadato: non risulta raccolto altrove nel
-- progetto (verificato — nessun codice legge x-forwarded-for o simili),
-- e non è stato richiesto — evitare di introdurre una nuova raccolta dati
-- non necessaria.
create table if not exists terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now()
);

create index if not exists idx_terms_acceptances_user_id on terms_acceptances(user_id);

alter table terms_acceptances enable row level security;

-- L'utente può inserire SOLO una riga a proprio nome (accept-terms/route.ts
-- usa il client con RLS, non quello admin) e leggere solo le proprie righe.
-- Nessuna policy per update/delete: né l'utente né un ruolo authenticated
-- generico possono modificare o rimuovere una riga già scritta — solo il
-- service role (che comunque bypassa sempre RLS) potrebbe, in pratica mai
-- usato per questo.
create policy "users can insert their own terms acceptance"
  on terms_acceptances for insert
  with check (auth.uid() = user_id);

create policy "users can view their own terms acceptance"
  on terms_acceptances for select
  using (auth.uid() = user_id);
