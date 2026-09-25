# Servizi del prodotto

Questo file è il contratto fra te e me: qui c'è **cosa deve fare il prodotto**,
non come. Se un servizio non è scritto qui, non lo costruisco; se è scritto male,
lo costruisco male. È il file che vale la pena compilare con calma.

## Come si descrive un servizio

Per ognuno servono cinque righe. Non di più, ma tutte e cinque — la quarta e la
quinta sono quelle che di solito mancano e che fanno rifare il lavoro.

```
### <Nome del servizio>

- **Per chi**: amministratore | condomino | entrambi | (altro ruolo)
- **Serve a**: il problema reale che risolve, in una frase
- **Fatto quando**: la condizione osservabile che dice che funziona
- **Da dove vengono i dati**: documento caricato / inserimento a mano / servizio esterno / calcolo
- **Cosa succede se va storto**: dato mancante, PDF illeggibile, utente senza permessi
```

Se un servizio tocca soldi, dati personali o comunicazioni verso terzi (email,
PEC, SDI), aggiungi una sesta riga: **Vincoli** (normativi, contrattuali, di
privacy).

---

## Parte A — Servizi già costruiti

Sono descritti in `STATO.md` con il loro stato reale. Qui elenchiamo solo quelli
di cui vuoi **cambiare** o **estendere** il comportamento.

### (nessuno per ora — aggiungi qui le modifiche che vuoi ai servizi esistenti)

---

## Parte B — Posizionamento (deciso il 19/09/2026)

**Il cliente è il condominio, non l'amministratore.**

- **Chi paga**: il condominio. Si iscrive un condòmino o un consigliere, che
  incarica qualcuno di caricare i documenti; l'app li elabora e restituisce il
  quadro completo. L'amministratore partecipa **solo se il condominio lo vuole**:
  è un ospite invitato, non il titolare dell'account.
- **Da dove vengono i dati**: dai rendiconti che l'amministratore ha **già
  inviato** ai condòmini. Lì dentro c'è tutto — riparti, costi, fornitori,
  millesimi. Non ci affianchiamo a un gestionale e non lo sostituiamo: leggiamo
  il suo output. Il lavoro è tirare fuori bene quelle informazioni.
- **Primo cliente**: il condominio di Iacopo.

### Cosa comporta questa scelta

1. **È uno strumento di lettura e verifica, non di gestione.** Il codice già
   scritto va esattamente in questa direzione: provenienza di ogni importo
   (documento, pagina, riga), quadratura dei totali, conflitti mostrati invece
   che risolti in silenzio. Non è un gestionale a cui manca qualcosa — è un
   revisore a cui manca l'ultimo miglio.
2. **Nessun dato entra a mano da un amministratore.** Tutto arriva da PDF. La
   qualità dell'estrazione non è una funzionalità fra le altre: è il prodotto.
3. **La dashboard oggi si chiama "amministratore"** ma il suo utente diventa il
   consigliere. Va rivista nel linguaggio e nei permessi, non nei dati.
4. **Privacy, da affrontare presto.** Un rendiconto contiene dati personali di
   tutti i condòmini (nomi, quote, morosità). Un condòmino ha diritto di
   consultare i documenti contabili (art. 1130-bis c.c.), ma mostrare le
   morosità altrui dentro un'app va deciso con attenzione. Chi vede cosa è una
   scelta di prodotto, non un dettaglio tecnico.
5. **Anche il marketing pubblico si rivolge al condòmino, non
   all'amministratore.** La pagina vetrina e il posizionamento SEO
   (`ROADMAP.md` → "La pagina che vende il prodotto") vanno scritti con le
   parole di chi vive nel condominio — le quattro frasi di questo file — non
   con quelle di un gestionale per professionisti: è lo stesso scarto già
   fatto per il cliente pagante.

### Chi vede cosa (risposta del 19/09/2026)

Il principio scelto: **la stessa visibilità che il condòmino ha già oggi**,
quando l'amministratore invia i documenti a tutti. L'app non allarga la platea e
non crea un accesso che prima non c'era; riorganizza ciò che è già stato
ricevuto.

In concreto:

- **Totali del condominio**: visibili a tutti gli iscritti di quel condominio.
- **Documenti originali (PDF)**: consultabili integralmente da tutti gli
  iscritti, perché sono gli stessi che l'amministratore ha già spedito a tutti.
- **Riparto per appartamento**: nella sezione "il mio appartamento" ciascuno
  vede **il proprio**. Le quote degli altri non vengono presentate in viste
  derivate (elenchi, classifiche, confronti fra condòmini), anche quando
  compaiono nel PDF che tutti possono aprire.
- **Mai**: indicizzazione pubblica, condivisione verso l'esterno del condominio,
  esportazioni che mettano in fila i dati personali di più condòmini.

La distinzione che regge questa scelta: **un documento già ricevuto non è un
dato nuovo, ma una vista che raccoglie e ordina i dati di tutti sì.** Il PDF
resta come è; le elaborazioni le facciamo solo sui numeri del condominio o su
quelli di chi guarda.

> ⚠️ Questo è un impianto ragionevole, non un parere legale. Condominiak tratta
> dati personali di persone che non sono sue clienti (gli altri condòmini):
> servono informativa, base giuridica e un ruolo dichiarato nel trattamento,
> e vanno fatti verificare da un legale **prima del primo condominio che non è
> il nostro**. In `ROADMAP.md` è in Fase 2.

### Le quattro frasi da far dire all'utente

Sono il metro di tutto il resto: un servizio che non porta a una di queste frasi
aspetta.

1. *"Ora ho capito quanto spendiamo all'anno."*
2. *"Ora ho capito quanto paghiamo un fornitore."*
3. *"Ora ho capito cosa chiedere all'amministratore in assemblea, visto che le
   luci delle scale si guastano di continuo."*
4. *"Ora ho capito quanto spendo di acqua ogni anno per il mio appartamento."*

La 1 e la 2 sono quasi fatte. La 4 richiede l'estrazione del riparto per unità,
che oggi manca. La 3 richiede di leggere i **verbali**, da cui oggi non si
estrae nulla: sono archiviati come documenti e basta.

### Altre risposte (19/09/2026)

- **Più case**: un utente ha un account solo, con più appartamenti assegnati.
- **Prezzo**: paga ogni condòmino che vuole accedere. In alternativa il
  condominio compra un'utenza unica, con il costo addebitato al condominio.
- **Documenti del primo giorno**: verbali delle ultime assemblee e rendiconti
  degli ultimi 2 anni. In una fase successiva si risale — verbali fino a 5-10
  anni indietro, rendiconti fino a 5.
- **Contratti di fornitura**: non servono. Serve però poter **modificare a mano**
  un fornitore quando cambia, aggiungendolo dalla sua sezione.

### Come si entra: il modello scelto (19/09/2026)

**Chi possiede i documenti entra.** Il primo che iscrive il proprio condominio
deve caricare i documenti richiesti: senza, il servizio non parte. Da lì invita
a cascata gli altri. Ogni persona vede solo il proprio condominio.

È un modello proporzionato e già in parte implementato (l'invito esistente è
legato a una **unità specifica**, non a un'email qualsiasi: è la scelta giusta).
Ha però otto punti deboli noti, elencati qui perché non vadano persi.

**1. Il documento non prova l'appartenenza.** Un rendiconto circola: email,
WhatsApp, il fascicolo consegnato a un acquirente in compravendita, l'agenzia,
l'inquilino, il tecnico, l'avvocato. Prova che chi lo possiede ha avuto accesso
al documento, non che abiti lì. È una barriera bassa — accettabile all'inizio,
da non confondere con una verifica.

**2. Chi arriva primo prende tutto, e nessuno può contestarlo.** Oggi il primo
diventa `owner_id` del condominio, con accesso in scrittura a ogni tabella. Se è
l'inquilino, l'ex proprietario, o un condòmino in lite con gli altri, non esiste
procedura di subentro né di contestazione. Serve prima di aprire a condomini non
nostri.

**3. Il duplicato.** Due persone dello stesso condominio caricano ognuna i propri
PDF: nascono due condomini paralleli con gli stessi dati e nessun collegamento.
Serve riconoscere l'indirizzo e proporre *"questo condominio c'è già, chiedi
accesso"* invece di crearne un altro.

**4. L'invito oggi non funziona affatto — verificato sul database.** L'URL è
`/invite/[token]` dove il token è **l'id dell'unità**
(`src/app/api/invite-resident/route.ts:42`), e il collegamento è una
`update unita set user_id` eseguita **dal browser**
(`src/app/invite/[token]/page.tsx:27`).

La policy `resident_access` su `unita` è `for all using (user_id = auth.uid())`
e non ha WITH CHECK, quindi la stessa condizione vale anche in scrittura: si può
modificare solo una riga **già propria**. Un invitato appena registrato non
possiede condomini e non è collegato ad alcuna unità, quindi la sua update non
trova righe. Provato: con un utente qualsiasi, le righe su cui può agire sono
**zero**.

Due conseguenze, una buona e una cattiva:

- **Nessuno può rivendicare un'unità altrui** conoscendone l'id. Il rischio che
  sembrava esserci non c'è: RLS lo blocca.
- **Ma non può farlo nemmeno chi è stato invitato davvero.** Una update che non
  tocca righe non è un errore per Postgres: il codice riceve `error: null`,
  considera riuscito il collegamento e manda l'utente in dashboard, dove
  `getDashboardContext` non lo trova legato a nulla e lo rimbalza
  all'onboarding. L'invito a cascata, su cui poggia tutto il modello di accesso,
  **oggi non collega nessuno.**

Va rifatto lato server, con la service role key e un token vero: segreto, con
scadenza e a uso singolo.

**5. Proprietario e inquilino non sono la stessa persona.** Alcune spese
competono all'uno, altre all'altro, e la morosità è del proprietario. Se entra
l'inquilino, cosa vede?

**6. Nessuno avvisa quando si vende casa.** Chi vende deve perdere l'accesso, chi
compra ottenerlo. Senza una riconferma periodica o un'azione del consigliere,
l'accesso resta a chi non abita più lì.

**7. I dati degli altri entrano prima del loro consenso.** Il primo iscritto
carica un documento che contiene i dati di tutti, compresi quelli che non si
iscriveranno mai. L'invito a cascata non risolve il problema: lo rende visibile
solo a chi entra. Da affrontare con l'informativa, non con il codice.

**8. "Vede solo il proprio condominio" oggi non è rappresentabile.** Le policy
RLS poggiano su due sole relazioni — `condominiums.owner_id = auth.uid()` e
`unita.user_id = auth.uid()`. Non esiste una tabella di appartenenza, quindi non
si possono esprimere: un consigliere che non possiede il record, un utente con
due case, un amministratore ospite, un accesso revocato. Serve una tabella
`membri (condominium_id, user_id, unita_id, ruolo, stato)` con le policy
riscritte sopra di essa.

**Cosa serve prima di aprire al secondo condominio** (per il nostro il rischio è
nullo, siamo gli unici utenti): token d'invito veri con scadenza e uso singolo,
tabella `membri` con RLS riscritte, deduplicazione per indirizzo, procedura di
contestazione e subentro.

### Domande ancora aperte

1. **Come verifichiamo che chi si iscrive sia davvero di quel condominio?** Se
   paga il singolo condòmino, l'abbonamento da solo non prova nulla: un estraneo
   che paga non deve poter aprire i rendiconti altrui. Le strade possibili sono
   l'invito da parte di chi ha già accesso, la verifica contro l'elenco unità
   estratto dai documenti, o l'approvazione del consigliere. È la domanda più
   urgente delle tre, perché senza risposta non si può aprire l'iscrizione.
2. **Chi carica i documenti il primo giorno, e chi può cancellarli?** Il primo
   iscritto diventa automaticamente consigliere?
3. **Un condominio senza nessun iscritto pagante**: i dati restano, si
   congelano, si cancellano? Dopo quanto?

---

## Parte C — Servizi da costruire

> Ordinati per le quattro frasi, non per dimensione.

**Per la frase 4 — "quanto spendo io"**

- [ ] **Estrazione del riparto per unità** — oggi l'estrazione legge i millesimi
      di ogni unità ma **non quanto è stato addebitato a ciascuna** per categoria:
      le righe di riparto sono riconosciute e deliberatamente escluse dalle spese
      (`src/lib/anthropic.ts:146`, `:162-166`). È il buco più grande.
- [ ] **"Quanto ho pagato io e perché"** — la quota del singolo, come nasce dal
      totale attraverso i millesimi, con la riga del documento
- [ ] **Verifica del riparto** — ricalcolare le quote dai millesimi e confrontarle
      con quelle stampate: se non tornano, dirlo

**Per la frase 3 — "cosa chiedere in assemblea"**

- [ ] **Estrazione delle delibere dai verbali** — oggi da un verbale non si
      estrae nulla di strutturato: chi ha deliberato cosa, quando, con quale
      importo approvato
- [ ] **Storia di un problema ricorrente** — mettere in fila guasti, delibere e
      spese sullo stesso impianto attraverso gli anni
- [ ] **Preventivo deliberato contro consuntivo speso**, anno per anno
- [ ] **Promemoria per l'assemblea** — l'elenco delle anomalie da portare

**Per le frasi 1 e 2 — quasi fatte, da rifinire**

- [ ] **Confronto fra anni** — cosa è aumentato, di quanto, per quale fornitore
- [ ] **Gestione manuale dei fornitori** — oggi i fornitori nascono solo
      dall'estrazione (`src/lib/fornitori-server.ts`): non c'è modo di
      aggiungerne uno a mano, correggerne il nome o unire due alias
      dall'interfaccia. Serve per il cambio fornitore.

**Fondamenta del nuovo posizionamento**

- [ ] **Un utente, più appartamenti e più condomini** — oggi `getDashboardContext`
      usa `maybeSingle()` sia sui condomini posseduti sia sulle unità
      (`src/lib/dashboard-context.ts:26`, `:37`): con due appartamenti la query
      non restituisce una riga e l'utente **viene rimbalzato all'onboarding**.
      Da rifare prima di promettere il doppio appartamento.
- [ ] **Ruoli**: consigliere (carica, configura, invita) e condòmino (legge);
      amministratore come ospite invitato e revocabile. Oggi i ruoli sono
      `admin` e `resident`, dove `admin` è chi possiede il condominio.
- [ ] **Iscrizione e verifica dell'appartenenza al condominio** — vedi domanda 1
- [ ] **Abbonamento e pagamento**, individuale o a carico del condominio

---

## Parte D — Cosa il prodotto **non** fa

- **Non è un gestionale per amministratori**: niente contabilità in partita
  doppia, niente emissione di rendiconti, niente gestione del personale.
- **Non produce documenti ufficiali**: non genera il rendiconto ex art. 1130-bis,
  lo legge.
- **Non incassa le quote condominiali** e non si sostituisce al conto corrente
  del condominio.
- **Non sostituisce l'amministratore** e non dà pareri legali: mostra i numeri e
  da dove vengono.
- **Non archivia i contratti di fornitura**: il fornitore si gestisce dalla sua
  anagrafica, a mano quando cambia.
- **Non porta nulla fuori dal condominio**: nessuna pagina pubblica, nessuna
  condivisione verso l'esterno.
