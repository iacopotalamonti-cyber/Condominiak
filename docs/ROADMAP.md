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
      alla produzione. **Resta da fare a mano**: su Netlify, in Deploy contexts →
      Deploy Previews, impostare le variabili Supabase dello staging, così le
      anteprime non scrivono sul database vero
- [x] Tracciamento errori (Sentry) su browser, server e funzione di estrazione.
      **Resta da fare a mano**: impostare `NEXT_PUBLIC_SENTRY_DSN` su Netlify
      (e `NEXT_PUBLIC_SENTRY_ENV`), altrimenti non parte nulla
- [x] CORS ristretto a `https://www.condominiak.me` (era `*`)
- [x] Backup giornaliero del database in `.github/workflows/backup.yml`, con il
      segreto `SUPABASE_DB_URL` impostato. Prima copia prodotta il 20/09/2026.
      La stringa deve essere quella del **Session pooler**: la connessione
      diretta risponde solo su IPv6 e i runner di GitHub non la raggiungono
- [ ] Provare un ripristino su staging: un backup non provato non è un backup

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
- [ ] Caricare i movimenti di 2020, 2023 e 2024, che il motore legge gratis
- [ ] Pulizia dello storage: 28 file duplicati, ~50 MB (`npm run pulisci-storage -- --esegui`)
- [ ] Riconoscere un formato nuovo proponendo una scheda al modello, invece di scriverla a mano

## Fase 1 bis — Appartenenza e accesso (prima del secondo condominio)

Per il nostro condominio non serve: siamo gli unici utenti e il rischio è nullo.
Serve tutto, invece, prima che entri qualcuno che non conosciamo.

- [ ] Rifare l'invito lato server: **oggi non collega nessuno** (RLS blocca l'update client-side). Token segreto, con scadenza, a uso singolo — non l'id dell'unità
- [ ] Tabella `membri` e policy RLS riscritte sopra di essa
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
