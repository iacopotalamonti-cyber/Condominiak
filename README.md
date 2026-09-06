# CondoTwin

SaaS B2B per la gestione digitale di condomini italiani: upload documenti (bilanci,
verbali, tabelle millesimali) → estrazione dati via AI (Claude) → dashboard
interattiva per amministratori e vista dedicata per ogni condomino.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + componenti in stile shadcn/ui (scritti a mano)
- Supabase (Postgres, Auth, Storage, RLS)
- Anthropic API (estrazione documenti via vision)
- Recharts
- Deploy: Netlify

## Setup locale

```bash
npm install
cp .env.local.example .env.local   # compila con le tue chiavi
npm run dev
```

Variabili richieste in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # solo server-side, mai esporre al client
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=CondoTwin
```

Lo schema del database (tabelle + RLS + bucket storage) è già applicato sul
progetto Supabase collegato a questo repository.

## Struttura

- `src/app/login`, `src/app/invite/[token]` — autenticazione e inviti condomini
- `src/app/onboarding` — wizard di configurazione (upload → estrazione AI → verifica → salvataggio)
- `src/app/dashboard/*` — cruscotto amministratore e vista condomino (`/dashboard/appartamento`)
- `src/app/api/*` — route per estrazione AI, salvataggio wizard, inviti
- `src/lib` — client Supabase, tipi, calcoli condominiali, helper Anthropic
- `src/components` — componenti UI, dashboard, onboarding, layout

## Deploy su Netlify

Il repository include `netlify.toml` (build command, plugin Next.js, header
CORS per le API). Collega il repo a Netlify e imposta le stesse variabili
d'ambiente elencate sopra in Site settings → Environment variables.
