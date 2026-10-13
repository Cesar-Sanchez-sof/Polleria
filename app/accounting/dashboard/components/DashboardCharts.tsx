"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPen } from "@/lib/services/dashboard.service";
import type {
  ExpenseCategory,
  MonthlyPoint,
  TopAccount,
} from "@/lib/services/dashboard.service";

const trendConfig = {
  ingresos: { label: "Ingresos", color: "#059669" },
  gastos: { label: "Gastos", color: "#dc2626" },
} satisfies ChartConfig;

const utilityConfig = {
  utilidad: { label: "Utilidad neta", color: "#2563eb" },
} satisfies ChartConfig;

const breakdownConfig = {
  amount: { label: "Monto" },
} satisfies ChartConfig;

const topConfig = {
  amount: { label: "Monto movido", color: "#7c3aed" },
} satisfies ChartConfig;

function ChartCard({
  title,
  description,
  empty,
  children,
}: Readonly<{
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
}>) {
  return (
    <Card className="bg-white rounded-xl shadow-sm ring-0 p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      {empty ? (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-200">
          <p className="text-xs text-slate-400">Sin movimientos en el periodo</p>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

interface DashboardChartsProps {
  monthlySeries: MonthlyPoint[];
  expenseBreakdown: ExpenseCategory[];
  topAccounts: TopAccount[];
  loading: boolean;
}

/** Los 4 gráficos del dashboard (US2, FR-003 a FR-006, FR-010) con Recharts. */
export function DashboardCharts({
  monthlySeries,
  expenseBreakdown,
  topAccounts,
  loading,
}: Readonly<DashboardChartsProps>) {
  const seriesEmpty =
    monthlySeries.length === 0 ||
    monthlySeries.every((p) => p.ingresos === 0 && p.gastos === 0);
  const breakdownEmpty = expenseBreakdown.length === 0;
  const topEmpty = topAccounts.length === 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl border bg-white shadow-sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Tendencia: ingresos vs gastos (FR-003) */}
      <ChartCard
        title="Ingresos vs. gastos"
        description="Tendencia mensual del período seleccionado"
        empty={seriesEmpty}
      >
        <ChartContainer config={trendConfig} className="aspect-video w-full">
          <BarChart data={monthlySeries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => formatPen(v)} width={90} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatPen(Number(v))} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {/* Utilidad neta mensual (FR-004) */}
      <ChartCard
        title="Utilidad neta mensual"
        description="Ingresos menos gastos de cada mes"
        empty={seriesEmpty}
      >
        <ChartContainer config={utilityConfig} className="aspect-video w-full">
          <LineChart data={monthlySeries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => formatPen(v)} width={90} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatPen(Number(v))} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="utilidad"
              stroke="var(--color-utilidad)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      {/* Distribución de gastos por categoría (FR-005) */}
      <ChartCard
        title="Distribución de gastos"
        description="Proporción por categoría de cuenta contable"
        empty={breakdownEmpty}
      >
        <ChartContainer config={breakdownConfig} className="aspect-video w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, name) => [
                    formatPen(Number(v)),
                    String(name),
                  ]}
                />
              }
            />
            <Pie
              data={expenseBreakdown}
              dataKey="amount"
              nameKey="category"
              innerRadius="55%"
              outerRadius="80%"
            >
              {expenseBreakdown.map((_, index) => (
                <Cell
                  key={index}
                  fill={
                    [
                      "#dc2626",
                      "#2563eb",
                      "#059669",
                      "#d97706",
                      "#7c3aed",
                      "#0891b2",
                      "#be185d",
                      "#4d7c0f",
                      "#64748b",
                    ][index % 9]
                  }
                />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      </ChartCard>

      {/* Cuentas con mayor movimiento (FR-006) */}
      <ChartCard
        title="Cuentas con mayor movimiento"
        description="Principales cuentas por monto movido en el período"
        empty={topEmpty}
      >
        <ChartContainer config={topConfig} className="aspect-video w-full">
          <BarChart data={topAccounts} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => formatPen(v)} />
            <YAxis
              type="category"
              dataKey="code"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={52}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v, _name, item) => {
                const account = item?.payload as TopAccount | undefined;
                return [formatPen(Number(v)), account?.name ?? "Monto movido"];
              }} />}
            />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
