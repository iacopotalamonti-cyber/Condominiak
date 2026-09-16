"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CATEGORIE_SPESA_LABEL, formatEuro } from "@/lib/condotwin-calculations";
import type { Spesa } from "@/lib/types";

interface SpeseChartProps {
  spese: Spesa[];
  // Parte del totale dell'esercizio non ricondotta a nessuna categoria. Entra
  // nel grafico come barra a sé: se restasse fuori, le barre sommerebbero meno
  // del totale scritto sopra e sarebbe il grafico a sembrare sbagliato.
  nonClassificato?: number;
}

const ETICHETTA_NON_CLASSIFICATO = "Non classificato";
const TRATTEGGIO_ID = "spese-non-classificato";

export function SpeseChart({ spese, nonClassificato = 0 }: SpeseChartProps) {
  const categorie = [...spese]
    .sort((a, b) => b.importo - a.importo)
    .map((s) => ({
      categoria: CATEGORIE_SPESA_LABEL[s.categoria] ?? s.categoria,
      importo: s.importo,
      classificata: true,
    }));

  // In fondo e non in ordine di grandezza: non è una voce di spesa, è ciò che
  // manca all'appello.
  const data = nonClassificato
    ? [...categorie, { categoria: ETICHETTA_NON_CLASSIFICATO, importo: nonClassificato, classificata: false }]
    : categorie;

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
        <defs>
          {/* Tratteggio invece di un colore pieno: segnala "importo non
              attribuito" anche a chi non distingue le tinte, e in stampa. */}
          <pattern
            id={TRATTEGGIO_ID}
            width="6"
            height="6"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="6" height="6" fill="var(--muted)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-axis)" strokeWidth="2.5" />
          </pattern>
        </defs>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
        />
        <YAxis
          type="category"
          dataKey="categoria"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }}
          formatter={(value) => formatEuro(Number(value))}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="importo" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((riga) => (
            <Cell
              key={riga.categoria}
              fill={riga.classificata ? "var(--chart-1)" : `url(#${TRATTEGGIO_ID})`}
              stroke={riga.classificata ? undefined : "var(--chart-axis)"}
              strokeWidth={riga.classificata ? 0 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
