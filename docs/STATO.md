# Stato del progetto — aggiornato al 25/09/2026

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
| Recupero password | `src/app/login/`, `src/app/reset/` | funzionante, provato il 25/09/2026 |
| Email di accesso | Supabase Auth → SMTP di Resend, testi in `supabase/email/` | da "Condominiak <noreply@condominiak.me>", in italiano (produzione). Dominio verificato su Resend (DKIM e SPF su GoDaddy). Indirizzi di ritorno: `condominiak.me`, `www.condominiak.me`, `condominiak.netlify.app` in produzione; `*--condominiak.netlify.app` sullo staging, che usa ancora l'SMTP di prova di Supabase (manda solo ai membri del team) |
| Invito via token | `src/app/invite/[token]/`, `src/app/api/invite-resident/`, `src/app/api/accetta-invito/`, `src/lib/inviti.ts` | funzionante — token segreto (solo l'impronta nel database), 14 giorni, uso singolo, legato all'email; accettato lato server |
| Più condomini e più unità per persona | `src/lib/appartenenza.ts`, `src/components/layout/CondominioSelector.tsx` | funzionante — tabelle `membri` e `unita_membri`, condominio attivo scelto con un cookie |
| Wizard di onboarding condominio | `src/app/onboarding/`, `src/components/onboarding/` | funzionante |
| Lettura diretta dei rendiconti conosciuti | `src/lib/lettura.ts`, `src/lib/motore.ts`, `src/lib/profili.ts`, `src/lib/profilo.ts` | funzionante, tre formati scritti a mano più quelli approvati, costo zero |
| Scheda di formato proposta dal modello | `src/lib/scheda.ts`, `src/lib/proposta-scheda.ts`, `src/app/dashboard/formati/` | per un PDF di formato sconosciuto il modello propone una scheda; il motore la prova contro il totale stampato; se quadra aspetta l'approvazione di un operatore (`OPERATORI`), poi legge senza modello tutti i rendiconti di quel formato. Non ancora provata su un formato vero |
| Estrazione AI da documenti | `netlify/functions/extract-background.mts`, `src/app/api/extract-status/` | funzionante, asincrona — usata solo quando la lettura diretta non basta. Chiede il token di sessione; analizza solo file propri o di un condominio che si amministra; lo stato lo legge solo chi l'ha avviata |
| Provenienza degli importi (documento/pagina/riga) | `fonti` su `bilanci`, `fonte_*` su `spese`/`movimenti` | funzionante |
| Quadratura bilancio + conflitti | `src/lib/bilancio.ts`, `src/lib/riconciliazione.ts` | funzionante, con test |
| Dashboard amministratore | `src/app/dashboard/page.tsx` | funzionante |
| Bilanci (storico, quadratura, rianalisi) | `src/app/dashboard/bilanci/` | funzionante |
| Analisi spese per categoria | `src/app/dashboard/spese/` | funzionante |
| Incassi e partite personali | `src/app/dashboard/spese/`, `src/lib/incassi.ts` | funzionante |
| Anagrafica fornitori + movimenti | `src/app/dashboard/fornitori/`, `src/lib/fornitori.ts` | funzionante |
| Archivio documenti | `src/app/dashboard/documenti/`, `src/lib/percorsi.ts`, `src/lib/archivio.ts` | funzionante — i file sono del condominio (`{condominio}/documenti/`), li apre ogni membro; lo stesso PDF caricato due volte è un file solo |
| Manutenzione dello Storage | `netlify/functions/manutenzione-storage.mts`, `src/lib/manutenzione.ts` | ogni ora: sposta lo storico `documenti/{utente}/` nel condominio, toglie i caricamenti abbandonati che sono doppioni, avvisa oltre l'80% dello spazio |
| Impianti (anagrafica + scadenze) | `src/app/dashboard/impianti/` | funzionante |
| Vista condomino (il suo appartamento) | `src/app/dashboard/appartamento/` | funzionante — la quota viene dal riparto letto, non da una divisione per millesimi |
| Lettura del riparto per unità | `src/lib/riparto.ts`, `src/lib/quote.ts` | funzionante sui rendiconti Tosiani |
| Impostazioni condominio | `src/app/dashboard/impostazioni/` | funzionante |

## Modello dati (tabelle Supabase)

`condominiums`, `membri`, `unita`, `unita_membri`, `inviti`, `bilanci`, `spese`, `incassi`,
`quote_unita`, `movimenti`, `fornitori`, `impianti`, `pagamenti`, `documenti`,
`schede_formato`. Definizioni TypeScript in `src/lib/types.ts`.

Migrazioni applicate, in ordine (`supabase/migrations/`):

1. `20260914000000_provenienza_importi.sql`
2. `20260916000000_verifica_non_possibile.sql`
3. `20260916100000_movimenti.sql`
4. `20260916110000_anagrafica_fornitori.sql`
5. `consuntivo_e_totale_documento_separati` (applicata il 20/09/2026)
6. `20260920130000_incassi.sql` — la tabella delle partite di singoli condomini
7. `20260923100000_quote_dal_riparto.sql` — anagrafica completa (tipologia,
   codice, subalterno) e tabella `quote_unita`. Provata su staging prima
8. `20260923120000_permessi_espliciti.sql` — i permessi di ogni tabella scritti
   per esteso; `anon` non ne ha nessuno
9. `20260924100000_membri.sql` — `membri`, `unita_membri`, `inviti`, e tutte le
   policy riscritte sopra di esse
10. `20260925100000_storage_per_condominio.sql` — le policy del bucket su `membri`
11. `20260925110000_spazio_documenti.sql` — quanto occupano i documenti
12. `20260925120000_schede_formato.sql` — le schede proposte dal modello e le decisioni; solo il server la legge

I numeri di Via Enriques 3 scritti a mano — sei esercizi, incassi, quote e
anagrafica del 2023-2025 — erano migrazioni e non lo sono più: stanno in
`supabase/dati/`, ogni istruzione ancorata al condominio per id. Un test in CI
impedisce di rimetterne dentro le migrazioni.

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

- **Dai verbali non si estrae nulla**: sono accettati e archiviati, ma lo schema
  di estrazione copre solo anagrafica, unità, bilanci, spese e impianti. Nessuna
  delibera diventa un dato.
- **I fornitori nascono solo dall'estrazione** (`src/lib/fornitori-server.ts`):
  dall'interfaccia non se ne può aggiungere o correggere uno a mano.
- **Le anteprime e i branch deploy usano lo staging** (verificato il 25/09/2026):
  URL, chiave pubblica e service role dei contesti Deploy Previews e Branch
  deploys sono quelli del progetto `shzxqeyyxjhultofwzfz`. Per entrare in
  un'anteprima serve un account sullo staging, non quello di produzione.
- **Sentry è acceso**: il DSN è impostato su Netlify per tutti i contesti.
- **Il backup non è ancora stato provato con un ripristino.** Dal 20/09/2026 il
  database ha una copia giornaliera (`.github/workflows/backup.yml`), ma finché
  non se ne ripristina una su staging non sappiamo se sia utilizzabile.
- **Nessun pagamento, nessuna fatturazione, nessun contratto**: l'app non ha
  ancora un modo per incassare.
- **Nessun documento legale**: privacy policy, termini, registro trattamenti GDPR
  (l'app tratta dati personali di condomini per conto di amministratori: siamo
  responsabili del trattamento, serve un DPA).

## Test presenti

`npm test` — quindici file in `src/lib/__tests__/`, 145 test: calcolo, parsing e
lettura dei rendiconti, inviti, percorsi e archiviazione dei documenti,
manutenzione dello Storage, e le regole sulle migrazioni. Non le pagine, non le
API, non i flussi end-to-end.

La RLS si prova su staging con `supabase/tests/` (tabelle e bucket): per ogni
utente finto conta cosa vede e prova a scrivere dove non dovrebbe.

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

Un formato nuovo non richiede più di scrivere la scheda a mano. Quando arriva
un PDF che nessuna scheda riconosce, dopo l'estrazione normale la funzione
chiede al modello una scheda, gli mostra il documento con le coordinate di ogni
frammento, e la prova col motore: se la lettura non quadra, il modello riceve
il motivo e ciò che il motore ha letto, e riprova una volta. Una scheda passa
solo se ha la forma che il motore conosce (niente campi in più, espressioni che
non possono bloccare la lettura, categorie esistenti), se quadra al centesimo
con il totale stampato, se trova l'anno e se non lascia voci senza categoria.
A quel punto aspetta in `/dashboard/formati`, dove un operatore vede voce per
voce cosa ha letto e in quale categoria l'ha messa, e la approva o la rifiuta.
