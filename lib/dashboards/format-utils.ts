import type { ConditionalColorRule } from "./widget-schema";

/**
 * Evalúa las reglas de color condicional en orden: la primera regla que coincida gana.
 */
export function evaluateConditionalColor(
  value: number | null | undefined,
  rules?: ConditionalColorRule[] | null,
  defaultColor?: string
): string | undefined {
  if (value === null || value === undefined || !rules || rules.length === 0) {
    return defaultColor;
  }

  for (const rule of rules) {
    if (rule.condition === "greaterThan" && value > rule.threshold) {
      return rule.color;
    }
    if (rule.condition === "lessThan" && value < rule.threshold) {
      return rule.color;
    }
    if (
      rule.condition === "between" &&
      rule.threshold2 !== undefined &&
      value >= Math.min(rule.threshold, rule.threshold2) &&
      value <= Math.max(rule.threshold, rule.threshold2)
    ) {
      return rule.color;
    }
  }

  return defaultColor;
}

/**
 * Calcula el barCategoryGap para Recharts aproximando barWidth (10 a 100):
 * barCategoryGap = (100 - barWidth)%
 */
export function calculateBarCategoryGap(barWidth: number = 70): string {
  const clamped = Math.max(10, Math.min(100, barWidth));
  return `${100 - clamped}%`;
}

/**
 * Calcula los ángulos del anillo (donut / pie):
 * Si startAngle se especifica, endAngle = startAngle - 360
 */
export function calculateDonutAngles(startAngle: number = 90): {
  startAngle: number;
  endAngle: number;
} {
  return {
    startAngle,
    endAngle: startAngle - 360,
  };
}

/**
 * Convierte el valor de fillOpacity de la UI (0 a 100) al formato decimal de Recharts (0 a 1)
 */
export function calculateFillOpacity(fillOpacity: number = 20): number {
  const clamped = Math.max(0, Math.min(100, fillOpacity));
  return clamped / 100;
}

/**
 * Calcula y valida el dominio numérico para YAxis en Recharts.
 * Si min >= max, hace fallback a automático.
 */
export function calculateYAxisDomain(
  yAxisMin?: number,
  yAxisMax?: number
): [number | "auto", number | "auto"] | undefined {
  if (yAxisMin !== undefined && yAxisMax !== undefined) {
    if (yAxisMin < yAxisMax) {
      return [yAxisMin, yAxisMax];
    }
    return ["auto", "auto"];
  }

  if (yAxisMin !== undefined) {
    return [yAxisMin, "auto"];
  }

  if (yAxisMax !== undefined) {
    return ["auto", yAxisMax];
  }

  return undefined;
}
