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

I fornitori hanno una loro anagrafica per condominio (`fornitori`), con il nome
canonico e gli alias con cui compaiono nei documenti: senza, la stessa ditta
scritta in due modi restava due fornitori e una correzione a mano si perdeva alla
rilettura successiva. Ogni movimento conserva comunque il nome come stampato nel
documento, che è provenienza.

I documenti caricati restano in archivio, quindi una rilettura non richiede di
ricaricarli: in *Analisi spese → Aggiungi un bilancio* ogni documento già
presente ha il suo pulsante **Rianalizza**. Serve quando l'estrazione migliora e
si vogliono rifare i conti sullo stesso documento.

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

## Costo dell'inferenza

Le chiamate al modello escono **direttamente verso `api.anthropic.com`**, con un
`baseURL` esplicito. Non è un dettaglio: dentro una Netlify Function l'AI Gateway
si inserisce da solo negli SDK supportati e fattura l'inferenza sui crediti del
piano — lo stesso monte che paga l'hosting. È già costato un sito offline
(6,15 $ di inferenza = 1.106 crediti su 1.000 disponibili). Con il `baseURL`
esplicito la spesa AI resta su Anthropic, dove è visibile, e non può più
spegnere l'applicazione.

Due variabili d'ambiente opzionali permettono di cambiare la leva di costo senza
un rilascio:

```bash
EXTRACTION_MODEL=claude-sonnet-5   # default: claude-opus-5
EXTRACTION_EFFORT=medium           # low | medium | high | xhigh | max
ANTHROPIC_BASE_URL=                # per tornare al gateway, se serve
```

Provare un modello più economico è un esperimento misurabile e non una
scommessa: la colonna Quadratura e i badge di verifica dicono se la qualità
regge. Ogni estrazione riporta quante chiamate e quanti token è costata, in
interfaccia e nei log della funzione.

## Deploy su Netlify

Il repository include `netlify.toml` (build command, plugin Next.js, header
CORS per le API). Collega il repo a Netlify e imposta le stesse variabili
d'ambiente elencate sopra in Site settings → Environment variables.
