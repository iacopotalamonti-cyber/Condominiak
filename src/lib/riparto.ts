// Il riparto non si calcola: sta stampato nel rendiconto, unità per unità.
//
// L'applicazione finora faceva una divisione: millesimi dell'appartamento
// diviso millesimi totali, per la spesa dell'anno. È il calcolo che si fa
// quando il riparto non ce l'hai. Ma il rendiconto lo porta già fatto, e fatto
// diversamente: un condominio non ha una tabella millesimale, ne ha molte —
// generali, scale e ascensore, corsello garage, fotovoltaico — e ogni spesa si
// divide con la sua. Riscaldamento e acqua non si dividono affatto: sono a
// contatore.
//
// Su Via Enriques 3 la differenza non è un arrotondamento. L'appartamento 9
// nel 2024-2025 ha pagato 2.377,54 €; la divisione ne dava 2.095,22. Sul solo
// riscaldamento, 873,65 contro 594,55: il 47% in meno.
//
// Quindi qui si legge, come si legge il totale.

import { importoDi, type Frammento, type Pagina, type Riga } from "./rendiconto.ts";

// Le colonne del riparto sono intestate su tre righe sovrapposte: "Millesimi"
// sulla prima, "Gen. Conduz." sulla seconda, "Appartamenti" sulla terza. Il
// nome della colonna è la loro somma.
const RIGHE_INTESTAZIONE = 3;

// Gli importi sono allineati a destra e finiscono poco oltre la parola che li
// intesta: fra 3 e 18 punti sui documenti veri. Venticinque copre lo scarto
// senza arrivare alla colonna dopo, che dista una quarantina di punti.
const TOLLERANZA_COLONNA = 25;

const INTESTAZIONE = /^(Millesimi|Personali|Spese)$/;
const CODICE_UNITA = /^\d{3}$/;
const RIGA_MILLESIMI = /Millesimi\s*-->/;

// Quando un'unità cambia proprietario a metà esercizio, il rendiconto stampa
// un secondo blocco di importi che comincia con la data del passaggio e non
// ripete il codice: "06/05/23 La Ganga Federica Pro 80,18 103,80 …". Sono
// spese di quella stessa unità, e nel 2022-2023 valevano 87,23 € sui generali
// — esattamente quanto non tornava prima che venissero attribuite.
const SEGUITO_UNITA = /\b(Pro|Inq)\b/;

// I millesimi si stampano con tre decimali — "79,065" — e il lettore degli
// importi ne vuole due, perché un importo in euro ne ha due. Sono numeri di
// natura diversa e si leggono con regole diverse: usare la regola larga anche
// per gli importi farebbe passare per denaro cose che non lo sono.
const MILLESIMO = /^-?\d{1,3}(?:\.\d{3})*,\d{3}$/;

function millesimoDi(testo: string): number | null {
  const pulito = testo.trim();
  if (!MILLESIMO.test(pulito)) return null;
  return Number(pulito.replace(/\./g, "").replace(",", "."));
}

export interface ColonnaRiparto {
  /** Nome per esteso, come lo stampa il documento. */
  nome: string;
  /** Estremo destro dell'intestazione: è lì che finiscono i suoi importi. */
  xFine: number;
}

export interface QuotaUnita {
  /** Codice dell'unità nel rendiconto ("009"). */
  codice: string;
  /** "Appartamento", "Box", "Cantina", "Posto auto". */
  tipologia: string;
  /** Il subalterno catastale, stampato davanti alla tipologia ("42 Appartamento"). */
  sub: string;
  nome: string;
  /** Quanto paga, colonna per colonna. */
  importi: Record<string, number>;
  /** I millesimi con cui ciascuna colonna la riguarda. */
  millesimi: Record<string, number>;
  totale: number;
  pagina: number;
}

export interface Riparto {
  colonne: ColonnaRiparto[];
  unita: QuotaUnita[];
  /** La riga "Totali Condominio", con cui si verifica quanto letto. */
  totaliDichiarati: Record<string, number>;
  /** Somma di quanto letto meno i totali dichiarati, colonna per colonna. */
  scarti: Record<string, number>;
  /**
   * Importi della riga dei totali che non stanno sotto nessuna colonna
   * riconosciuta. Se ce ne sono, una colonna è sfuggita alla lettura — e con
   * lei le quote che porta — anche se ogni colonna letta torna.
   */
  totaliSenzaColonna: number[];
  quadra: boolean;
}

function ordinati(riga: Riga): Frammento[] {
  return riga.frammenti.slice().sort((a, b) => a.x - b.x);
}

function testoRiga(riga: Riga): string {
  return ordinati(riga)
    .map((f) => f.testo.trim())
    .filter(Boolean)
    .join(" ");
}

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100;
}

/** La colonna a cui appartiene un importo, o null se non ne tocca nessuna. */
function colonnaDi(xFine: number, colonne: ColonnaRiparto[]): string | null {
  let migliore: { nome: string; distanza: number } | null = null;

  for (const colonna of colonne) {
    const distanza = xFine - colonna.xFine;
    if (distanza < -2 || distanza > TOLLERANZA_COLONNA) continue;
    if (!migliore || distanza < migliore.distanza) {
      migliore = { nome: colonna.nome, distanza };
    }
  }

  return migliore?.nome ?? null;
}

/**
 * Le colonne dichiarate dall'intestazione di una pagina di riparto.
 *
 * Restituisce null quando la pagina non è un riparto: è così che si
 * distinguono le pagine da leggere senza doverle elencare a mano.
 */
export function colonneDi(pagina: Pagina): ColonnaRiparto[] | null {
  const righe = pagina.righe.slice().sort((a, b) => b.y - a.y);
  const indice = righe.findIndex(
    (riga) => ordinati(riga).filter((f) => INTESTAZIONE.test(f.testo.trim())).length >= 3
  );
  if (indice < 0) return null;

  // Le parole note servono solo a trovare la riga d'intestazione e il punto
  // in cui cominciano le colonne. Le colonne sono tutto ciò che sta da lì a
  // destra, qualunque parola le apra: il 2023-2024 ha una decima colonna,
  // "Consumi Enel Box/Cantine", e un elenco di parole note l'aveva persa.
  const intestazione = ordinati(righe[indice]);
  const inizio = Math.min(
    ...intestazione.filter((f) => INTESTAZIONE.test(f.testo.trim())).map((f) => f.x)
  );
  const colonne: ColonnaRiparto[] = intestazione
    .filter((f) => f.x >= inizio - 5 && f.testo.trim())
    .map((f) => ({ nome: f.testo.trim(), xFine: f.xFine }));

  // Le due righe sotto completano il nome: si attribuisce ogni pezzo alla
  // colonna che gli sta più vicino orizzontalmente, confrontando i centri.
  for (const riga of righe.slice(indice + 1, indice + RIGHE_INTESTAZIONE)) {
    for (const frammento of ordinati(riga)) {
      const centro = (frammento.x + frammento.xFine) / 2;
      let vicina: ColonnaRiparto | null = null;
      let minima = Infinity;

      for (const colonna of colonne) {
        // Il centro dell'intestazione non si conosce, ma la sua parola è larga
        // quanto la colonna: bastano una trentina di punti di raggio.
        const distanza = Math.abs(centro - (colonna.xFine - 13));
        if (distanza < minima) {
          minima = distanza;
          vicina = colonna;
        }
      }

      if (vicina && minima <= 30) vicina.nome = `${vicina.nome} ${frammento.testo.trim()}`;
    }
  }

  for (const colonna of colonne) colonna.nome = colonna.nome.replace(/\s+/g, " ").trim();
  return colonne;
}

/**
 * Legge le quote di tutte le unità, da tutte le pagine di riparto.
 *
 * Un'unità può comparire su più righe — il proprietario e l'inquilino si
 * dividono le spese — e le righe si sommano: la domanda a cui l'applicazione
 * risponde è quanto costa quell'appartamento, non a chi è stato addebitato.
 */
export function leggiRiparto(pagine: Pagina[]): Riparto | null {
  let colonne: ColonnaRiparto[] | null = null;
  const perCodice = new Map<string, QuotaUnita>();
  const totaliDichiarati: Record<string, number> = {};
  const totaliSenzaColonna: number[] = [];

  for (const pagina of pagine) {
    const colonnePagina = colonneDi(pagina);
    if (!colonnePagina) continue;
    colonne ??= colonnePagina;

    // L'ultima unità di cui si sono lette righe: serve alle righe di seguito,
    // che non portano il codice.
    let corrente: QuotaUnita | null = null;

    for (const riga of pagina.righe.slice().sort((a, b) => b.y - a.y)) {
      const frammenti = ordinati(riga);
      const linea = testoRiga(riga);

      const importi = frammenti
        .map((f) => ({ valore: importoDi(f.testo), colonna: colonnaDi(f.xFine, colonnePagina) }))
        .filter((v): v is { valore: number; colonna: string } => v.valore !== null && v.colonna !== null);

      if (/^Totali\s+Condominio/i.test(linea)) {
        for (const frammento of frammenti) {
          const valore = importoDi(frammento.testo);
          if (valore === null) continue;
          const colonna = colonnaDi(frammento.xFine, colonnePagina);
          if (colonna === null) {
            totaliSenzaColonna.push(valore);
            continue;
          }
          totaliDichiarati[colonna] = arrotonda((totaliDichiarati[colonna] ?? 0) + valore);
        }
        continue;
      }

      // Le righe di totale parziale ("Totali Garage") ripetono importi già
      // contati: si saltano, o l'unità verrebbe pagata due volte.
      if (/^(Totali|Millesimi -->)/i.test(linea)) continue;

      const codice = frammenti[0]?.testo.trim();

      if (!codice || !CODICE_UNITA.test(codice)) {
        // Righe senza codice: sono il seguito dell'unità precedente, oppure
        // l'arrotondamento finale, che non appartiene a nessuno.
        if (corrente && importi.length && SEGUITO_UNITA.test(linea)) {
          for (const { valore, colonna } of importi) {
            corrente.importi[colonna] = arrotonda((corrente.importi[colonna] ?? 0) + valore);
          }
        }
        continue;
      }

      if (RIGA_MILLESIMI.test(linea)) {
        const quote = frammenti
          .map((f) => ({ valore: millesimoDi(f.testo), colonna: colonnaDi(f.xFine, colonnePagina) }))
          .filter((v): v is { valore: number; colonna: string } => v.valore !== null && v.colonna !== null);

        // I millesimi di un'unità precedono sempre le sue righe di importo.
        corrente = perCodice.get(codice) ?? {
          codice,
          tipologia: "",
          sub: "",
          nome: "",
          importi: {},
          millesimi: {},
          totale: 0,
          pagina: pagina.numero,
        };
        for (const { valore, colonna } of quote) corrente.millesimi[colonna] = valore;
        perCodice.set(codice, corrente);
        continue;
      }

      const unita = perCodice.get(codice);
      if (!unita) continue;
      corrente = unita;

      // La descrizione sta fra il codice e la sigla Pro/Inq: "32 Appartamento",
      // poi il nome. La riga dell'inquilino non porta la tipologia, quindi il
      // primo che la scrive vince e le righe dopo non la cancellano.
      const testuali = frammenti
        .slice(1)
        .filter((f) => importoDi(f.testo) === null)
        .map((f) => f.testo.trim());
      const tipologia = testuali.find((t) => /appartamento|box|cantina|posto auto|negozio|ufficio/i.test(t));
      if (tipologia && !unita.tipologia) {
        unita.sub = tipologia.match(/^(\d+)/)?.[1] ?? "";
        unita.tipologia = tipologia.replace(/^\d+\s*/, "").trim();
        unita.nome = testuali.filter((t) => t !== tipologia && !/^(Pro|Inq)$/.test(t)).join(" ").trim();
      }

      for (const { valore, colonna } of importi) {
        unita.importi[colonna] = arrotonda((unita.importi[colonna] ?? 0) + valore);
      }
      unita.pagina = pagina.numero;
    }
  }

  if (!colonne || !perCodice.size) return null;

  const unita = [...perCodice.values()].sort((a, b) => a.codice.localeCompare(b.codice));
  for (const u of unita) {
    u.totale = arrotonda(Object.values(u.importi).reduce((tot, v) => tot + v, 0));
  }

  const scarti: Record<string, number> = {};
  for (const colonna of Object.keys(totaliDichiarati)) {
    const letto = arrotonda(unita.reduce((tot, u) => tot + (u.importi[colonna] ?? 0), 0));
    scarti[colonna] = arrotonda(letto - totaliDichiarati[colonna]);
  }

  return {
    colonne,
    unita,
    totaliDichiarati,
    scarti,
    totaliSenzaColonna,
    // Due centesimi per colonna: il documento stampa una riga di
    // arrotondamento, e sotto quella soglia non c'è niente da spiegare. Ma
    // anche una riga di totali letta per intero: un importo senza colonna
    // vuol dire una colonna persa, e le colonne lette non possono accorgersene.
    // Senza totali stampati, poi, non c'è niente con cui verificare.
    quadra:
      Object.keys(totaliDichiarati).length > 0 &&
      totaliSenzaColonna.length === 0 &&
      Object.values(scarti).every((s) => Math.abs(s) <= 0.02),
  };
}
