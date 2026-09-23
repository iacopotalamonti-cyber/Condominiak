-- Il riparto diventa un dato, e l'anagrafica diventa completa.
--
-- L'applicazione calcolava la quota di un appartamento come millesimi diviso
-- millesimi totali, per la spesa dell'anno. Il rendiconto invece la stampa,
-- unità per unità, e la calcola in un altro modo: con nove basi diverse —
-- millesimi generali, scale e ascensore, corsello garage, fotovoltaico… — e con
-- riscaldamento e acqua a contatore. Sul 2024-2025 la divisione sbagliava da
-- -34% a +59% a seconda dell'appartamento.
--
-- Qui la quota diventa quello che il documento dichiara, e si conserva così
-- com'è stampata: importi e millesimi colonna per colonna, in jsonb, perché le
-- colonne cambiano da un esercizio all'altro (il 2022-2023 ne ha dieci, gli
-- altri nove) e non sono le nostre categorie ma le basi di riparto del
-- condominio.
--
-- L'anagrafica, poi, conosceva solo gli appartamenti: 14 unità che sommano
-- 908,52 millesimi generali. Gli altri 91,48 sono di 30 unità — box, cantine,
-- posti auto — che nel 2024-2025 hanno pagato 1.357,80 €. Entrano anche loro.

-- ---------------------------------------------------------------------------
-- Unità di ogni tipologia
-- ---------------------------------------------------------------------------

-- Un box non ha un interno. L'unicità resta per chi ce l'ha: Postgres non
-- considera uguali due NULL, quindi più pertinenze senza interno convivono.
alter table public.unita alter column interno drop not null;

-- I millesimi si stampano con tre decimali (79,065): con due, la quota di
-- ogni unità perdeva mezzo millesimo prima ancora di essere usata.
alter table public.unita alter column millesimi type numeric(8,3);

-- Il codice con cui l'amministratore identifica l'unità nel rendiconto
-- ("009"). È la chiave che collega un'unità alla sua riga di riparto, anno
-- dopo anno, senza dipendere da come è scritto il nome.
alter table public.unita add column if not exists codice text;
alter table public.unita add column if not exists sub text;
alter table public.unita add column if not exists tipologia text not null default 'appartamento';

alter table public.unita drop constraint if exists unita_tipologia_valida;
alter table public.unita add constraint unita_tipologia_valida
  check (tipologia in ('appartamento', 'box', 'cantina', 'posto_auto', 'altro'));

create unique index if not exists unita_condominio_codice
  on public.unita (condominium_id, codice) where codice is not null;

comment on column public.unita.millesimi is
  'Millesimi generali. Non sono la base della quota: quella sta in quote_unita, per ogni tabella di riparto.';

-- ---------------------------------------------------------------------------
-- La quota di ogni unità, come il rendiconto la stampa
-- ---------------------------------------------------------------------------

create table if not exists public.quote_unita (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  anno integer not null,
  -- Null quando nessuna unità dell'anagrafica ha quel codice: la riga resta,
  -- perché è un numero del documento, e aspetta di essere collegata.
  unita_id uuid references public.unita(id) on delete set null,
  codice_unita text not null,
  tipologia text,
  nome_nel_documento text,
  -- Colonna del riparto → importo. {"Millesimi Generali": 441.86, …}
  importi jsonb not null,
  -- Colonna del riparto → millesimi dell'unità in quella tabella.
  millesimi jsonb not null default '{}'::jsonb,
  totale numeric(12,2) not null,
  fonte_documento text,
  fonte_pagina integer,
  documento_path text,
  unique (condominium_id, anno, codice_unita)
);

comment on table public.quote_unita is
  'Quanto paga ogni unità in un esercizio, letto dal riparto stampato nel rendiconto. Non calcolato.';

alter table public.quote_unita enable row level security;

-- Stesse regole delle spese. La visibilità è quella di un rendiconto inviato
-- a tutti i condomini: chi è nel condominio legge tutte le righe, e la
-- pagina mostra a ciascuno la propria. Vedi DECISIONI.md, 19/09/2026.
drop policy if exists admin_quote_unita on public.quote_unita;
create policy admin_quote_unita on public.quote_unita
  for all using (
    condominium_id in (select id from public.condominiums where owner_id = auth.uid())
  );

drop policy if exists resident_read_quote_unita on public.quote_unita;
create policy resident_read_quote_unita on public.quote_unita
  for select using (
    condominium_id in (select condominium_id from public.unita where user_id = auth.uid())
  );

create index if not exists quote_unita_condominio_anno on public.quote_unita (condominium_id, anno);
create index if not exists quote_unita_unita on public.quote_unita (unita_id);
