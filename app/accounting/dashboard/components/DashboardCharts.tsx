"use client";

import { useState, useMemo } from "react";
import {
  Area,
  AreaChart,
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
  ComposedChart,
} from "recharts";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Table as TableIcon,
  Layers,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Landmark,
  ShieldAlert,
  Coins,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ingresos: { label: "Ingresos", color: "#10b981" },
  gastos: { label: "Gastos", color: "#f43f5e" },
  utilidad: { label: "Utilidad Neta", color: "#3b82f6" },
} satisfies ChartConfig;

const breakdownConfig = {
  amount: { label: "Monto" },
} satisfies ChartConfig;

const topConfig = {
  amount: { label: "Monto movido", color: "#8b5cf6" },
} satisfies ChartConfig;

const PIE_PALETTE = [
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#64748b", // Slate
  "#6366f1", // Indigo
];

function getAccountTypeBadge(code: string): { label: string; color: string } {
  const first = code.charAt(0);
  switch (first) {
    case "1":
    case "2":
    case "3":
      return { label: "Activo", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" };
    case "4":
      return { label: "Pasivo", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20" };
    case "5":
      return { label: "Patrimonio", color: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20" };
    case "6":
      return { label: "Gasto", color: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" };
    case "7":
      return { label: "Ingreso", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" };
    default:
      return { label: "Cuenta", color: "bg-muted text-muted-foreground border-border" };
  }
}

interface DashboardChartsProps {
  monthlySeries: MonthlyPoint[];
  expenseBreakdown: ExpenseCategory[];
  topAccounts: TopAccount[];
  loading: boolean;
}

export function DashboardCharts({
  monthlySeries,
  expenseBreakdown,
  topAccounts,
  loading,
}: Readonly<DashboardChartsProps>) {
  const [activeTab, setActiveTab] = useState<"trend" | "expenses" | "accounts" | "table">("trend");
  const [chartMode, setChartMode] = useState<"combo" | "bars" | "areas">("combo");

  const seriesEmpty =
    monthlySeries.length === 0 ||
    monthlySeries.every((p) => p.ingresos === 0 && p.gastos === 0);
  const breakdownEmpty = expenseBreakdown.length === 0;
  const topEmpty = topAccounts.length === 0;

  // Cálculos estadísticos rápidos de la serie
  const stats = useMemo(() => {
    if (seriesEmpty) return null;
    const totalIngresos = monthlySeries.reduce((acc, p) => acc + p.ingresos, 0);
    const totalGastos = monthlySeries.reduce((acc, p) => acc + p.gastos, 0);
    const totalUtilidad = monthlySeries.reduce((acc, p) => acc + p.utilidad, 0);
    const avgIngresos = totalIngresos / monthlySeries.length;
    const avgGastos = totalGastos / monthlySeries.length;
    const avgMargin = totalIngresos > 0 ? (totalUtilidad / totalIngresos) * 100 : 0;

    return {
      totalIngresos,
      totalGastos,
      totalUtilidad,
      avgIngresos,
      avgGastos,
      avgMargin,
    };
  }, [monthlySeries, seriesEmpty]);

  const totalExpenses = useMemo(
    () => expenseBreakdown.reduce((acc, e) => acc + e.amount, 0),
    [expenseBreakdown]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl border border-border/60 bg-card shadow-xs" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Selector de pestañas analíticas superiores */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl">
          <Button
            type="button"
            variant={activeTab === "trend" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 rounded-lg shadow-2xs"
            onClick={() => setActiveTab("trend")}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Tendencia & P&L</span>
          </Button>
          <Button
            type="button"
            variant={activeTab === "expenses" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 rounded-lg shadow-2xs"
            onClick={() => setActiveTab("expenses")}
          >
            <PieChartIcon className="h-3.5 w-3.5" />
            <span>Estructura de Gastos ({expenseBreakdown.length})</span>
          </Button>
          <Button
            type="button"
            variant={activeTab === "accounts" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 rounded-lg shadow-2xs"
            onClick={() => setActiveTab("accounts")}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Top Cuentas ({topAccounts.length})</span>
          </Button>
          <Button
            type="button"
            variant={activeTab === "table" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 rounded-lg shadow-2xs"
            onClick={() => setActiveTab("table")}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span>Tabla Mensual</span>
          </Button>
        </div>

        {activeTab === "trend" && !seriesEmpty && (
          <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5 shadow-2xs">
            <Button
              type="button"
              variant={chartMode === "combo" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px] px-2 font-medium"
              onClick={() => setChartMode("combo")}
            >
              Barras + Utilidad
            </Button>
            <Button
              type="button"
              variant={chartMode === "bars" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px] px-2 font-medium"
              onClick={() => setChartMode("bars")}
            >
              Barras P&L
            </Button>
            <Button
              type="button"
              variant={chartMode === "areas" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px] px-2 font-medium"
              onClick={() => setChartMode("areas")}
            >
              Curvas de Área
            </Button>
          </div>
        )}
      </div>

      {/* Contenido según la pestaña activa */}

      {/* PESTAÑA 1: TENDENCIA & P&L */}
      {activeTab === "trend" && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 sm:p-6 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Evolución Mensual de Ingresos, Gastos y Utilidad Neta
                </h3>
                <p className="text-xs text-muted-foreground">
                  Comportamiento histórico y balance del período (montos expresados en PEN)
                </p>
              </div>

              {stats && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/20">
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Prom. Ingresos:</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {formatPen(stats.avgIngresos)}/mes
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-1.5 border border-blue-500/20">
                    <span className="text-[11px] text-blue-800 dark:text-blue-300 font-medium">Margen Promedio:</span>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                      {stats.avgMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {seriesEmpty ? (
              <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Sin movimientos contables registrados en los meses del período</p>
              </div>
            ) : (
              <ChartContainer config={trendConfig} className="h-80 w-full aspect-auto">
                {chartMode === "combo" ? (
                  <ComposedChart data={monthlySeries} margin={{ top: 12, right: 12, left: 12, bottom: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatPen(v)}
                      width={85}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v, name) => [
                            formatPen(Number(v)),
                            name === "ingresos" ? "Ingresos" : name === "gastos" ? "Gastos" : "Utilidad Neta",
                          ]}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line
                      type="monotone"
                      dataKey="utilidad"
                      stroke="var(--color-utilidad)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "var(--color-utilidad)" }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                ) : chartMode === "bars" ? (
                  <BarChart data={monthlySeries} margin={{ top: 12, right: 12, left: 12, bottom: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatPen(v)}
                      width={85}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v, name) => [
                            formatPen(Number(v)),
                            name === "ingresos" ? "Ingresos" : "Gastos",
                          ]}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[4, 4, 0, 0]} maxBarSize={45} />
                    <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} maxBarSize={45} />
                  </BarChart>
                ) : (
                  <AreaChart data={monthlySeries} margin={{ top: 12, right: 12, left: 12, bottom: 4 }}>
                    <defs>
                      <linearGradient id="fillIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="fillGastos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatPen(v)}
                      width={85}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v, name) => [
                            formatPen(Number(v)),
                            name === "ingresos" ? "Ingresos" : "Gastos",
                          ]}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="ingresos"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#fillIngresos)"
                    />
                    <Area
                      type="monotone"
                      dataKey="gastos"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#fillGastos)"
                    />
                  </AreaChart>
                )}
              </ChartContainer>
            )}
          </Card>

          {/* Gráfico secundario: Utilidad Neta sola en detalle */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-4 sm:p-5 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col gap-3">
              <div>
                <h4 className="text-sm font-bold text-foreground">Curva de Utilidad Neta Mensual</h4>
                <p className="text-xs text-muted-foreground">
                  Valores positivos indican superávit operativo del mes
                </p>
              </div>

              {seriesEmpty ? (
                <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Sin datos</p>
                </div>
              ) : (
                <ChartContainer config={trendConfig} className="h-56 w-full aspect-auto">
                  <LineChart data={monthlySeries} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatPen(v)}
                      width={80}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v) => [formatPen(Number(v)), "Utilidad Neta"]}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="utilidad"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#3b82f6" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </Card>

            {/* Resumen de indicadores del período */}
            <Card className="p-4 sm:p-5 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-foreground">Desempeño y Cumplimiento</h4>
                <p className="text-xs text-muted-foreground">
                  Análisis consolidado del flujo neto durante los {monthlySeries.length} meses evaluados
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Ingresos</span>
                  <p className="text-base font-extrabold text-foreground mt-0.5">
                    {formatPen(stats?.totalIngresos ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Gastos</span>
                  <p className="text-base font-extrabold text-foreground mt-0.5">
                    {formatPen(stats?.totalGastos ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Resultado Acumulado</span>
                  <p className={`text-base font-extrabold mt-0.5 ${(stats?.totalUtilidad ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                    {formatPen(stats?.totalUtilidad ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Margen Operativo</span>
                  <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                    {(stats?.avgMargin ?? 0).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">
                <Coins className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Los datos corresponden a asientos aprobados y conciliados en el Libro Diario contable.
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: ESTRUCTURA DE GASTOS */}
      {activeTab === "expenses" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Gráfico Donut */}
          <Card className="lg:col-span-5 p-4 sm:p-6 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col items-center justify-between gap-4">
            <div className="w-full text-left">
              <h3 className="text-base font-bold text-foreground">Distribución por Categoría PCGE</h3>
              <p className="text-xs text-muted-foreground">
                Total registrado en el rango: <span className="font-bold text-foreground">{formatPen(totalExpenses)}</span>
              </p>
            </div>

            {breakdownEmpty ? (
              <div className="flex h-64 w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Sin gastos registrados</p>
              </div>
            ) : (
              <div className="relative flex items-center justify-center w-full my-auto">
                <ChartContainer config={breakdownConfig} className="h-64 w-full aspect-square">
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
                      innerRadius="60%"
                      outerRadius="85%"
                      paddingAngle={3}
                    >
                      {expenseBreakdown.map((_, index) => (
                        <Cell
                          key={index}
                          fill={PIE_PALETTE[index % PIE_PALETTE.length]}
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                {/* Centro del donut con total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Gastos Totales
                  </span>
                  <span className="text-lg font-black text-foreground">
                    {formatPen(totalExpenses)}
                  </span>
                </div>
              </div>
            )}

            <div className="w-full text-center">
              <span className="text-[11px] text-muted-foreground">
                Agrupado según las cuentas elementales del Plan Contable General Empresarial
              </span>
            </div>
          </Card>

          {/* Lista detallada con barras de porcentaje */}
          <Card className="lg:col-span-7 p-4 sm:p-6 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Desglose y Participación de Gastos</h3>
              <p className="text-xs text-muted-foreground">
                Ranking de rubros ordenados por magnitud presupuestaria
              </p>
            </div>

            {breakdownEmpty ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Sin movimientos de gasto</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 divide-y divide-border/50">
                {expenseBreakdown.map((item, idx) => {
                  const color = PIE_PALETTE[idx % PIE_PALETTE.length];
                  return (
                    <div key={item.category} className="pt-3 first:pt-0 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-semibold text-foreground">
                            {item.category}
                          </span>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                            Cta. {item.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-foreground">
                            {formatPen(item.amount)}
                          </span>
                          <span className="w-12 text-right font-bold text-primary">
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, item.percent)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PESTAÑA 3: TOP CUENTAS DE MAYOR MOVIMIENTO */}
      {activeTab === "accounts" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Gráfico de barras horizontales */}
          <Card className="lg:col-span-6 p-4 sm:p-6 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Cuentas con Mayor Volumen Operativo</h3>
              <p className="text-xs text-muted-foreground">
                Top cuentas ordenadas por monto movido total (Débitos + Créditos)
              </p>
            </div>

            {topEmpty ? (
              <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Sin movimientos de cuentas en el período</p>
              </div>
            ) : (
              <ChartContainer config={topConfig} className="h-80 w-full aspect-auto">
                <BarChart data={topAccounts} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.4} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatPen(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="code"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    width={56}
                    className="font-mono text-xs font-bold"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v, _name, item) => {
                          const account = item?.payload as TopAccount | undefined;
                          return [formatPen(Number(v)), `${account?.code} - ${account?.name}`];
                        }}
                      />
                    }
                  />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 6, 6, 0]} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            )}
          </Card>

          {/* Tabla de cuentas con insignias y clasificación */}
          <Card className="lg:col-span-6 p-4 sm:p-6 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Detalle de Cuentas Principales</h3>
              <p className="text-xs text-muted-foreground">
                Clasificación PCGE y flujo acumulado en el rango seleccionado
              </p>
            </div>

            {topEmpty ? (
              <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Sin registros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/70 text-muted-foreground">
                      <th className="pb-2 text-left font-semibold">Código</th>
                      <th className="pb-2 text-left font-semibold">Nombre de Cuenta</th>
                      <th className="pb-2 text-left font-semibold">Tipo</th>
                      <th className="pb-2 text-right font-semibold">Monto Movido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {topAccounts.map((acc) => {
                      const badge = getAccountTypeBadge(acc.code);
                      return (
                        <tr key={acc.code} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 font-mono font-bold text-foreground">
                            {acc.code}
                          </td>
                          <td className="py-2.5 text-foreground font-medium max-w-[200px] truncate" title={acc.name}>
                            {acc.name}
                          </td>
                          <td className="py-2.5">
                            <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-bold text-foreground font-mono">
                            {formatPen(acc.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PESTAÑA 4: TABLA MENSUAL DETALLADA */}
      {activeTab === "table" && (
        <Card className="p-4 sm:p-6 bg-card border border-border/70 rounded-2xl shadow-xs flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Tabla Histórica Mensual</h3>
            <p className="text-xs text-muted-foreground">
              Desglose detallado de Ingresos, Gastos, Utilidad Neta y Margen por período mensual
            </p>
          </div>

          {seriesEmpty ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">Sin datos mensuales para mostrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/70 text-muted-foreground">
                    <th className="pb-2.5 text-left font-semibold">Mes</th>
                    <th className="pb-2.5 text-right font-semibold">Ingresos (PEN)</th>
                    <th className="pb-2.5 text-right font-semibold">Gastos (PEN)</th>
                    <th className="pb-2.5 text-right font-semibold">Utilidad Neta (PEN)</th>
                    <th className="pb-2.5 text-right font-semibold">Margen (%)</th>
                    <th className="pb-2.5 text-center font-semibold">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {monthlySeries.map((row) => {
                    const margin = row.ingresos > 0 ? (row.utilidad / row.ingresos) * 100 : 0;
                    const isPositive = row.utilidad >= 0;
                    return (
                      <tr key={row.month} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 font-semibold text-foreground">
                          {row.label}
                        </td>
                        <td className="py-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {formatPen(row.ingresos)}
                        </td>
                        <td className="py-3 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                          {formatPen(row.gastos)}
                        </td>
                        <td className={`py-3 text-right font-mono font-bold ${isPositive ? "text-blue-600 dark:text-blue-400" : "text-rose-600"}`}>
                          {formatPen(row.utilidad)}
                        </td>
                        <td className="py-3 text-right font-bold text-foreground">
                          {margin.toFixed(1)}%
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isPositive
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {isPositive ? "Rentable" : "Déficit"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
