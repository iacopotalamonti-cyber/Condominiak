"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CATEGORIE_SPESA_LABEL, formatEuro } from "@/lib/condotwin-calculations";
import type { Spesa } from "@/lib/types";

interface SpeseChartProps {
  spese: Spesa[];
}

export function SpeseChart({ spese }: SpeseChartProps) {
  const data = [...spese]
    .sort((a, b) => b.importo - a.importo)
    .map((s) => ({
      categoria: CATEGORIE_SPESA_LABEL[s.categoria] ?? s.categoria,
      importo: s.importo,
    }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
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
        <Bar dataKey="importo" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
