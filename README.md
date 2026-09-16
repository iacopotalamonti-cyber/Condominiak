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
progetto Supabase collegato a questo repository. Le modifiche successive stanno
in `supabase/migrations/`: vanno applicate in ordine di nome, una volta sola
(vedi `supabase/migrations/README.md`).

```bash
npm test     # controlli sul parsing degli importi e sulla quadratura
```

## Struttura

- `src/app/login`, `src/app/invite/[token]` — autenticazione e inviti condomini
- `src/app/onboarding` — wizard di configurazione (upload → estrazione AI → verifica → salvataggio)
- `src/app/dashboard/*` — cruscotto amministratore e vista condomino (`/dashboard/appartamento`)
- `src/app/api/*` — route per estrazione AI, salvataggio wizard, inviti
- `src/lib` — client Supabase, tipi, calcoli condominiali, helper Anthropic
- `src/components` — componenti UI, dashboard, onboarding, layout
- `netlify/functions/extract-background.mts` — l'analisi vera dei documenti,
  fuori dai limiti di tempo delle funzioni sincrone

## Da dove vengono i numeri

Un importo estratto non viaggia mai da solo: porta con sé il documento, la
pagina e la riga da cui è stato letto (`fonti` su `bilanci`, colonne `fonte_*`
su `spese`). In interfaccia la riga compare sotto ogni cifra e apre il PDF alla
pagina giusta; i documenti caricati vengono quindi conservati, non cancellati
dopo l'analisi.

Tre controlli girano fuori dal modello, perché un modello non può verificare se
stesso:

- **verifica sul documento** — il testo del PDF viene estratto pagina per pagina
  e l'importo si considera verificato solo se le sue cifre sono davvero in quella
  pagina. Tre esiti distinti: verificato, non trovato nella pagina (un errore da
  controllare), non verificabile (scansione senza testo). La prima versione si
  appoggiava alle citazioni dell'API, ma quelle si agganciano alla prosa che il
  modello scrive e qui gli si chiede solo JSON: non ne arrivava nessuna;
- **quadratura** — la somma delle voci di spesa viene confrontata con il totale
  stampato nel documento, e lo scarto è mostrato in `/dashboard/bilanci`;
- **conflitti** — quando due documenti danno importi diversi per lo stesso
  campo, il valore scartato resta visibile invece di essere scelto in silenzio.

I rendiconti analitici elencano le singole righe, ciascuna con il proprio
fornitore: quelle righe finiscono in `movimenti` e alimentano la pagina
**Fornitori** (`/dashboard/fornitori`), che mostra quanto ha incassato ciascuno,
con quali categorie e in quali anni, e il link alla riga del documento. Quando il
dettaglio c'è, i totali per categoria sono la somma delle sue righe: quadrano per
costruzione invece che per fiducia. Le righe che non nominano una controparte —
consumi a contatore, conguagli, giroconti — restano nel totale sotto una voce
dichiarata, invece di sparire.

Quando i conti di un esercizio non tornano, l'estrazione rilegge una volta sola
il tratto di documento da cui vengono quegli importi, per intero: la causa più
frequente è una tabella tagliata a metà fra due blocchi di pagine.

## Deploy su Netlify

Il repository include `netlify.toml` (build command, plugin Next.js, header
CORS per le API). Collega il repo a Netlify e imposta le stesse variabili
d'ambiente elencate sopra in Site settings → Environment variables.
