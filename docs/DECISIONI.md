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

## Aperte

**Chi è il cliente pagante** — vedi le cinque domande in `SERVIZI.md`. È la
decisione da cui dipendono multi-tenancy, prezzi e metà della roadmap.
