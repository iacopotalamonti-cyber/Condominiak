"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatEuro } from "@/lib/condotwin-calculations";
import type { Bilancio } from "@/lib/types";

interface BilancioChartProps {
  bilanci: Bilancio[];
}

export function BilancioChart({ bilanci }: BilancioChartProps) {
  const data = [...bilanci]
    .sort((a, b) => a.anno - b.anno)
    .map((b) => ({
      anno: String(b.anno),
      Preventivo: b.preventivo ?? 0,
      Consuntivo: b.consuntivo ?? 0,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="anno"
          tickLine={false}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          width={40}
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
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
        />
        <Bar dataKey="Preventivo" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Consuntivo" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
