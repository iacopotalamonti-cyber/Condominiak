// Le colonne di un rendiconto, ricavate dalla sua intestazione.
//
// Un rendiconto stampa gli importi in più colonne affiancate — importo del
// movimento, parziale per voce, totale per tabella, e di nuovo le stesse per la
// quota a carico dell'inquilino. Nel testo appiattito quelle colonne
// scompaiono: restano numeri in fila, e prendere "l'ultimo" significa a volte
// prendere il totale di una tabella e spacciarlo per il totale di una voce.
//
// Le coordinate invece ci sono. E non serve indovinarle: l'intestazione è
// ristampata su ogni pagina, quindi la mappa delle colonne si legge dal
// documento stesso, pagina per pagina. Un rendiconto con colonne in posizioni
// diverse continua a funzionare senza toccare il codice.

export interface Frammento {
  /** Estremo sinistro del testo, in punti tipografici. */
  x: number;
  /** Estremo destro. Gli importi sono allineati a destra: è questo che conta. */
  xFine: number;
  testo: string;
}

export type Colonna =
  | "movimento"
  | "parziale_proprietario"
  | "totale_proprietario"
  | "parziale_inquilino"
  | "totale_inquilino";

export interface MappaColonne {
  /** Estremo destro dichiarato dall'intestazione, per ciascuna colonna. */
  ancore: { colonna: Colonna; xFine: number }[];
}

// Gli importi finiscono qualche punto più a destra della parola che li
// intesta: "Parziale" chiude a 385 e i suoi numeri a 399. Il margine copre lo
// scarto senza arrivare alla colonna successiva, che dista una cinquantina di
// punti.
const TOLLERANZA_COLONNA = 30;

/**
 * Ricava la mappa delle colonne dall'intestazione di una pagina.
 *
 * L'ordine di lettura è quello orizzontale: "Importo" è il movimento, poi si
 * alternano "Parziale" e "Totale" prima per il proprietario e poi per
 * l'inquilino. Una pagina che non ha questa intestazione non è una pagina di
 * elenco spese, e restituisce null invece di una mappa inventata.
 */
export function mappaColonne(frammenti: Frammento[]): MappaColonne | null {
  const intestazioni = frammenti
    .filter((f) => /^(Importo|Parziale|Totale)$/.test(f.testo.trim()))
    .sort((a, b) => a.xFine - b.xFine);

  const importo = intestazioni.find((f) => f.testo.trim() === "Importo");
  const coppie = intestazioni.filter((f) => f.testo.trim() !== "Importo");

  // Servono almeno "Importo" e la prima coppia parziale/totale: sotto questa
  // soglia non stiamo guardando la tabella delle spese.
  if (!importo || coppie.length < 2) return null;

  const ordine: Colonna[] = [
    "parziale_proprietario",
    "totale_proprietario",
    "parziale_inquilino",
    "totale_inquilino",
  ];

  const ancore: MappaColonne["ancore"] = [{ colonna: "movimento", xFine: importo.xFine }];
  coppie.slice(0, 4).forEach((f, i) => ancore.push({ colonna: ordine[i], xFine: f.xFine }));

  return { ancore };
}

/** A quale colonna appartiene un importo, in base a dove finisce. */
export function colonnaDi(xFine: number, mappa: MappaColonne): Colonna | null {
  let migliore: { colonna: Colonna; distanza: number } | null = null;

  for (const ancora of mappa.ancore) {
    // Solo verso destra: un numero non sconfina mai a sinistra della propria
    // intestazione, mentre a destra si allunga quanto è lungo.
    const distanza = xFine - ancora.xFine;
    if (distanza < -2 || distanza > TOLLERANZA_COLONNA) continue;
    if (!migliore || distanza < migliore.distanza) migliore = { colonna: ancora.colonna, distanza };
  }

  return migliore?.colonna ?? null;
}

const IMPORTO = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;

/** Il valore di un importo stampato all'italiana, o null se non lo è. */
export function importoDi(testo: string): number | null {
  const pulito = testo.trim();
  if (!IMPORTO.test(pulito)) return null;
  return Number(pulito.replace(/\./g, "").replace(",", "."));
}

// ---------------------------------------------------------------------------
// Le voci
// ---------------------------------------------------------------------------

export interface Riga {
  /** Coordinata verticale, per tenere insieme i frammenti della stessa riga. */
  y: number;
  frammenti: Frammento[];
}

export interface Pagina {
  numero: number;
  righe: Riga[];
}

export interface Voce {
  codice: string;
  descrizione: string;
  /** Quota a carico del proprietario, come stampata nella sua colonna. */
  totale: number | null;
  /** Quota a carico dell'inquilino, quando il rendiconto la distingue. */
  totaleInquilino: number | null;
  pagina: number;
  /** La riga da cui viene il totale, per poterlo ritrovare nel documento. */
  riga: string;
}

export interface Tabella {
  /** Totale stampato della tabella di ripartizione, per la quadratura. */
  totale: number;
  pagina: number;
}

export interface LetturaRendiconto {
  voci: Voce[];
  tabelle: Tabella[];
  /** Pagine in cui è stata riconosciuta la tabella delle spese. */
  pagineLette: number[];
}

const CODICE_VOCE = /^\d{3}\.\d{3}$/;

function testoRiga(riga: Riga): string {
  return riga.frammenti
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((f) => f.testo.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Legge le voci di spesa dalle pagine di un rendiconto.
 *
 * Le pagine senza l'intestazione della tabella delle spese vengono saltate:
 * sono relazioni, riparti, riepiloghi. Non c'è bisogno di riconoscerle una per
 * una — se non hanno le colonne, non sono l'elenco delle spese.
 */
export function leggiVoci(pagine: Pagina[]): LetturaRendiconto {
  const voci: Voce[] = [];
  const tabelle: Tabella[] = [];
  const pagineLette: number[] = [];

  for (const pagina of pagine) {
    const tutti = pagina.righe.flatMap((r) => r.frammenti);
    const mappa = mappaColonne(tutti);
    if (!mappa) continue;
    pagineLette.push(pagina.numero);

    // Dall'alto verso il basso: una voce raccoglie i totali che la seguono,
    // fino alla voce successiva.
    const righe = pagina.righe.slice().sort((a, b) => b.y - a.y);
    let corrente: Voce | null = null;

    for (const riga of righe) {
      const ordinati = riga.frammenti.slice().sort((a, b) => a.x - b.x);
      const codice = ordinati.find((f) => CODICE_VOCE.test(f.testo.trim()));

      if (codice) {
        const descrizione = ordinati
          .filter((f) => f.x > codice.x && importoDi(f.testo) === null)
          .map((f) => f.testo.trim())
          .join(" ")
          .trim();

        corrente = {
          codice: codice.testo.trim(),
          descrizione,
          totale: null,
          totaleInquilino: null,
          pagina: pagina.numero,
          riga: testoRiga(riga),
        };
        voci.push(corrente);
      }

      for (const frammento of ordinati) {
        const valore = importoDi(frammento.testo);
        if (valore === null) continue;

        const colonna = colonnaDi(frammento.xFine, mappa);
        if (!colonna) continue;

        if (colonna === "totale_proprietario" || colonna === "totale_inquilino") {
          // Totale di tabella: non è una spesa in più, serve a far quadrare.
          tabelle.push({ totale: valore, pagina: pagina.numero });
          continue;
        }

        if (!corrente) continue;

        // Il primo parziale incontrato è quello della voce: se il documento ne
        // stampa altri più sotto appartengono a una voce successiva.
        if (colonna === "parziale_proprietario" && corrente.totale === null) {
          corrente.totale = valore;
          corrente.riga = testoRiga(riga);
        }
        if (colonna === "parziale_inquilino" && corrente.totaleInquilino === null) {
          corrente.totaleInquilino = valore;
        }
      }
    }
  }

  return { voci, tabelle, pagineLette };
}

/** Somma delle voci lette, quota proprietario e quota inquilino insieme. */
export function totaleVoci(voci: Voce[]): number {
  const somma = voci.reduce((tot, v) => tot + (v.totale ?? 0) + (v.totaleInquilino ?? 0), 0);
  return Math.round(somma * 100) / 100;
}
