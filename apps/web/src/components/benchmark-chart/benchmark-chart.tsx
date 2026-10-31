"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTable,
  ChartTooltip,
  chartFill,
} from "@nuvui/charts";
import { ADAPTERS } from "@repo/types";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { ADAPTER_LABELS, type ChartRow, type Unit } from "@/lib/benchmark-data";
import { formatMultiple, formatRps, formatRpsShort } from "@/lib/format";
import "./benchmark-chart.scss";

// Nest + Node is the one solid bar, in the primary color. The other two are patterned, so the
// highlight doesn't depend on telling colors apart.
const config = {
  express: { label: ADAPTER_LABELS.express, color: "var(--color-chart-5)", pattern: "diagonal" },
  fastify: { label: ADAPTER_LABELS.fastify, color: "var(--color-chart-6)", pattern: "dots" },
  node: { label: ADAPTER_LABELS.node, color: "var(--color-primary)", pattern: "solid" },
} satisfies ChartConfig;

const BAR_RADIUS: [number, number, number, number] = [0, 4, 4, 0];
const MAX_BAR_THICKNESS = 24;
const LABEL_AXIS = "labels";

type BenchmarkChartProps = {
  rows: readonly ChartRow[];
  unit: Unit;
  /** The end of the value axis. Fixed from outside, so live bars grow instead of rescaling. */
  max: number;
  title: string;
};

export function BenchmarkChart({ rows, unit, max, title }: BenchmarkChartProps) {
  const format = unit === "rps" ? formatRps : formatMultiple;
  const formatLabel = unit === "rps" ? formatRpsShort : formatMultiple;

  return (
    <ChartContainer
      className={`benchmark-chart${rows.length === 1 ? " benchmark-chart--single" : ""}`}
      config={config}
      aria-label={title}
      patterns
      formatValue={(value) => (typeof value === "number" ? format(value) : "Not measured")}
      table={<ChartTable data={[...rows]} category="route" categoryLabel="Route" caption={title} />}
    >
      <BarChart data={[...rows]} layout="vertical" barGap={2} margin={{ right: 56 }}>
        <XAxis type="number" hide domain={[0, max || 1]} />
        <YAxis type="category" dataKey="route" tickLine={false} axisLine={false} width={112} />
        <ChartTooltip />
        <ChartLegend />
        {ADAPTERS.map((adapter) => (
          <Bar
            key={adapter}
            dataKey={adapter}
            fill={chartFill(adapter)}
            radius={BAR_RADIUS}
            maxBarSize={MAX_BAR_THICKNESS}
            animationDuration={800}
            animationEasing="linear"
          />
        ))}
        {/* Recharts hides a bar's labels while it animates, and a live run restarts that animation
            every second. So the labels come from invisible bars on their own axis, laid out the
            same way, that never animate. */}
        <YAxis yAxisId={LABEL_AXIS} type="category" dataKey="route" hide />
        {ADAPTERS.map((adapter) => (
          <Bar
            key={adapter}
            yAxisId={LABEL_AXIS}
            dataKey={adapter}
            fill="none"
            maxBarSize={MAX_BAR_THICKNESS}
            legendType="none"
            tooltipType="none"
            isAnimationActive={false}
          >
            <LabelList
              dataKey={adapter}
              position="right"
              offset={8}
              formatter={(value) => (typeof value === "number" ? formatLabel(value) : "")}
            />
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}
