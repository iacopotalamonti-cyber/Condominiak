# Informativa privacy per chi usa Condominiak

> **BOZZA del 26/09/2026 — da far rivedere a un legale. Non in uso.**
> Versione: `privacy-2026-09-bozza` — ai sensi dell'art. 13 del Regolamento
> (UE) 2016/679 ("GDPR")

Ultimo aggiornamento: [DATA]

## 1. Titolare del trattamento

[TITOLARE: nome e cognome o ragione sociale], [INDIRIZZO], [C.F./P.IVA].
Per qualsiasi domanda sulla privacy: **[EMAIL PRIVACY]**.

⚖️ *Da decidere: ruolo di Condominiak rispetto ai dati contenuti nei documenti
(titolare autonomo, responsabile per conto del condominio, contitolare). Questa
bozza assume titolare autonomo. Vedi `README.md`, domanda 1.*

## 2. Quali dati trattiamo

**Dati del tuo account**
- email e password (conservata solo in forma cifrata, non la vediamo);
- data di iscrizione e ultimo accesso;
- condomini a cui appartieni, il tuo ruolo (consigliere o condòmino) e
  l'appartamento collegato;
- le dichiarazioni che hai accettato, con data e versione del testo.

**Dati tecnici**
- indirizzo IP, tipo di browser, registri di accesso e di errore.

**Dati contenuti nei documenti che carichi o consulti**
- quelli presenti nei rendiconti condominiali: nomi dei condòmini, codici degli
  appartamenti, millesimi, quote di spesa, conguagli, eventuali debiti, nomi
  dei fornitori e importi pagati. Per questi dati vedi anche l'informativa per
  i condòmini ([LINK /informativa-condomini]).

**Dati che non trattiamo**
- dati di pagamento; dati di navigazione a fini pubblicitari; non usiamo
  cookie di profilazione né strumenti di analisi del traffico.

## 3. Perché li trattiamo e su quale base

| Finalità | Base giuridica |
|---|---|
| Creare e gestire il tuo account, farti accedere al tuo condominio | Esecuzione del contratto (art. 6.1.b) |
| Leggere i documenti caricati e mostrarti i conti del condominio e la quota del tuo appartamento | Esecuzione del contratto (art. 6.1.b) |
| Mandarti le email di servizio (conferma, recupero password, inviti) | Esecuzione del contratto (art. 6.1.b) |
| Sicurezza, prevenzione di abusi, correzione degli errori | Legittimo interesse (art. 6.1.f) |
| Conservare la prova delle dichiarazioni che hai accettato | Legittimo interesse (art. 6.1.f) a difendersi in caso di contestazione |
| Adempiere obblighi di legge (es. richieste dell'autorità) | Obbligo legale (art. 6.1.c) |

Non usiamo i tuoi dati per pubblicità, non li vendiamo e non li usiamo per
profilarti.

## 4. Uso dell'intelligenza artificiale

Per leggere i documenti che i nostri programmi non riescono a interpretare da
soli, inviamo il contenuto del documento a un modello di intelligenza
artificiale (Anthropic). Il modello estrae numeri e voci di spesa; non prende
decisioni che ti riguardano. Ogni numero estratto è collegato alla pagina del
documento da cui viene, così puoi verificarlo.
[VERIFICARE: Anthropic non usa i dati inviati tramite API per addestrare i suoi
modelli e li conserva per [N] giorni, secondo le condizioni commerciali vigenti.]

## 5. Chi vede i tuoi dati

**Dentro il tuo condominio**
- gli altri iscritti al tuo condominio vedono i conti del condominio e i
  documenti originali (gli stessi che l'amministratore manda a tutti);
- la quota di ciascun appartamento, nell'app, la vede solo chi è collegato a
  quell'appartamento, oltre ai consiglieri;
- i consiglieri vedono l'elenco degli iscritti e degli inviti del condominio.

**Fornitori tecnici** che trattano i dati per nostro conto, come responsabili
del trattamento (art. 28):

| Fornitore | Servizio | Dove |
|---|---|---|
| Supabase Inc. | Database, archivio dei documenti, autenticazione | Unione Europea (Irlanda) |
| Netlify Inc. | Hosting del sito e delle funzioni di lettura dei documenti | Stati Uniti |
| Anthropic PBC | Modello di intelligenza artificiale per la lettura dei documenti | Stati Uniti |
| Resend Inc. | Invio delle email | [VERIFICARE] |
| Functional Software Inc. (Sentry) | Registrazione degli errori tecnici | Unione Europea (Germania) |

**Nessun altro**, salvo richiesta dell'autorità nei casi previsti dalla legge.

## 6. Trasferimenti fuori dall'Unione Europea

Alcuni fornitori si trovano negli Stati Uniti. Il trasferimento avviene sulla
base di [VERIFICARE per ciascuno: decisione di adeguatezza UE-USA (Data Privacy
Framework) per i fornitori certificati / clausole contrattuali standard
approvate dalla Commissione europea]. Puoi chiederne copia a [EMAIL PRIVACY].

## 7. Per quanto tempo li conserviamo

⚖️ *Proposte da validare:*

| Dato | Per quanto |
|---|---|
| Account | Finché resta attivo; cancellato entro [30] giorni dalla chiusura |
| Documenti e dati di un condominio | Finché il condominio resta registrato; cancellati entro [30] giorni dalla richiesta di un consigliere o dalla chiusura dell'ultimo account del condominio |
| Inviti non accettati | [90] giorni dalla scadenza |
| Prova delle dichiarazioni accettate | [10] anni dalla chiusura dell'account (termine di prescrizione ordinaria) |
| Registri tecnici e di errore | [90] giorni |
| Copie di sicurezza | Fino a [30] giorni, poi sovrascritte |

## 8. I tuoi diritti

Puoi chiederci in qualsiasi momento, scrivendo a [EMAIL PRIVACY]:

- di **vedere** i dati che abbiamo su di te e averne copia (art. 15);
- di **correggerli** (art. 16);
- di **cancellarli** (art. 17);
- di **limitarne** il trattamento (art. 18);
- di **riceverli** in un formato leggibile da un computer (art. 20);
- di **opporti** ai trattamenti basati sul legittimo interesse (art. 21).

Rispondiamo entro un mese. Se ritieni che il trattamento violi la legge, puoi
presentare reclamo al **Garante per la protezione dei dati personali**
(www.garanteprivacy.it).

Nota: se chiedi di cancellare dati che fanno parte di un documento del
condominio (per esempio il tuo nome in un rendiconto), valuteremo la richiesta
bilanciandola con il diritto degli altri condòmini di consultare quel
documento. ⚖️ *Da validare.*

## 9. Sicurezza

I dati viaggiano cifrati (HTTPS). L'accesso ai dati di ogni condominio è
limitato, a livello di database, ai soli iscritti di quel condominio. Le
password sono conservate cifrate. I documenti non sono pubblici e si aprono
solo con un collegamento temporaneo per chi ne ha diritto.

## 10. Cookie

Usiamo solo cookie tecnici, necessari per tenerti collegato al tuo account.
Non usiamo cookie di profilazione né di terze parti a fini pubblicitari, quindi
non serve un consenso.

## 11. Minori

Il servizio è riservato ai maggiorenni.

## 12. Modifiche

Se cambiamo questa informativa in modo importante te lo diciamo per email o
nell'app prima che le modifiche abbiano effetto.
