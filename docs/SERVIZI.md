# Servizi del prodotto

Questo file è il contratto fra te e me: qui c'è **cosa deve fare il prodotto**,
non come. Se un servizio non è scritto qui, non lo costruisco; se è scritto male,
lo costruisco male. È il file che vale la pena compilare con calma.

## Come si descrive un servizio

Per ognuno servono cinque righe. Non di più, ma tutte e cinque — la quarta e la
quinta sono quelle che di solito mancano e che fanno rifare il lavoro.

```
### <Condominiak>

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

## Parte B — Servizi da costruire

> Da compilare. Sotto ci sono le domande a cui mi serve una risposta, e una
> lista di candidati plausibili per un gestionale condominiale italiano: cancella
> quelli che non ti interessano, tieni quelli che sì, aggiungi i tuoi.

### Domande a cui rispondere prima di tutto il resto

1. **Chi paga?** L'amministratore professionista (abbonamento per condominio
   gestito), lo studio (abbonamento a fasce), o il condominio stesso? Da questa
   risposta dipendono autenticazione multi-studio, fatturazione e prezzi.
2. **Quanti condomini per utente?** Oggi il modello dati regge più condomini per
   `owner_id`, ma la dashboard ragiona su uno solo alla volta. Un amministratore
   con 40 condomini è un prodotto diverso da uno con 1.
3. **Il condomino è un utente o un destinatario?** Oggi riceve un invito e vede
   il suo appartamento. Deve poter fare qualcosa (segnalare, pagare, votare) o
   solo leggere?
4. **Sostituiamo il gestionale dell'amministratore o ci affianchiamo?** Se ci
   affianchiamo, l'import dai gestionali esistenti (Danea, Arcadia, Domustudio)
   diventa il servizio più importante di tutti. Se lo sostituiamo, servono
   registro anagrafico, riparto, rendiconto ex art. 1130-bis c.c.: molto più lavoro.
5. **Chi è il primo cliente vero?** Un nome. La roadmap si ordina su di lui, non
   sull'elenco delle funzionalità.

### Candidati (da confermare, scartare o riscrivere)

- [ ] **Multi-condominio** — elenco condomini, switch rapido, KPI aggregati sullo studio
- [ ] **Riparto spese e rendiconto** — dalla spesa ai millesimi al dovuto per unità
- [ ] **Rate e solleciti** — piano rate, stato pagamenti, sollecito automatico
- [ ] **Incassi** — riconciliazione estratto conto bancario ↔ rate dovute
- [ ] **Pagamento online del condomino** — carta / SEPA / PagoPA
- [ ] **Scadenzario** — contratti, revisioni impianti, assicurazioni, adempimenti; con avvisi
- [ ] **Segnalazioni / ticket** — il condomino segnala un guasto, l'amministratore traccia
- [ ] **Assemblee** — convocazione, deleghe, quorum, verbale, voto
- [ ] **Comunicazioni** — email/PEC massive ai condomini con tracciamento invio
- [ ] **Archivio documentale strutturato** — ricerca full-text, categorie, retention
- [ ] **Anagrafica condomini completa** — proprietari/inquilini, subentri, quote
- [ ] **Preventivo e consuntivo assistiti** — costruzione del preventivo dall'anno prima
- [ ] **Import da gestionale esistente** — CSV/Excel/PDF dei principali software
- [ ] **Fatturazione ai clienti (nostra)** — abbonamento, fatture elettroniche SDI
- [ ] **Portale pubblico del condominio** — bacheca, documenti, contatti
- [ ] **App mobile / PWA** — notifiche push al condomino
- [ ] **Assistente conversazionale** — domande in linguaggio naturale sui documenti del condominio

---

## Parte C — Cosa il prodotto **non** fa

Altrettanto importante. Scrivere qui "non facciamo la contabilità in partita
doppia" o "non gestiamo il personale (portieri)" evita mesi di lavoro sbagliato.

- (da compilare)
