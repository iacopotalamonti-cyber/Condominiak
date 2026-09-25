// Il motore: legge un rendiconto seguendo una scheda, invece di un lettore
// scritto apposta.
//
// Fino a ieri ogni formato aveva la sua funzione. Funzionava, ma non scala: un
// amministratore nuovo voleva codice nuovo, e codice nuovo vuole qualcuno che
// lo scriva e qualcuno che lo riveda. Qui la conoscenza di un formato diventa
// una scheda di dati — dove sono le colonne, come si riconosce una voce, dove
// sta il totale — e il motore che la esegue è uno solo, scritto e verificato
// una volta.
//
// È anche ciò che rende sicuro far proporre una scheda al modello: una scheda
// descrive dove guardare, non cosa fare. Al peggio legge male dei numeri, e la
// quadratura contro il totale stampato se ne accorge. Codice generato a runtime
// avrebbe potuto fare qualunque cosa.

import {
  importoDi,
  INTESTAZIONI_PREDEFINITE,
  mappaColonne,
  type MappaColonne,
  type Pagina,
  type Riga,
} from "./rendiconto.ts";

// ---------------------------------------------------------------------------
// La scheda
// ---------------------------------------------------------------------------

/**
 * Come si riconosce l'inizio di una voce di spesa.
 *
 * Tre modi, perché tre sono quelli che i rendiconti usano davvero:
 * - `codice`: un codice in una colonna sua ("001.005")
 * - `intestazione`: una riga di solo testo al margine sinistro ("Consumi Acqua")
 * - `chiusura`: una riga che dichiara insieme nome e totale ("Tot. Conto n.9 € 8,98")
 */
/**
 * Dove sta, dentro la riga di un movimento, il nome di chi ha emesso la spesa.
 *
 * "prima-del-numero": la riga è "Tosiani Angelo | NP105 | 18/11/24 | 154,79" —
 * il nome è tutto ciò che sta prima del numero di documento, e il numero di
 * documento è il frammento subito a sinistra della data. Nessuna coordinata
 * fissa: si trova la data, e il resto viene da sé.
 */
export type RegolaFornitore = { tipo: "prima-del-numero" };

export type RegolaVoce =
  | { tipo: "codice"; schema: string }
  | { tipo: "intestazione"; rientroMassimo: number }
  | { tipo: "chiusura"; schema: string; nomi?: string };

export interface ProfiloFormato {
  nome: string;
  /** Testo che compare solo nei documenti di questo formato. */
  impronta: string;
  /**
   * Quale colonna porta il totale di una voce, contata da sinistra: 0 è la
   * colonna dell'importo del movimento. È la parte che cambia fra formati che
   * sembrano identici — in un rendiconto la terza colonna è il totale della
   * voce, in un altro è il totale della tabella di riparto.
   */
  colonnaTotale?: number;
  /** Seconda colonna di totale, quando il formato separa proprietario e conduttore. */
  colonnaTotaleSecondaria?: number;
  /**
   * Le parole che intestano le colonne, come espressioni sul testo intero di
   * un frammento. Senza, valgono quelle dei formati conosciuti: "Importo" per
   * il movimento, "Parziale" e "Totale" per i totali.
   */
  intestazioni?: { movimento: string; totali: string };
  voce: RegolaVoce;
  /** Come si isola il fornitore in una riga di movimento, dove è isolabile. */
  fornitore?: RegolaFornitore;
  /**
   * -1 quando il formato stampa le spese come uscite di cassa, col segno meno.
   * Serve perché i totali di formati diversi siano confrontabili fra loro
   * senza che se ne ricordi chi li legge.
   */
  segno?: -1 | 1;
  /** Espressione con un gruppo di cattura sul totale generale stampato. */
  totaleGenerale?: string;
  /** Voci addebitate a contatore, esposte a parte (P00, P01…). */
  personali?: string;
  /**
   * Alcuni file contengono consuntivo e preventivo di seguito: dopo il totale
   * generale non si legge più, o la spesa raddoppia.
   */
  fermatiAlTotale?: boolean;
  /**
   * Una voce i cui movimenti scavalcano il salto pagina viene ristampata con lo
   * stesso codice, e il totale compare solo la seconda volta.
   */
  unisciVociSpezzate?: boolean;
}

// ---------------------------------------------------------------------------
// Il risultato
// ---------------------------------------------------------------------------

/**
 * Una riga di spesa vera: la fattura, il consumo, il conguaglio.
 *
 * Sta nella colonna più a sinistra, quella dell'importo del movimento, ed è
 * l'unico posto dove compare il nome di chi ha emesso la spesa. Senza queste
 * righe si sa quanto è costato l'ascensore, non a chi è stato pagato.
 */
export interface MovimentoLetto {
  descrizione: string;
  /** Chi ha emesso la spesa, quando il formato gli dà una colonna sua. */
  fornitore: string;
  /** Data del documento in formato AAAA-MM-GG, "" se la riga non la porta. */
  data: string;
  importo: number;
  pagina: number;
}

export interface VoceLetta {
  chiave: string;
  descrizione: string;
  importo: number;
  /** Quota separata, quando il formato distingue proprietario e conduttore. */
  importoSecondario: number | null;
  pagina: number;
  /**
   * I movimenti della voce, quando sommano al totale della voce stessa. Se non
   * ci arrivano vengono scartati: una lista incompleta di fatture è peggio di
   * nessuna lista, perché sembra completa.
   */
  movimenti: MovimentoLetto[];
}

export interface Lettura {
  profilo: string;
  voci: VoceLetta[];
  personali: { chiave: string; descrizione: string; importo: number }[];
  totaleGenerale: number | null;
  /** Somma di quanto letto meno il totale stampato: quanto non abbiamo spiegato. */
  scarto: number | null;
}

// Le date dei documenti sono stampate all'italiana e spesso con l'anno a due
// cifre: "18/11/24". Il secolo non è scritto da nessuna parte, ma un rendiconto
// condominiale non porta fatture dell'Ottocento.
const DATA = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;

function dataDi(testo: string): string {
  const trovato = testo.trim().match(DATA);
  if (!trovato) return "";
  const [, giorno, mese, anno] = trovato;
  const completo = anno.length === 4 ? anno : `20${anno}`;
  return `${completo}-${mese.padStart(2, "0")}-${giorno.padStart(2, "0")}`;
}

/** La colonna più a sinistra: l'importo del singolo movimento. */
const COLONNA_MOVIMENTO = 0;

// Quanto può discostare la somma dei movimenti dal totale della voce prima che
// la si consideri incompleta. Un centesimo, cioè l'arrotondamento e nulla più:
// questo confronto è l'unica prova che non ci siamo persi una fattura.
const TOLLERANZA_MOVIMENTI = 0.01;

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100;
}

/** I frammenti di una riga, da sinistra a destra, come testo unico. */
export function testoRiga(riga: Riga): string {
  return riga.frammenti
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((f) => f.testo.trim())
    .filter(Boolean)
    .join(" ");
}

/** A quale colonna appartiene un importo, contata da sinistra. */
function indiceColonna(xFine: number, mappa: MappaColonne): number | null {
  let migliore: { indice: number; distanza: number } | null = null;

  mappa.ancore.forEach((ancora, indice) => {
    const distanza = xFine - ancora.xFine;
    if (distanza < -2 || distanza > 30) return;
    if (!migliore || distanza < migliore.distanza) migliore = { indice, distanza };
  });

  return migliore === null ? null : (migliore as { indice: number }).indice;
}

// ---------------------------------------------------------------------------
// La lettura
// ---------------------------------------------------------------------------

export function leggi(pagine: Pagina[], profilo: ProfiloFormato): Lettura {
  const voci: VoceLetta[] = [];
  const personali: Lettura["personali"] = [];
  let totaleGenerale: number | null = null;
  let corrente: VoceLetta | null = null;

  const schemaCodice = profilo.voce.tipo === "codice" ? new RegExp(profilo.voce.schema) : null;
  const schemaChiusura = profilo.voce.tipo === "chiusura" ? new RegExp(profilo.voce.schema, "i") : null;
  const schemaNomi = profilo.voce.tipo === "chiusura" && profilo.voce.nomi
    ? new RegExp(profilo.voce.nomi, "i")
    : null;
  const schemaTotale = profilo.totaleGenerale ? new RegExp(profilo.totaleGenerale, "i") : null;
  const schemaPersonali = profilo.personali ? new RegExp(profilo.personali) : null;

  const nomi = new Map<string, string>();
  const parole = profilo.intestazioni
    ? { movimento: new RegExp(profilo.intestazioni.movimento, "i"), totali: new RegExp(profilo.intestazioni.totali, "i") }
    : INTESTAZIONI_PREDEFINITE;

  for (const pagina of pagine) {
    if (totaleGenerale !== null && profilo.fermatiAlTotale) break;

    const mappa =
      profilo.colonnaTotale === undefined
        ? null
        : mappaColonne(pagina.righe.flatMap((r) => r.frammenti), parole);

    // Un formato a colonne che su questa pagina non le trova sta guardando
    // una relazione o un riparto, non l'elenco delle spese.
    if (profilo.colonnaTotale !== undefined && !mappa) continue;

    const margine = Math.min(...pagina.righe.flatMap((r) => r.frammenti.map((f) => f.x)));

    for (const riga of pagina.righe.slice().sort((a, b) => b.y - a.y)) {
      if (totaleGenerale !== null && profilo.fermatiAlTotale) break;

      const linea = testoRiga(riga);
      const ordinati = riga.frammenti.slice().sort((a, b) => a.x - b.x);
      const importi = ordinati.filter((f) => importoDi(f.testo) !== null);

      if (schemaTotale && totaleGenerale === null) {
        const trovato = linea.match(schemaTotale);
        if (trovato) {
          totaleGenerale = importoDi(trovato[1]);
          continue;
        }
      }

      if (schemaPersonali) {
        const trovato = ordinati.find((f) => schemaPersonali.test(f.testo.trim()));
        if (trovato && importi.length) {
          personali.push({
            chiave: trovato.testo.trim(),
            descrizione: ordinati
              .filter((f) => f.x > trovato.x && importoDi(f.testo) === null)
              .map((f) => f.testo.trim())
              .join(" "),
            importo: importoDi(importi[importi.length - 1].testo)!,
          });
          continue;
        }
      }

      if (schemaNomi) {
        const trovato = linea.match(schemaNomi);
        if (trovato) nomi.set(trovato[1], trovato[2]);
      }

      // --- apertura di una voce ---------------------------------------------

      if (schemaCodice) {
        const codice = ordinati.find((f) => schemaCodice.test(f.testo.trim()));
        if (codice) {
          const chiave = codice.testo.trim();
          const precedente = voci[voci.length - 1];
          const continua =
            profilo.unisciVociSpezzate &&
            precedente?.chiave === chiave &&
            precedente.importo === 0 &&
            precedente.importoSecondario === null;

          if (continua) {
            precedente.pagina = pagina.numero;
            corrente = precedente;
          } else {
            corrente = {
              chiave,
              descrizione: ordinati
                .filter((f) => f.x > codice.x && importoDi(f.testo) === null)
                .map((f) => f.testo.trim())
                .join(" ")
                .trim(),
              importo: 0,
              importoSecondario: null,
              pagina: pagina.numero,
              movimenti: [],
            };
            voci.push(corrente);
          }
        }
      }

      if (profilo.voce.tipo === "intestazione" && !importi.length) {
        const inizio = Math.min(...riga.frammenti.map((f) => f.x));
        const rientro = inizio - margine;
        if (rientro <= profilo.voce.rientroMassimo && linea.length > 2) {
          corrente = {
            chiave: linea,
            descrizione: linea,
            importo: 0,
            importoSecondario: null,
            pagina: pagina.numero,
            movimenti: [],
          };
        }
        continue;
      }

      if (schemaChiusura) {
        const trovato = linea.match(schemaChiusura);
        if (trovato) {
          const importo = importoDi(trovato[2]);
          if (importo !== null) {
            voci.push({
              chiave: trovato[1],
              descrizione: nomi.get(trovato[1]) ?? trovato[1],
              importo,
              importoSecondario: null,
              pagina: pagina.numero,
              // Questo formato dichiara solo il totale del conto: le righe che
              // lo compongono stanno altrove, e non le leggiamo.
              movimenti: [],
            });
          }
        }
        continue;
      }

      // --- importi nelle colonne --------------------------------------------

      if (!mappa || !corrente) continue;

      for (const frammento of importi) {
        const indice = indiceColonna(frammento.xFine, mappa);
        if (indice === null) continue;

        const valore = importoDi(frammento.testo)!;

        if (indice === profilo.colonnaTotale) {
          // Un formato scrive il totale una volta sola sotto la voce; un altro
          // lo ripete in una riga di chiusura. Tenere l'ultimo va bene in
          // entrambi i casi: è sempre lo stesso numero.
          corrente.importo = valore;
          corrente.pagina = pagina.numero;
          if (!voci.includes(corrente)) voci.push(corrente);
        } else if (indice === profilo.colonnaTotaleSecondaria && corrente.importoSecondario === null) {
          corrente.importoSecondario = valore;
          if (!voci.includes(corrente)) voci.push(corrente);
        } else if (indice === COLONNA_MOVIMENTO) {
          const sinistra = ordinati.filter((f) => f.x < frammento.x && importoDi(f.testo) === null);
          const indiceData = sinistra.findIndex((f) => DATA.test(f.testo.trim()));

          corrente.movimenti.push({
            descrizione: sinistra
              .map((f) => f.testo.trim())
              .filter(Boolean)
              .join(" ")
              .trim(),
            // Il fornitore si stacca solo se prima della data resta qualcosa
            // oltre al numero di documento: altrimenti si taglierebbe via il
            // nome invece del numero.
            fornitore:
              profilo.fornitore && indiceData > 1
                ? sinistra
                    .slice(0, indiceData - 1)
                    .map((f) => f.testo.trim())
                    .filter(Boolean)
                    .join(" ")
                    .trim()
                : "",
            data: indiceData >= 0 ? dataDi(sinistra[indiceData].testo) : "",
            importo: valore,
            pagina: pagina.numero,
          });
        }
      }
    }
  }

  const segno = profilo.segno ?? 1;
  const lette = voci
    .filter((v) => v.importo !== 0 || v.importoSecondario !== null)
    .map((v) => {
      // I movimenti si tengono solo se sommano al totale della voce. Una riga
      // può essere sfuggita — un importo finito in un'altra colonna, una
      // tabella spezzata — e un elenco di fatture a cui ne manca una si legge
      // come se fosse completo.
      const totale = arrotonda(v.importo + (v.importoSecondario ?? 0));
      const somma = arrotonda(v.movimenti.reduce((tot, m) => tot + m.importo, 0));
      const completi = Math.abs(somma - totale) <= TOLLERANZA_MOVIMENTI;

      return {
        ...v,
        importo: arrotonda(v.importo * segno),
        importoSecondario: v.importoSecondario === null ? null : arrotonda(v.importoSecondario * segno),
        movimenti: completi
          ? v.movimenti.map((m) => ({ ...m, importo: arrotonda(m.importo * segno) }))
          : [],
      };
    });
  for (const p of personali) p.importo = arrotonda(p.importo * segno);
  if (totaleGenerale !== null) totaleGenerale = arrotonda(totaleGenerale * segno);
  const somma = arrotonda(
    lette.reduce((tot, v) => tot + v.importo + (v.importoSecondario ?? 0), 0) +
      personali.reduce((tot, p) => tot + p.importo, 0)
  );

  return {
    profilo: profilo.nome,
    voci: lette,
    personali,
    totaleGenerale,
    scarto: totaleGenerale === null ? null : arrotonda(somma - totaleGenerale),
  };
}

/** Il primo profilo la cui impronta compare nel documento, se ce n'è uno. */
export function riconosci(pagine: Pagina[], profili: ProfiloFormato[]): ProfiloFormato | null {
  const testo = pagine.flatMap((p) => p.righe.map(testoRiga)).join("\n");
  return profili.find((p) => new RegExp(p.impronta, "i").test(testo)) ?? null;
}
