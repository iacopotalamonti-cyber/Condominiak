-- Le schede di formato proposte dal modello, e la decisione su ciascuna.
--
-- Un formato non è di un condominio: è di uno studio o di un gestionale, e
-- vale per tutti i condomini che amministra. Per questo la scheda approvata
-- la usa l'estrazione di chiunque, e per questo a deciderla non è
-- l'amministratore di un condominio ma chi gestisce Condominiak (gli
-- "operatori", elencati per email nella variabile d'ambiente OPERATORI).
--
-- verifica: ciò che il motore ha letto con la scheda sul documento da cui è
-- nata — anno, totale stampato, scarto, voci con la loro categoria. È quello
-- che l'operatore guarda prima di approvare.

create table if not exists public.schede_formato (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  scheda jsonb not null,
  mappatura jsonb not null,
  verifica jsonb not null,
  stato text not null default 'proposta' check (stato in ('proposta', 'approvata', 'rifiutata')),
  documento_nome text,
  proposta_da uuid references auth.users (id) on delete set null,
  deciso_da uuid references auth.users (id) on delete set null,
  deciso_il timestamptz,
  created_at timestamptz not null default now()
);

-- Due schede approvate con lo stesso nome si contenderebbero la mappatura.
create unique index if not exists schede_formato_nome_approvata
  on public.schede_formato (lower(nome)) where stato = 'approvata';
create index if not exists schede_formato_stato on public.schede_formato (stato);
create index if not exists schede_formato_proposta_da on public.schede_formato (proposta_da);
create index if not exists schede_formato_deciso_da on public.schede_formato (deciso_da);

-- Solo il server. La RLS è attiva e senza policy: nemmeno un permesso concesso
-- per sbaglio renderebbe la tabella leggibile a un utente. Eccezione scritta
-- alla regola 8 della ROADMAP: authenticated non riceve permessi, perché non
-- c'è niente che un utente debba leggere qui direttamente.
alter table public.schede_formato enable row level security;
revoke all on public.schede_formato from anon, authenticated;
grant all on public.schede_formato to service_role;
