# Piano di lavoro

Un piano serve per una ragione sola: oggi ogni rilascio va diritto in produzione,
su un unico database, senza CI e senza staging. Finché è così, ogni funzionalità
nuova è anche un rischio nuovo. L'ordine sotto mette prima le fondamenta, poi il
prodotto.

Le fasi sono sequenziali solo dove indicato. Ogni voce è una PR, non un progetto.

---

## Fase 0 — Rendere il rilascio non spaventoso (prima di tutto il resto)

Nessuna funzionalità nuova. Una settimana scarsa di lavoro che poi si ripaga a
ogni rilascio successivo.

- [x] `.env.local.example` nel repo, con tutte le variabili e un commento per ciascuna
- [x] Schema iniziale del database esportato in `supabase/migrations/00000000000000_schema_iniziale.sql`, così l'ambiente si ricostruisce da zero
- [x] CI su GitHub Actions: `lint` + `test` + `build` a ogni push e PR (il lint falliva già: sistemato)
- [x] Ambiente di staging: progetto Supabase `shzxqeyyxjhultofwzfz` ("Condominiak
      Staging", eu-west-1), con lo schema iniziale applicato e verificato identico
      alla produzione. Su Netlify le anteprime e i branch deploy puntano allo
      staging (verificato il 25/09/2026: URL e chiavi sono del progetto di
      staging), quindi non scrivono sul database vero
- [x] Tracciamento errori (Sentry) su browser, server e funzioni. DSN e
      ambiente impostati su Netlify per tutti i contesti
- [x] CORS ristretto a `https://www.condominiak.me` (era `*`)
- [x] Backup giornaliero del database in `.github/workflows/backup.yml`, con il
      segreto `SUPABASE_DB_URL` impostato. Prima copia prodotta il 20/09/2026.
      La stringa deve essere quella del **Session pooler**: la connessione
      diretta risponde solo su IPv6 e i runner di GitHub non la raggiungono
- [ ] Provare un ripristino su staging: un backup non provato non è un backup
- [ ] **Il backup dipende da un'immagine Docker da scaricare ogni volta.** Il
      23/09/2026 il registro di GitHub l'ha rifiutata due volte di fila per
      troppe richieste, e il backup lanciato a mano non è mai partito. I notturni
      sono riusciti, ma è un caso: `supabase db dump` scarica l'immagine di
      Postgres a ogni esecuzione. Va sostituito con `pg_dump` installato sul
      runner, senza Docker

**Fatto quando**: posso rompere il `main` e accorgermene dalla CI invece che da un cliente.

## Fuori piano — I numeri giusti (20/09/2026)

Non era in piano: è nata dalla domanda "quanto abbiamo speso quest'anno", a cui
l'app rispondeva con numeri che non tornavano con la carta.

- [x] Motore di lettura dei rendiconti, con i formati descritti come dati
      (`src/lib/motore.ts`, `src/lib/profili.ts`)
- [x] Tre formati riconosciuti: Studio Tosiani, Studio Contavalli, MULTIGEST
- [x] Corrispondenza fra codice di voce e categoria per i tre formati
      (`src/lib/profilo.ts`)
- [x] Un rendiconto riconosciuto non passa più dal modello: costo zero
- [x] Fornitore e data letti dalle righe dei movimenti, dove il formato li espone
- [x] Categoria `fotovoltaico`
- [x] Tabella `incassi` e sezione dedicata in Analisi spese
- [x] Sei esercizi (2020-2025) riscritti in produzione dai documenti, scarto 0,00
- [x] Recupero password (`/reset`): prima si rientrava solo dalla console di Supabase
- [x] Lettore del riparto per unità (`src/lib/riparto.ts`): nove tabelle
      millesimali, scarto 0,00 su tutte e tre i rendiconti Tosiani
- [x] Quote per unità salvate (`quote_unita`) e mostrate nella vista
      appartamento, al posto della divisione millesimi/totale che sbagliava da
      -34% a +59%. Tre esercizi in archivio, 132 quote, tutte in quadratura
- [x] Le 30 unità mancanti in anagrafica: box, cantine e posti auto. I millesimi
      generali ora sommano 1000,000
- [ ] Per il 2020, 2021 e 2022 il riparto non si legge ancora: sono gli altri
      due formati (Contavalli, MULTIGEST), che lo stampano diversamente
- [x] Collegare una persona a più unità (appartamento, box, cantina) senza
      passare dal nome: tabella `unita_membri` (25/09/2026)
- [ ] Caricare i movimenti di 2020, 2023 e 2024, che il motore legge gratis
- [x] Pulizia dello storage: non serve più lanciarla a mano. La manutenzione
      oraria (`netlify/functions/manutenzione-storage.mts`) toglie i caricamenti
      abbandonati che sono doppioni di un file in archivio (26 file, ~50 MB)
- [x] Riconoscere un formato nuovo proponendo una scheda al modello, invece di
      scriverla a mano (25/09/2026). Verificata dalla quadratura, approvata da un
      operatore in `/dashboard/formati`
- [ ] Provarla su un rendiconto vero di un formato che non conosciamo: finora
      è provata su un documento costruito nei test e sulle tre schede esistenti

## Chiesto il 23/09/2026 — da fare

### 1. Provare il giro completo dei consuntivi

Oggi i sei esercizi in archivio li ha scritti una migrazione, non l'applicazione.
Non sappiamo se il percorso normale — cancella, ricarica il PDF, salva —
produce gli stessi numeri. È la prova che manca.

- [ ] Cancellare i consuntivi e ricaricarli dall'interfaccia, confrontando il
      risultato con quello di oggi, voce per voce
- [ ] Fare la prova **prima su staging**, o comunque con un backup fresco: se il
      giro non riproduce i numeri, senza copia li abbiamo persi
- [ ] Prima ancora, sistemare il vincolo che la rende parziale: **tre esercizi su
      sei non hanno il PDF in archivio** (2020, 2021 e 2023 hanno
      `documento_path` nullo, perché furono letti fuori dall'applicazione).
      Vanno ricaricati, altrimenti la prova copre solo 2022, 2024 e 2025
- [x] Il confronto va fatto da un test, non a occhio: `npm run
      confronta-consuntivi -- foto.json *.pdf` rifà per ogni PDF ciò che fa
      l'app (lettura, estrazione, righe del salvataggio, la stessa funzione
      della rotta) e confronta voce per voce con una fotografia del database.
      **Esito del 25/09/2026, sui sei rendiconti**: consuntivo, totale
      stampato, spese per categoria e le 132 quote identici su tutti gli anni.
      Le differenze rimaste sono volute: gli incassi prendono la descrizione del
      documento invece di quella scritta a mano (stessi importi); i movimenti
      del 2025 hanno gli stessi totali per ognuno dei 20 fornitori con nome, ma
      la categoria segue la stessa corrispondenza delle spese e non si salvano
      le righe delle voci le cui fatture non sommano al totale. Il ricaricamento
      aggiungerebbe i movimenti del 2020 (59), 2023 (74) e 2024 (73). La prova
      ha trovato e fatto correggere due errori del motore: un fornitore perso
      quando numero e data sono nello stesso frammento, e "Fornitori vari" /
      "Differenza contabile" trattati come fornitori
- [ ] Il giro vero dall'interfaccia (cancella, carica, salva), anno per anno,
      con una copia delle righe prima di ciascuno e il confronto dopo. Mette
      anche in archivio i PDF del 2020, 2021 e 2023, che oggi mancano

### 2. La pagina che vende il prodotto

- [ ] Pagina pubblica su `condominiak.me`: cosa fa, per chi, cosa costa
- [ ] Le quattro frasi di `SERVIZI.md` sono già il contenuto — "ora ho capito
      quanto spendiamo all'anno", "quanto paghiamo un fornitore", "cosa devo
      chiedere in assemblea", "quanto spendo per l'acqua"
- [ ] Il prezzo non è ancora deciso (Fase 3): la pagina può esistere prima, ma
      senza cifra o con una richiesta di contatto

### 3. Rifare la dashboard

- [ ] **Togliere la tabella dei pagamenti.** Non ha senso in un prodotto in cui
      il cliente è il condominio e non l'amministratore: i pagamenti li conosce
      chi incassa. Tocca `src/components/dashboard/PaymentGrid.tsx`, la query e
      gli avvisi di morosità in `src/app/dashboard/page.tsx`, la vista
      appartamento, `calcolaMorosita`/`percentualeMorosita` in `calcoli.ts` e il
      punteggio `scoreEdificio`, che oggi pesa la morosità: va ricalcolato sui
      soli impianti o su qualcos'altro
- [ ] **Mettere una bacheca**: ogni condòmino scrive quando si rompe qualcosa, e
      lo etichetta come segnalazione. Tabella nuova, con RLS per condominio
- [x] Nota di sequenza: la bacheca era inutile finché l'invito non collegava
      nessuno. Dal 25/09/2026 l'invito funziona: si può fare

## Per reggere centinaia di condomini (verificato il 23/09/2026)

I volumi non sono il problema: un condominio produce circa 130 righe l'anno fra
quote, spese e movimenti, e trecento condomini per dieci anni sono 400.000
righe — poche, per Postgres. Il problema sono alcune assunzioni da un
condominio solo, e i PDF. In ordine di urgenza:

- [x] **Permessi espliciti sulle tabelle** (`20260923120000_permessi_espliciti.sql`):
      dal 30/10/2026 Supabase non li concede più alle tabelle nuove. Applicata in
      produzione il 25/09/2026; `anon` non ha più permessi su nessuna tabella
- [x] **Una persona, più unità; un proprietario, più condomini.** Fatto il
      25/09/2026: tabelle `membri` e `unita_membri`, selettore del condominio.
      `getDashboardContext` legge condominio e unità con `.maybeSingle()`: con due
      righe fallisce e rimanda all'onboarding. È l'assunzione più grave, perché il
      prodotto la contraddice per definizione. Si risolve con la tabella `membri`
      della Fase 1 bis
- [x] **Indici sulle colonne che la RLS legge a ogni riga** (25/09/2026).: `condominiums.owner_id`
      e `unita.user_id` non ne hanno, e ogni policy le interroga
- [x] **RLS che ricalcola l'utente a ogni riga** (21 policy). Riscritte il
      25/09/2026, una per azione; l'advisor non segnala più nulla.: `auth.uid()` va
      scritto `(select auth.uid())`, così si valuta una volta per query. Due
      policy permissive per tabella (amministratore e condomino) si possono
      fondere in una. Correzione meccanica, segnalata dall'advisor di Supabase
- [x] **Le migrazioni di dati assumono un condominio solo**. Fatto il
      25/09/2026: i dati stanno in `supabase/dati/`, ancorati per id, e un test
      in CI lo impone.: usano
      `select id from condominiums limit 1`. Sono già state eseguite, ma stanno
      nella storia che si ripete in un ripristino: su un database con più
      condomini scriverebbero i dati di Via Enriques nel primo che capita.
      Vanno ancorate all'id del condominio
- [x] **I documenti in archivio sono per utente, non per condominio**. Fatto il
      25/09/2026: `{condominio}/documenti/`, lo storico lo sposta la manutenzione.
      (`documenti/{user_id}/…`): con più persone nello stesso condominio, uno
      non vede i PDF caricati dall'altro
- [ ] **I PDF sono il vero volume**: i rendiconti di Via Enriques pesano da 0,6 a
      2,3 MB, in media 1,4. Con tre documenti l'anno (consuntivo, preventivo,
      verbale) il piano gratuito — 1 GB di storage — basta per una ventina di
      condomini con dieci anni di storico; trecento condomini sono circa 13 GB.
      Serve il piano Pro prima di quella soglia. Dal 25/09/2026 lo spazio si
      misura (impostazioni, e la manutenzione oraria avvisa su Sentry oltre
      l'80%), e lo stesso PDF caricato due volte occupa spazio una volta sola.
      Il passaggio al Pro resta una decisione di spesa
- [x] **Il collo di bottiglia del prodotto sono i formati, non i dati** — dal
      25/09/2026 la scheda la propone il modello (vedi sopra); resta da provarla
      su un formato vero: centinaia
      di condomini vuol dire decine di amministratori, cioè decine di formati.
      Oggi ogni formato nuovo è una scheda scritta a mano. La scheda proposta dal
      modello, e verificata dalla quadratura, è ciò che rende la cosa scalabile
- [ ] Protezione contro le password compromesse disattivata in Supabase Auth
      (un interruttore, segnalato dall'advisor di sicurezza)

## Fase 1 bis — Appartenenza e accesso (prima del secondo condominio)

Per il nostro condominio non serve: siamo gli unici utenti e il rischio è nullo.
Serve tutto, invece, prima che entri qualcuno che non conosciamo.

- [x] Rifare l'invito lato server: token segreto, con scadenza, a uso singolo — non l'id dell'unità (25/09/2026)
- [x] Tabella `membri` e policy RLS riscritte sopra di essa (25/09/2026)
- [x] Estrazione chiusa a chi non ne ha diritto: la funzione chiede il token di
      sessione e verifica i file; lo stato lo legge solo chi l'ha avviata (25/09/2026)
- [ ] Deduplicazione dei condomini per indirizzo
- [ ] Procedura di contestazione e subentro del primo iscritto
- [ ] Decidere cosa vede l'inquilino rispetto al proprietario

## Fase 1 — Chiarire il prodotto

Non è lavoro di codice ed è il collo di bottiglia vero.

- [ ] `docs/SERVIZI.md` Parte B compilata, almeno le cinque domande iniziali
- [ ] Primo cliente reale individuato, con i suoi documenti veri per le prove

**Fatto quando**: so quali tre servizi costruire dopo e per chi.

## Fase 2 — Il primo cliente in produzione

Da riempire quando la Fase 1 è chiusa. La regola: i tre servizi che servono a
quel cliente per smettere di usare il suo strumento attuale, niente altro.

- [ ] (servizio 1)
- [ ] (servizio 2)
- [ ] (servizio 3)
- [ ] Privacy policy, termini di servizio, informativa ai condòmini, e verifica
      legale dell'impianto "chi vede cosa" descritto in `SERVIZI.md` — prima del
      primo condominio che non è il nostro
- [ ] Test end-to-end (Playwright) sul percorso completo: registrazione → onboarding → dashboard

**Fatto quando**: un amministratore vero ci lavora sopra per un mese senza tornare indietro.

## Fase 3 — Incassare

- [ ] Modello di prezzo deciso
- [ ] Abbonamento e pagamento (Stripe)
- [ ] Fatturazione elettronica verso SDI
- [ ] Limiti di piano applicati nel prodotto

## Fase 4 — Scala

- [ ] Multi-condominio e multi-utente per studio
- [ ] Permessi granulari (collaboratori dello studio)
- [ ] Osservabilità: costo AI per condominio, tempi di estrazione, tasso di errore
- [ ] Onboarding self-service senza il nostro intervento

---

## Come lavoriamo (processo)

1. **Un cambiamento = un branch = una PR.** Niente lavoro diretto su `main`.
2. **Prima la descrizione, poi il codice.** Il servizio entra in `SERVIZI.md`
   con le sue cinque righe prima che io scriva una riga.
3. **Ogni PR passa** `npm run lint`, `npm test`, `npm run build` in locale e in CI.
4. **Le migrazioni non si modificano dopo essere state applicate**: se serve un
   cambiamento, si aggiunge un file nuovo. Vanno testate su staging prima.
   *Il 20/09/2026 questa regola non è stata rispettata*: le quattro migrazioni
   dei dati e della tabella `incassi` sono andate diritte in produzione, con un
   backup prima e una verifica dopo, ma senza passare da staging. Lo staging è
   stato riallineato in seguito. È il genere di scorciatoia che funziona finché
   l'unico utente siamo noi.
5. **Un rilascio che cambia dati ha sempre un modo per tornare indietro** scritto
   nella PR, prima del merge.
6. **`STATO.md` si aggiorna** quando una funzionalità arriva in produzione.
7. **Le scelte con alternative vere finiscono in `DECISIONI.md`**, con la data e
   il perché: fra sei mesi nessuno dei due si ricorderà.
8. **Ogni migrazione che crea una tabella concede i suoi permessi**, nello stesso
   file: `grant select, insert, update, delete` ad `authenticated`, `grant all` a
   `service_role`, niente ad `anon` salvo una ragione scritta. Dal 30/10/2026
   Supabase non lo fa più da solo, e una tabella senza permessi è invisibile
   all'app. Mai `alter default privileges`: una tabella nuova senza RLS
   diventerebbe leggibile da chiunque abbia fatto l'accesso.
