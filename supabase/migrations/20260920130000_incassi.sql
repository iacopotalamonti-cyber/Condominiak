-- Il denaro che entra non è una spesa col segno meno.
--
-- Un rendiconto stampa un totale generale che comprende anche le partite di
-- singoli condomini: il rimborso di un sinistro assicurativo incassato dal
-- condominio, una spesa riaddebitata a chi l'ha causata. Sommarle alle spese
-- le fa sparire dentro una categoria — l'assicurazione del 2023-2024 diventa
-- negativa — e toglierle senza dirlo fa sembrare che i conti non tornino: le
-- voci sommano 30.793,26 contro i 28.293,26 stampati, e l'applicazione
-- avvisava che 2.500 € erano contati due volte.
--
-- Non erano contati due volte: erano un rimborso assicurativo incassato. Qui
-- trova un posto suo, e la differenza fra le spese e il totale stampato smette
-- di essere un errore e diventa una riga che si può leggere.

create table if not exists public.incassi (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  anno integer not null,
  descrizione text not null,
  -- Il segno è quello con cui la voce compare nel documento: negativo quando
  -- il rendiconto la sottrae dalle spese (un rimborso incassato), positivo
  -- quando ve la somma (una spesa riaddebitata a un singolo). Vale sempre
  -- spese = totale stampato - somma di queste righe, e quella è la sola
  -- ragione per cui la colonna non è dichiarata positiva.
  importo numeric(12,2) not null,
  -- Il codice della voce nel rendiconto ("008.002", "12"): stabile fra gli
  -- anni, e l'unica chiave con cui riconoscere la stessa partita.
  codice text,
  fonte_documento text,
  fonte_pagina integer,
  fonte_testo text,
  fonte_verificata boolean not null default false,
  fonte_verificabile boolean not null default false,
  documento_path text,
  note text,
  unique (condominium_id, anno, descrizione)
);

comment on table public.incassi is
  'Partite di singoli condomini dentro il totale del rendiconto: rimborsi incassati e spese riaddebitate. Non sono spesa comune.';

alter table public.incassi enable row level security;

-- Stesse regole delle spese: l'amministratore del condominio scrive, chi ha
-- un''unità nel condominio legge.
drop policy if exists admin_incassi on public.incassi;
create policy admin_incassi on public.incassi
  for all using (
    condominium_id in (select id from public.condominiums where owner_id = auth.uid())
  );

drop policy if exists resident_read_incassi on public.incassi;
create policy resident_read_incassi on public.incassi
  for select using (
    condominium_id in (select condominium_id from public.unita where user_id = auth.uid())
  );

create index if not exists incassi_condominio_anno on public.incassi (condominium_id, anno);
