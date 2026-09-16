"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatEuro } from "@/lib/condotwin-calculations";
import { SENZA_FORNITORE } from "@/lib/fornitori";

interface Voce {
  fornitore: string;
  totale: number;
}

interface FornitoriChartProps {
  voci: Voce[];
}

// Oltre questa soglia le barre diventano illeggibili e la coda non dice nulla:
// il resto si accorpa in una voce dichiarata invece di sparire dal grafico.
const MAX_BARRE = 12;
const ALTRI = "Altri fornitori";
const TRATTEGGIO_ID = "fornitori-non-attribuito";

export function FornitoriChart({ voci }: FornitoriChartProps) {
  const ordinati = [...voci].sort((a, b) => b.totale - a.totale);
  const principali = ordinati.slice(0, MAX_BARRE);
  const coda = ordinati.slice(MAX_BARRE);

  const data = [
    ...principali,
    ...(coda.length
      ? [{ fornitore: `${ALTRI} (${coda.length})`, totale: coda.reduce((t, v) => t + v.totale, 0) }]
      : []),
  ].map((voce) => ({
    ...voce,
    // La spesa senza controparte nominata non è un fornitore: si distingue
    // come si distingue il non classificato in Analisi spese.
    attribuito: !voce.fornitore.startsWith(SENZA_FORNITORE) && !voce.fornitore.startsWith(ALTRI),
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
        <defs>
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
          dataKey="fornitore"
          tickLine={false}
          axisLine={false}
          width={170}
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
        <Bar dataKey="totale" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((voce) => (
            <Cell
              key={voce.fornitore}
              fill={voce.attribuito ? "var(--chart-1)" : `url(#${TRATTEGGIO_ID})`}
              stroke={voce.attribuito ? undefined : "var(--chart-axis)"}
              strokeWidth={voce.attribuito ? 0 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
