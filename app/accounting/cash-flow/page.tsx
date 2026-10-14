"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Waves,
  RefreshCw,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Landmark,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { formatDateToIso } from "@/lib/dates";
import {
  getCashFlowStatement,
  formatPen,
  formatCutOffDate,
  type CashFlowStatementResult,
} from "@/lib/services/cash-flow-statement.service";

function todayIso(): string {
  const now = new Date();
  return formatDateToIso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );
}

function startOfYearIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function startOfMonthIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}-01`;
}

export default function CashFlowStatementPage() {
  const [desde, setDesde] = useState<string>(startOfYearIso);
  const [hasta, setHasta] = useState<string>(todayIso);
  const [statement, setStatement] = useState<CashFlowStatementResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (start: string, end: string) => {
    if (!start || !end || start > end) {
      setError("Rango de fechas inválido: 'Desde' no puede ser posterior a 'Hasta'.");
      setStatement(null);
      setLoading(false);
      return;
    }
    const req = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getCashFlowStatement({ desde: start, hasta: end });
      if (req !== requestRef.current) return;
      setStatement(data);
    } catch (e) {
      if (req !== requestRef.current) return;
      setStatement(null);
      setError(
        e instanceof Error ? e.message : "No se pudo generar el Estado de Flujos de Efectivo."
      );
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(desde, hasta);
    }, 0);
    return () => clearTimeout(timer);
  }, [desde, hasta, load]);

  const handleExportCsv = () => {
    if (!statement) return;
    const lines: string[] = [];
    lines.push("ESTADO DE FLUJOS DE EFECTIVO (NIC 7 / MÉTODO INDIRECTO)");
    lines.push(`Período: ${formatCutOffDate(statement.period.startDate)} al ${formatCutOffDate(statement.period.endDate)}`);
    lines.push(`Moneda: ${statement.currency}`);
    lines.push("");

    lines.push("CONCEPTO,IMPORTE (PEN)");
    lines.push("1. ACTIVIDADES DE OPERACIÓN,");
    lines.push(`"  Utilidad Neta del Ejercicio",${statement.operating_activities.net_profit.toFixed(2)}`);
    lines.push(`"  Ajuste: Depreciación",${statement.operating_activities.adjustments_non_cash.depreciation.toFixed(2)}`);
    lines.push(`"  Ajuste: Dif. Cambio no realizada",${statement.operating_activities.adjustments_non_cash.unrealized_exchange_difference.toFixed(2)}`);
    lines.push(`"  Variación en Cuentas por Cobrar",${statement.operating_activities.working_capital_changes.accounts_receivable.toFixed(2)}`);
    lines.push(`"  Variación en Inventarios",${statement.operating_activities.working_capital_changes.inventories.toFixed(2)}`);
    lines.push(`"  Variación en Cuentas por Pagar",${statement.operating_activities.working_capital_changes.accounts_payable.toFixed(2)}`);
    lines.push(`"  Variación en Remuneraciones por Pagar",${statement.operating_activities.working_capital_changes.payroll_payable.toFixed(2)}`);
    lines.push(`"  Variación en Tributos por Pagar",${statement.operating_activities.working_capital_changes.taxes_payable.toFixed(2)}`);
    lines.push(`"Flujo Neto de Actividades de Operación",${statement.operating_activities.net_cash_operating.toFixed(2)}`);
    lines.push("");

    lines.push("2. ACTIVIDADES DE INVERSIÓN,");
    lines.push(`"  Compras de Propiedad Planta y Equipo",${statement.investing_activities.property_plant_equipment_purchases.toFixed(2)}`);
    lines.push(`"  Ventas de Activos",${statement.investing_activities.asset_sales.toFixed(2)}`);
    lines.push(`"Flujo Neto de Actividades de Inversión",${statement.investing_activities.net_cash_investing.toFixed(2)}`);
    lines.push("");

    lines.push("3. ACTIVIDADES DE FINANCIAMIENTO,");
    lines.push(`"  Aportes de Capital",${statement.financing_activities.capital_contributions.toFixed(2)}`);
    lines.push(`"  Obligaciones Financieras",${statement.financing_activities.financial_obligations.toFixed(2)}`);
    lines.push(`"  Dividendos Pagados",${statement.financing_activities.dividends_paid.toFixed(2)}`);
    lines.push(`"Flujo Neto de Actividades de Financiamiento",${statement.financing_activities.net_cash_financing.toFixed(2)}`);
    lines.push("");

    lines.push(`"AUMENTO (DISMINUCIÓN) NETO DE EFECTIVO",${statement.net_cash_increase.toFixed(2)}`);
    lines.push(`"Saldo de Efectivo al Inicio del Período",${statement.cash_at_beginning.toFixed(2)}`);
    lines.push(`"Saldo de Efectivo al Cierre del Período",${statement.cash_at_end.toFixed(2)}`);

    const csv = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(lines.join("\n"));
    const link = document.createElement("a");
    link.href = csv;
    link.download = `flujo_efectivo_${statement.period.startDate}_${statement.period.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <ModuleHeader
        title="Flujo de Efectivo"
        subtitle="Estado de Flujos de Efectivo por Método Indirecto conforme a la NIC 7 y PCGE 2019."
        icon={Waves}
        iconClassName="bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground"
      >
        <span className="bg-card border border-border px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground shadow-2xs">
          Rango: {formatCutOffDate(desde)} — {formatCutOffDate(hasta)}
        </span>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-5 md:p-6">
        <div className="flex flex-col w-full gap-5 max-w-6xl mx-auto">
          {/* Barra de Filtros */}
          <Card className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 shadow-2xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-muted-foreground">Desde:</span>
                  <input
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
                  />
                  <span className="text-muted-foreground">—</span>
                  <span className="font-medium text-muted-foreground">Hasta:</span>
                  <input
                    type="date"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
                  />
                </div>
              </div>

              {/* Atajos */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs rounded-lg"
                  onClick={() => {
                    setDesde(startOfMonthIso());
                    setHasta(todayIso());
                  }}
                >
                  Este mes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs rounded-lg"
                  onClick={() => {
                    setDesde(startOfYearIso());
                    setHasta(todayIso());
                  }}
                >
                  Año actual (YTD)
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() => void load(desde, hasta)}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                <span className="hidden sm:inline text-xs">Actualizar</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {statement && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleExportCsv}
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Exportar CSV</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
            </div>
          </Card>

          {/* Tarjetas Resumen de Efectivo */}
          {statement && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Saldo Inicial de Efectivo
                </span>
                <span className="text-xl font-extrabold text-foreground mt-1">
                  {formatPen(statement.cash_at_beginning)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Al {formatCutOffDate(statement.period.startDate)}
                </span>
              </Card>

              <Card className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Flujo Neto Operativo
                </span>
                <span
                  className={`text-xl font-extrabold mt-1 ${
                    statement.operating_activities.net_cash_operating >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600"
                  }`}
                >
                  {formatPen(statement.operating_activities.net_cash_operating)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Generado por el giro del negocio
                </span>
              </Card>

              <Card className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Variación Neta de Efectivo
                </span>
                <span
                  className={`text-xl font-extrabold mt-1 ${
                    statement.net_cash_increase >= 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-rose-600"
                  }`}
                >
                  {formatPen(statement.net_cash_increase)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Op. + Inv. + Fin.
                </span>
              </Card>

              <Card className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Saldo Final de Efectivo
                </span>
                <span
                  className={`text-xl font-extrabold mt-1 ${
                    statement.cash_at_end >= 0 ? "text-foreground" : "text-rose-600"
                  }`}
                >
                  {formatPen(statement.cash_at_end)}
                </span>
                <div className="flex items-center gap-1 mt-1">
                  {statement.is_reconciled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                      <CheckCircle2 className="h-3 w-3" /> Conciliado con Cta. 10
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                      <AlertTriangle className="h-3 w-3" /> Dif: {formatPen(statement.reconciliation_difference)}
                    </span>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Estado de Error */}
          {error && (
            <Card className="p-6 bg-destructive/5 border border-destructive/20 rounded-2xl text-center flex flex-col items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-semibold text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void load(desde, hasta)}>
                Reintentar
              </Button>
            </Card>
          )}

          {/* Tabla Oficial de Flujos de Efectivo */}
          {statement && !error && (
            <Card className="bg-card border border-border rounded-2xl p-5 sm:p-7 shadow-xs flex flex-col gap-5 print:shadow-none print:border-0">
              <header className="border-b border-border/70 pb-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                  Reporte Financiero Oficial
                </p>
                <h2 className="text-lg font-bold text-foreground mt-0.5">
                  ESTADO DE FLUJOS DE EFECTIVO (MÉTODO INDIRECTO)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Del {formatCutOffDate(statement.period.startDate)} al {formatCutOffDate(statement.period.endDate)} • Moneda: Nuevos Soles (PEN)
                </p>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-border/40">
                    {/* 1. ACTIVIDADES DE OPERACIÓN */}
                    <tr className="bg-muted/40 font-bold">
                      <td colSpan={2} className="py-2.5 px-3 text-foreground text-xs uppercase tracking-wide">
                        1. ACTIVIDADES DE OPERACIÓN
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-6 pr-4 text-foreground font-medium">
                        Utilidad (Pérdida) Neta del Ejercicio
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                        {formatPen(statement.operating_activities.net_profit)}
                      </td>
                    </tr>

                    {/* Ajustes no monetarios */}
                    <tr className="text-muted-foreground italic font-semibold">
                      <td colSpan={2} className="py-1.5 pl-6 pr-4 text-[11px]">
                        Ajustes por partidas que no afectan el efectivo:
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pl-10 pr-4 text-muted-foreground">
                        Depreciación y amortización del período (PCGE 68)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.operating_activities.adjustments_non_cash.depreciation)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pl-10 pr-4 text-muted-foreground">
                        Diferencia de cambio no realizada
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.operating_activities.adjustments_non_cash.unrealized_exchange_difference)}
                      </td>
                    </tr>

                    {/* Cambios en capital de trabajo */}
                    <tr className="text-muted-foreground italic font-semibold">
                      <td colSpan={2} className="py-1.5 pl-6 pr-4 text-[11px]">
                        Cambios netos en activos y pasivos operativos (Capital de Trabajo):
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pl-10 pr-4 text-muted-foreground">
                        (Aumento) Disminución en Cuentas por Cobrar Comerciales (Cta. 12)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.operating_activities.working_capital_changes.accounts_receivable)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pl-10 pr-4 text-muted-foreground">
                        (Aumento) Disminución en Inventarios / Existencias (Ctas. 20/24/25)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.operating_activities.working_capital_changes.inventories)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pl-10 pr-4 text-muted-foreground">
                        Aumento (Disminución) en Cuentas por Pagar Comerciales (Cta. 42)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.operating_activities.working_capital_changes.accounts_payable)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pl-10 pr-4 text-muted-foreground">
                        Aumento (Disminución) en Remuneraciones y Participaciones por Pagar (Cta. 41)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.operating_activities.working_capital_changes.payroll_payable)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pl-10 pr-4 text-muted-foreground">
                        Aumento (Disminución) en Tributos por Pagar (Cta. 40)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.operating_activities.working_capital_changes.taxes_payable)}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-border/80 bg-muted/20 font-bold">
                      <td className="py-2.5 pl-6 pr-4 text-foreground">
                        Flujo Neto de Actividades de Operación
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatPen(statement.operating_activities.net_cash_operating)}
                      </td>
                    </tr>

                    {/* 2. ACTIVIDADES DE INVERSIÓN */}
                    <tr className="bg-muted/40 font-bold">
                      <td colSpan={2} className="py-2.5 px-3 text-foreground text-xs uppercase tracking-wide">
                        2. ACTIVIDADES DE INVERSIÓN
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-6 pr-4 text-muted-foreground">
                        Pagos por compra de propiedad, planta y equipo (Cta. 33)
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.investing_activities.property_plant_equipment_purchases)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-6 pr-4 text-muted-foreground">
                        Cobranzas por venta de activos fijos
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.investing_activities.asset_sales)}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-border/80 bg-muted/20 font-bold">
                      <td className="py-2.5 pl-6 pr-4 text-foreground">
                        Flujo Neto de Actividades de Inversión
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatPen(statement.investing_activities.net_cash_investing)}
                      </td>
                    </tr>

                    {/* 3. ACTIVIDADES DE FINANCIAMIENTO */}
                    <tr className="bg-muted/40 font-bold">
                      <td colSpan={2} className="py-2.5 px-3 text-foreground text-xs uppercase tracking-wide">
                        3. ACTIVIDADES DE FINANCIAMIENTO
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-6 pr-4 text-muted-foreground">
                        Aportes de capital en efectivo (Cta. 50/52)
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.financing_activities.capital_contributions)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-6 pr-4 text-muted-foreground">
                        Obtención (Amortización) neta de préstamos y obligaciones financieras (Cta. 45)
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.financing_activities.financial_obligations)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-6 pr-4 text-muted-foreground">
                        Dividendos y participaciones pagados a socios (Cta. 407/44)
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatPen(statement.financing_activities.dividends_paid)}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-border/80 bg-muted/20 font-bold">
                      <td className="py-2.5 pl-6 pr-4 text-foreground">
                        Flujo Neto de Actividades de Financiamiento
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatPen(statement.financing_activities.net_cash_financing)}
                      </td>
                    </tr>

                    {/* CONCILIACIÓN FINAL DE EFECTIVO */}
                    <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                      <td className="py-3 pl-4 pr-4 text-primary text-sm uppercase">
                        AUMENTO (DISMINUCIÓN) NETO DE EFECTIVO Y EQUIVALENTES
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-primary text-sm">
                        {formatPen(statement.net_cash_increase)}
                      </td>
                    </tr>
                    <tr className="bg-muted/10 font-semibold">
                      <td className="py-2 pl-6 pr-4 text-foreground">
                        Saldo de efectivo al inicio del período (Cuentas 101/104)
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {formatPen(statement.cash_at_beginning)}
                      </td>
                    </tr>
                    <tr className="bg-muted/20 font-extrabold border-b-2 border-border">
                      <td className="py-2.5 pl-6 pr-4 text-foreground text-xs uppercase">
                        SALDO DE EFECTIVO AL FINAL DEL PERÍODO
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-foreground text-xs">
                        {formatPen(statement.cash_at_end)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <footer className="pt-2 text-center text-[11px] text-muted-foreground">
                Documento contable oficial generado automáticamente conforme al marco PCGE 2019 y Norma Internacional de Contabilidad (NIC 7).
              </footer>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
