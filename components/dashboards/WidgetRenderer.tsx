"use client";

import React from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Badge } from "@/components/ui/badge";

export interface WidgetData {
  id: string;
  title: string;
  type: string; // "kpi" | "bar" | "line" | "table"
  metricKey: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: any;
}

// Datos de demostración enriquecidos y contextualmente relevantes (Pollería / Restaurante)
const SAMPLE_BAR_DATA = [
  { name: "1/4 Pollo", ventas: 142 },
  { name: "1/2 Pollo", ventas: 98 },
  { name: "1 Pollo Ent.", ventas: 215 },
  { name: "Papas Fritas", ventas: 180 },
  { name: "Inca Kola 1.5L", ventas: 124 },
  { name: "Chicha Morada", ventas: 89 },
];

const SAMPLE_LINE_DATA = [
  { hora: "12:00", ingresos: 480 },
  { hora: "13:00", ingresos: 1250 },
  { hora: "14:00", ingresos: 1680 },
  { hora: "15:00", ingresos: 920 },
  { hora: "18:00", ingresos: 650 },
  { hora: "19:00", ingresos: 1420 },
  { hora: "20:00", ingresos: 2150 },
  { hora: "21:00", ingresos: 1890 },
  { hora: "22:00", ingresos: 840 },
];

const SAMPLE_TABLE_DATA = [
  { id: "#PED-1082", mesa: "Mesa 04", mozo: "Carlos M.", total: "S/ 84.50", estado: "Entregado" },
  { id: "#PED-1083", mesa: "Mesa 12", mozo: "Ana R.", total: "S/ 142.00", estado: "En Cocina" },
  { id: "#PED-1084", mesa: "Delivery", mozo: "App Web", total: "S/ 68.00", estado: "En Ruta" },
  { id: "#PED-1085", mesa: "Mesa 01", mozo: "Carlos M.", total: "S/ 115.50", estado: "Pendiente" },
  { id: "#PED-1086", mesa: "Mesa 08", mozo: "Luis P.", total: "S/ 52.00", estado: "Entregado" },
];

export function WidgetRenderer({ widget }: { widget: WidgetData }) {
  const { type, metricKey } = widget;

  // 1. KPI Widget
  if (type === "kpi") {
    let value = "S/ 14,850.00";
    let change = "+14.2%";
    let isPositive = true;
    let subtitle = "vs período anterior";
    let Icon = DollarSign;

    if (metricKey === "orders_count") {
      value = "248";
      change = "+8.5%";
      subtitle = "pedidos hoy";
      Icon = ShoppingBag;
    } else if (metricKey === "avg_ticket") {
      value = "S/ 59.80";
      change = "+3.4%";
      subtitle = "promedio por comanda";
      Icon = TrendingUp;
    } else if (metricKey === "active_tables") {
      value = "18 / 24";
      change = "75% ocup.";
      subtitle = "mesas activas ahora";
      Icon = UtensilsCrossed;
    } else if (metricKey === "avg_time") {
      value = "22 min";
      change = "-4 min";
      subtitle = "tiempo promedio preparación";
      Icon = Clock;
    }

    return (
      <div className="flex flex-col justify-between h-full p-4 select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground line-clamp-1">
            {widget.title}
          </span>
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="size-4" />
          </div>
        </div>

        <div className="my-auto py-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 font-semibold text-[11px] px-1.5 py-0.2 rounded ${
              isPositive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {change}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span>
        </div>
      </div>
    );
  }

  // 2. Gráfico de Barras
  if (type === "bar") {
    return (
      <div className="flex flex-col h-full p-3 pt-1 select-none">
        <div className="text-xs font-semibold text-foreground mb-2 px-1">
          {widget.title}
        </div>
        <div className="flex-1 w-full min-h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SAMPLE_BAR_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} stroke="#888888" />
              <YAxis tick={{ fontSize: 10 }} stroke="#888888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="ventas" fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 3. Gráfico de Líneas
  if (type === "line") {
    return (
      <div className="flex flex-col h-full p-3 pt-1 select-none">
        <div className="text-xs font-semibold text-foreground mb-2 px-1">
          {widget.title}
        </div>
        <div className="flex-1 w-full min-h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SAMPLE_LINE_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="hora" tick={{ fontSize: 10 }} stroke="#888888" />
              <YAxis tick={{ fontSize: 10 }} stroke="#888888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="ingresos"
                stroke="#e11d48"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${widget.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 4. Tabla de Datos
  if (type === "table") {
    return (
      <div className="flex flex-col h-full p-3 pt-1 select-none overflow-hidden">
        <div className="text-xs font-semibold text-foreground mb-2 px-1">
          {widget.title}
        </div>
        <div className="flex-1 overflow-auto rounded border border-border/60">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[9px] tracking-wider sticky top-0">
              <tr>
                <th className="py-1.5 px-2 font-medium">Pedido</th>
                <th className="py-1.5 px-2 font-medium">Ubicación</th>
                <th className="py-1.5 px-2 font-medium">Total</th>
                <th className="py-1.5 px-2 font-medium text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {SAMPLE_TABLE_DATA.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="py-1.5 px-2 font-mono text-muted-foreground font-medium">
                    {row.id}
                  </td>
                  <td className="py-1.5 px-2 text-foreground font-medium">{row.mesa}</td>
                  <td className="py-1.5 px-2 text-foreground font-semibold tabular-nums">
                    {row.total}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 ${
                        row.estado === "Entregado"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : row.estado === "En Cocina"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {row.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center h-full p-4 text-xs text-muted-foreground">
      Widget tipo: {type} ({widget.title})
    </div>
  );
}
