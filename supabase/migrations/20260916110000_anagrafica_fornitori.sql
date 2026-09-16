-- Anagrafica fornitori, per condominio.
--
-- Il fornitore era una stringa libera sulla riga di movimento. Tre conseguenze:
-- lo stesso fornitore scritto in due modi restava due fornitori; non c'era
-- posto dove tenere partita IVA, contatti o note; e una correzione fatta a mano
-- veniva persa alla rianalisi successiva, perché il nome si rideriva dal testo.
--
-- Con l'anagrafica il nome canonico lo decide l'utente una volta sola, e gli
-- alias registrano le forme con cui quel fornitore compare nei documenti, così
-- le estrazioni successive lo riconoscono da sole.

create table if not exists public.fornitori (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  nome text not null,
  -- Forme alternative con cui il nome compare nei documenti, già normalizzate.
  alias text[] not null default '{}',
  piva text,
  note text
);

comment on table public.fornitori is
  'Fornitori del condominio: nome canonico più gli alias con cui compaiono nei documenti.';

create unique index if not exists fornitori_nome_unico
  on public.fornitori (condominium_id, lower(nome));
create index if not exists fornitori_condominio_idx
  on public.fornitori (condominium_id);

alter table public.fornitori enable row level security;

drop policy if exists admin_fornitori on public.fornitori;
create policy admin_fornitori on public.fornitori
  for all
  using (
    condominium_id in (
      select condominiums.id from public.condominiums where condominiums.owner_id = auth.uid()
    )
  );

drop policy if exists resident_read_fornitori on public.fornitori;
create policy resident_read_fornitori on public.fornitori
  for select
  using (
    condominium_id in (
      select unita.condominium_id from public.unita where unita.user_id = auth.uid()
    )
  );

-- Il movimento punta all'anagrafica, ma conserva anche il nome come stampato
-- nel documento: è provenienza, e non va persa quando il nome canonico cambia.
alter table public.movimenti
  add column if not exists fornitore_id uuid references public.fornitori(id) on delete set null;

comment on column public.movimenti.fornitore is
  'Nome del fornitore come stampato nel documento. Il nome da mostrare sta in fornitori.nome.';

create index if not exists movimenti_fornitore_id_idx on public.movimenti (fornitore_id);
