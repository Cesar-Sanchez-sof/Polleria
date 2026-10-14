/**
 * Helpers y utilidades financieras para el Dashboard Contable.
 */

import { formatDateToIso, parseUtcDate } from "@/lib/dates";
import { formatPen } from "@/lib/services/dashboard.service";
import type { DashboardPayload, Kpi } from "@/lib/services/dashboard.service";

export interface FinancialHealth {
  margin: number;
  marginStatus: "excellent" | "good" | "tight" | "deficit";
  marginLabel: string;
  liquidityRatio: number;
  liquidityStatus: "healthy" | "moderate" | "risk";
  liquidityLabel: string;
  workingCapital: number;
  expenseRatio: number;
  summaryText: string;
}

export function calculateFinancialHealth(payload: DashboardPayload | null): FinancialHealth | null {
  if (!payload || payload.meta.empty) return null;

  const getVal = (key: string) => payload.kpis.find((k) => k.key === key)?.value ?? 0;
  const ingresos = getVal("ingresos");
  const gastos = getVal("gastos");
  const utilidad = getVal("utilidad");
  const caja = getVal("caja_bancos");
  const porCobrar = getVal("por_cobrar");
  const porPagar = getVal("por_pagar");

  // Margen Neto (%)
  const margin = ingresos > 0 ? (utilidad / ingresos) * 100 : utilidad < 0 ? -100 : 0;
  let marginStatus: FinancialHealth["marginStatus"] = "good";
  let marginLabel = "Margen Positivo";

  if (margin >= 25) {
    marginStatus = "excellent";
    marginLabel = "Excelente Rentabilidad (≥ 25%)";
  } else if (margin >= 10) {
    marginStatus = "good";
    marginLabel = "Rentabilidad Saludable (10% - 25%)";
  } else if (margin > 0) {
    marginStatus = "tight";
    marginLabel = "Margen Ajustado (< 10%)";
  } else {
    marginStatus = "deficit";
    marginLabel = "Déficit Operativo";
  }

  // Tratamiento de obligaciones y efectivo
  // En PCGE: Pasivo normal tiene saldo acreedor. Si porPagar <= 0, no hay deudas vigentes o hay anticipos.
  const hasDebts = porPagar > 0.01;
  const isCashNegative = caja < 0;

  let liquidityRatio = 0;
  let liquidityStatus: FinancialHealth["liquidityStatus"] = "healthy";
  let liquidityLabel = "Sin Deudas Pendientes";

  if (hasDebts) {
    liquidityRatio = caja > 0 ? caja / porPagar : 0;
    if (liquidityRatio >= 1.5) {
      liquidityStatus = "healthy";
      liquidityLabel = `Alta Cobertura (${liquidityRatio.toFixed(1)}x)`;
    } else if (liquidityRatio >= 1.0) {
      liquidityStatus = "moderate";
      liquidityLabel = `Cobertura Adecuada (${liquidityRatio.toFixed(1)}x)`;
    } else {
      liquidityStatus = "risk";
      liquidityLabel = "Atención: Obligaciones superan caja (< 1.0x)";
    }
  } else {
    liquidityStatus = isCashNegative ? "risk" : "healthy";
    liquidityLabel = isCashNegative ? "Alerta: Saldo deudor en Caja" : "Sin Deudas Comerciales";
  }

  // Capital de trabajo operativo
  const workingCapital = caja + porCobrar - porPagar;

  // Ratio de ejecución de gastos vs ingresos
  const expenseRatio = ingresos > 0 ? (gastos / ingresos) * 100 : 0;

  // Texto ejecutivo resumen
  let summaryText = "";
  if (utilidad >= 0) {
    summaryText = `El período presenta un superávit neto de ${formatPen(utilidad)} con un margen de ganancia del ${margin.toFixed(1)}%.`;
    if (isCashNegative) {
      summaryText += ` Nota: La cuenta de Caja y Bancos refleja saldo negativo (${formatPen(caja)}), revise conciliaciones.`;
    } else if (hasDebts) {
      if (liquidityRatio >= 1) {
        summaryText += ` La caja disponible cubre el ${(liquidityRatio * 100).toFixed(0)}% de los compromisos por pagar a proveedores.`;
      } else {
        summaryText += ` Sin embargo, las obligaciones inmediatas superan la disponibilidad inmediata en caja.`;
      }
    } else {
      summaryText += ` No se registran cuentas comerciales pendientes por pagar a proveedores.`;
    }
  } else {
    summaryText = `El período registra un resultado negativo de ${formatPen(utilidad)}. Se recomienda auditar la concentración de gastos y optimizar cobros.`;
    if (isCashNegative) {
      summaryText += ` Además, la cuenta de caja presenta saldo negativo (${formatPen(caja)}).`;
    }
  }

  return {
    margin,
    marginStatus,
    marginLabel,
    liquidityRatio,
    liquidityStatus,
    liquidityLabel,
    workingCapital,
    expenseRatio,
    summaryText,
  };
}

/** Preajustes rápidos de fecha */
export function getPresetRange(
  preset: "current_month" | "previous_month" | "current_quarter" | "ytd" | "last_6_months" | "last_12_months"
): { desde: string; hasta: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const todayIso = formatDateToIso(new Date(Date.UTC(year, month, now.getDate())));

  const pad = (n: number) => String(n).padStart(2, "0");

  switch (preset) {
    case "current_month": {
      const start = `${year}-${pad(month + 1)}-01`;
      return { desde: start, hasta: todayIso };
    }
    case "previous_month": {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const lastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
      return {
        desde: `${prevYear}-${pad(prevMonth + 1)}-01`,
        hasta: `${prevYear}-${pad(prevMonth + 1)}-${pad(lastDay)}`,
      };
    }
    case "current_quarter": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      return {
        desde: `${year}-${pad(quarterStartMonth + 1)}-01`,
        hasta: todayIso,
      };
    }
    case "ytd": {
      return {
        desde: `${year}-01-01`,
        hasta: todayIso,
      };
    }
    case "last_6_months": {
      const d = new Date(Date.UTC(year, month - 6, now.getDate()));
      return {
        desde: formatDateToIso(d),
        hasta: todayIso,
      };
    }
    case "last_12_months": {
      const d = new Date(Date.UTC(year, month - 12, now.getDate()));
      return {
        desde: formatDateToIso(d),
        hasta: todayIso,
      };
    }
  }
}

/** Desplaza el rango hacia atrás o adelante por el tamaño del período actual */
export function shiftRange(
  desde: string,
  hasta: string,
  direction: "prev" | "next"
): { desde: string; hasta: string } {
  const start = parseUtcDate(desde).getTime();
  const end = parseUtcDate(hasta).getTime();
  const duration = end - start + 86_400_000; // duración en ms incluyendo ambos extremos

  if (direction === "prev") {
    const newEnd = start - 86_400_000;
    const newStart = newEnd - (duration - 86_400_000);
    return {
      desde: formatDateToIso(new Date(newStart)),
      hasta: formatDateToIso(new Date(newEnd)),
    };
  } else {
    const newStart = end + 86_400_000;
    const newEnd = newStart + (duration - 86_400_000);
    return {
      desde: formatDateToIso(new Date(newStart)),
      hasta: formatDateToIso(new Date(newEnd)),
    };
  }
}

/** Exporta los datos del dashboard a formato CSV para Excel/Sheets */
export function exportDashboardCsv(payload: DashboardPayload) {
  const lines: string[] = [];

  lines.push("REPORTE FINANCIERO Y CONTABLE - DASHBOARD");
  lines.push(`Período: ${payload.period.label} (${payload.period.desde} al ${payload.period.hasta})`);
  lines.push(`Generado el: ${new Date().toLocaleString("es-PE")}`);
  lines.push(`Moneda: ${payload.meta.currency}`);
  lines.push("");

  // KPIs
  lines.push("INDICADOR CONTABLE,VALOR,TIPO,VARIACIÓN VS PERÍODO PREVIO");
  for (const kpi of payload.kpis) {
    const val = kpi.kind === "currency" ? kpi.value.toFixed(2) : String(kpi.value);
    const varText = kpi.variation ? `${kpi.variation.percent}% (${kpi.variation.direction})` : "N/A";
    lines.push(`"${kpi.label}",${val},"${kpi.kind}","${varText}"`);
  }
  lines.push("");

  // Serie Mensual
  lines.push("SERIE MENSUAL");
  lines.push("MES,INGRESOS (PEN),GASTOS (PEN),UTILIDAD NETA (PEN),MARGEN (%)");
  for (const pt of payload.monthlySeries) {
    const margin = pt.ingresos > 0 ? ((pt.utilidad / pt.ingresos) * 100).toFixed(1) : "0.0";
    lines.push(`"${pt.label}",${pt.ingresos.toFixed(2)},${pt.gastos.toFixed(2)},${pt.utilidad.toFixed(2)},${margin}%`);
  }
  lines.push("");

  // Gastos
  lines.push("DISTRIBUCIÓN DE GASTOS POR CATEGORÍA");
  lines.push("CATEGORÍA,CUENTA PCGE,MONTO (PEN),PARTICIPACIÓN (%)");
  for (const exp of payload.expenseBreakdown) {
    lines.push(`"${exp.category}","${exp.code}",${exp.amount.toFixed(2)},${exp.percent}%`);
  }
  lines.push("");

  // Top Cuentas
  lines.push("CUENTAS CON MAYOR MOVIMIENTO");
  lines.push("CÓDIGO,NOMBRE DE CUENTA,MONTO MOVIDO (PEN)");
  for (const acc of payload.topAccounts) {
    lines.push(`"${acc.code}","${acc.name}",${acc.amount.toFixed(2)}`);
  }

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(lines.join("\n"));
  const link = document.createElement("a");
  link.setAttribute("href", csvContent);
  link.setAttribute("download", `dashboard_contable_${payload.period.desde}_${payload.period.hasta}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
