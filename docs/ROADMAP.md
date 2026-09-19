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
- [ ] Schema iniziale del database esportato in `supabase/migrations/00000000000000_schema_iniziale.sql`, così l'ambiente si ricostruisce da zero
- [x] CI su GitHub Actions: `lint` + `test` + `build` a ogni push e PR (il lint falliva già: sistemato)
- [ ] Ambiente di staging: secondo progetto Supabase + deploy preview Netlify collegati
- [ ] Tracciamento errori (Sentry) su app e background function
- [ ] Restringere il CORS in `netlify.toml` al solo dominio dell'app
- [ ] Backup del database verificato: non basta che esista, va provato un ripristino

**Fatto quando**: posso rompere il `main` e accorgermene dalla CI invece che da un cliente.

## Fase 1 bis — Appartenenza e accesso (prima del secondo condominio)

Per il nostro condominio non serve: siamo gli unici utenti e il rischio è nullo.
Serve tutto, invece, prima che entri qualcuno che non conosciamo.

- [ ] Token d'invito veri: segreti, con scadenza, a uso singolo — oggi il token è l'id dell'unità
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
5. **Un rilascio che cambia dati ha sempre un modo per tornare indietro** scritto
   nella PR, prima del merge.
6. **`STATO.md` si aggiorna** quando una funzionalità arriva in produzione.
7. **Le scelte con alternative vere finiscono in `DECISIONI.md`**, con la data e
   il perché: fra sei mesi nessuno dei due si ricorderà.
