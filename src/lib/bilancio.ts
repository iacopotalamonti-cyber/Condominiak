import type { Bilancio, Incasso, Spesa } from "./types";

// Scostamento oltre il quale la somma delle voci e il totale del documento non
// si considerano più la stessa cifra (arrotondamenti dell'amministratore).
export const TOLLERANZA_QUADRATURA = 1;

// Da dove viene il totale mostrato. Serve a dirlo in interfaccia invece di
// presentare tutti i numeri come se avessero la stessa autorevolezza.
export type OrigineTotale = "documento" | "consuntivo" | "voci" | "assente";

export interface TotaleEsercizio {
  anno: number;
  // Quanto è stato speso nell'esercizio: è questo il numero che ogni pagina
  // deve mostrare, qualunque pagina sia.
  totale: number;
  origine: OrigineTotale;
  // Somma delle voci di spesa classificate per categoria.
  sommaVoci: number;
  // Somma con segno delle partite di singoli condomini comprese nel totale
  // stampato: negativa quando il documento le sottrae (un rimborso incassato),
  // positiva quando ve le somma (una spesa riaddebitata).
  incassi: number;
  // Quanto del totale non è ricondotto a nessuna categoria. È la parte che
  // l'estrazione non ha classificato: va mostrata, non nascosta, altrimenti il
  // dettaglio non somma al totale e i numeri sembrano sbagliati.
  nonClassificato: number;
  // Il caso opposto: le voci sommano più del totale dichiarato, quindi
  // qualcosa è stato contato due volte.
  eccedenza: number;
  quadra: boolean;
}

// L'ordine di precedenza è il punto di tutto il modulo: il totale stampato sul
// documento batte il consuntivo registrato, che batte la somma delle voci.
// Prima ogni pagina sceglieva per conto suo e mostrava un numero diverso.
export function totaleEsercizio(
  anno: number,
  bilancio: Pick<Bilancio, "totale_documento" | "consuntivo"> | undefined | null,
  spese: Pick<Spesa, "importo">[],
  // Le partite di singoli condomini comprese nel totale stampato. Senza di
  // loro un rimborso assicurativo di 2.500 € si presentava come 2.500 € di
  // spese contate due volte.
  incassi: Pick<Incasso, "importo">[] = []
): TotaleEsercizio {
  const sommaVoci = arrotonda(spese.reduce((somma, s) => somma + (s.importo || 0), 0));
  const sommaIncassi = arrotonda(incassi.reduce((somma, i) => somma + (i.importo || 0), 0));

  // Il totale stampato sul documento comprende gli incassi: quanto è stato
  // speso è quel totale meno loro. È l'unico posto in cui questa sottrazione
  // va fatta, e per questo sta qui e non nelle pagine.
  const daDocumento = positivo(arrotonda(positivo(bilancio?.totale_documento) - sommaIncassi));
  const daConsuntivo = positivo(bilancio?.consuntivo);

  let totale = 0;
  let origine: OrigineTotale = "assente";

  if (daDocumento) {
    totale = daDocumento;
    origine = "documento";
  } else if (daConsuntivo) {
    totale = daConsuntivo;
    origine = "consuntivo";
  } else if (sommaVoci) {
    // Nessun totale dichiarato: le voci sono la migliore evidenza di spesa.
    // Il preventivo di proposito non entra mai qui, perché è una previsione e
    // non dice quanto è stato speso davvero.
    totale = sommaVoci;
    origine = "voci";
  }

  const differenza = arrotonda(totale - sommaVoci);

  return {
    anno,
    totale: arrotonda(totale),
    origine,
    sommaVoci,
    incassi: sommaIncassi,
    nonClassificato: differenza > TOLLERANZA_QUADRATURA ? differenza : 0,
    eccedenza: differenza < -TOLLERANZA_QUADRATURA ? -differenza : 0,
    quadra: Math.abs(differenza) <= TOLLERANZA_QUADRATURA,
  };
}

// Tutti gli esercizi per cui esistono dati, dal più recente. Gli anni vengono
// da entrambe le tabelle: un anno con sole voci di spesa e nessun bilancio
// registrato è comunque un esercizio da mostrare.
export function esercizi(
  bilanci: Bilancio[],
  spese: Spesa[],
  incassi: Incasso[] = []
): TotaleEsercizio[] {
  const anni = new Set<number>();
  for (const b of bilanci) if (b.anno) anni.add(b.anno);
  for (const s of spese) if (s.anno) anni.add(s.anno);

  return Array.from(anni)
    .sort((a, b) => b - a)
    .map((anno) =>
      totaleEsercizio(
        anno,
        bilanci.find((b) => b.anno === anno),
        spese.filter((s) => s.anno === anno),
        incassi.filter((i) => i.anno === anno)
      )
    );
}

// L'esercizio di riferimento quando una pagina ne mostra uno solo: l'anno in
// corso se ci sono dati, altrimenti il più recente disponibile. Anche questa
// scelta stava scritta in modo diverso in ogni pagina.
export function esercizioCorrente(
  bilanci: Bilancio[],
  spese: Spesa[],
  anno = new Date().getFullYear(),
  incassi: Incasso[] = []
): TotaleEsercizio | null {
  const tutti = esercizi(bilanci, spese, incassi);
  return tutti.find((e) => e.anno === anno) ?? tutti[0] ?? null;
}

export const ORIGINE_TOTALE_LABEL: Record<OrigineTotale, string> = {
  documento: "totale stampato sul documento",
  consuntivo: "consuntivo registrato",
  voci: "somma delle voci di spesa",
  assente: "nessun totale disponibile",
};

function positivo(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function arrotonda(value: number): number {
  return Math.round(value * 100) / 100;
}
