-- Audit privacy 2026-09-24, punto 2 — cancellation_feedback.user_id
-- referenziava profiles(id) senza ON DELETE CASCADE (default NO ACTION),
-- confermato via pg_constraint. Rischio pratico oggi basso: la tabella è
-- già svuotata esplicitamente da account/delete/confirm/route.ts prima di
-- deleteUser() — questa è una difesa in profondità aggiuntiva, non una
-- correzione di un bug osservato.
--
-- Il blocco DO trova ed elimina da solo il vincolo esistente (qualunque
-- sia il suo nome), non serve conoscerlo in anticipo.

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'cancellation_feedback'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) like '%user_id%';

  if cname is not null then
    execute format('alter table public.cancellation_feedback drop constraint %I', cname);
  end if;
end $$;

alter table public.cancellation_feedback
  add constraint cancellation_feedback_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
