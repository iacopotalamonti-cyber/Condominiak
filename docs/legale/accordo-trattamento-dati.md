# Accordo sul trattamento dei dati (art. 28 GDPR)

> **BOZZA del 26/09/2026 — da far rivedere a un legale. Non in uso.**
> Versione: `dpa-2026-09-bozza`
>
> Serve **solo se** si sceglie lo schema in cui il condominio è titolare e
> Condominiak è responsabile del trattamento (vedi `README.md`, domanda 1), ad
> esempio quando il condominio diventa cliente pagante con un contratto firmato
> dall'amministratore o su delibera assembleare. Nello schema "titolare
> autonomo" non serve.

**Tra**

il **Condominio [nome/via, città]**, C.F. [C.F. DEL CONDOMINIO], in persona di
[amministratore pro tempore / soggetto delegato dall'assemblea con delibera del
[DATA]] ("**Titolare**")

**e**

[TITOLARE DI CONDOMINIAK], [INDIRIZZO], [C.F./P.IVA] ("**Responsabile**").

## 1. Oggetto

Il Responsabile tratta per conto del Titolare i dati personali contenuti nei
documenti contabili del condominio caricati sul servizio Condominiak, al solo
scopo di fornire il servizio descritto nei Termini di servizio.

## 2. Natura e finalità del trattamento

Conservazione dei documenti, lettura automatica (anche con strumenti di
intelligenza artificiale), organizzazione dei dati contabili, presentazione
agli utenti autorizzati del condominio.

## 3. Tipi di dati e interessati

- **Interessati**: condòmini, titolari di diritti reali sulle unità,
  eventualmente conduttori; fornitori persone fisiche; utenti del servizio.
- **Dati**: dati anagrafici, identificativi delle unità, millesimi, quote,
  conguagli, posizioni debitorie/creditorie, importi pagati ai fornitori, email
  degli utenti.
- **Categorie particolari**: non previste; se presenti per caso in un
  documento, trattate con le stesse misure e segnalate al Titolare.

## 4. Durata

Per la durata del contratto di servizio. Alla cessazione, il Responsabile
cancella i dati entro [30] giorni, salvo diversa istruzione scritta del
Titolare di restituirli prima.

## 5. Obblighi del Responsabile

Il Responsabile:

a) tratta i dati solo su istruzione documentata del Titolare, incluse quelle
   contenute in questo accordo e nei Termini di servizio;
b) garantisce che chi tratta i dati sia vincolato alla riservatezza;
c) adotta le misure di sicurezza dell'Allegato A (art. 32);
d) non ricorre ad altri responsabili senza autorizzazione: il Titolare
   autorizza fin d'ora quelli dell'Allegato B; il Responsabile comunica con
   [15] giorni di anticipo ogni cambiamento, e il Titolare può opporsi;
e) assiste il Titolare nel rispondere alle richieste degli interessati;
f) assiste il Titolare negli obblighi degli artt. 32-36;
g) comunica al Titolare ogni violazione dei dati personali senza ingiustificato
   ritardo e comunque entro [48] ore da quando ne viene a conoscenza;
h) mette a disposizione le informazioni necessarie a dimostrare il rispetto di
   questo accordo e consente verifiche ragionevoli, con preavviso;
i) informa il Titolare se ritiene che un'istruzione violi il GDPR.

## 6. Trasferimenti fuori dallo Spazio economico europeo

Consentiti solo verso i sub-responsabili dell'Allegato B e con le garanzie ivi
indicate.

## Allegato A — Misure di sicurezza

- Cifratura dei dati in transito (HTTPS/TLS) e a riposo presso il fornitore del
  database.
- Separazione dei dati per condominio a livello di database (Row Level
  Security): ogni utente legge solo i condomini a cui appartiene.
- Documenti non pubblici, aperti solo con collegamenti firmati e temporanei.
- Password conservate con hash; accesso con email verificata.
- Accessi amministrativi limitati al personale del Responsabile che ne ha
  bisogno.
- Registrazione degli errori configurata per escludere i dati personali.
- Copie di sicurezza [DA DEFINIRE: frequenza e conservazione].

## Allegato B — Sub-responsabili autorizzati

| Sub-responsabile | Servizio | Luogo | Garanzia per il trasferimento |
|---|---|---|---|
| Supabase Inc. | Database, archivio documenti, autenticazione | UE (Irlanda) | — |
| Netlify Inc. | Hosting e funzioni di elaborazione | USA | [VERIFICARE: DPF / SCC] |
| Anthropic PBC | Modello di intelligenza artificiale | USA | [VERIFICARE: DPF / SCC] |
| Resend Inc. | Invio email | [VERIFICARE] | [VERIFICARE] |
| Functional Software Inc. (Sentry) | Monitoraggio errori | UE (Germania) | — |

Luogo e data: ______________________

Per il Titolare ______________________  Per il Responsabile ______________________
