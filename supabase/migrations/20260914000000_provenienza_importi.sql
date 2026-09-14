-- Provenienza degli importi estratti dai documenti.
--
-- Un numero senza l'indicazione di dove è stato letto non è verificabile:
-- queste colonne conservano documento, pagina e riga di testo da cui ogni
-- importo proviene, più il totale stampato nel documento, che permette di
-- rifare il controllo di quadratura anche dopo il salvataggio.
--
-- Tutte le colonne sono aggiuntive e ammettono NULL: le righe già presenti
-- restano valide e si presentano semplicemente come prive di provenienza.

alter table public.bilanci
  add column if not exists totale_documento numeric,
  add column if not exists fonti jsonb,
  add column if not exists documento_path text;

comment on column public.bilanci.totale_documento is
  'Totale complessivo stampato nel documento, usato per verificare la somma delle voci di spesa.';
comment on column public.bilanci.fonti is
  'Provenienza dei singoli importi: { "cons": { "documento", "pagina", "testo", "verificata" }, ... }';
comment on column public.bilanci.documento_path is
  'Percorso su Storage del documento da cui viene il bilancio.';

alter table public.spese
  add column if not exists fonte_documento text,
  add column if not exists fonte_pagina integer,
  add column if not exists fonte_testo text,
  add column if not exists fonte_verificata boolean not null default false,
  add column if not exists documento_path text;

comment on column public.spese.fonte_pagina is
  'Pagina del documento da cui è stato letto l''importo, 1-based.';
comment on column public.spese.fonte_verificata is
  'true se l''importo è stato ritrovato nel testo estratto dal PDF, non solo dichiarato dal modello.';
comment on column public.spese.documento_path is
  'Percorso su Storage del documento da cui viene la voce di spesa.';
