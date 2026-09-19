import type {
  CampoImporto,
  CategoriaSpesa,
  ExtractedMovimento,
  Controllo,
  ExtractedBilancio,
  ExtractedImpianti,
  ExtractedImpiantiDettagli,
  ExtractedImpiantoDettaglio,
  ExtractedInfo,
  ExtractedSpese,
  ExtractedUnita,
  ExtractionResult,
  Fonte,
  ValoreScartato,
} from "./types";
// Deve restare uguale a quella di ./bilancio.ts, che è il riferimento per
// l'interfaccia. Non la si importa da lì perché questo modulo viene impacchettato
// anche dentro la Netlify Function, e un import in più fra i due è una dipendenza
// che non serve: a tenerle allineate ci pensa un test.
const TOLLERANZA_QUADRATURA = 1;

// I bilanci sono tabelle fitte di numeri e l'errore di lettura non si vede:
// vale la pena del modello più capace, con il ragionamento acceso. Restano
// però la voce di spesa più grossa dell'applicazione, e ora che la quadratura
// e la verifica sul PDF dicono se la qualità regge, provare un modello più
// economico è un esperimento misurabile: sono sovrascrivibili da variabile
// d'ambiente, così si cambia senza un rilascio.
export const EXTRACTION_MODEL = "claude-opus-5";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const EXTRACTION_EFFORT: Effort = "high";

// Un refuso in una variabile d'ambiente non deve far fallire ogni estrazione
// con un 400: un valore non riconosciuto ricade sul predefinito.
const EFFORT_AMMESSI: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function effortValido(valore: string | undefined): Effort {
  const effort = EFFORT_AMMESSI.find((ammesso) => ammesso === valore);
  return effort ?? EXTRACTION_EFFORT;
}
// Con il ragionamento attivo i token di thinking rientrano in questo tetto: in
// streaming non c'è il rischio di timeout HTTP, e uno spazio più largo evita
// che la risposta venga troncata a metà JSON.
export const EXTRACTION_MAX_TOKENS = 32000;

// Il tier dell'account impone un tetto di token in input per singola richiesta
// molto più basso della context window del modello: superarlo fa fallire la
// chiamata con 400 input_tokens_exceeded. I documenti vengono quindi analizzati
// uno per richiesta, e i PDF più lunghi di così spezzati in blocchi di pagine.
export const MAX_PAGES_PER_REQUEST = 20;

// Pagine ripetute fra un blocco e il successivo: una tabella che cade sul
// confine viene comunque vista intera in uno dei due blocchi, invece di
// produrre due subtotali parziali spacciati per totali.
export const PAGINE_SOVRAPPOSTE = 2;

const CATEGORIE_SPESA = [
  "riscaldamento",
  "ascensore",
  "pulizia",
  "assicurazione",
  "amm",
  "illuminazione",
  "manutenzione",
  "acqua",
  "giardinaggio",
  "varie",
] as const;

const TIPI_IMPIANTO = [
  "riscaldamento",
  "ascensore",
  "areeVerdi",
  "raffrescamento",
  "citofono",
  "parcheggio",
] as const;

const IMPIANTI_CON_DETTAGLI = ["riscaldamento", "ascensore", "areeVerdi", "citofono"] as const;

const CAMPI_DETTAGLIO = ["marca", "anno", "ultima", "contratto", "scad", "fornitore"] as const;

export const TOTALE_CAMPI = 60;

// Tutti i campi di un bilancio che contengono un importo, nell'ordine in cui
// vengono mostrati: è la lista su cui girano fusione, controlli e interfaccia.
export const CAMPI_IMPORTO: CampoImporto[] = [
  "prev",
  "cons",
  "fondo",
  "totale",
  ...CATEGORIE_SPESA.map((c) => `spesa.${c}` as CampoImporto),
];

export const CAMPI_IMPORTO_LABEL: Record<string, string> = {
  prev: "Preventivo",
  cons: "Consuntivo",
  fondo: "Fondo riserva",
  totale: "Totale del documento",
};

const IMPORTO_SCHEMA = `{"v": 0, "pag": 0, "txt": ""}`;

const SPESE_SCHEMA = CATEGORIE_SPESA.map((c) => `"${c}": ${IMPORTO_SCHEMA}`).join(", ");

export const EXTRACTION_SCHEMA = `{
  "info": {"via":"","citta":"","cap":"","annoCostr":"","piani":0,"nApt":0,"pianoTerra":true,"amm":"","emailAmm":"","telAmm":""},
  "unita": [{"int":1,"piano":"T","mq":0,"ml":0,"nome":"","email":"","tel":""}],
  "bilanci": [
    {
      "anno": 0,
      "prev": ${IMPORTO_SCHEMA},
      "cons": ${IMPORTO_SCHEMA},
      "fondo": ${IMPORTO_SCHEMA},
      "totale": ${IMPORTO_SCHEMA},
      "spese": {${SPESE_SCHEMA}},
      "movimenti": [{"data": "", "desc": "", "forn": "", "cat": "", "v": 0, "pag": 0, "txt": ""}]
    }
  ],
  "imp": {"riscaldamento":false,"ascensore":false,"areeVerdi":false,"raffrescamento":false,"citofono":false,"parcheggio":false},
  "impDet": {
    "riscaldamento":{"marca":"","anno":"","ultima":"","contratto":"","scad":""},
    "ascensore":{"marca":"","anno":"","ultima":"","contratto":"","scad":""},
    "areeVerdi":{"fornitore":"","contratto":"","scad":""},
    "citofono":{"marca":"","anno":"","ultima":""}
  },
  "confidence": {"info":0.0,"unita":0.0,"bilanci":0.0,"spese":0.0,"imp":0.0},
  "note": ""
}`;

// Le regole sugli importi sono la parte che decide se i numeri saranno
// ritrovabili nel documento o no: ogni valore deve portarsi dietro la pagina e
// la riga da cui viene, e nessun valore può essere dedotto.
const REGOLE_IMPORTI = `Regole sugli importi:
- Ogni importo si scrive nella forma ${IMPORTO_SCHEMA}
- "v" è il numero e basta: punto come separatore decimale, nessun separatore per
  le migliaia (12345.67, non 12.345,67)
- "pag" è il numero di pagina di QUESTO blocco: la prima pagina che ricevi è 1
- "txt" è la riga del documento da cui hai letto il numero, copiata alla lettera
  con l'etichetta e l'importo come sono stampati
- Se un importo non è presente nel documento scrivi {"v": 0, "pag": 0, "txt": ""}:
  non dedurlo, non stimarlo, non calcolarlo, non riportarlo da un altro anno
- Non scrivere mai un importo che non compaia stampato nel documento. "totale" è
  il totale complessivo stampato, non la somma che faresti tu
- Le quote individuali e i riparti millesimali non sono voci di spesa del
  condominio: servono solo gli importi complessivi
- Molti rendiconti sono ANALITICI: elencano i singoli movimenti raggruppati per
  voce, con codici tipo 001.001, 002.004, 100.002. In quel caso l'importo di una
  categoria è il TOTALE del periodo per quella voce, mai una sola delle sue
  righe. Se il documento stampa il subtotale della voce usa quello e copialo in
  "txt"; se non lo stampa, somma tutte le righe di quella voce e scrivi in "txt"
  la prima e l'ultima riga che hai sommato
- Sommare le righe di una stessa voce, e sommare in "varie" le voci che non
  rientrano in nessuna categoria dello schema, è l'unico calcolo consentito:
  tutto il resto va copiato come stampato. Quando sommi, dillo in "note"
- I rendiconti condominiali contengono quasi sempre, dopo l'elenco delle spese,
  una o più TABELLE DI RIPARTO: ri-espongono le stesse spese già elencate,
  divise fra le unità o per criterio di ripartizione. NON sono spese nuove e non
  vanno messe né in "spese" né in "movimenti". Le riconosci da queste tracce:
  percentuali di attribuzione ("80% periodo invernale", "60% spesa estiva",
  "100% millesimi"), colonne per unità o per interno, intestazioni con
  "riparto", "ripartizione", "suddivisione", "quote", "tabella millesimale", e
  soprattutto dal fatto che i loro importi ricompaiono identici nell'elenco
  spese. Nel dubbio fra elenco spese e riparto, prendi l'elenco spese
- Se la stessa tabella di riparto compare più volte (una per scala, per
  impianto o per criterio), vale comunque zero: non è una spesa ripetuta
- CONTROLLO FINALE, fallo sempre: somma tutte le categorie e confrontale con il
  totale generale stampato nel documento. Se non torna hai saltato delle righe,
  e devi tornare a cercarle prima di rispondere. Se dopo la ricerca resta una
  differenza, NON inventare dove metterla e non gonfiare una categoria per far
  quadrare i conti: lasciala fuori e scrivi in "note" quanto manca e in quali
  pagine pensi che sia`;

const REGOLE_MOVIMENTI = `Regole sui movimenti (il dettaglio riga per riga):
- Se il documento è analitico, compila "movimenti" con UNA VOCE PER OGNI RIGA di
  spesa che elenca: è il dettaglio, non un riassunto
- "desc" è la descrizione della riga come stampata
- "forn" è il nome del fornitore che compare in quella riga (la ditta, la
  società, il professionista). Lascialo "" se la riga non nomina nessuno, come
  per consumi, conguagli e giroconti: non dedurre il fornitore da altre righe
- "cat" è una delle categorie dello schema, la stessa a cui assegneresti la riga
- "data" è la data del movimento in formato AAAA-MM-GG; "" se non c'è
- "v", "pag" e "txt" seguono le stesse regole degli altri importi
- Se il documento NON elenca le singole righe, lascia "movimenti" vuoto: non
  inventare un dettaglio che non c'è
- Non saltare righe perché piccole o ripetitive: il dettaglio serve proprio a
  far tornare i conti`;

const REGOLE_BILANCI = `Regole sui bilanci:
- "bilanci" contiene una voce per ogni esercizio effettivamente presente nel
  documento e nessuna in più: se il documento riguarda un solo anno, restituisci
  una sola voce. Non aggiungere anni per completare una serie
- "anno" è l'esercizio a cui il bilancio si riferisce, non la data di
  approvazione né quella di stampa del documento
- Un esercizio a cavallo di due anni solari (per esempio 01/07/2024-30/06/2025,
  o un rendiconto intitolato "2024-2025") è UN SOLO esercizio, non due:
  restituisci una sola voce, con "anno" uguale al PRIMO dei due anni, quello
  con cui il documento stesso si intitola. Non spezzare lo stesso rendiconto in
  due bilanci e non ripetere lo stesso totale sotto due anni diversi
- "prev" è il preventivo, "cons" il consuntivo, "fondo" il fondo di riserva
- Ogni voce di spesa appartiene all'anno del proprio bilancio: non mescolare
  esercizi diversi nella stessa voce`;

export const EXTRACTION_PROMPT = `Sei un esperto di amministrazione condominiale italiana.
Analizza questi documenti (bilanci, verbali assemblee, tabelle millesimali, contratti) e
estrai tutti i dati strutturati disponibili.

Restituisci SOLO JSON valido, senza markdown, senza testo aggiuntivo, con questo schema esatto:
${EXTRACTION_SCHEMA}

${REGOLE_IMPORTI}

${REGOLE_MOVIMENTI}

${REGOLE_BILANCI}

Altre regole:
- Usa SOLO dati esplicitamente presenti nei documenti — non inventare mai
- Per le stringhe non trovate usa ""
- I millesimi devono sommare il più vicino possibile a 1000
- "confidence" indica la tua certezza per ogni sezione (0.0-1.0)
- In "note" scrivi quali anni hai riconosciuto e da quale parte del documento,
  che cosa non sei riuscito a leggere e che cosa manca`;

// Aggiunta di un singolo esercizio allo storico già esistente: stesso schema,
// ma al modello interessa solo l'anno di quel bilancio e le sue voci di spesa.
export const BILANCIO_PROMPT = `Sei un esperto di amministrazione condominiale italiana.
Questo documento è il bilancio di UN SINGOLO esercizio (preventivo o consuntivo) di un condominio.

Restituisci SOLO JSON valido, senza markdown, senza testo aggiuntivo, con questo schema esatto:
${EXTRACTION_SCHEMA}

- Compila SOLO "bilanci", con una sola voce: l'anno di questo bilancio, i suoi
  importi, le sue voci di spesa E I SUOI MOVIMENTI, che sono la parte più
  importante quando il documento elenca le singole righe. Lascia tutto il resto
  ai valori vuoti dello schema

${REGOLE_IMPORTI}

${REGOLE_MOVIMENTI}

${REGOLE_BILANCI}

- "confidence" indica la tua certezza per ogni sezione (0.0-1.0)
- In "note" scrivi l'anno riconosciuto e da quale parte del documento l'hai ricavato`;

// Primo passaggio sui PDF lunghi: invece di tagliare a pagine fisse, si chiede
// al modello dove sono le tabelle, così l'estrazione vera riceve la tabella
// intera invece di due metà.
export const LOCALIZZA_PROMPT = `Sei un esperto di amministrazione condominiale italiana.
Questo è un documento condominiale di più pagine. NON estrarre importi.

Indica soltanto in quali pagine si trovano i prospetti di bilancio (preventivo,
consuntivo, riepilogo delle spese, fondo di riserva).

Restituisci SOLO JSON valido, senza markdown, senza testo aggiuntivo:
{"sezioni": [{"anno": 0, "da": 1, "a": 1, "cosa": ""}]}

- "da" e "a" sono numeri di pagina di questo blocco: la prima pagina che ricevi è 1
- Includi la pagina del totale e quelle delle voci di spesa che lo compongono,
  anche quando la tabella prosegue su più pagine
- "anno" è l'esercizio del prospetto, 0 se non riesci a leggerlo
- "cosa" descrive in poche parole il prospetto ("consuntivo 2023", "riparto spese")
- Se non trovi nessun prospetto restituisci {"sezioni": []}`;

export type ExtractionMode = "condominio" | "bilancio";

// La rilettura serviva a poco perché rimandava le stesse istruzioni: stesso
// documento, stesso prompt, stesso errore. Qui invece il modello riceve lo
// scarto misurato — un dato che non poteva conoscere, perché nasce dal
// confronto fra la sua risposta e il totale stampato.
export function promptCorrezione(
  sommaVoci: number,
  totaleStampato: number,
  pagineRiparto: number[]
): string {
  const scarto = arrotonda(sommaVoci - totaleStampato);
  const sospette = pagineRiparto.length
    ? ` Le pagine ${pagineRiparto.join(", ")} sembrano tabelle di riparto: comincia da lì.`
    : "";

  if (scarto > 0) {
    return `
CORREZIONE. Una prima lettura di questo documento ha prodotto voci di spesa che sommano
${eur(sommaVoci)}, mentre il totale stampato nel documento è ${eur(totaleStampato)}:
${eur(scarto)} DI TROPPO. Quasi sempre significa che sono state incluse righe di una
tabella di riparto, oppure che la stessa tabella è stata letta due volte perché ricompare
più avanti.${sospette}
Rileggi e restituisci SOLO le righe dell'elenco spese vere. Le voci devono sommare
${eur(totaleStampato)}. Non togliere righe a caso per far quadrare il conto: togli quelle
che ri-espongono importi già presenti altrove, e scrivi in "note" quali hai escluso e perché.`;
  }

  return `
CORREZIONE. Una prima lettura di questo documento ha prodotto voci di spesa che sommano
${eur(sommaVoci)}, mentre il totale stampato nel documento è ${eur(totaleStampato)}:
MANCANO ${eur(-scarto)}. Significa che delle righe di spesa non sono state lette — spesso
perché la tabella prosegue oltre il salto pagina, o perché una voce raggruppa più righe.
Rileggi con attenzione e cerca le righe mancanti. Le voci devono sommare
${eur(totaleStampato)}. Se non le trovi, NON gonfiare una categoria: scrivi in "note"
quanto manca e dove pensi che sia.`;
}

// Ogni documento viene analizzato in una richiesta separata: senza questa nota
// il modello prova a "completare" lo schema deducendo i campi che vede mancare,
// e in fase di fusione quei valori inventati sovrascriverebbero quelli reali
// estratti dagli altri documenti.
export function extractionPrompt(
  label: string,
  index: number,
  total: number,
  mode: ExtractionMode = "condominio",
  // Pagine che il testo del PDF indica come tabelle di riparto, numerate come
  // le vede il modello in questo blocco.
  pagineRiparto: number[] = []
): string {
  const base = mode === "bilancio" ? BILANCIO_PROMPT : EXTRACTION_PROMPT;

  const avviso = pagineRiparto.length
    ? `

ATTENZIONE: dal testo del documento le pagine ${pagineRiparto.join(", ")} di questo blocco
sembrano TABELLE DI RIPARTO. Verificale: se lo sono, i loro importi sono spese già
elencate altrove e non vanno messi né in "spese" né in "movimenti".`
    : "";

  if (total <= 1) return base + avviso;

  return `${base}${avviso}

CONTESTO: stai analizzando solo una parte della documentazione (${label} — blocco ${index} di ${total}).
Estrai esclusivamente i dati presenti in QUESTO blocco e lascia a 0 / "" tutto il resto: i campi
mancanti vengono recuperati dagli altri blocchi. Non dedurre, stimare o completare valori assenti qui.`;
}

// -----------------------------------------------------------------------
// Lettura dei valori grezzi
// -----------------------------------------------------------------------

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Gli importi arrivano come li scrive il modello o come sono stampati nel
// documento: "12.345,67", "12,345.67", "€ 1.200", "(350,00)" per i negativi.
// Il separatore decimale si riconosce dall'ultimo separatore presente e da
// quante cifre lo seguono: nei gruppi delle migliaia sono sempre tre, quindi
// "48.500" vale 48500 e non 48,5.
export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const raw = value.trim();
  if (!raw) return 0;

  const negativo = /^\(.*\)$/.test(raw) || /^[-−–]/.test(raw);
  const cifre = raw.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cifre)) return 0;

  const separatore = Math.max(cifre.lastIndexOf(","), cifre.lastIndexOf("."));
  let intero = cifre;
  let decimali = "";

  if (separatore !== -1) {
    const coda = cifre.slice(separatore + 1);
    // Una coda di una o due cifre è la parte decimale; tre cifre sono un
    // gruppo di migliaia, che va tenuto nella parte intera.
    if (/^\d{1,2}$/.test(coda)) {
      intero = cifre.slice(0, separatore);
      decimali = coda;
    }
  }

  const soloCifre = intero.replace(/\D/g, "");
  const parsed = Number(`${soloCifre || "0"}.${decimali || "0"}`);
  if (!Number.isFinite(parsed)) return 0;

  return negativo ? -parsed : parsed;
}

function confidence(value: unknown): number {
  return Math.min(1, Math.max(0, num(value)));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function arrotonda(value: number): number {
  return Math.round(value * 100) / 100;
}

function eur(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

// -----------------------------------------------------------------------
// Verifica: il numero esiste davvero in quella pagina?
// -----------------------------------------------------------------------

// La prima versione si appoggiava alle citazioni dell'API. Non funzionava, e il
// motivo sta nella documentazione: "citations require interleaving citation
// blocks with text output". Le citazioni si agganciano alla prosa che il modello
// scrive, ma qui gli si chiede di restituire SOLO JSON — non c'è testo in cui
// interfogliarle, e infatti non ne arrivava nessuna. Inoltre un PDF scansionato
// non è citabile affatto.
//
// La verifica quindi non passa più da ciò che il modello decide di scrivere: si
// estrae il testo del PDF per pagina e si controlla noi che le cifre siano dove
// il modello dice che sono. Se il PDF non ha un livello di testo (scansione) la
// verifica non è possibile, ed è un esito diverso da "non trovato".

export interface ContestoEstrazione {
  // Nome del file da cui viene questo blocco.
  documento: string;
  // Pagine che precedono il blocco nel documento intero: il modello numera le
  // pagine a partire da quelle che riceve, non da quelle del PDF originale.
  offsetPagina: number;
  // Testo del documento pagina per pagina, indicizzato sul numero di pagina
  // assoluto (1-based). Vuota per le immagini e per i PDF senza testo.
  testoPagine: Map<number, string>;
}

export function soleCifre(testo: string): string {
  return testo.replace(/[^\d]/g, "");
}

// Le cifre dell'importo come comparirebbero stampate, separatori esclusi:
// 12345.67 -> "1234567", 12345 -> "12345".
export function cifreImporto(valore: number): string {
  const assoluto = Math.abs(valore);
  const arrotondato = Math.round(assoluto * 100) / 100;
  const testo = Number.isInteger(arrotondato) ? String(arrotondato) : arrotondato.toFixed(2);
  return soleCifre(testo);
}

export type EsitoVerifica = "verificata" | "non_trovata" | "non_verificabile";

// Si cerca sulla pagina dichiarata e su quelle adiacenti: una tabella che
// prosegue oltre il salto pagina fa sbagliare il modello di una pagina, e in
// quel caso il numero è comunque quello giusto. Oltre non si va, perché un
// importo come 1.250,00 ricorre e allargando la ricerca si verificherebbe
// qualsiasi cosa.
export function verificaImporto(
  valore: number,
  pagina: number,
  testoPagine: Map<number, string>
): EsitoVerifica {
  if (!valore || !pagina || !testoPagine.size) return "non_verificabile";

  const vicine = [pagina, pagina - 1, pagina + 1]
    .map((p) => testoPagine.get(p))
    .filter((testo): testo is string => Boolean(testo && testo.trim()));

  if (!vicine.length) return "non_verificabile";

  const cifre = cifreImporto(valore);

  // Poche cifre ("55") ricorrono dentro qualunque altro numero della pagina:
  // cercarle nel flusso delle sole cifre darebbe un "verificato" preso a caso.
  // Prima questi importi venivano dichiarati non verificabili, il che metteva
  // un punto interrogativo accanto a ogni spesa sotto i 100 € — cioè a buona
  // parte dei piccoli interventi. Si cerca invece la forma con cui i
  // rendiconti li stampano, centesimi compresi.
  if (cifre.length < 3) {
    const stampato = formaStampata(valore);
    return vicine.some((testo) => stampato.test(testo)) ? "verificata" : "non_trovata";
  }

  return vicine.some((testo) => soleCifre(testo).includes(cifre)) ? "verificata" : "non_trovata";
}

// "55,00" o "55.00", non preceduto né seguito da altre cifre: esclude il 55
// dentro 1.550,00 e quello dentro un numero di fattura.
function formaStampata(valore: number): RegExp {
  const assoluto = Math.round(Math.abs(valore) * 100);
  const intero = Math.floor(assoluto / 100);
  const decimali = String(assoluto % 100).padStart(2, "0");
  return new RegExp(`(?<![\\d.,])${intero}[.,]${decimali}(?![\\d])`);
}

// -----------------------------------------------------------------------
// Riconoscere le tabelle di riparto
// -----------------------------------------------------------------------

// Un rendiconto, dopo l'elenco delle uscite, ri-espone le stesse somme divise
// fra le unità. Quelle pagine non sono spese, e finché il modello le legge come
// tali i totali usciranno gonfiati. Il testo delle pagine ce l'abbiamo già
// estratto per la verifica degli importi: qui si usa per dire al modello dove
// sono, invece di sperare che se ne accorga.
//
// Un solo indizio non basta: "Spesa ripartizione costi" è una voce di spesa
// vera, il servizio di lettura dei contatori. Servono più segnali insieme, o
// uno inequivocabile.
const RIPARTO_INEQUIVOCABILI = [
  /tabella\s+millesimal/i,
  /prospetto\s+di\s+ripart/i,
  /riparto\s+(?:generale|spese|delle\s+spese)/i,
  /quote?\s+millesimal/i,
  /suddivisione\s+(?:spese|delle\s+spese)/i,
];

const RIPARTO_INDIZI = [
  /millesim/i,
  /\brepart|ripartiz/i,
  /a\s+carico\s+(?:di|dei|delle)/i,
  /\bsubalterno\b|\binterno\s+n/i,
  /\bscala\s+[A-Z]\b/,
];

// Le percentuali di attribuzione — "(80% spesa periodo invernale)", "(100% Mm
// Cli nuovi)" — sono la firma del riparto: nell'elenco spese non servono.
const PERCENTUALI_ATTRIBUZIONE = /\(\s*\d{1,3}\s*%[^)]{0,60}\)/g;

export function paginaDiRiparto(testo: string): boolean {
  if (!testo || testo.trim().length < 40) return false;
  if (RIPARTO_INEQUIVOCABILI.some((marcatore) => marcatore.test(testo))) return true;

  const indizi = RIPARTO_INDIZI.filter((marcatore) => marcatore.test(testo)).length;
  const percentuali = (testo.match(PERCENTUALI_ATTRIBUZIONE) ?? []).length;

  // Due indizi diversi, oppure un indizio accompagnato da più percentuali di
  // attribuzione: una sola percentuale capita anche in una fattura.
  return indizi >= 2 || (indizi >= 1 && percentuali >= 2) || percentuali >= 3;
}

export function pagineDiRiparto(testoPagine: Map<number, string>): number[] {
  return Array.from(testoPagine.entries())
    .filter(([, testo]) => paginaDiRiparto(testo))
    .map(([pagina]) => pagina)
    .sort((a, b) => a - b);
}

// -----------------------------------------------------------------------
// Normalizzazione
// -----------------------------------------------------------------------

function mapSpese(valore: (categoria: (typeof CATEGORIE_SPESA)[number]) => number): ExtractedSpese {
  return {
    riscaldamento: valore("riscaldamento"),
    ascensore: valore("ascensore"),
    pulizia: valore("pulizia"),
    assicurazione: valore("assicurazione"),
    amm: valore("amm"),
    illuminazione: valore("illuminazione"),
    manutenzione: valore("manutenzione"),
    acqua: valore("acqua"),
    giardinaggio: valore("giardinaggio"),
    varie: valore("varie"),
  };
}

function mapImpianti(
  presente: (tipo: (typeof TIPI_IMPIANTO)[number]) => boolean
): ExtractedImpianti {
  return {
    riscaldamento: presente("riscaldamento"),
    ascensore: presente("ascensore"),
    areeVerdi: presente("areeVerdi"),
    raffrescamento: presente("raffrescamento"),
    citofono: presente("citofono"),
    parcheggio: presente("parcheggio"),
  };
}

export function leggiImporto(bilancio: ExtractedBilancio, campo: CampoImporto): number {
  if (campo.startsWith("spesa.")) {
    return bilancio.spese[campo.slice(6) as keyof ExtractedSpese] ?? 0;
  }
  return (bilancio[campo as "prev" | "cons" | "fondo" | "totale"] as number) ?? 0;
}

export function scriviImporto(
  bilancio: ExtractedBilancio,
  campo: CampoImporto,
  valore: number
): void {
  if (campo.startsWith("spesa.")) {
    bilancio.spese[campo.slice(6) as keyof ExtractedSpese] = valore;
    return;
  }
  bilancio[campo as "prev" | "cons" | "fondo" | "totale"] = valore;
}

export function etichettaCampo(campo: CampoImporto): string {
  if (campo.startsWith("spesa.")) return CAMPI_IMPORTO_LABEL[campo.slice(6)] ?? campo.slice(6);
  return CAMPI_IMPORTO_LABEL[campo] ?? campo;
}

// Un importo dello schema: {"v": …, "pag": …, "txt": …}. Se il modello scrive
// il numero nudo la fonte manca, e l'importo resta segnalabile come tale.
function importoConFonte(
  raw: unknown,
  ctx: ContestoEstrazione
): { valore: number; fonte: Fonte | null } {
  if (typeof raw === "number" || typeof raw === "string") {
    return { valore: num(raw), fonte: null };
  }

  const r = record(raw);
  const valore = num(r.v);
  if (!valore) return { valore: 0, fonte: null };

  const paginaBlocco = Math.max(0, Math.round(num(r.pag)));
  const pagina = paginaBlocco ? paginaBlocco + ctx.offsetPagina : 0;
  const esito = verificaImporto(valore, pagina, ctx.testoPagine);

  const fonte: Fonte = {
    documento: ctx.documento,
    pagina,
    testo: str(r.txt),
    verificata: esito === "verificata",
    verificabile: esito !== "non_verificabile",
  };

  return { valore, fonte };
}

export function bilancioVuoto(anno = 0): ExtractedBilancio {
  return {
    anno,
    prev: 0,
    cons: 0,
    fondo: 0,
    spese: mapSpese(() => 0),
    movimenti: [],
    totale: 0,
    fonti: {},
    conflitti: {},
  };
}

const CATEGORIE_VALIDE = new Set<string>(CATEGORIE_SPESA);

function categoriaValida(valore: unknown): CategoriaSpesa {
  const categoria = str(valore).toLowerCase();
  // Una categoria fuori elenco finisce in "varie" invece di far sparire la
  // riga: l'importo resta nei conti, solo meno qualificato.
  return (CATEGORIE_VALIDE.has(categoria) ? categoria : "varie") as CategoriaSpesa;
}

function dataValida(valore: unknown): string {
  const data = str(valore);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : "";
}

function normalizzaMovimenti(raw: unknown, ctx: ContestoEstrazione): ExtractedMovimento[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((riga) => {
      const item = record(riga);
      const { valore, fonte } = importoConFonte(item, ctx);
      return {
        data: dataValida(item.data),
        descrizione: str(item.desc),
        fornitore: str(item.forn),
        categoria: categoriaValida(item.cat),
        importo: valore,
        fonte,
      };
    })
    .filter((movimento) => movimento.importo !== 0);
}

// Con il dettaglio disponibile, i totali di categoria smettono di essere una
// lettura a sé e diventano la somma delle righe: quadrano per costruzione
// invece che per fortuna.
function applicaTotaliDaiMovimenti(bilancio: ExtractedBilancio): void {
  const perCategoria = new Map<string, ExtractedMovimento[]>();
  for (const movimento of bilancio.movimenti) {
    const righe = perCategoria.get(movimento.categoria) ?? [];
    righe.push(movimento);
    perCategoria.set(movimento.categoria, righe);
  }

  for (const categoria of CATEGORIE_SPESA) {
    const righe = perCategoria.get(categoria);
    if (!righe?.length) continue;

    const campo = `spesa.${categoria}` as CampoImporto;
    scriviImporto(bilancio, campo, arrotonda(righe.reduce((t, m) => t + m.importo, 0)));

    // Questa somma non compare stampata da nessuna parte: la sua origine è il
    // calcolo, e va detto invece di spacciarla per una riga letta nel documento.
    const prima = righe[0];
    bilancio.fonti[campo] = {
      documento: prima.fonte?.documento ?? "",
      pagina: prima.fonte?.pagina ?? 0,
      testo: `somma di ${righe.length} ${righe.length === 1 ? "movimento" : "movimenti"}`,
      verificata: false,
      verificabile: false,
    };
  }
}

function normalizzaBilancio(raw: unknown, ctx: ContestoEstrazione): ExtractedBilancio {
  const r = record(raw);
  const bilancio = bilancioVuoto(Math.round(num(r.anno)));
  const spese = record(r.spese);

  for (const campo of CAMPI_IMPORTO) {
    const grezzo = campo.startsWith("spesa.") ? spese[campo.slice(6)] : r[campo];
    const { valore, fonte } = importoConFonte(grezzo, ctx);
    if (!valore) continue;
    scriviImporto(bilancio, campo, valore);
    if (fonte) bilancio.fonti[campo] = fonte;
  }

  bilancio.movimenti = normalizzaMovimenti(r.movimenti, ctx);
  if (bilancio.movimenti.length) applicaTotaliDaiMovimenti(bilancio);

  return bilancio;
}

export function emptyExtraction(): ExtractionResult {
  return {
    info: {
      via: "",
      citta: "",
      cap: "",
      annoCostr: "",
      piani: 0,
      nApt: 0,
      pianoTerra: false,
      amm: "",
      emailAmm: "",
      telAmm: "",
    },
    unita: [],
    bilanci: [],
    imp: mapImpianti(() => false),
    impDet: {},
    documenti: [],
    uso: { chiamate: 0, tokenIngresso: 0, tokenUscita: 0 },
    trovati: 0,
    totale: TOTALE_CAMPI,
    confidence: { info: 0, unita: 0, bilanci: 0, spese: 0, imp: 0 },
    note: "",
  };
}

// Ripulisce l'output testuale del modello (fence markdown, prosa residua) e
// lo fa combaciare con il JSON dello schema di estrazione.
export function parseExtractionOutput(text: string): unknown {
  let clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(clean);
}

// L'output del modello è JSON libero: qualsiasi campo può mancare o avere il
// tipo sbagliato. Normalizzare qui evita che un singolo campo malformato faccia
// esplodere la fusione o il wizard.
export function normalizeExtraction(raw: unknown, ctx: ContestoEstrazione): ExtractionResult {
  const r = record(raw);
  const info = record(r.info);
  const imp = record(r.imp);
  const conf = record(r.confidence);

  const result: ExtractionResult = {
    info: {
      via: str(info.via),
      citta: str(info.citta),
      cap: str(info.cap),
      annoCostr: str(info.annoCostr),
      piani: num(info.piani),
      nApt: num(info.nApt),
      pianoTerra: info.pianoTerra === true,
      amm: str(info.amm),
      emailAmm: str(info.emailAmm),
      telAmm: str(info.telAmm),
    },
    unita: (Array.isArray(r.unita) ? r.unita : [])
      .map((u) => {
        const item = record(u);
        return {
          int: num(item.int),
          piano: str(item.piano),
          mq: num(item.mq),
          ml: num(item.ml),
          nome: str(item.nome),
          email: str(item.email),
          tel: str(item.tel),
        };
      })
      .filter((u) => u.int > 0),
    bilanci: (Array.isArray(r.bilanci) ? r.bilanci : [])
      .map((b) => normalizzaBilancio(b, ctx))
      // Una voce senza anno e senza un solo importo è lo schema restituito
      // vuoto: tenerla produrrebbe una riga fantasma nello storico.
      .filter(
        (b) => b.anno > 0 || b.movimenti.length || CAMPI_IMPORTO.some((c) => leggiImporto(b, c))
      ),
    imp: mapImpianti((t) => imp[t] === true),
    impDet: normalizeImpDet(r.impDet),
    documenti: [],
    // Lo riempie chi ha fatto la chiamata: qui si conosce la risposta, non il
    // suo costo.
    uso: { chiamate: 0, tokenIngresso: 0, tokenUscita: 0 },
    trovati: 0,
    totale: TOTALE_CAMPI,
    confidence: {
      info: confidence(conf.info),
      unita: confidence(conf.unita),
      bilanci: confidence(conf.bilanci),
      spese: confidence(conf.spese),
      imp: confidence(conf.imp),
    },
    note: str(r.note),
  };

  result.trovati = contaCampiTrovati(result);
  return result;
}

function normalizeImpDet(raw: unknown): ExtractedImpiantiDettagli {
  const source = record(raw);
  const out: ExtractedImpiantiDettagli = {};

  for (const tipo of IMPIANTI_CON_DETTAGLI) {
    const dettaglio = record(source[tipo]);
    const normalized: ExtractedImpiantoDettaglio = {};
    for (const campo of CAMPI_DETTAGLIO) {
      const value = str(dettaglio[campo]);
      if (value) normalized[campo] = value;
    }
    if (Object.keys(normalized).length) out[tipo] = normalized;
  }

  return out;
}

// -----------------------------------------------------------------------
// Fusione
// -----------------------------------------------------------------------

function pickStr(a: string, b: string, preferB: boolean): string {
  if (!a) return b;
  if (!b) return a;
  return preferB ? b : a;
}

function pickNum(a: number, b: number, preferB: boolean): number {
  if (!a) return b;
  if (!b) return a;
  return preferB ? b : a;
}

// Ogni documento produce un'estrazione parziale: la fusione tiene il valore
// valorizzato e, quando entrambi lo sono, quello del documento che dichiara
// più confidenza sulla sezione. Vale per l'anagrafica; sugli importi la
// confidenza dichiarata dal modello non basta e si usa `fondiCampo`.
export function mergeExtractions(results: ExtractionResult[]): ExtractionResult {
  if (!results.length) return emptyExtraction();

  const merged = results.reduce(mergePair);
  merged.note = Array.from(new Set(results.map((r) => r.note).filter(Boolean))).join(" ");
  merged.trovati = contaCampiTrovati(merged);
  return merged;
}

function mergePair(a: ExtractionResult, b: ExtractionResult): ExtractionResult {
  return {
    info: mergeInfo(a.info, b.info, b.confidence.info > a.confidence.info),
    unita: mergeUnita(a.unita, b.unita, b.confidence.unita > a.confidence.unita),
    bilanci: mergeBilanci(a.bilanci, b.bilanci),
    imp: mapImpianti((t) => a.imp[t] || b.imp[t]),
    impDet: mergeImpDet(a.impDet, b.impDet),
    documenti: a.documenti.length ? a.documenti : b.documenti,
    uso: {
      chiamate: a.uso.chiamate + b.uso.chiamate,
      tokenIngresso: a.uso.tokenIngresso + b.uso.tokenIngresso,
      tokenUscita: a.uso.tokenUscita + b.uso.tokenUscita,
    },
    trovati: 0,
    totale: TOTALE_CAMPI,
    confidence: {
      info: Math.max(a.confidence.info, b.confidence.info),
      unita: Math.max(a.confidence.unita, b.confidence.unita),
      bilanci: Math.max(a.confidence.bilanci, b.confidence.bilanci),
      spese: Math.max(a.confidence.spese, b.confidence.spese),
      imp: Math.max(a.confidence.imp, b.confidence.imp),
    },
    note: "",
  };
}

function mergeInfo(a: ExtractedInfo, b: ExtractedInfo, preferB: boolean): ExtractedInfo {
  return {
    via: pickStr(a.via, b.via, preferB),
    citta: pickStr(a.citta, b.citta, preferB),
    cap: pickStr(a.cap, b.cap, preferB),
    annoCostr: pickStr(a.annoCostr, b.annoCostr, preferB),
    piani: pickNum(a.piani, b.piani, preferB),
    nApt: pickNum(a.nApt, b.nApt, preferB),
    pianoTerra: a.pianoTerra || b.pianoTerra,
    amm: pickStr(a.amm, b.amm, preferB),
    emailAmm: pickStr(a.emailAmm, b.emailAmm, preferB),
    telAmm: pickStr(a.telAmm, b.telAmm, preferB),
  };
}

function mergeUnita(
  a: ExtractedUnita[],
  b: ExtractedUnita[],
  preferB: boolean
): ExtractedUnita[] {
  const byInterno = new Map<number, ExtractedUnita>();

  for (const unita of a) byInterno.set(unita.int, unita);
  for (const unita of b) {
    const existing = byInterno.get(unita.int);
    if (!existing) {
      byInterno.set(unita.int, unita);
      continue;
    }
    byInterno.set(unita.int, {
      int: unita.int,
      piano: pickStr(existing.piano, unita.piano, preferB),
      mq: pickNum(existing.mq, unita.mq, preferB),
      ml: pickNum(existing.ml, unita.ml, preferB),
      nome: pickStr(existing.nome, unita.nome, preferB),
      email: pickStr(existing.email, unita.email, preferB),
      tel: pickStr(existing.tel, unita.tel, preferB),
    });
  }

  return Array.from(byInterno.values()).sort((x, y) => x.int - y.int);
}

function stessoImporto(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

// Quando due documenti (o due blocchi dello stesso documento) danno importi
// diversi per lo stesso campo, il valore scartato non sparisce: viene messo in
// `conflitti` e mostrato all'amministratore, perché è esattamente il caso in
// cui uno dei due numeri è sbagliato e nessuno se ne accorgerebbe.
function fondiCampo(
  dest: ExtractedBilancio,
  src: ExtractedBilancio,
  campo: CampoImporto
): void {
  const valoreSrc = leggiImporto(src, campo);
  if (!valoreSrc) return;

  const valoreDest = leggiImporto(dest, campo);
  const fonteDest = dest.fonti[campo];
  const fonteSrc = src.fonti[campo];

  if (!valoreDest) {
    scriviImporto(dest, campo, valoreSrc);
    if (fonteSrc) dest.fonti[campo] = fonteSrc;
    return;
  }

  if (stessoImporto(valoreDest, valoreSrc)) {
    // Stesso numero letto due volte: si tiene la fonte migliore delle due.
    if (fonteSrc?.verificata && !fonteDest?.verificata) dest.fonti[campo] = fonteSrc;
    else if (!fonteDest && fonteSrc) dest.fonti[campo] = fonteSrc;
    return;
  }

  // Valori diversi: vince quello verificato da una citazione, poi quello che
  // almeno indica la pagina. A parità si tiene il primo, in modo che il
  // risultato non dipenda dall'ordine in cui arrivano i blocchi.
  const punteggio = (f?: Fonte) => (f?.verificata ? 2 : f?.pagina ? 1 : 0);
  const vinceSrc = punteggio(fonteSrc) > punteggio(fonteDest);

  const scartato: ValoreScartato = vinceSrc
    ? { valore: valoreDest, fonte: fonteDest ?? null }
    : { valore: valoreSrc, fonte: fonteSrc ?? null };

  if (vinceSrc) {
    scriviImporto(dest, campo, valoreSrc);
    if (fonteSrc) dest.fonti[campo] = fonteSrc;
  }

  const conflitti = dest.conflitti[campo] ?? [];
  if (!conflitti.some((c) => stessoImporto(c.valore, scartato.valore))) {
    conflitti.push(scartato);
  }
  dest.conflitti[campo] = conflitti;
}

// I blocchi di pagine si sovrappongono di proposito, quindi la stessa riga può
// arrivare due volte: va tenuta una volta sola. La chiave non usa il testo
// intero perché due letture della stessa riga possono troncarlo diversamente.
function chiaveMovimento(movimento: ExtractedMovimento): string {
  return [
    movimento.categoria,
    movimento.importo.toFixed(2),
    movimento.fonte?.pagina ?? 0,
    movimento.descrizione.slice(0, 40).toLowerCase().replace(/\s+/g, " ").trim(),
  ].join("|");
}

function fondiMovimenti(
  a: ExtractedMovimento[],
  b: ExtractedMovimento[]
): ExtractedMovimento[] {
  const perChiave = new Map<string, ExtractedMovimento>();

  for (const movimento of [...a, ...b]) {
    const chiave = chiaveMovimento(movimento);
    const esistente = perChiave.get(chiave);
    // A parità di riga si tiene quella verificata sul documento, e fra due non
    // verificate quella che almeno nomina un fornitore.
    const migliore =
      !esistente ||
      (movimento.fonte?.verificata && !esistente.fonte?.verificata) ||
      (Boolean(movimento.fornitore) && !esistente.fornitore);
    if (migliore) perChiave.set(chiave, movimento);
  }

  return Array.from(perChiave.values()).sort((x, y) => {
    if (x.data && y.data && x.data !== y.data) return x.data.localeCompare(y.data);
    return y.importo - x.importo;
  });
}

function mergeBilanci(a: ExtractedBilancio[], b: ExtractedBilancio[]): ExtractedBilancio[] {
  const byAnno = new Map<number, ExtractedBilancio>();

  for (const bilancio of a) byAnno.set(bilancio.anno, bilancio);

  for (const bilancio of b) {
    const existing = byAnno.get(bilancio.anno);
    if (!existing) {
      byAnno.set(bilancio.anno, bilancio);
      continue;
    }

    for (const campo of CAMPI_IMPORTO) fondiCampo(existing, bilancio, campo);

    existing.movimenti = fondiMovimenti(existing.movimenti, bilancio.movimenti);
    // I totali di categoria seguono il dettaglio fuso, altrimenti resterebbero
    // quelli del primo blocco e le righe aggiunte dagli altri non conterebbero.
    if (existing.movimenti.length) applicaTotaliDaiMovimenti(existing);

    for (const campo of CAMPI_IMPORTO) {
      const altri = bilancio.conflitti[campo];
      if (!altri?.length) continue;
      const conflitti = existing.conflitti[campo] ?? [];
      for (const c of altri) {
        if (!conflitti.some((x) => stessoImporto(x.valore, c.valore))) conflitti.push(c);
      }
      existing.conflitti[campo] = conflitti;
    }
  }

  return Array.from(byAnno.values()).sort((x, y) => y.anno - x.anno);
}

function mergeImpDet(
  a: ExtractedImpiantiDettagli,
  b: ExtractedImpiantiDettagli
): ExtractedImpiantiDettagli {
  const out: ExtractedImpiantiDettagli = {};

  for (const tipo of IMPIANTI_CON_DETTAGLI) {
    const dettaglio: ExtractedImpiantoDettaglio = {};
    for (const campo of CAMPI_DETTAGLIO) {
      const value = a[tipo]?.[campo] || b[tipo]?.[campo];
      if (value) dettaglio[campo] = value;
    }
    if (Object.keys(dettaglio).length) out[tipo] = dettaglio;
  }

  return out;
}

// -----------------------------------------------------------------------
// Controlli
// -----------------------------------------------------------------------

export function sommaSpese(spese: ExtractedSpese): number {
  return CATEGORIE_SPESA.reduce((somma, c) => somma + (spese[c] || 0), 0);
}

// I controlli che il modello non può fare su se stesso: sono aritmetica e
// confronti fra documenti, e girano sul risultato finale invece che dentro la
// richiesta. Sono la rete che prende gli errori di lettura rimasti.
export function controlliBilancio(bilancio: ExtractedBilancio): Controllo[] {
  const controlli: Controllo[] = [];
  const annoMax = new Date().getFullYear() + 1;

  if (!bilancio.anno) {
    controlli.push({
      campo: "",
      livello: "errore",
      messaggio: "L'anno dell'esercizio non è stato riconosciuto: indicalo prima di salvare.",
    });
  } else if (bilancio.anno < 1900 || bilancio.anno > annoMax) {
    controlli.push({
      campo: "",
      livello: "errore",
      messaggio: `L'anno ${bilancio.anno} non è plausibile per un esercizio condominiale.`,
    });
  }

  const somma = sommaSpese(bilancio.spese);

  // Da un bilancio vuoto i controlli aritmetici non hanno niente da dire, e il
  // silenzio veniva mostrato come un via libera verde. Peggio: salvarlo
  // cancellava i dati buoni già in archivio per quell'anno. Zero importi non è
  // un bilancio che quadra, è una lettura fallita.
  const vuoto =
    !somma && !bilancio.movimenti.length && !CAMPI_IMPORTO.some((c) => leggiImporto(bilancio, c));
  if (vuoto) {
    controlli.push({
      campo: "",
      livello: "errore",
      messaggio:
        "Da questo documento non è stato estratto nessun importo: la lettura è fallita. " +
        "Riprova, oppure inserisci i valori a mano — non salvare così, cancelleresti i dati già in archivio.",
    });
    return controlli;
  }

  if (somma && bilancio.totale && Math.abs(somma - bilancio.totale) > TOLLERANZA_QUADRATURA) {
    controlli.push({
      campo: "totale",
      livello: "errore",
      messaggio:
        `Le voci di spesa sommano ${eur(somma)}, ma il totale stampato nel documento è ` +
        `${eur(bilancio.totale)}: mancano ${eur(Math.abs(somma - bilancio.totale))}.`,
    });
  } else if (
    somma &&
    !bilancio.totale &&
    bilancio.cons &&
    Math.abs(somma - bilancio.cons) > TOLLERANZA_QUADRATURA
  ) {
    controlli.push({
      campo: "cons",
      livello: "avviso",
      messaggio:
        `Le voci di spesa sommano ${eur(somma)}, il consuntivo è ${eur(bilancio.cons)}: ` +
        `differenza di ${eur(Math.abs(somma - bilancio.cons))}.`,
    });
  }

  for (const campo of CAMPI_IMPORTO) {
    const scartati = bilancio.conflitti[campo];
    if (!scartati?.length) continue;
    const valori = [leggiImporto(bilancio, campo), ...scartati.map((s) => s.valore)]
      .map(eur)
      .join(" / ");
    controlli.push({
      campo,
      livello: "avviso",
      messaggio: `Letture discordanti per «${etichettaCampo(campo)}»: ${valori}. Scegli tu quella giusta.`,
    });
  }

  const senzaPagina = CAMPI_IMPORTO.filter(
    (campo) => leggiImporto(bilancio, campo) && !bilancio.fonti[campo]?.pagina
  );
  if (senzaPagina.length) {
    controlli.push({
      campo: "",
      livello: "avviso",
      messaggio:
        `Per ${senzaPagina.length} importi non è indicata la pagina di origine ` +
        `(${senzaPagina.map(etichettaCampo).join(", ")}): verificali sul documento.`,
    });
  }

  return controlli;
}

export function haErrori(controlli: Controllo[]): boolean {
  return controlli.some((c) => c.livello === "errore");
}

// -----------------------------------------------------------------------
// Conteggio campi
// -----------------------------------------------------------------------

// I 60 campi dello schema: 9 di anagrafica, 10 unità, 15 valori di bilancio,
// 10 voci di spesa, 6 impianti, 10 dettagli impianto.
function contaCampiTrovati(r: ExtractionResult): number {
  let trovati = [r.info.via, r.info.citta, r.info.cap, r.info.annoCostr, r.info.amm, r.info.emailAmm, r.info.telAmm].filter(Boolean).length;
  if (r.info.piani) trovati++;
  if (r.info.nApt) trovati++;

  trovati += Math.min(r.unita.length, 10);
  trovati += Math.min(
    r.bilanci.reduce((acc, b) => acc + (b.prev ? 1 : 0) + (b.cons ? 1 : 0) + (b.fondo ? 1 : 0), 0),
    15
  );
  trovati += Math.min(
    r.bilanci.reduce((acc, b) => acc + CATEGORIE_SPESA.filter((c) => b.spese[c]).length, 0),
    10
  );
  trovati += TIPI_IMPIANTO.filter((t) => r.imp[t]).length;
  trovati += Math.min(
    IMPIANTI_CON_DETTAGLI.reduce((acc, tipo) => acc + Object.keys(r.impDet[tipo] ?? {}).length, 0),
    10
  );

  return Math.min(trovati, TOTALE_CAMPI);
}
