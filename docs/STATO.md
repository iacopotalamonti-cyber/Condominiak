# Stato del progetto — aggiornato al 23/09/2026

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
| Recupero password | `src/app/login/`, `src/app/reset/` | funzionante — richiede gli indirizzi di ritorno elencati in Supabase |
| Invito condomino via token | `src/app/invite/[token]/`, `src/app/api/invite-resident/` | funzionante |
| Wizard di onboarding condominio | `src/app/onboarding/`, `src/components/onboarding/` | funzionante |
| Lettura diretta dei rendiconti conosciuti | `src/lib/lettura.ts`, `src/lib/motore.ts`, `src/lib/profili.ts`, `src/lib/profilo.ts` | funzionante, tre formati, costo zero |
| Estrazione AI da documenti | `netlify/functions/extract-background.mts`, `src/app/api/extract-status/` | funzionante, asincrona — usata solo quando la lettura diretta non basta |
| Provenienza degli importi (documento/pagina/riga) | `fonti` su `bilanci`, `fonte_*` su `spese`/`movimenti` | funzionante |
| Quadratura bilancio + conflitti | `src/lib/bilancio.ts`, `src/lib/riconciliazione.ts` | funzionante, con test |
| Dashboard amministratore | `src/app/dashboard/page.tsx` | funzionante |
| Bilanci (storico, quadratura, rianalisi) | `src/app/dashboard/bilanci/` | funzionante |
| Analisi spese per categoria | `src/app/dashboard/spese/` | funzionante |
| Incassi e partite personali | `src/app/dashboard/spese/`, `src/lib/incassi.ts` | funzionante |
| Anagrafica fornitori + movimenti | `src/app/dashboard/fornitori/`, `src/lib/fornitori.ts` | funzionante |
| Archivio documenti | `src/app/dashboard/documenti/` | funzionante |
| Impianti (anagrafica + scadenze) | `src/app/dashboard/impianti/` | funzionante |
| Vista condomino (il suo appartamento) | `src/app/dashboard/appartamento/` | funzionante — la quota viene dal riparto letto, non da una divisione per millesimi |
| Lettura del riparto per unità | `src/lib/riparto.ts`, `src/lib/quote.ts` | funzionante sui rendiconti Tosiani |
| Impostazioni condominio | `src/app/dashboard/impostazioni/` | funzionante |

## Modello dati (tabelle Supabase)

`condominiums`, `unita`, `bilanci`, `spese`, `incassi`, `quote_unita`, `movimenti`,
`fornitori`, `impianti`, `pagamenti`, `documenti`. Definizioni TypeScript in `src/lib/types.ts`.

Migrazioni applicate, in ordine (`supabase/migrations/`):

1. `20260914000000_provenienza_importi.sql`
2. `20260916000000_verifica_non_possibile.sql`
3. `20260916100000_movimenti.sql`
4. `20260916110000_anagrafica_fornitori.sql`
5. `20260920120000_spese_lette_dai_documenti.sql` — sostituisce i numeri estratti
   dal modello con quelli letti dai documenti, sei esercizi dal 2020 al 2025
6. `consuntivo_e_totale_documento_separati` (applicata il 20/09/2026)
7. `20260920130000_incassi.sql` — la tabella delle partite di singoli condomini
8. `20260920140000_incassi_dei_sei_esercizi.sql` — le quattro righe dei sei anni

9. `20260923100000_quote_dal_riparto.sql` — anagrafica completa (tipologia,
   codice, subalterno) e tabella `quote_unita`. Provata su staging prima
10. `20260923110000_quote_tre_esercizi.sql` — le 30 unità mancanti e le quote di
    2023, 2024, 2025. Il modo esatto di tornare indietro è in
    `supabase/rollback/`

Le quattro del 20/09 sono state applicate direttamente in produzione, con un
backup prima e una verifica dopo, saltando lo staging — che è stato riallineato
solo in seguito e ha la tabella `incassi` ma non i suoi dati. Vedi la nota al
punto 4 di `ROADMAP.md`.

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
- **Sentry è collegato ma spento finché manca il DSN su Netlify.**
- **Il backup non è ancora stato provato con un ripristino.** Dal 20/09/2026 il
  database ha una copia giornaliera (`.github/workflows/backup.yml`), ma finché
  non se ne ripristina una su staging non sappiamo se sia utilizzabile.
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

`npm test` — dieci file in `src/lib/__tests__/`: `anthropic`, `bilancio`,
`lettura`, `motore`, `movimenti`, `profilo`, `quote`, `rendiconto`, `riparto`,
`riconciliazione`. Centosette test che coprono il calcolo, il parsing e la lettura dei rendiconti;
non le pagine, non le API, non i flussi end-to-end.

## Dati in archivio

Un condominio, Via Enriques 3, con sei esercizi dal 2019-2020 al 2024-2025.
Tutti letti dai documenti, tutti in quadratura al centesimo con il totale
stampato. I movimenti (il dettaglio per fornitore) esistono solo per il
2024-2025: 67 righe, 21 fornitori.

Anagrafica di 44 unità — 14 appartamenti, 12 box, 13 cantine, 5 posti auto — con
millesimi generali che sommano 1000,000. Quote per unità lette dal riparto per
2023, 2024 e 2025: 132 righe, ogni esercizio in quadratura con la riga "Totali
Condominio" del proprio rendiconto.

## Lettura dei rendiconti

Tre formati riconosciuti — Studio Tosiani, Studio Contavalli, MULTIGEST —
descritti come dati in `src/lib/profili.ts` ed eseguiti da un motore solo
(`src/lib/motore.ts`). Un rendiconto riconosciuto non viene mandato al modello:
la lettura costa zero e si verifica da sola contro il totale che il documento
stampa. Se non quadra al centesimo, se incontra un codice senza categoria o se
non si capisce l'anno, si dichiara inutilizzabile e il documento va al modello
come prima.

Verificata sui sei rendiconti di Via Enriques 3, dal 2019-2020 al 2024-2025:
sei letture utilizzabili, scarto 0,00 su tutte.

Da riga di comando: `npm run leggi-bilancio -- percorso/del/rendiconto.pdf`.
