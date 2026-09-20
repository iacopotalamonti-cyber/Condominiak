// Leggere un rendiconto senza chiedere niente a nessuno.
//
// Questo modulo è il punto in cui il motore entra nell'applicazione. Prende un
// PDF, guarda se è di un formato che conosciamo, lo legge, e restituisce la
// stessa forma che l'estrazione AI produrrebbe — così chi salva non deve
// sapere da dove vengono i numeri.
//
// Il salto non è di precisione: è di natura. Un'estrazione AI costa, varia da
// una volta all'altra e va verificata; una lettura costa zero, dà sempre lo
// stesso risultato e si verifica da sola contro il totale che il documento
// stampa. Quando la lettura non quadra, o incontra un codice che il profilo
// non conosce, si dichiara inutilizzabile e lascia il lavoro al modello: un
// numero sbagliato gratis è più caro di uno giusto a pagamento.

import { getDocumentProxy } from "unpdf";

import { leggi, riconosci, testoRiga, type Lettura } from "./motore.ts";
import { PROFILI } from "./profili.ts";
import { classifica, mappaturaPer, type Classificazione } from "./profilo.ts";
import type { Frammento, Pagina, Riga } from "./rendiconto.ts";
import type { CategoriaSpesa, ExtractedBilancio, ExtractedMovimento, Fonte } from "./types.ts";

// Due frammenti entro due punti di altezza appartengono alla stessa riga: è lo
// scarto fra un carattere e il suo apice, non fra due righe di testo.
const TOLLERANZA_RIGA = 2;

// Oltre questo scarto fra le voci lette e il totale stampato la lettura non si
// considera riuscita. Un centesimo, non un euro: qui non stiamo interpretando
// niente, stiamo copiando, e copiare o torna o non torna.
const TOLLERANZA_QUADRATURA = 0.01;

/** Il testo di un PDF con le coordinate, che è ciò su cui il motore lavora. */
export async function pagineDi(dati: Uint8Array): Promise<Pagina[]> {
  const pdf = await getDocumentProxy(dati);
  const pagine: Pagina[] = [];

  for (let numero = 1; numero <= pdf.numPages; numero++) {
    const { items } = await (await pdf.getPage(numero)).getTextContent();
    const righe = new Map<number, Riga>();

    for (const item of items as { str?: string; transform: number[]; width?: number }[]) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const chiave = [...righe.keys()].find((k) => Math.abs(k - y) <= TOLLERANZA_RIGA) ?? y;
      if (!righe.has(chiave)) righe.set(chiave, { y: chiave, frammenti: [] });
      const x = Math.round(item.transform[4]);
      const frammento: Frammento = {
        x,
        xFine: Math.round(x + (item.width ?? 0)),
        testo: item.str,
      };
      righe.get(chiave)!.frammenti.push(frammento);
    }

    pagine.push({ numero, righe: [...righe.values()] });
  }

  return pagine;
}

// ---------------------------------------------------------------------------
// L'anno
// ---------------------------------------------------------------------------

// Un esercizio condominiale va da agosto a luglio, e il rendiconto lo dichiara
// sempre come un intervallo di date: "01-08-2024 - 31-07-2025", "DAL
// 01/08/2020 AL 31/07/2021", "(17/12/2019 - 31/07/2020)". L'anno
// dell'esercizio è quello in cui l'esercizio chiude — la seconda data.
const PERIODO =
  /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*(?:[-–—‐]|al)\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/i;

// Lo stesso documento riporta anche il periodo del preventivo, che è
// l'esercizio successivo: una riga che lo nomina non dice il nostro anno.
const CONSUNTIVO = /consuntiv|gestione|rendicont/i;
const PREVENTIVO = /preventiv/i;

/**
 * L'anno in cui l'esercizio si chiude, letto dall'intervallo di date.
 *
 * Si preferisce l'intervallo su una riga che parla di consuntivo o di
 * gestione; se nessuna lo fa, vale il primo intervallo del documento, che nei
 * rendiconti è sempre quello in copertina.
 */
export function annoEsercizio(pagine: Pagina[]): number | null {
  let primo: number | null = null;

  for (const pagina of pagine) {
    for (const riga of pagina.righe.slice().sort((a, b) => b.y - a.y)) {
      const linea = testoRiga(riga);
      const trovato = linea.match(PERIODO);
      if (!trovato) continue;

      const chiusura = Number(trovato[6]);
      if (PREVENTIVO.test(linea)) continue;
      if (CONSUNTIVO.test(linea)) return chiusura;
      primo ??= chiusura;
    }
  }

  return primo;
}

// ---------------------------------------------------------------------------
// La lettura
// ---------------------------------------------------------------------------

export interface RendicontoLetto {
  formato: string;
  anno: number | null;
  lettura: Lettura;
  classificazione: Classificazione;
  /**
   * Quanta parte delle spese è anche scomposta nei singoli movimenti, da 0 a 1.
   * Non arriva a 1 quando una fattura viene ripartita a percentuale fra più
   * voci — la luce di un contatore diviso fra scale, ascensore e autorimesse —
   * perché lì la riga della fattura non appartiene a una voce sola.
   */
  coperturaMovimenti: number;
  /** Perché questa lettura non è utilizzabile, o null se lo è. */
  motivo: string | null;
}

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100;
}

/**
 * Legge un rendiconto, se ne riconosce il formato.
 *
 * Restituisce null quando il formato è sconosciuto — non è un errore, è il
 * caso normale per un amministratore nuovo, e chi chiama passa al modello.
 */
export function leggiRendiconto(pagine: Pagina[]): RendicontoLetto | null {
  const profilo = riconosci(pagine, PROFILI);
  if (!profilo) return null;

  const lettura = leggi(pagine, profilo);
  const mappatura = mappaturaPer(profilo.nome);
  const classificazione = mappatura
    ? classifica(lettura, mappatura)
    : { spese: {}, rimborsi: [], nonMappate: [], totaleSpese: 0, totaleRimborsi: 0 };
  const anno = annoEsercizio(pagine);

  const spese = lettura.voci.reduce(
    (tot, v) => tot + Math.abs(v.importo) + Math.abs(v.importoSecondario ?? 0),
    0
  );
  const conMovimenti = lettura.voci
    .filter((v) => v.movimenti.length)
    .reduce((tot, v) => tot + Math.abs(v.importo) + Math.abs(v.importoSecondario ?? 0), 0);

  return {
    formato: profilo.nome,
    anno,
    lettura,
    classificazione,
    coperturaMovimenti: spese ? conMovimenti / spese : 0,
    motivo: motivoDiScarto(lettura, classificazione, anno, Boolean(mappatura)),
  };
}

function motivoDiScarto(
  lettura: Lettura,
  classificazione: Classificazione,
  anno: number | null,
  mappata: boolean
): string | null {
  if (!mappata) return "le voci di questo formato non sono ancora ricondotte alle categorie";
  if (anno === null) return "non si capisce a quale esercizio si riferisce";
  if (lettura.totaleGenerale === null) return "il documento non stampa un totale con cui verificare";
  if (lettura.scarto === null || Math.abs(lettura.scarto) > TOLLERANZA_QUADRATURA) {
    return `le voci lette non tornano con il totale stampato (${lettura.scarto} di scarto)`;
  }
  if (classificazione.nonMappate.length) {
    const codici = classificazione.nonMappate.map((r) => r.codice).join(", ");
    return `voci senza categoria: ${codici}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// La forma che l'applicazione salva
// ---------------------------------------------------------------------------

function euro(valore: number): string {
  return valore.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Una fonte che non viene da un modello: l'abbiamo letta noi, e la si può
// ricontrollare aprendo quella pagina del PDF.
function fonteDi(documento: string, pagina: number, testo: string): Fonte {
  return { documento, pagina, testo, verificata: true, verificabile: true };
}

/**
 * Traduce una lettura nella forma che l'applicazione già sa salvare.
 *
 * Il totale dell'esercizio è la somma delle spese, non il totale generale
 * stampato: quando il condominio incassa un rimborso, il documento lo sottrae
 * dalle spese e stampa un totale più basso di quanto è stato davvero speso.
 * Il totale stampato non si perde — finisce nella nota, con la differenza e la
 * sua ragione.
 */
export function estrazioneDa(letto: RendicontoLetto, documento: string): ExtractedBilancio {
  const { lettura, classificazione } = letto;

  const fonti: ExtractedBilancio["fonti"] = {};
  const spese = {} as ExtractedBilancio["spese"];

  // Le voci che compongono ciascuna categoria, per poter dire da dove viene un
  // numero invece di presentarlo e basta.
  const vociPerCategoria = new Map<string, { codice: string; importo: number; pagina: number }[]>();
  const mappatura = mappaturaPer(letto.formato);

  for (const voce of lettura.voci) {
    const destinazione = mappatura?.voci[voce.chiave];
    if (!destinazione || destinazione === "rimborso") continue;
    const righe = vociPerCategoria.get(destinazione) ?? [];
    righe.push({
      codice: voce.chiave,
      importo: arrotonda(voce.importo + (voce.importoSecondario ?? 0)),
      pagina: voce.pagina,
    });
    vociPerCategoria.set(destinazione, righe);
  }
  for (const personale of lettura.personali) {
    const destinazione = mappatura?.personali[personale.chiave];
    if (!destinazione || destinazione === "rimborso") continue;
    const righe = vociPerCategoria.get(destinazione) ?? [];
    righe.push({ codice: personale.chiave, importo: personale.importo, pagina: 0 });
    vociPerCategoria.set(destinazione, righe);
  }

  for (const [categoria, importo] of Object.entries(classificazione.spese)) {
    spese[categoria as CategoriaSpesa] = importo ?? 0;
    const righe = vociPerCategoria.get(categoria) ?? [];
    if (!righe.length) continue;
    fonti[`spesa.${categoria as CategoriaSpesa}`] = fonteDi(
      documento,
      righe[0].pagina,
      righe.map((r) => `${r.codice} ${euro(r.importo)}`).join(" + ")
    );
  }

  const totale = classificazione.totaleSpese;
  if (lettura.totaleGenerale !== null) {
    fonti.totale = fonteDi(
      documento,
      lettura.voci[lettura.voci.length - 1]?.pagina ?? 0,
      `Totale generale stampato ${euro(lettura.totaleGenerale)}`
    );
    fonti.cons = fonti.totale;
  }

  return {
    anno: letto.anno ?? 0,
    // Un rendiconto consuntivo non dichiara il preventivo dell'anno appena
    // chiuso né il fondo di riserva in una forma che si possa leggere qui:
    // restano vuoti invece di essere riempiti con un numero plausibile.
    prev: 0,
    cons: totale,
    fondo: 0,
    spese,
    movimenti: movimentiDa(letto, documento),
    totale,
    fonti,
    conflitti: {},
  };
}

function movimentiDa(letto: RendicontoLetto, documento: string): ExtractedMovimento[] {
  const mappatura = mappaturaPer(letto.formato);
  const movimenti: ExtractedMovimento[] = [];

  for (const voce of letto.lettura.voci) {
    const destinazione = mappatura?.voci[voce.chiave];
    if (!destinazione || destinazione === "rimborso") continue;

    for (const movimento of voce.movimenti) {
      movimenti.push({
        data: movimento.data,
        descrizione: movimento.descrizione,
        // Vuoto quando il formato non dà al fornitore una colonna sua: la riga
        // resta, con la sua descrizione, e finisce fra le non attribuite. È
        // meglio di un nome ritagliato a occhio dalla descrizione.
        fornitore: movimento.fornitore,
        categoria: destinazione,
        importo: movimento.importo,
        fonte: fonteDi(documento, movimento.pagina, movimento.descrizione),
      });
    }
  }

  return movimenti;
}

/** La riga da mettere in nota: cosa è stato letto, e cosa è rimasto fuori. */
export function notaDiLettura(letto: RendicontoLetto): string {
  const { lettura, classificazione } = letto;
  const parti = [
    `Letto da ${letto.formato} senza usare il modello: ` +
      `${lettura.voci.length} voci in quadratura al centesimo con il totale stampato.`,
  ];

  // Il totale stampato comprende anche le partite che riguardano un singolo
  // condomino — un rimborso assicurativo incassato, una spesa riaddebitata a
  // chi l'ha causata — e quelle non sono spesa comune. La differenza va detta,
  // altrimenti chi confronta il nostro numero con la carta pensa a un errore.
  if (classificazione.rimborsi.length) {
    const descrizioni = classificazione.rimborsi
      .map((r) => `${r.descrizione.slice(0, 60)} ${euro(r.importo)}`)
      .join("; ");
    parti.push(
      `Il totale stampato è ${euro(lettura.totaleGenerale ?? 0)} perché comprende anche ` +
        `partite di singoli condomini (${descrizioni}), che restano fuori dalle spese comuni: ` +
        `spese comuni ${euro(classificazione.totaleSpese)}.`
    );
  }

  const copertura = Math.round(letto.coperturaMovimenti * 100);
  if (copertura === 0) {
    parti.push(
      "Questo formato dichiara solo il totale di ogni conto, non le fatture che lo compongono: " +
        "il dettaglio per fornitore non c'è nel documento."
    );
  } else if (copertura < 100) {
    parti.push(
      `Il dettaglio per fornitore copre il ${copertura}% delle spese: il resto sono fatture ` +
        "ripartite a percentuale fra più voci, che non appartengono a una sola."
    );
  }

  return parti.join(" ");
}
