-- Movimenti: il dettaglio riga per riga del rendiconto.
--
-- Finora di un esercizio si conservava un solo importo per categoria. Un
-- rendiconto analitico però elenca i singoli movimenti, ciascuno con il proprio
-- fornitore, e quel dettaglio serve a due cose: classificare la spesa per
-- fornitore, e far quadrare i totali per costruzione invece che per fiducia
-- (le righe di spese diventano la somma dei movimenti di quella categoria).
--
-- La tabella spese resta: un documento sintetico, senza dettaglio, continua a
-- produrre solo i totali di categoria.

create table if not exists public.movimenti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  anno integer not null,
  -- Data del movimento come stampata nel documento; spesso manca.
  data date,
  descrizione text not null default '',
  -- Nome del fornitore così come compare nel documento. Null quando la riga
  -- non ne indica uno (consumi, conguagli, giroconti).
  fornitore text,
  categoria text not null,
  importo numeric not null default 0,
  fonte_documento text,
  fonte_pagina integer,
  fonte_testo text,
  fonte_verificata boolean not null default false,
  fonte_verificabile boolean not null default false,
  documento_path text
);

comment on table public.movimenti is
  'Singole righe di spesa di un rendiconto analitico, con il fornitore di ciascuna.';

create index if not exists movimenti_condominio_anno_idx
  on public.movimenti (condominium_id, anno);
create index if not exists movimenti_fornitore_idx
  on public.movimenti (condominium_id, fornitore);

alter table public.movimenti enable row level security;

-- Stessi permessi di spese: l'amministratore possiede il condominio, il
-- condomino legge quello in cui ha un'unità.
drop policy if exists admin_movimenti on public.movimenti;
create policy admin_movimenti on public.movimenti
  for all
  using (
    condominium_id in (
      select condominiums.id from public.condominiums where condominiums.owner_id = auth.uid()
    )
  );

drop policy if exists resident_read_movimenti on public.movimenti;
create policy resident_read_movimenti on public.movimenti
  for select
  using (
    condominium_id in (
      select unita.condominium_id from public.unita where unita.user_id = auth.uid()
    )
  );
