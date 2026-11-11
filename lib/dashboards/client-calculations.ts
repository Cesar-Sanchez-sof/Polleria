/**
 * Cálculos puros en cliente para visuales analíticos de Dashboards.
 * 
 * Reglas:
 * - Cascada: Acumulado progresivo, positivos/negativos con base flotante y total final.
 * - Pareto: Orden desc forzado, suma total, acumulado y porcentaje acumulado (0 - 100%).
 * - Matrix: Pivot dinámico con totales de fila y columna, y tope de 500 celdas.
 * - Delta KPI: Comparación porcentual con el período previo ("—" si previo es 0).
 */

export interface DeltaResult {
  percent: number | null;
  formatted: string;
  direction: "up" | "down" | "flat" | "none";
}

/**
 * Calcula la variación porcentual entre el valor actual y el del período anterior.
 * Si el previo es 0, no es un número finito o no existe, devuelve formatted: "—".
 */
export function calculateDeltaPercentage(current: number, previous: number): DeltaResult {
  if (previous === 0 || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return {
      percent: null,
      formatted: "—",
      direction: "none",
    };
  }

  const diff = current - previous;
  const percent = (diff / Math.abs(previous)) * 100;
  const rounded = Number(percent.toFixed(1));

  if (rounded > 0) {
    return {
      percent: rounded,
      formatted: `+${rounded.toFixed(1)}%`,
      direction: "up",
    };
  }

  if (rounded < 0) {
    return {
      percent: rounded,
      formatted: `${rounded.toFixed(1)}%`,
      direction: "down",
    };
  }

  return {
    percent: 0,
    formatted: "0.0%",
    direction: "flat",
  };
}

export interface WaterfallItem {
  category: string;
  value: number; // Altura de la barra visible
  base: number;  // Altura de la base transparente (offset flotante)
  displayValue: number; // Valor original con signo
  isTotal?: boolean;
  type: "positive" | "negative" | "total";
}

/**
 * Calcula las barras flotantes para un gráfico de cascada (Waterfall).
 * Acumula progresivamente los valores positivos y negativos, y añade la columna final de Total.
 */
export function calculateWaterfallData(
  rows: Record<string, unknown>[],
  categoryKey: string,
  valueKey: string,
  totalLabel: string = "Total"
): WaterfallItem[] {
  const result: WaterfallItem[] = [];
  let runningTotal = 0;

  for (const row of rows) {
    const category = String(row[categoryKey] ?? "(Vacío)");
    const rawVal = Number(row[valueKey]) || 0;

    const base = rawVal >= 0 ? runningTotal : runningTotal + rawVal;
    const itemType = rawVal >= 0 ? "positive" : "negative";

    result.push({
      category,
      value: Math.abs(rawVal),
      base: base >= 0 ? base : 0,
      displayValue: rawVal,
      type: itemType,
    });

    runningTotal += rawVal;
  }

  // Barra final de Total acumulado
  result.push({
    category: totalLabel,
    value: Math.abs(runningTotal),
    base: 0,
    displayValue: runningTotal,
    isTotal: true,
    type: "total",
  });

  return result;
}

export interface ParetoItem {
  category: string;
  value: number;
  cumulativeValue: number;
  cumulativePercentage: number;
}

/**
 * Calcula los datos del diagrama de Pareto (80/20).
 * Fuerza orden descendente por valor, calcula la suma total y el porcentaje acumulado (0% a 100%).
 */
export function calculateParetoData(
  rows: Record<string, unknown>[],
  categoryKey: string,
  valueKey: string
): ParetoItem[] {
  // 1. Extraer y ordenar forzosamente de mayor a menor
  const sorted = rows
    .map((row) => ({
      category: String(row[categoryKey] ?? "(Vacío)"),
      value: Number(row[valueKey]) || 0,
    }))
    .sort((a, b) => b.value - a.value);

  // 2. Suma acumulada de todos los valores
  const totalSum = sorted.reduce((acc, curr) => acc + curr.value, 0);

  // 3. Proporciones acumuladas
  let runningSum = 0;
  return sorted.map((item) => {
    runningSum += item.value;
    const cumulativePercentage = totalSum > 0 ? (runningSum / totalSum) * 100 : 0;
    return {
      category: item.category,
      value: item.value,
      cumulativeValue: runningSum,
      cumulativePercentage: Number(cumulativePercentage.toFixed(1)),
    };
  });
}

const WEEKDAY_ORDER: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
  domingo: 7,
};

/**
 * Ordena claves de dimensión para matrices dinámicas y mapas de calor:
 * - weekday: Lunes -> Domingo
 * - hourOfDay: 00:00 -> 23:00
 * - fechas: cronológico YYYY-MM-DD
 * - números o texto: orden alfanumérico natural (nunca orden de aparición)
 */
export function sortDimensionKeys(keys: string[]): string[] {
  if (keys.length <= 1) return [...keys];

  // 1. Días de la semana
  const isAllWeekday = keys.every((k) => {
    const norm = k.trim().toLowerCase();
    return norm in WEEKDAY_ORDER;
  });
  if (isAllWeekday) {
    return [...keys].sort((a, b) => {
      const orderA = WEEKDAY_ORDER[a.trim().toLowerCase()] ?? 99;
      const orderB = WEEKDAY_ORDER[b.trim().toLowerCase()] ?? 99;
      return orderA - orderB;
    });
  }

  // 2. Horas del día (00:00 a 23:00)
  const isAllHours = keys.every((k) => /^(\d{1,2}):(\d{2})$/.test(k.trim()));
  if (isAllHours) {
    return [...keys].sort((a, b) => {
      const [hA, mA] = a.trim().split(":").map(Number);
      const [hB, mB] = b.trim().split(":").map(Number);
      return hA !== hB ? hA - hB : mA - mB;
    });
  }

  // 3. Fechas cronológicas (YYYY-MM-DD o YYYY-MM o YYYY-MM-DD HH:mm)
  const isAllDates = keys.every((k) => /^\d{4}-\d{2}(-\d{2})?/.test(k.trim()));
  if (isAllDates) {
    return [...keys].sort((a, b) => a.trim().localeCompare(b.trim()));
  }

  // 4. Numérico o alfanumérico natural
  return [...keys].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export interface MatrixPivotResult {
  rowKeys: string[];
  colKeys: string[];
  grid: Record<string, Record<string, Record<string, number>>>; // [rowKey][colKey][metricKey] = value
  rowTotals: Record<string, Record<string, number>>; // [rowKey][metricKey] = total
  colTotals: Record<string, Record<string, number>>; // [colKey][metricKey] = total
  grandTotals: Record<string, number>; // [metricKey] = total
  exceeded: boolean;
  totalCells: number;
  displayedRowCount: number;
  displayedColCount: number;
}

/**
 * Realiza el pivotaje en cliente para una matriz dinámica con filas, columnas y múltiples medidas.
 * Incluye totales de fila, totales de columna, gran total, y límite protector de 500 celdas.
 */
export function calculateMatrixPivot(
  rows: Record<string, unknown>[],
  rowDimKey: string,
  colDimKey?: string,
  metricKeys: string[] = []
): MatrixPivotResult {
  const distinctRowSet = new Set<string>();
  const distinctColSet = new Set<string>();

  // Recolectar dimensiones
  for (const row of rows) {
    const rKey = String(row[rowDimKey] ?? "(Vacío)");
    distinctRowSet.add(rKey);

    if (colDimKey) {
      const cKey = String(row[colDimKey] ?? "(General)");
      distinctColSet.add(cKey);
    }
  }

  let rowKeys = sortDimensionKeys(Array.from(distinctRowSet));
  let colKeys = colDimKey ? sortDimensionKeys(Array.from(distinctColSet)) : ["Total"];

  const rawCellCount = rowKeys.length * colKeys.length;
  const MAX_MATRIX_CELLS = 500;
  const exceeded = rawCellCount > MAX_MATRIX_CELLS;

  if (exceeded) {
    // Si excede 500 celdas, recortar para no desbordar el navegador
    const maxCols = Math.min(colKeys.length, 25);
    colKeys = colKeys.slice(0, maxCols);
    const maxRows = Math.max(1, Math.floor(MAX_MATRIX_CELLS / colKeys.length));
    rowKeys = rowKeys.slice(0, maxRows);
  }

  const validRowSet = new Set(rowKeys);
  const validColSet = new Set(colKeys);

  // Inicializar estructuras de cuadrícula y acumuladores
  const grid: Record<string, Record<string, Record<string, number>>> = {};
  const rowTotals: Record<string, Record<string, number>> = {};
  const colTotals: Record<string, Record<string, number>> = {};
  const grandTotals: Record<string, number> = {};

  for (const m of metricKeys) {
    grandTotals[m] = 0;
  }

  for (const r of rowKeys) {
    grid[r] = {};
    rowTotals[r] = {};
    for (const m of metricKeys) {
      rowTotals[r][m] = 0;
    }
    for (const c of colKeys) {
      grid[r][c] = {};
      for (const m of metricKeys) {
        grid[r][c][m] = 0;
      }
    }
  }

  for (const c of colKeys) {
    colTotals[c] = {};
    for (const m of metricKeys) {
      colTotals[c][m] = 0;
    }
  }

  // Poblar valores
  for (const row of rows) {
    const rKey = String(row[rowDimKey] ?? "(Vacío)");
    const cKey = colDimKey ? String(row[colDimKey] ?? "(General)") : "Total";

    if (!validRowSet.has(rKey) || !validColSet.has(cKey)) continue;

    for (const m of metricKeys) {
      const val = Number(row[m]) || 0;
      grid[rKey][cKey][m] = (grid[rKey][cKey][m] || 0) + val;
      rowTotals[rKey][m] = (rowTotals[rKey][m] || 0) + val;
      colTotals[cKey][m] = (colTotals[cKey][m] || 0) + val;
      grandTotals[m] = (grandTotals[m] || 0) + val;
    }
  }

  return {
    rowKeys,
    colKeys,
    grid,
    rowTotals,
    colTotals,
    grandTotals,
    exceeded,
    totalCells: rawCellCount,
    displayedRowCount: rowKeys.length,
    displayedColCount: colKeys.length,
  };
}
