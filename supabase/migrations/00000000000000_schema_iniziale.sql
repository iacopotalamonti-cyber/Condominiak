-- Schema iniziale — ricostruito dal progetto Supabase di produzione il 19/09/2026.
--
-- Fino a oggi lo schema esisteva solo sul database: le migrazioni successive
-- aggiungevano pezzi a tabelle che nessun file aveva mai creato, e da questo
-- repository non si poteva né ricreare un ambiente né leggere le policy di
-- sicurezza. Questo file chiude quel buco.
--
-- Rappresenta lo stato del database a oggi, migrazioni successive comprese:
-- su un database vuoto va eseguito per primo, e le quattro migrazioni datate
-- che lo seguono diventano innocue (sono scritte con "if not exists").
--
-- Nota: nessun trigger aggiorna updated_at. Le colonne esistono ma il valore
-- cambia solo se lo scrive l'applicazione.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table if not exists public.condominiums (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  via text not null,
  civico text,
  citta text not null,
  cap text,
  provincia text,
  anno_costruzione integer,
  piani integer not null default 4,
  n_appartamenti integer not null default 12,
  piano_terra boolean default true,
  nome_amm text,
  email_amm text,
  tel_amm text,
  owner_id uuid not null references auth.users(id) on delete cascade
);

create table if not exists public.unita (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  interno integer not null,
  piano text,
  mq numeric(6,1),
  millesimi numeric(7,2) not null,
  nome_proprietario text,
  email text,
  telefono text,
  -- Collegamento al condòmino che ha accettato l'invito. Resta null finché
  -- l'unità non è rivendicata.
  user_id uuid references auth.users(id),
  unique (condominium_id, interno)
);

create table if not exists public.bilanci (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  anno integer not null,
  preventivo numeric(12,2),
  consuntivo numeric(12,2),
  fondo_riserva numeric(12,2),
  note text,
  -- Totale stampato nel documento, per rifare la quadratura dopo il salvataggio.
  totale_documento numeric,
  -- Provenienza dei tre importi: documento, pagina, riga.
  fonti jsonb,
  documento_path text,
  unique (condominium_id, anno)
);

create table if not exists public.spese (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  anno integer not null,
  categoria text not null,
  importo numeric(12,2) not null default 0,
  note text,
  fonte_documento text,
  fonte_pagina integer,
  fonte_testo text,
  fonte_verificata boolean not null default false,
  fonte_verificabile boolean not null default false,
  documento_path text,
  unique (condominium_id, anno, categoria)
);

create table if not exists public.fornitori (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  nome text not null,
  alias text[] not null default '{}'::text[],
  piva text,
  note text
);

comment on table public.fornitori is
  'Fornitori del condominio: nome canonico più gli alias con cui compaiono nei documenti.';

create table if not exists public.movimenti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  anno integer not null,
  data date,
  descrizione text not null default '',
  fornitore text,
  categoria text not null,
  importo numeric not null default 0,
  fonte_documento text,
  fonte_pagina integer,
  fonte_testo text,
  fonte_verificata boolean not null default false,
  fonte_verificabile boolean not null default false,
  documento_path text,
  fornitore_id uuid references public.fornitori(id) on delete set null
);

comment on table public.movimenti is
  'Singole righe di spesa di un rendiconto analitico, con il fornitore di ciascuna.';

create table if not exists public.impianti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  tipo text not null,
  presente boolean default true,
  marca text,
  anno_installazione text,
  ultima_revisione text,
  contratto_ditta text,
  scadenza_contratto text,
  stato text default 'ok' check (stato in ('ok', 'warning', 'critical')),
  note text,
  unique (condominium_id, tipo)
);

create table if not exists public.pagamenti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  unita_id uuid not null references public.unita(id) on delete cascade,
  anno integer not null,
  mese integer not null check (mese between 1 and 12),
  importo numeric(10,2),
  stato text default 'ok' check (stato in ('ok', 'ritardo', 'non_pagato')),
  data_pagamento date,
  note text,
  unique (unita_id, anno, mese)
);

create table if not exists public.documenti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  nome text not null,
  tipo text,
  storage_path text,
  data_emissione date,
  data_scadenza date,
  ai_processed boolean default false,
  ai_extracted_at timestamptz,
  ai_confidence numeric(3,2),
  note text
);

-- ---------------------------------------------------------------------------
-- Indici
-- ---------------------------------------------------------------------------

create index if not exists fornitori_condominio_idx on public.fornitori (condominium_id);

-- Protegge dai doppioni per nome, a parità di condominio e ignorando maiuscole.
create unique index if not exists fornitori_nome_unico
  on public.fornitori (condominium_id, lower(nome));

create index if not exists movimenti_condominio_anno_idx on public.movimenti (condominium_id, anno);
create index if not exists movimenti_fornitore_idx on public.movimenti (condominium_id, fornitore);
create index if not exists movimenti_fornitore_id_idx on public.movimenti (fornitore_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Due sole relazioni reggono tutti i permessi:
--   amministratore = chi possiede il condominio (condominiums.owner_id)
--   condòmino      = chi è collegato a un'unità   (unita.user_id)
-- Il primo può tutto sul proprio condominio, il secondo può solo leggere.
-- Il limite di questo impianto è documentato in docs/SERVIZI.md: non esprime
-- un consigliere che non possiede il record, un utente con due case, un ospite
-- o un accesso revocato. Va sostituito da una tabella di appartenenza.
-- ---------------------------------------------------------------------------

alter table public.condominiums enable row level security;
alter table public.unita enable row level security;
alter table public.bilanci enable row level security;
alter table public.spese enable row level security;
alter table public.fornitori enable row level security;
alter table public.movimenti enable row level security;
alter table public.impianti enable row level security;
alter table public.pagamenti enable row level security;
alter table public.documenti enable row level security;

drop policy if exists owner_full_access on public.condominiums;
create policy owner_full_access on public.condominiums
  for all using (owner_id = auth.uid());

drop policy if exists admin_access on public.unita;
create policy admin_access on public.unita
  for all using (
    condominium_id in (select id from public.condominiums where owner_id = auth.uid())
  );

-- Nota: questa policy non ha WITH CHECK, quindi la USING vale anche in
-- scrittura. Un utente può agire solo su una riga che è GIÀ sua: non può
-- rivendicare un'unità non collegata. È il motivo per cui l'accettazione
-- dell'invito, se fatta dal client, non collega nessuno.
drop policy if exists resident_access on public.unita;
create policy resident_access on public.unita
  for all using (user_id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array['bilanci', 'spese', 'fornitori', 'movimenti', 'impianti', 'documenti']
  loop
    execute format('drop policy if exists admin_%1$s on public.%1$I', t);
    execute format($f$
      create policy admin_%1$s on public.%1$I
        for all using (
          condominium_id in (select id from public.condominiums where owner_id = auth.uid())
        )
    $f$, t);

    execute format('drop policy if exists resident_read_%1$s on public.%1$I', t);
    execute format($f$
      create policy resident_read_%1$s on public.%1$I
        for select using (
          condominium_id in (select condominium_id from public.unita where user_id = auth.uid())
        )
    $f$, t);
  end loop;
end $$;

drop policy if exists admin_pagamenti on public.pagamenti;
create policy admin_pagamenti on public.pagamenti
  for all using (
    condominium_id in (select id from public.condominiums where owner_id = auth.uid())
  );

-- Il condòmino vede solo i pagamenti della propria unità, non quelli del
-- condominio: è l'unica tabella dove la morosità altrui resta fuori.
drop policy if exists resident_read_pagamenti on public.pagamenti;
create policy resident_read_pagamenti on public.pagamenti
  for select using (
    unita_id in (select id from public.unita where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documenti-condominiali',
  'documenti-condominiali',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- I file stanno in <condominium_id>/..., tranne quelli caricati durante
-- l'onboarding, che vivono in pending/<user_id>/... finché il condominio non
-- esiste ancora.

drop policy if exists admin_storage_documenti on storage.objects;
create policy admin_storage_documenti on storage.objects
  for all using (
    bucket_id = 'documenti-condominiali'
    and ((storage.foldername(name))[1])::uuid in (
      select id from public.condominiums where owner_id = auth.uid()
    )
  );

drop policy if exists resident_read_storage_documenti on storage.objects;
create policy resident_read_storage_documenti on storage.objects
  for select using (
    bucket_id = 'documenti-condominiali'
    and ((storage.foldername(name))[1])::uuid in (
      select condominium_id from public.unita where user_id = auth.uid()
    )
  );

drop policy if exists own_pending_uploads on storage.objects;
create policy own_pending_uploads on storage.objects
  for all
  using (
    bucket_id = 'documenti-condominiali'
    and (storage.foldername(name))[1] = 'pending'
    and (storage.foldername(name))[2] = (auth.uid())::text
  )
  with check (
    bucket_id = 'documenti-condominiali'
    and (storage.foldername(name))[1] = 'pending'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );
