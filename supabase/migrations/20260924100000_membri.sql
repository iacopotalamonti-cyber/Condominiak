-- Chi appartiene a un condominio, e a quali unità.
--
-- Finora l'appartenenza era due colonne: condominiums.owner_id (chi l'ha
-- registrato, e quindi l'unico amministratore) e unita.user_id (l'unico utente
-- di un'unità). Ne seguivano tre limiti che il prodotto contraddice per
-- definizione: una persona non poteva appartenere a due condomini, un'unità non
-- poteva avere due persone — "Talamonti - Cappella" sono due — e una persona non
-- poteva avere appartamento, box e cantina. L'applicazione leggeva il
-- condominio e l'unità di un utente aspettandosene una sola riga, e con due
-- rimandava all'onboarding.
--
-- Qui l'appartenenza diventa una tabella, e il legame con le unità un'altra,
-- molti-a-molti. owner_id resta come memoria di chi ha registrato il
-- condominio, e user_id finché il codice non smette di leggerlo; nessuna delle
-- due decide più chi vede cosa.
--
-- Nella stessa migrazione la RLS viene riscritta sopra membri. Si risolvono
-- insieme due difetti segnalati dall'advisor di Supabase: auth.uid() veniva
-- ricalcolato a ogni riga (ora una volta per query, dentro una funzione), e
-- ogni tabella aveva due policy permissive valutate entrambe su ogni riga (ora
-- una per azione, solo per gli utenti autenticati). E se ne chiude un terzo: un
-- condomino poteva modificare la propria unità, compresi i millesimi. Ora i
-- condomini leggono e basta.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table if not exists public.membri (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- admin: gestisce il condominio (carica documenti, invita). resident: legge.
  ruolo text not null check (ruolo in ('admin', 'resident')),
  unique (condominium_id, user_id)
);
create index if not exists membri_utente on public.membri (user_id);

comment on table public.membri is
  'Chi appartiene a un condominio, con quale ruolo. Una persona può appartenere a più condomini.';

create table if not exists public.unita_membri (
  unita_id uuid not null references public.unita(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (unita_id, user_id)
);
create index if not exists unita_membri_utente on public.unita_membri (user_id);

comment on table public.unita_membri is
  'Le unità di una persona: più persone per unità, più unità per persona.';

-- L'invito era un link con l'id dell'unità: chi lo conosceva poteva tentare di
-- rivendicarla. Ora è un token casuale, di cui si conserva solo l'impronta,
-- con una scadenza, valido una volta e soltanto per l'email invitata.
create table if not exists public.inviti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  unita_id uuid references public.unita(id) on delete cascade,
  email text not null,
  ruolo text not null default 'resident' check (ruolo in ('admin', 'resident')),
  token_hash text not null unique,
  creato_da uuid references auth.users(id) on delete set null,
  scade_il timestamptz not null,
  usato_il timestamptz,
  usato_da uuid references auth.users(id) on delete set null
);
create index if not exists inviti_condominio on public.inviti (condominium_id);
create index if not exists inviti_unita on public.inviti (unita_id);
create index if not exists inviti_creato_da on public.inviti (creato_da);
create index if not exists inviti_usato_da on public.inviti (usato_da);

-- ---------------------------------------------------------------------------
-- Chi è l'utente, calcolato una volta per query
-- ---------------------------------------------------------------------------

-- security definer perché le policy di membri le usano a loro volta: senza,
-- leggere membri per decidere chi può leggere membri sarebbe una ricorsione.
-- search_path vuoto e nomi qualificati, perché una funzione con i privilegi del
-- proprietario non deve risolvere i nomi dove decide chi la chiama.
create or replace function public.condomini_membro()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.condominium_id from public.membri m where m.user_id = (select auth.uid())
$$;

create or replace function public.condomini_admin()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.condominium_id from public.membri m
  where m.user_id = (select auth.uid()) and m.ruolo = 'admin'
$$;

create or replace function public.unita_mie()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select um.unita_id from public.unita_membri um where um.user_id = (select auth.uid())
$$;

revoke all on function public.condomini_membro(), public.condomini_admin(), public.unita_mie() from public, anon;
grant execute on function public.condomini_membro(), public.condomini_admin(), public.unita_mie() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Chi c'era già
-- ---------------------------------------------------------------------------

insert into public.membri (condominium_id, user_id, ruolo)
select id, owner_id, 'admin' from public.condominiums where owner_id is not null
on conflict (condominium_id, user_id) do nothing;

insert into public.membri (condominium_id, user_id, ruolo)
select distinct condominium_id, user_id, 'resident' from public.unita where user_id is not null
on conflict (condominium_id, user_id) do nothing;

insert into public.unita_membri (unita_id, user_id)
select id, user_id from public.unita where user_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Le policy vecchie
-- ---------------------------------------------------------------------------

drop policy if exists owner_full_access on public.condominiums;
drop policy if exists admin_access on public.unita;
drop policy if exists resident_access on public.unita;
drop policy if exists admin_pagamenti on public.pagamenti;
drop policy if exists resident_read_pagamenti on public.pagamenti;

do $$
declare
  t text;
begin
  foreach t in array array['bilanci', 'spese', 'incassi', 'quote_unita', 'fornitori', 'movimenti', 'impianti', 'documenti']
  loop
    execute format('drop policy if exists admin_%1$s on public.%1$I', t);
    execute format('drop policy if exists resident_read_%1$s on public.%1$I', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Le policy nuove: una per azione, solo per chi ha fatto l'accesso
-- ---------------------------------------------------------------------------

-- Il condominio: lo vede chi ne fa parte, lo modifica chi lo gestisce. Si crea
-- solo dal server, che nella stessa operazione registra chi lo crea fra i
-- membri; non si cancella dall'applicazione.
create policy condominio_lettura on public.condominiums for select to authenticated
  using (id in (select public.condomini_membro()));
create policy condominio_modifica on public.condominiums for update to authenticated
  using (id in (select public.condomini_admin()))
  with check (id in (select public.condomini_admin()));

-- Le tabelle del condominio: le legge chi ne fa parte, le scrive chi lo
-- gestisce. La visibilità è quella di un rendiconto mandato a tutti i
-- condomini (DECISIONI.md, 19/09/2026).
do $$
declare
  t text;
begin
  foreach t in array array['unita', 'bilanci', 'spese', 'incassi', 'quote_unita', 'fornitori', 'movimenti', 'impianti', 'documenti']
  loop
    execute format($f$
      create policy %1$s_lettura on public.%1$I for select to authenticated
        using (condominium_id in (select public.condomini_membro()))
    $f$, t);
    execute format($f$
      create policy %1$s_inserimento on public.%1$I for insert to authenticated
        with check (condominium_id in (select public.condomini_admin()))
    $f$, t);
    execute format($f$
      create policy %1$s_modifica on public.%1$I for update to authenticated
        using (condominium_id in (select public.condomini_admin()))
        with check (condominium_id in (select public.condomini_admin()))
    $f$, t);
    execute format($f$
      create policy %1$s_cancellazione on public.%1$I for delete to authenticated
        using (condominium_id in (select public.condomini_admin()))
    $f$, t);
  end loop;
end $$;

-- I pagamenti sono l'eccezione: un condomino vede solo quelli delle sue unità.
create policy pagamenti_lettura on public.pagamenti for select to authenticated
  using (
    condominium_id in (select public.condomini_admin())
    or unita_id in (select public.unita_mie())
  );
create policy pagamenti_inserimento on public.pagamenti for insert to authenticated
  with check (condominium_id in (select public.condomini_admin()));
create policy pagamenti_modifica on public.pagamenti for update to authenticated
  using (condominium_id in (select public.condomini_admin()))
  with check (condominium_id in (select public.condomini_admin()));
create policy pagamenti_cancellazione on public.pagamenti for delete to authenticated
  using (condominium_id in (select public.condomini_admin()));

-- ---------------------------------------------------------------------------
-- Le tabelle nuove
-- ---------------------------------------------------------------------------

alter table public.membri enable row level security;
alter table public.unita_membri enable row level security;
alter table public.inviti enable row level security;

-- Ognuno vede le proprie appartenenze; chi gestisce vede quelle del suo
-- condominio. Entrare in un condominio passa sempre dal server, che controlla
-- l'invito: nessuno può aggiungersi da solo.
create policy membri_lettura on public.membri for select to authenticated
  using (user_id = (select auth.uid()) or condominium_id in (select public.condomini_admin()));
create policy membri_modifica on public.membri for update to authenticated
  using (condominium_id in (select public.condomini_admin()))
  with check (condominium_id in (select public.condomini_admin()));
create policy membri_cancellazione on public.membri for delete to authenticated
  using (condominium_id in (select public.condomini_admin()));

create policy unita_membri_lettura on public.unita_membri for select to authenticated
  using (
    user_id = (select auth.uid())
    or unita_id in (select u.id from public.unita u where u.condominium_id in (select public.condomini_admin()))
  );
create policy unita_membri_cancellazione on public.unita_membri for delete to authenticated
  using (unita_id in (select u.id from public.unita u where u.condominium_id in (select public.condomini_admin())));

create policy inviti_lettura on public.inviti for select to authenticated
  using (condominium_id in (select public.condomini_admin()));
create policy inviti_cancellazione on public.inviti for delete to authenticated
  using (condominium_id in (select public.condomini_admin()));

-- ---------------------------------------------------------------------------
-- Permessi (ROADMAP.md, regola 8) e indici
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.membri, public.unita_membri, public.inviti to authenticated;
grant all on table public.membri, public.unita_membri, public.inviti to service_role;

-- Le chiavi esterne che l'advisor segnalava senza indice.
create index if not exists condominiums_owner on public.condominiums (owner_id);
create index if not exists documenti_condominio on public.documenti (condominium_id);
create index if not exists pagamenti_condominio on public.pagamenti (condominium_id);
create index if not exists unita_utente on public.unita (user_id);
