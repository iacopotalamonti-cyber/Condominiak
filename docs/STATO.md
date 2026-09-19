# Stato del progetto — aggiornato al 19/09/2026

Mappa di quello che esiste **davvero nel codice** oggi. Serve a non rispiegare
il progetto da capo a ogni sessione, e a distinguere ciò che è fatto da ciò che
crediamo fatto. Va aggiornato quando una funzionalità entra in produzione, non
quando viene iniziata.

## Identità

Il prodotto si chiama **Condominiak**, come il dominio. Il nome è allineato in
tutto il codice (19/09/2026); non esistono più riferimenti a CondoTwin.

## Stack in uso

| Livello | Scelta | Dove si vede |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript | `package.json`, `src/app/` |
| UI | Tailwind CSS v4 + componenti stile shadcn/ui scritti a mano | `src/components/ui/` |
| Grafici | Recharts | `src/components/dashboard/*Chart.tsx` |
| Form | react-hook-form + zod | `src/components/onboarding/` |
| Database / Auth / Storage | Supabase (Postgres + RLS) | `src/lib/supabase/`, `supabase/migrations/` |
| AI | Anthropic API (estrazione da PDF) | `src/lib/anthropic.ts`, `netlify/functions/extract-background.mts` |
| PDF | `unpdf`, `pdf-lib` | `src/lib/anthropic.ts` |
| Hosting | Netlify (plugin Next.js + background function) | `netlify.toml`, `netlify/functions/` |

## Servizi già funzionanti

| Servizio | Dove | Stato |
| --- | --- | --- |
| Registrazione / login | `src/app/login/`, `src/middleware.ts` | funzionante |
| Invito condomino via token | `src/app/invite/[token]/`, `src/app/api/invite-resident/` | funzionante |
| Wizard di onboarding condominio | `src/app/onboarding/`, `src/components/onboarding/` | funzionante |
| Estrazione AI da documenti | `netlify/functions/extract-background.mts`, `src/app/api/extract-status/` | funzionante, asincrona |
| Provenienza degli importi (documento/pagina/riga) | `fonti` su `bilanci`, `fonte_*` su `spese`/`movimenti` | funzionante |
| Quadratura bilancio + conflitti | `src/lib/bilancio.ts`, `src/lib/riconciliazione.ts` | funzionante, con test |
| Dashboard amministratore | `src/app/dashboard/page.tsx` | funzionante |
| Bilanci (storico, quadratura, rianalisi) | `src/app/dashboard/bilanci/` | funzionante |
| Analisi spese per categoria | `src/app/dashboard/spese/` | funzionante |
| Anagrafica fornitori + movimenti | `src/app/dashboard/fornitori/`, `src/lib/fornitori.ts` | funzionante |
| Archivio documenti | `src/app/dashboard/documenti/` | funzionante |
| Impianti (anagrafica + scadenze) | `src/app/dashboard/impianti/` | funzionante |
| Vista condomino (il suo appartamento) | `src/app/dashboard/appartamento/` | funzionante |
| Impostazioni condominio | `src/app/dashboard/impostazioni/` | funzionante |

## Modello dati (tabelle Supabase)

`condominiums`, `unita`, `bilanci`, `spese`, `movimenti`, `fornitori`,
`impianti`, `pagamenti`, `documenti`. Definizioni TypeScript in `src/lib/types.ts`.

Migrazioni applicate, in ordine (`supabase/migrations/`):

1. `20260914000000_provenienza_importi.sql`
2. `20260916000000_verifica_non_possibile.sql`
3. `20260916100000_movimenti.sql`
4. `20260916110000_anagrafica_fornitori.sql`

Lo schema completo è in `supabase/migrations/00000000000000_schema_iniziale.sql`,
ricostruito dal database di produzione il 19/09/2026: tabelle, indici, policy RLS
e bucket storage. Su un database vuoto va eseguito per primo; le quattro
migrazioni datate che lo seguono diventano innocue.

Progetti Supabase (organizzazione "Condominial", eu-west-1):

- produzione — `mqmedyjwjzxwuxqgyahy`
- staging — `shzxqeyyxjhultofwzfz`, creato il 19/09/2026 applicando la migrazione
  iniziale: stesse 9 tabelle, 17 policy, 3 policy storage, 19 indici, 1 bucket.
  È anche la prova che la migrazione ricostruisce l'ambiente da zero.

## Cosa manca per poter chiamare "produzione" la produzione

Non sono funzionalità mancanti, sono i pezzi di infrastruttura che oggi non ci
sono affatto:

- **Un utente = un solo appartamento**: `getDashboardContext`
  (`src/lib/dashboard-context.ts:26` e `:37`) usa `maybeSingle()` sia sui
  condomini posseduti sia sulle unità. Chi ha due appartamenti non ottiene una
  riga e finisce rimbalzato all'onboarding. Incompatibile con il prodotto deciso.
- **Dai verbali non si estrae nulla**: sono accettati e archiviati, ma lo schema
  di estrazione copre solo anagrafica, unità, bilanci, spese e impianti. Nessuna
  delibera diventa un dato.
- **I fornitori nascono solo dall'estrazione** (`src/lib/fornitori-server.ts`):
  dall'interfaccia non se ne può aggiungere o correggere uno a mano.
- **Lo staging esiste ma Netlify non lo usa ancora**: finché le anteprime di
  deploy non puntano al progetto di staging, continuano a scrivere sul database
  di produzione.
- **Nessun tracciamento errori**: se una funzione di estrazione fallisce per un
  utente, lo sappiamo solo se ce lo racconta.
- **Il primo backup non è ancora girato**: il workflow esiste
  (`.github/workflows/backup.yml`) ma resta fermo finché nel repository non c'è
  il segreto `SUPABASE_DB_URL`. Fino ad allora il database, che contiene dati
  reali, non ha alcuna copia.
- **L'invito ai condòmini non collega nessuno** (verificato): la policy
  `resident_access` su `unita` impedisce a un invitato di rivendicare la propria
  unità, e l'update client-side fallisce in silenzio. Vedi `SERVIZI.md` → "Come
  si entra", punto 4.
- **Nessun pagamento, nessuna fatturazione, nessun contratto**: l'app non ha
  ancora un modo per incassare.
- **Nessun documento legale**: privacy policy, termini, registro trattamenti GDPR
  (l'app tratta dati personali di condomini per conto di amministratori: siamo
  responsabili del trattamento, serve un DPA).

## Test presenti

`npm test` — quattro file in `src/lib/__tests__/`: `anthropic`, `bilancio`,
`movimenti`, `riconciliazione`. Coprono il calcolo e il parsing, non le pagine,
non le API, non i flussi end-to-end.
