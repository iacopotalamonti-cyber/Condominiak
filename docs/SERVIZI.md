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

### Domande ancora aperte

1. **Cosa vede un condòmino che non è consigliere?** Ha un account o riceve solo
   un riepilogo? Vede i numeri di tutto il condominio o solo i propri?
2. **Quali sono le tre cose** che un condòmino deve poter dire dopo cinque
   minuti nell'app ("ora ho capito X")? Da qui si ordina tutto il resto.
3. **Un utente segue più condomini?** Chi ha due case, o siede in due consigli.
4. **Quanto costa e chi materialmente paga?** Abbonamento annuo per condominio
   anticipato da un condòmino e poi ripartito, oppure delibera assembleare?
5. **Quali documenti carichiamo il primo giorno?** Solo consuntivo e riparto, o
   anche preventivo, verbali, contratti?

---

## Parte C — Servizi da costruire

> Ricalibrati sul condominio come cliente. Cancella, aggiungi, commenta.

- [ ] **Estrazione del riparto per unità** — oggi l'estrazione legge i millesimi
      di ogni unità, ma **non quanto è stato addebitato a ciascuna** per ogni
      categoria: le righe di riparto vengono riconosciute e deliberatamente
      escluse dalle spese. Per un prodotto del condominio è il buco più grande:
      senza, alla domanda "perché ho pagato 1.240 €?" l'app non sa rispondere.
- [ ] **"Quanto ho pagato io e perché"** — la vista del singolo condòmino: la sua
      quota, come nasce dal totale attraverso i millesimi, con la riga del documento
- [ ] **Verifica del riparto** — ricalcolare le quote dai millesimi e confrontarle
      con quelle stampate nel rendiconto: se non tornano, dirlo
- [ ] **Confronto fra anni** — cosa è aumentato, di quanto, per quale fornitore
- [ ] **Scheda fornitore leggibile dal condòmino** — quanto incassa, da quanti anni,
      con quali categorie
- [ ] **Ruoli e inviti** — consigliere (carica, configura) vs condòmino (legge);
      invito dell'amministratore come ospite, revocabile
- [ ] **Domande in linguaggio naturale** sui documenti del condominio
- [ ] **Segnalazione di anomalie** — voci senza fornitore, scostamenti dal preventivo,
      spese fuori scala rispetto agli anni precedenti
- [ ] **Esportazione** — un PDF di sintesi da portare in assemblea
- [ ] **Abbonamento e pagamento** (dopo il primo cliente)

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
