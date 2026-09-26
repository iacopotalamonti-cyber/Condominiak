# Le dichiarazioni dentro l'app

> **BOZZA del 26/09/2026 — da far rivedere a un legale. Non in uso.**
> Versione: `dichiarazioni-2026-09-bozza`

Sono i testi che l'utente legge e spunta. Ogni accettazione si salva con
utente, condominio, ruolo dichiarato, identificativo della versione del testo,
data e ora. Se un testo cambia, cambia la versione e si richiede una nuova
accettazione a chi deve farla.

---

## A. Registrazione di un condominio (chi lo registra per primo)

### Passo 1 — "Chi sei in questo condominio?"

Scelta obbligatoria, una sola:

- ○ **Sono consigliere** del condominio (o incaricato dal consiglio)
- ○ **Sono l'amministratore** del condominio
- ○ **Sono un condòmino** (proprietario di un'unità dell'edificio)

⚖️ *Da decidere: inquilini/conduttori possono registrare? Per ora no.*

### Passo 2 — Spunte obbligatorie per tutti

- ☐ Ho letto e accetto i **Termini di servizio** [link].
- ☐ Ho letto l'**Informativa privacy** [link].

### Passo 3a — Se ha scelto "consigliere" o "amministratore"

- ☐ Dichiaro di essere **[consigliere / amministratore]** del condominio di
  **[via, città]** e di caricare questi documenti nell'esercizio di questo
  ruolo.

### Passo 3b — Se ha scelto "condòmino" (dichiarazione di responsabilità)

Mostrata per intero, non in un link:

> Dichiaro, sotto la mia responsabilità, che:
>
> 1. sono condòmino del condominio di **[via, città]**;
> 2. i documenti che carico li ho ricevuti legittimamente come condòmino,
>    ad esempio dall'amministratore, come tutti gli altri condòmini;
> 3. li carico solo per consultarli e farli consultare **ai condòmini dello
>    stesso condominio**, e non li condividerò fuori dal condominio;
> 4. mi impegno a far conoscere agli altri condòmini l'**informativa per i
>    condòmini** [link];
> 5. sono responsabile di ciò che carico e terrò indenne Condominiak da
>    pretese dovute a un caricamento non autorizzato.
>
> So che una dichiarazione falsa può avere conseguenze civili e che
> Condominiak può chiudere il mio account.

- ☐ **Confermo la dichiarazione qui sopra.**

⚖️ *Da decidere: chi registra da condòmino ottiene i poteri di consigliere
nell'app? Proposta: sì, ma il condominio resta segnato come "registrato da un
condòmino" finché un consigliere o l'amministratore non si iscrive e lo
conferma; da quel momento può togliere i poteri a chi ha registrato.*

---

## B. Ogni caricamento di documenti (promemoria breve)

Sopra il pulsante di caricamento, sempre visibile, senza spunta:

> Carica solo rendiconti e documenti contabili di questo condominio, ricevuti
> come condòmino, consigliere o amministratore. Saranno visibili agli iscritti
> di questo condominio.

---

## C. Accettazione di un invito

### Invitato come condòmino

- ☐ Ho letto e accetto i **Termini di servizio** [link].
- ☐ Ho letto l'**Informativa privacy** [link].
- ☐ Dichiaro di essere condòmino del condominio di **[via, città]** e mi
  impegno a non condividere fuori dal condominio i dati e i documenti che
  vedrò.

### Invitato come consigliere

Come sopra, con la terza spunta al posto di:

- ☐ Dichiaro di essere consigliere del condominio di **[via, città]** (o
  incaricato dal consiglio) e mi impegno a non condividere fuori dal condominio
  i dati e i documenti che vedrò.

---

## D. Chi invita (dentro la finestra dell'invito)

Riga sotto il pulsante "Manda l'invito", senza spunta:

> Invita solo persone di questo condominio. Riceveranno un'email con il link,
> valido 14 giorni per il loro indirizzo.

---

## Cosa salva l'app (tabella `accettazioni`, da costruire)

| Campo | Esempio |
|---|---|
| utente | id dell'account |
| condominio | id del condominio |
| tipo | `registrazione`, `invito`, `termini`, `privacy` |
| ruolo dichiarato | `consigliere`, `amministratore`, `condomino` |
| versione del testo | `dichiarazioni-2026-09` |
| data e ora | 2026-10-01 10:32:05 UTC |

Leggibile solo da chi l'ha firmata e da chi gestisce Condominiak. Non si
modifica e non si cancella dall'app: è la prova.
