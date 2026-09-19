// Import relativo: questo modulo viene impacchettato anche dentro la Netlify
// Function, che non passa dagli alias di percorso di Next.
import type { CategoriaSpesa, ExtractedBilancio, ExtractedMovimento } from "./types";

// La riconciliazione è la parte che il modello non deve toccare. Il modello
// trascrive le righe — e lo fa bene: sul rendiconto 2024, 95 movimenti su 99
// sono stati ritrovati alla lettera nel testo del PDF. Quello che sbaglia è
// sommarle: le stesse cifre compaiono una seconda volta nelle tabelle di
// riparto, e il totale usciva a 49.177,77 € contro i 27.748,85 € stampati.
//
// Qui non si chiede niente a nessuno: si prende il totale scritto sul
// documento e lo si usa come arbitro. Si provano poche letture possibili
// dell'insieme di righe e si tiene quella che ci arriva. Se nessuna ci
// arriva, non si butta via niente e lo si dichiara.

// Sotto un euro è arrotondamento, non un errore di lettura. Stesso valore di
// TOLLERANZA_QUADRATURA in bilancio.ts e anthropic.ts.
export const TOLLERANZA_QUADRATURA = 1;

// Oltre l'euro di arrotondamento, uno scarto entro l'1% del totale vale la
// pena di essere mostrato — le voci sono quasi tutte giuste — ma va segnalato,
// non spacciato per quadratura.
const SOGLIA_AVVICINATA = 0.01;

const CATEGORIE: CategoriaSpesa[] = [
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
];

export type EsitoRiconciliazione = "quadra" | "avvicinata" | "non_riconciliata";

// Come si è arrivati al risultato, in chiaro: serve a poterlo spiegare
// all'amministratore invece di presentargli un numero calato dall'alto.
export type Strategia =
  | "nessuna"
  | "tutte le righe"
  | "senza le righe ripetute"
  | "senza le pagine di riparto"
  | "senza le pagine di riparto e senza le righe ripetute"
  | "solo le pagine del registro"
  | "solo le pagine del registro, senza le righe ripetute";

export interface Riconciliazione {
  movimenti: ExtractedMovimento[];
  scartati: ExtractedMovimento[];
  pagineTenute: number[];
  pagineScartate: number[];
  // Ricalcolate sommando i movimenti tenuti, non lette dal modello.
  spese: Record<CategoriaSpesa, number>;
  somma: number;
  totaleStampato: number;
  scarto: number;
  esito: EsitoRiconciliazione;
  strategia: Strategia;
}

// Il denaro si somma in centesimi interi: sommare 99 float dà una coda di
// decimali che poi va a sbattere contro una tolleranza di un euro.
function cent(importo: number): number {
  return Math.round((Number.isFinite(importo) ? importo : 0) * 100);
}

function euro(centesimi: number): number {
  return Math.round(centesimi) / 100;
}

function paginaDi(m: ExtractedMovimento): number {
  return m.fonte?.pagina && m.fonte.pagina > 0 ? m.fonte.pagina : 0;
}

// Due righe sono la stessa riga se dicono la stessa cosa: la punteggiatura e
// le maiuscole cambiano fra il registro e il riparto, il contenuto no.
function impronta(m: ExtractedMovimento): string {
  const descrizione = m.descrizione
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return `${m.data || ""}|${descrizione}|${cent(m.importo)}`;
}

// Una riga che ricompare identica su un'altra pagina è quasi sempre l'eco di
// quella del registro dentro una tabella di riparto. Su una stessa pagina due
// righe identiche sono due pagamenti veri, e restano.
function senzaDuplicati(movimenti: ExtractedMovimento[]): ExtractedMovimento[] {
  const vistePerImpronta = new Map<string, Set<number>>();
  return movimenti.filter((m) => {
    const chiave = impronta(m);
    const pagina = paginaDi(m);
    const pagine = vistePerImpronta.get(chiave);
    if (!pagine) {
      vistePerImpronta.set(chiave, new Set([pagina]));
      return true;
    }
    if (pagine.has(pagina)) return true;
    pagine.add(pagina);
    return false;
  });
}

interface Candidato {
  movimenti: ExtractedMovimento[];
  strategia: Strategia;
}

function pagineOrdinate(movimenti: ExtractedMovimento[]): number[] {
  return Array.from(new Set(movimenti.map(paginaDi))).sort((a, b) => a - b);
}

// Il registro analitico occupa quasi sempre un blocco di pagine consecutive,
// seguito dai prospetti di riparto. Provare ogni intervallo contiguo costa
// niente — poche decine di pagine — e non dipende dal riconoscere una parola
// italiana in un'intestazione: è il totale stampato a dire quale intervallo è
// quello giusto.
function intervalliContigui(
  movimenti: ExtractedMovimento[],
  obiettivo: number
): ExtractedMovimento[] | null {
  const pagine = pagineOrdinate(movimenti).filter((p) => p > 0);
  if (pagine.length < 2) return null;

  const sommaPagina = new Map<number, number>();
  for (const m of movimenti) {
    const p = paginaDi(m);
    sommaPagina.set(p, (sommaPagina.get(p) ?? 0) + cent(m.importo));
  }

  let miglioreScarto = Infinity;
  let migliore: { da: number; a: number } | null = null;

  for (let i = 0; i < pagine.length; i++) {
    let somma = 0;
    for (let j = i; j < pagine.length; j++) {
      somma += sommaPagina.get(pagine[j]) ?? 0;
      const scarto = Math.abs(somma - obiettivo);
      // A parità di scarto vince l'intervallo più lungo: tenere più righe
      // significa buttare via meno informazione vera.
      const piuLungo = migliore && j - i > pagine.indexOf(migliore.a) - pagine.indexOf(migliore.da);
      if (scarto < miglioreScarto || (scarto === miglioreScarto && piuLungo)) {
        miglioreScarto = scarto;
        migliore = { da: pagine[i], a: pagine[j] };
      }
    }
  }

  if (!migliore) return null;
  const { da, a } = migliore;
  // Le righe senza pagina (pagina 0) non si possono collocare: restano dentro,
  // perché escluderle sarebbe una scelta arbitraria e non misurabile.
  return movimenti.filter((m) => {
    const p = paginaDi(m);
    return p === 0 || (p >= da && p <= a);
  });
}

function somma(movimenti: ExtractedMovimento[]): number {
  return movimenti.reduce((acc, m) => acc + cent(m.importo), 0);
}

function speseDa(movimenti: ExtractedMovimento[]): Record<CategoriaSpesa, number> {
  const spese = Object.fromEntries(CATEGORIE.map((c) => [c, 0])) as Record<CategoriaSpesa, number>;
  for (const m of movimenti) {
    const categoria = CATEGORIE.includes(m.categoria) ? m.categoria : "varie";
    spese[categoria] += cent(m.importo);
  }
  for (const c of CATEGORIE) spese[c] = euro(spese[c]);
  return spese;
}

function esitoDi(scartoCent: number, totaleCent: number): EsitoRiconciliazione {
  if (Math.abs(scartoCent) <= TOLLERANZA_QUADRATURA * 100) return "quadra";
  if (totaleCent > 0 && Math.abs(scartoCent) <= totaleCent * SOGLIA_AVVICINATA) return "avvicinata";
  return "non_riconciliata";
}

function esito(
  movimenti: ExtractedMovimento[],
  scartati: ExtractedMovimento[],
  totaleStampato: number,
  strategia: Strategia
): Riconciliazione {
  const sommaCent = somma(movimenti);
  const totaleCent = cent(totaleStampato);
  const tenute = pagineOrdinate(movimenti).filter((p) => p > 0);
  const scartate = pagineOrdinate(scartati).filter((p) => p > 0 && !tenute.includes(p));

  return {
    movimenti,
    scartati,
    pagineTenute: tenute,
    pagineScartate: scartate,
    spese: speseDa(movimenti),
    somma: euro(sommaCent),
    totaleStampato,
    scarto: euro(sommaCent - totaleCent),
    esito: totaleCent > 0 ? esitoDi(sommaCent - totaleCent, totaleCent) : "non_riconciliata",
    strategia,
  };
}

/**
 * Sceglie, fra poche letture possibili dell'elenco di movimenti, quella che
 * somma al totale stampato sul documento.
 *
 * Nessuna riga viene scartata per un sospetto: si scartano solo se quello che
 * resta quadra col totale che l'amministratore ha stampato. Se nessuna lettura
 * ci arriva, si tiene tutto e lo si dichiara `non_riconciliata` — meglio un
 * numero visibilmente sbagliato che un numero sbagliato di nascosto.
 *
 * @param pagineRiparto pagine riconosciute come prospetti di riparto, se
 *   disponibili: entrano come un candidato in più, non come una certezza.
 */
export function riconcilia(
  movimenti: ExtractedMovimento[],
  totaleStampato: number,
  pagineRiparto: number[] = []
): Riconciliazione {
  if (!movimenti.length || !totaleStampato || totaleStampato <= 0) {
    return esito(movimenti, [], totaleStampato, "nessuna");
  }

  const obiettivo = cent(totaleStampato);
  const candidati: Candidato[] = [{ movimenti, strategia: "tutte le righe" }];

  const deduplicati = senzaDuplicati(movimenti);
  if (deduplicati.length < movimenti.length) {
    candidati.push({ movimenti: deduplicati, strategia: "senza le righe ripetute" });
  }

  if (pagineRiparto.length) {
    const riparto = new Set(pagineRiparto);
    const senzaRiparto = movimenti.filter((m) => !riparto.has(paginaDi(m)));
    if (senzaRiparto.length && senzaRiparto.length < movimenti.length) {
      candidati.push({ movimenti: senzaRiparto, strategia: "senza le pagine di riparto" });
      const pulito = senzaDuplicati(senzaRiparto);
      if (pulito.length < senzaRiparto.length) {
        candidati.push({
          movimenti: pulito,
          strategia: "senza le pagine di riparto e senza le righe ripetute",
        });
      }
    }
  }

  const intervallo = intervalliContigui(movimenti, obiettivo);
  if (intervallo?.length && intervallo.length < movimenti.length) {
    candidati.push({ movimenti: intervallo, strategia: "solo le pagine del registro" });
    const pulito = senzaDuplicati(intervallo);
    if (pulito.length < intervallo.length) {
      candidati.push({
        movimenti: pulito,
        strategia: "solo le pagine del registro, senza le righe ripetute",
      });
    }
  }

  const intero = candidati[0];
  let migliore = intero;
  let miglioreScarto = Math.abs(somma(intero.movimenti) - obiettivo);

  for (const candidato of candidati.slice(1)) {
    const scarto = Math.abs(somma(candidato.movimenti) - obiettivo);
    // Stretto: a parità di scarto vince il candidato che tiene più righe, cioè
    // quello arrivato prima, perché i candidati sono ordinati dal meno al più
    // aggressivo.
    if (scarto < miglioreScarto) {
      miglioreScarto = scarto;
      migliore = candidato;
    }
  }

  // La regola che tiene tutto insieme: si scartano righe solo se il totale
  // stampato conferma quello che resta. Un candidato che riduce l'elenco senza
  // arrivare al totale è un'ipotesi non verificata, e non merita di cancellare
  // righe che il modello ha ritrovato alla lettera sul documento.
  const ammesso = esitoDi(miglioreScarto, obiettivo) !== "non_riconciliata";
  if (!ammesso || migliore === intero) {
    return esito(movimenti, [], totaleStampato, "tutte le righe");
  }

  const tenuti = new Set(migliore.movimenti);
  return esito(
    migliore.movimenti,
    movimenti.filter((m) => !tenuti.has(m)),
    totaleStampato,
    migliore.strategia
  );
}

/**
 * Applica la riconciliazione a un esercizio: i movimenti tenuti sostituiscono
 * quelli letti, e le voci di spesa vengono ricalcolate sommandoli.
 *
 * Le voci del modello vengono sostituite solo quando i conti arrivano al
 * totale stampato. Finché non ci arrivano, quello che ha letto il modello
 * resta dov'è: sbagliato ma suo, e visibile nei controlli.
 */
export function riconciliaBilancio(
  bilancio: ExtractedBilancio,
  pagineRiparto: number[] = []
): { bilancio: ExtractedBilancio; riconciliazione: Riconciliazione } {
  const riconciliazione = riconcilia(bilancio.movimenti, bilancio.totale, pagineRiparto);

  if (riconciliazione.esito === "non_riconciliata") {
    return { bilancio, riconciliazione };
  }

  return {
    bilancio: {
      ...bilancio,
      movimenti: riconciliazione.movimenti,
      spese: { ...bilancio.spese, ...riconciliazione.spese },
    },
    riconciliazione,
  };
}

// Una riga di spiegazione da mettere nelle note dell'estrazione: quello che il
// codice ha fatto ai numeri deve restare leggibile da chi guarda il risultato.
export function spiegaRiconciliazione(anno: number, r: Riconciliazione): string | null {
  if (r.strategia === "nessuna" || !r.scartati.length) return null;

  const pagine = r.pagineScartate.length ? ` (pagine ${r.pagineScartate.join(", ")})` : "";
  const esito =
    r.esito === "quadra"
      ? `i conti tornano al totale stampato di ${r.totaleStampato.toFixed(2)} €`
      : `restano ${Math.abs(r.scarto).toFixed(2)} € di scarto sul totale stampato`;

  return `Esercizio ${anno}: scartate ${r.scartati.length} righe già conteggiate altrove${pagine} — ${esito}.`;
}
