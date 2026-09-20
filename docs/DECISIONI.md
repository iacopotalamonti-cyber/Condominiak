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

Il parser si ferma quando non riconosce un formato invece di indovinare: sul
rendiconto dell'amministratore precedente (MULTIGEST) riconosce zero pagine e
lo dichiara. È la proprietà che lo distingue da un modello, che un numero lo
restituisce sempre.

## Aperte

**Cosa vede un condòmino che non è consigliere**, e come trattiamo i dati
personali degli altri condòmini contenuti nei rendiconti (morosità in primo
luogo). Vedi le cinque domande aperte in `SERVIZI.md`.

**Prezzo e modalità di incasso** dell'abbonamento per condominio.
