# Decisioni

Le scelte che avevano un'alternativa reale, con il motivo e la data. Serve a non
rimetterle in discussione ogni tre mesi e a spiegare il codice a chi arriva dopo.
Formato: data, decisione, perché, cosa abbiamo scartato.

## Già prese (ricostruite dal codice e dai commit)

**2026 — L'inferenza AI esce diretta verso `api.anthropic.com`, con `baseURL` esplicito.**
Dentro una Netlify Function l'AI Gateway si inserisce da solo negli SDK supportati e
fattura l'inferenza sui crediti del piano, gli stessi che pagano l'hosting: è già
costato un sito offline (6,15 $ = 1.106 crediti su 1.000). Scartato: lasciare il
gateway per comodità. Reversibile con `ANTHROPIC_BASE_URL`.

**2026 — Ogni importo estratto porta con sé la sua provenienza (documento, pagina, riga).**
Un numero estratto da un'AI senza modo di risalire alla fonte non è verificabile,
e un gestionale condominiale non può chiedere fiducia sui numeri. Costo: i
documenti caricati vanno conservati, non cancellati. Scartato: le citazioni
native dell'API, che si agganciano alla prosa del modello mentre qui si chiede solo JSON.

**2026 — L'estrazione vive in una background function, non in una route API.**
L'analisi di un bilancio supera i limiti di tempo delle funzioni sincrone.
Costo: serve un meccanismo di polling dello stato (`/api/extract-status`).

**2026 — I fornitori hanno un'anagrafica per condominio, con alias.**
Senza, la stessa ditta scritta in due modi restava due fornitori e una correzione
a mano si perdeva alla rilettura successiva. Il nome come stampato nel documento
resta comunque su ogni movimento: è provenienza.

**2026 — Componenti UI scritti a mano in stile shadcn/ui, non una libreria di componenti.**
Scartato: MUI, Chakra. Costo: ogni componente nuovo va scritto.

**19/09/2026 — Il prodotto si chiama Condominiak.**
Finora convivevano due nomi: CondoTwin nel codice (`package.json`, README, un
modulo di libreria), Condominiak nel repository. Vince Condominiak perché è già
il dominio, e un dominio costa molto di più da cambiare di una stringa nel
codice. Scartato: CondoTwin. Il modulo `condotwin-calculations.ts` è diventato
`calcoli.ts` invece di `condominiak-calculations.ts`: il nome del prodotto dentro
un nome di file è esattamente ciò che ha reso necessario questo lavoro, e i file
vicini (`bilancio.ts`, `movimenti.ts`, `fornitori.ts`) già si chiamano per il
dominio, non per il prodotto.

**19/09/2026 — Il cliente è il condominio, non l'amministratore.**
Paga il condominio: si iscrive un condòmino o un consigliere, carica i
rendiconti che l'amministratore ha già inviato, e l'app li elabora.
L'amministratore entra solo se il condominio lo invita. Scartato:
l'amministratore professionista come cliente pagante, che avrebbe richiesto
riparto, rendiconto e contabilità da produrre, non da leggere. Conseguenza: il
prodotto è uno strumento di verifica, e la qualità dell'estrazione dai PDF non è
una funzionalità fra le altre — è il prodotto. Vedi `SERVIZI.md` Parte B.

**20/09/2026 — I rendiconti si leggono con un parser, non con il modello.**
Un rendiconto è generato da un gestionale: ha un livello di testo vero, colonne
in posizioni dichiarate dalla propria intestazione, e voci con un codice
(`001.005 Assicurazione`) che lo stesso amministratore riusa ogni anno. Su tre
esercizi consecutivi del nostro condominio — 2022-23, 2023-24, 2024-25 — il
parser legge 30, 28 e 30 voci senza alcuna chiamata al modello, e 22 codici
sono presenti in tutti e tre. Dei 30 codici del 2024-2025, due soli non
comparivano negli anni precedenti.

Il modello serve dunque una volta per formato, per scrivere la corrispondenza
fra codice e categoria, non una volta per documento. Scartato: continuare a
mandare l'intero PDF come immagini a ogni analisi — 43 pagine per estrarne 9 di
spese, con un costo per ogni rilettura e un risultato che può cambiare fra due
letture dello stesso file.

Il parser si ferma quando non riconosce un formato invece di indovinare. È la
proprietà che lo distingue da un modello, che un numero lo restituisce sempre.
(MULTIGEST, che quel giorno non si leggeva, è stato aggiunto il 20/09: i formati
riconosciuti sono tre.)

**20/09/2026 — I formati sono dati, non codice generato.**
Un formato nuovo si descrive con una scheda — dove sono le colonne, come si
riconosce una voce, dove sta il totale — che un motore solo, scritto e
verificato una volta, esegue. Scartato: far scrivere al modello un lettore in
codice per ogni formato nuovo, che era la strada più diretta e anche la più
pericolosa. Una scheda dice dove guardare, non cosa fare: al peggio legge male
dei numeri, e la quadratura contro il totale stampato se ne accorge. Codice
generato a runtime avrebbe potuto fare qualunque cosa, e nessuno lo avrebbe
riletto. Costo: un formato che non si lascia descrivere dalla scheda richiede di
estendere il motore, e l'estensione va rivista da noi.

**20/09/2026 — Una lettura si usa solo se quadra al centesimo.**
Il rendiconto stampa il proprio totale: la lettura si confronta con quello. Se
lo scarto supera un centesimo, se compare un codice che il profilo non conosce,
o se non si capisce l'anno, la lettura si dichiara inutilizzabile e il documento
va al modello come prima. Scartato: usare la lettura migliore disponibile e
segnalare l'incertezza. Un numero sbagliato gratis costa più di uno giusto a
pagamento, perché nessuno lo ricontrolla.

**20/09/2026 — Un esercizio a cavallo prende l'anno in cui chiude.**
Il rendiconto 01/08/2024 – 31/07/2025 è l'esercizio 2025. Scartato: l'anno di
apertura. Era già sbagliato in archivio — il 2024-2025 stava sotto il 2024 — e
sistemarlo ha richiesto di spostare tutto di uno. La regola vale ovunque:
nell'estrazione, nel database, nei selettori d'anno.

**20/09/2026 — Quello che il condominio incassa sta fuori dalle spese, in una tabella sua.**
Il rendiconto tiene dentro il proprio totale anche le partite di singoli
condomini: un rimborso assicurativo incassato, una spesa riaddebitata a chi
l'ha causata. Vanno in `incassi`, e vale sempre `spese = totale stampato −
incassi`. Scartato: sommarle alle categorie col segno che hanno — il rimborso
di 2.500 € del 2023-2024 avrebbe reso negativa l'assicurazione e reso gli anni
non confrontabili. Scartato anche: riscrivere il totale stampato per far
tornare i conti. È la cifra che il condòmino ritrova sulla carta, e cambiarla
sarebbe mentirgli.

**20/09/2026 — Il fotovoltaico è una categoria a sé.**
È un impianto del condominio con costi ricorrenti propri: assistenza, accisa,
oneri fiscali, manutenzioni straordinarie. Finiva in "varie", e i 5.378,85 € di
manutenzione straordinaria del 2023-2024 sparivano dentro una voce che non
significa niente.

**20/09/2026 — I movimenti di una voce si tengono solo se sommano al totale della voce.**
Altrimenti si scartano tutti. Scartato: tenerne una parte e dichiarare la
copertura riga per riga. Un elenco di fatture a cui ne manca una si legge come
se fosse completo, e nessuno va a controllare quanto è completo. Conseguenza:
sui rendiconti Tosiani il dettaglio per fornitore copre l'84% delle spese, e il
resto sono fatture ripartite a percentuale fra più voci — la luce di un
contatore diviso fra scale, ascensore e autorimesse — che non appartengono a
una voce sola. La percentuale si dice, non si nasconde.

**20/09/2026 — Fornitore e data si leggono solo dove il formato dà loro una colonna.**
Nei rendiconti Tosiani il fornitore sta prima del numero di documento, e si
isola trovando la data. Negli altri due formati no, e il campo resta vuoto:
meglio di un nome ritagliato a occhio dalla descrizione, che sembra un dato e
non lo è.

**23/09/2026 — La quota di un appartamento si legge dal riparto, non si calcola.**
Il rendiconto stampa, unità per unità, quanto paga ciascuna. L'applicazione la
calcolava come millesimi generali diviso millesimi totali, per la spesa
dell'anno, e sul 2024-2025 sbagliava da -34% a +59%: il condominio ripartisce
con nove tabelle millesimali diverse — generali, scale e ascensore, corsello
garage, fotovoltaico… — e paga riscaldamento e acqua a contatore, che insieme
sono metà della spesa. Scartato: correggere la divisione usando le tabelle
giuste. Avrebbe richiesto di sapere quale tabella usa ogni voce di spesa, cioè
di rifare il riparto che l'amministratore ha già fatto e stampato. Dove il
riparto non si legge, la pagina non mostra una stima: dice che manca.

**23/09/2026 — L'anagrafica comprende box, cantine e posti auto.**
Sono unità con i loro millesimi, e nel 2024-2025 hanno pagato 1.357,80 €.
Senza di loro i millesimi generali sommavano 908,52 e sembrava che mancasse
qualcosa nei dati; mancavano invece 30 unità. Si collegano a un'unità del
rendiconto con il codice dell'amministratore ("009"), che resta lo stesso
anno dopo anno, e non con il nome. Le liste pensate per le persone — gli
inviti, il selettore degli appartamenti — mostrano solo gli appartamenti.

**23/09/2026 — Il salvataggio collega le quote alle unità, ma non crea unità.**
Prima per codice; se un'unità non ce l'ha ancora, per tipologia e nome, ma
solo se il nome ne identifica una sola. Scartato: creare in automatico le
unità che il riparto nomina e l'anagrafica non ha. Un'unità creata in silenzio
da un nome scritto diversamente è un doppione che nessuno vede, e sposta la
quota di un appartamento su un altro. Le quote non collegate restano salvate e
aspettano un'unità.

**23/09/2026 — Una verifica deve poter fallire su ciò che non ha letto.**
Il lettore del riparto confrontava ogni colonna letta con il totale stampato di
quella colonna, e diceva "quadra". Nel 2023-2024 c'era una decima colonna che
non riconosceva: spariva dalle quote e anche dal confronto, e la verifica
passava. Ora ogni numero della riga dei totali deve trovare la sua colonna, o
la lettura si dichiara sbagliata. È una regola generale: un controllo che
guarda solo ciò che ha capito non si accorge mai di ciò che gli è sfuggito.

**23/09/2026 — Nessun permesso ad anon sulle tabelle.**
Supabase concedeva tutto a tutti, anche a chi ha solo la chiave pubblica, e
lasciava alla RLS il compito di fermarlo. L'applicazione non legge mai una
tabella senza un utente autenticato, quindi anon non ha bisogno di niente.
Scartato: seguire il modello suggerito da Supabase, che concede a anon la
lettura. Con la RLS scritta bene non cambierebbe nulla; con una policy scritta
male, la differenza è fra un errore e i dati di un condominio su internet.

**25/09/2026 — Chi vede cosa lo decide la tabella `membri`.**
Prima l'appartenenza si deduceva da due colonne: `condominiums.owner_id` per
l'amministratore, `unita.user_id` per il condomino, una riga ciascuno. Con due
appartamenti, o due condomini, l'utente finiva all'onboarding. Ora una persona
è membro di quanti condomini vuole, con un ruolo per ciascuno, ed è collegata a
quante unità vuole. `owner_id` resta come memoria di chi ha registrato il
condominio, non come permesso. Il condominio che si sta guardando è una
preferenza in un cookie: se nomina un condominio non più suo, non vale.

**25/09/2026 — L'invito è un token segreto, non l'id di un'unità.**
Casuale (32 byte), salvato solo come impronta, valido 14 giorni, usabile una
volta, e solo dall'email a cui è stato mandato. Si accetta sul server: la RLS
non deve lasciar scrivere a un utente il proprio collegamento a un'unità.
Scartato: collegare per email alla registrazione. Un'email scritta male
nell'anagrafica collegherebbe un estraneo all'appartamento di un altro.

**25/09/2026 — I documenti sono del condominio, non di chi li carica.**
`{condominio}/documenti/{impronta}-{nome}`: li apre ogni membro, e restano dove
sono se l'amministratore cambia. Un file entra nell'archivio quando i suoi
numeri vengono salvati, non quando viene analizzato: un'analisi abbandonata non
lascia niente in archivio. L'impronta del contenuto nel nome fa sì che lo
stesso PDF caricato due volte sia un file solo.

**25/09/2026 — La manutenzione dello Storage non cancella mai un contenuto unico.**
Sposta lo storico nel condominio i cui dati lo citano (copia, aggiorna le
righe, e solo alla fine toglie l'originale), e cancella un caricamento
abbandonato solo se lo stesso contenuto è già in archivio. Un file che non si
sa di chi sia resta dov'è e finisce nel rapporto. Scartato: cancellare i
caricamenti più vecchi di un mese. Fra i 27 file di oggi ce n'è uno che non
esiste da nessun'altra parte.

**25/09/2026 — Le migrazioni sono schema; i dati di un condominio no.**
Le tre migrazioni che scrivevano i numeri di Via Enriques sceglievano il
condominio con `limit 1`, e due `update` non lo sceglievano affatto: su un
database con più condomini avrebbero scritto su uno a caso e spostato gli
esercizi di tutti. Sono passate in `supabase/dati/`, dove ogni file nomina il
condominio per id e si ferma se non lo trova. Non si riscrive la storia di
produzione: sono già state applicate, e restano come registro.

## Aperte

**Cosa vede un condòmino che non è consigliere**, e come trattiamo i dati
personali degli altri condòmini contenuti nei rendiconti (morosità in primo
luogo). Vedi le cinque domande aperte in `SERVIZI.md`.

**Prezzo e modalità di incasso** dell'abbonamento per condominio.
