-- Audit privacy 2026-09-24, punto 2 — scored_offers.last_matched_search_id
-- referenzia searches(id) con NO ACTION (default), confermato via
-- pg_constraint. Rischio REALE, non teorico: alla cancellazione account,
-- profiles viene cancellata → CASCADE parallelo su scored_offers.user_id
-- E searches.user_id (entrambi → profiles). Postgres non garantisce
-- l'ordine fra le due cascate nella stessa istruzione: se searches viene
-- cancellata PRIMA che la riga scored_offers che la referenzia sia stata
-- a sua volta rimossa dalla propria cascata, il vincolo NO ACTION
-- (controllato immediatamente dopo ogni riga cancellata sul lato
-- referenziato) solleva una foreign key violation che abortisce l'intera
-- transazione di deleteUser().
--
-- ON DELETE SET NULL invece di CASCADE: last_matched_search_id è un
-- riferimento informativo ("quale ricerca ha aggiornato per ultima questo
-- punteggio"), non un rapporto di ownership — perdere quel puntatore
-- specifico non fa perdere score/motivo/hard_gate, e soprattutto elimina
-- il problema di ordine sopra descritto (qualunque ordine di cascata,
-- SET NULL non fallisce mai su una riga che sta comunque per sparire).
--
-- Prerequisito verificato: last_matched_search_id è nullable
-- (information_schema.columns.is_nullable = 'YES', confermato prima di
-- scrivere questa migration).

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'scored_offers'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) like '%last_matched_search_id%';

  if cname is not null then
    execute format('alter table public.scored_offers drop constraint %I', cname);
  end if;
end $$;

alter table public.scored_offers
  add constraint scored_offers_last_matched_search_id_fkey
  foreign key (last_matched_search_id) references public.searches(id) on delete set null;
