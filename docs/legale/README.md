# Testi legali di Condominiak — bozze da far rivedere a un legale

> **Stato: BOZZA del 26/09/2026, non in uso.** Scritte da chi costruisce il
> prodotto, non da un avvocato. Servono a far lavorare il legale su un testo
> invece che su un foglio bianco. Nessuno di questi testi va pubblicato o fatto
> accettare prima della sua revisione.

I campi tra parentesi quadre (`[TITOLARE]`, `[EMAIL PRIVACY]`…) vanno riempiti.
I punti marcati **⚖️ Da decidere** sono domande aperte per il legale.

| File | Cosa è | Chi lo vede |
|---|---|---|
| [`termini-di-servizio.md`](termini-di-servizio.md) | Il contratto d'uso del servizio | Chi si registra, accettazione obbligatoria |
| [`informativa-privacy.md`](informativa-privacy.md) | Informativa art. 13 GDPR per chi usa l'app | Chi si registra, presa visione obbligatoria |
| [`informativa-condomini.md`](informativa-condomini.md) | Informativa art. 14 GDPR per i condòmini i cui dati sono nei documenti caricati | Pubblica, linkata nell'app e condivisibile nel condominio |
| [`dichiarazioni-onboarding.md`](dichiarazioni-onboarding.md) | Le spunte e le dichiarazioni dentro l'app | Chi registra un condominio, chi carica, chi è invitato |
| [`accordo-trattamento-dati.md`](accordo-trattamento-dati.md) | Accordo art. 28 GDPR, se il condominio diventa cliente formale | Il condominio, tramite chi lo rappresenta |

---

## Cosa fa il prodotto (per chi non l'ha mai visto)

Condominiak legge i rendiconti condominiali in PDF — quelli che l'amministratore
manda già a tutti i condòmini — e li trasforma in una vista chiara: quanto
spende il condominio, per cosa, a quali fornitori, come cambia negli anni, quanto
tocca al proprio appartamento. Ogni numero porta la pagina e la riga del PDF da
cui viene.

- **Il cliente è il condominio, non l'amministratore.** Si registra un condòmino
  o un consigliere, carica i PDF, poi invita gli altri condòmini.
- **I dati entrano solo dai PDF.** Nessuno inserisce dati personali a mano.
- **Ruoli nell'app:**
  - **Consigliere** (chi gestisce il condominio nell'app): carica, modifica,
    cancella, invita.
  - **Condòmino**: legge i conti del condominio e i documenti, e vede la quota
    del *proprio* appartamento.
  - **Operatore** (chi gestisce Condominiak): vede in più gli strumenti tecnici
    di lettura dei formati.
- **Oggi è in prova gratuita** con un solo condominio vero (quello del
  fondatore). Il prezzo non è deciso.

## Quali dati personali tratta

| Dato | Di chi | Da dove arriva | Perché |
|---|---|---|---|
| Email, password (cifrata), data di iscrizione | Chi usa l'app | Registrazione | Accesso |
| Ruolo, appartamento collegato, condominio | Chi usa l'app | Invito o registrazione | Mostrare a ciascuno ciò che gli spetta |
| Email di chi è invitato | Condòmino invitato | Chi invita la scrive | Mandare l'invito (vale 14 giorni) |
| Nomi dei condòmini, codice dell'appartamento, millesimi, quote di spesa, conguagli | **Tutti i condòmini, anche chi non usa l'app** | I PDF caricati | Riparto per appartamento |
| Eventuali morosità, spese personali riaddebitate | Singoli condòmini | I PDF caricati | Fanno parte del rendiconto |
| Nomi di fornitori (a volte ditte individuali, quindi persone fisiche) e importi pagati | Fornitori | I PDF caricati | Pagina fornitori |
| Il PDF originale | Tutti i precedenti | Caricamento | Consultazione e verifica di ogni numero |
| Indirizzo IP, log tecnici, errori | Chi usa l'app | Automatico | Sicurezza e funzionamento |

**Non tratta**: dati di pagamento (non si paga ancora), categorie particolari
(art. 9) *di proposito* — ma un rendiconto può contenerne per caso (esempio: una
spesa per un montascale che rivela una disabilità). ⚖️ **Da decidere** se serve
una clausola o un processo per questo caso.

## Dove vanno i dati (fornitori tecnici)

| Fornitore | Cosa fa | Dove | Note |
|---|---|---|---|
| Supabase | Database, file PDF, autenticazione | UE (Irlanda, `eu-west-1`) | |
| Netlify | Ospita il sito e le funzioni che leggono i PDF; conserva per breve tempo il risultato della lettura | USA (`us-east-1`) | Il PDF transita dalle funzioni; il risultato della lettura resta nello store del lavoro |
| Anthropic | Modello di intelligenza artificiale che legge i PDF che il programma non sa leggere da solo | USA | Riceve il contenuto del PDF. [VERIFICARE: conservazione dei dati API e divieto di addestramento nelle condizioni commerciali vigenti] |
| Resend | Invio delle email (inviti, conferme, recupero password) | [VERIFICARE regione] | Riceve email del destinatario e testo dell'invito |
| Sentry | Registrazione degli errori | UE (Germania) | Configurato senza dati personali di default e senza registrazione delle sessioni |

⚖️ **Da decidere**: base per il trasferimento verso gli USA di Netlify,
Anthropic ed eventualmente Resend (Data Privacy Framework, se i fornitori sono
certificati, o clausole contrattuali standard). Verificare per ciascuno.

Nessun analytics, nessun cookie di profilazione: solo i cookie tecnici di
sessione dell'accesso.

## La regola "chi vede cosa" già decisa

Presa il 19/09/2026 e confermata il 26/09/2026 (vedi `docs/SERVIZI.md` e
`docs/DECISIONI.md`):

- **L'app non allarga la platea.** Mostra ai condòmini di un edificio ciò che
  l'amministratore ha già mandato a tutti loro. Non condivide niente fuori dal
  condominio, non indicizza, non esporta elenchi.
- I **totali del condominio** e i **PDF originali** li vedono tutti gli iscritti
  di quel condominio (sono gli stessi documenti che hanno già per email).
- Il **riparto per appartamento** lo mostriamo solo per il proprio. Le quote
  degli altri non finiscono in elenchi, classifiche o confronti, anche se sono
  nel PDF.
- Base normativa di partenza: art. 1129 e 1130-bis c.c. (diritto del condòmino
  di prendere visione ed estrarre copia dei documenti giustificativi e del
  rendiconto).

## Domande aperte per il legale

1. **Chi è il titolare del trattamento dei dati contenuti nei PDF?**
   Le bozze assumono che Condominiak sia **titolare autonomo** del proprio
   servizio, con base giuridica nel **legittimo interesse** (art. 6.1.f) dei
   condòmini a consultare i conti del proprio condominio, e che chi carica
   dichiari di avere diritto a quei documenti. Alternative da valutare:
   - il **condominio** come titolare e Condominiak come **responsabile**
     (art. 28), che però richiede che il condominio sia cliente formale, con
     un rappresentante che firma (l'amministratore o una delibera);
   - **contitolarità** con chi carica.
   Quale regge meglio, anche quando chi registra è un condòmino qualunque?
2. **Il primo che registra un condominio non è consigliere né amministratore.**
   Basta la sua dichiarazione (vedi `dichiarazioni-onboarding.md`)? Serve una
   verifica (esempio: conferma di un secondo condòmino, o dell'amministratore)?
   Che poteri gli diamo nel frattempo?
3. **Informativa ai condòmini che non usano l'app** (art. 14): basta pubblicarla
   e chiedere a chi registra di diffonderla nel condominio (bacheca, email,
   assemblea)? L'art. 14.5.b (sforzo sproporzionato) si applica?
4. **Morosità**: i rendiconti le contengono. Mostrarle solo nel PDF originale e
   mai in viste dell'app è sufficiente?
5. **Categorie particolari per caso** (vedi sopra).
6. **Uso dell'intelligenza artificiale** (AI Act e trasparenza): basta dirlo
   nell'informativa? Il modello non prende decisioni sulle persone, legge
   numeri.
7. **Responsabilità sui numeri**: l'app può sbagliare una lettura. Le bozze lo
   dicono chiaramente e mostrano sempre la fonte. La limitazione di
   responsabilità nei termini regge verso un consumatore?
8. **Consumatori**: chi si registra è quasi sempre una persona fisica. Servono
   le clausole del Codice del Consumo (recesso, foro, clausole vessatorie da
   approvare specificamente, art. 1341-1342 c.c.)?
9. **Conservazione**: le bozze propongono tempi (vedi informativa). Sono
   ragionevoli? Oggi l'app **non ha ancora** una funzione per cancellare
   l'account o il condominio: va costruita prima del primo cliente esterno.
10. **Registro dei trattamenti e DPIA**: servono per questa dimensione e questo
    tipo di dati?

## Cosa manca nel prodotto per rispettare questi testi

Da costruire prima del primo condominio che non è il nostro (in
`docs/ROADMAP.md`):

- [ ] Pagine pubbliche `/termini`, `/privacy`, `/informativa-condomini`
- [ ] Spunte dell'onboarding e dell'invito, con prova salvata (utente, testo,
      versione, data)
- [ ] Cancellazione dell'account e del condominio, con i documenti
- [ ] Esportazione dei propri dati (art. 20)
- [ ] Un indirizzo email per la privacy che qualcuno legge
