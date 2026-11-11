import { prisma } from "@/lib/prisma";
import { ValidationError, ForbiddenError } from "@/lib/http/errors";
import { permissionsForUser, hasPermission } from "@/lib/auth/permissions";
import {
  SEMANTIC_DATASETS,
  type SemanticDataset,
  type SemanticField,
  type DateGranularity,
} from "@/lib/dashboards/semantic-model";
import type {
  WidgetDataConfig,
  FilterRule,
} from "@/lib/dashboards/widget-schema";

export interface QueryUserContext {
  userId?: number;
  superuser?: boolean;
}

export interface NormalizedQueryResult {
  dataset: string;
  rows: Record<string, string | number | boolean | null>[];
  meta: {
    axis?: string;
    legend?: string;
    metrics: string[];
    totalRows: number;
    truncated: boolean;
    engine: "prisma_aggregate" | "prisma_groupby" | "in_memory_hybrid";
  };
}

/** Límite de seguridad máximo de filas procesables en memoria */
export const MAX_MEMORY_ROWS = 50000;

/**
 * Convierte un timestamp UTC a la zona horaria America/Lima (UTC-5).
 * Se aplica EXCLUSIVAMENTE a campos que contienen hora (hasTime === true).
 */
export function toLimaDate(val: Date | string | number): Date {
  const d = new Date(val);
  if (isNaN(d.getTime())) return d;
  return new Date(d.getTime() - 5 * 3600 * 1000);
}

export const WEEKDAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export const WEEKDAY_ORDER: Record<string, number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 7,
};

/**
 * Formatea fechas según su tipo:
 * - Si hasTime === true (Timestamp: orderedAt, createdAt, paidAt, movedAt): convierte a America/Lima (UTC-5).
 * - Si hasTime === false (@db.Date: issuedAt, entryDate, InformalPurchase.date): formatea en UTC directo sin desplazamiento.
 */
export function formatSemanticDate(
  dateVal: Date | string | number,
  hasTime: boolean = false,
  granularity?: DateGranularity
): string {
  const d = hasTime ? toLimaDate(dateVal) : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  const year = d.getUTCFullYear();
  const monthNum = d.getUTCMonth() + 1;
  const month = String(monthNum).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const quarter = Math.floor((monthNum - 1) / 3) + 1;
  const weekday = WEEKDAYS_ES[d.getUTCDay()];

  switch (granularity) {
    case "year":
      return `${year}`;
    case "quarter":
      return `${year}-Q${quarter}`;
    case "month":
      return `${year}-${month}`;
    case "weekday":
      return weekday;
    case "day":
      return `${year}-${month}-${day}`;
    case "hour":
      return `${year}-${month}-${day} ${hour}:00`;
    case "hourOfDay":
      return `${hour}:00`;
    default:
      return `${year}-${month}`;
  }
}

/** Helper de compatibilidad para formateo de fechas */
export function formatDateLima(dateVal: Date | string | number, granularity?: DateGranularity): string {
  return formatSemanticDate(dateVal, true, granularity);
}

/**
 * Traduce un valor de filtro al formato esperado por Prisma
 */
function parseFilterValue(value: unknown, dataType: string): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.map((v) => parseFilterValue(v, dataType));
  }
  if (dataType === "number") {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }
  if (dataType === "date") {
    return new Date(String(value));
  }
  return String(value);
}

/**
 * Convierte un Decimal o valor numérico de Prisma a number JS
 */
function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "object" && val !== null && "toNumber" in val) {
    return (val as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
}

function parseYMD(val: unknown): { y: number; m: number; d: number } | null {
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return { y: parseInt(match[1], 10), m: parseInt(match[2], 10), d: parseInt(match[3], 10) };
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return { y: val.getUTCFullYear(), m: val.getUTCMonth() + 1, d: val.getUTCDate() };
  }
  return null;
}

/**
 * Construye condiciones específicas para campos de fecha:
 * - hasTime === true (Timestamps): Si llega 'between' con 'YYYY-MM-DD', se interpreta en America/Lima (UTC-5):
 *   inicio = 00:00:00 Lima del día inicial (05:00 UTC),
 *   fin = 00:00:00 Lima del día siguiente al final (05:00 UTC, excluyente con 'lt').
 * - hasTime === false (@db.Date): Se comparan fechas UTC directas (inclusive con 'gte' y 'lte').
 */
export function buildDateCondition(
  operator: string,
  rawVal: unknown,
  hasTime: boolean
): unknown {
  if (hasTime) {
    if (operator === "between" && Array.isArray(rawVal) && rawVal.length === 2) {
      const startYmd = parseYMD(rawVal[0]);
      const endYmd = parseYMD(rawVal[1]);
      if (startYmd && endYmd) {
        const startUtc = new Date(Date.UTC(startYmd.y, startYmd.m - 1, startYmd.d, 5, 0, 0, 0));
        const endUtc = new Date(Date.UTC(endYmd.y, endYmd.m - 1, endYmd.d + 1, 5, 0, 0, 0));
        return { gte: startUtc, lt: endUtc };
      }
    }

    if (operator === "gte" || operator === "greaterOrEqual") {
      const ymd = parseYMD(rawVal);
      if (ymd) {
        return { gte: new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 5, 0, 0, 0)) };
      }
    }

    if (operator === "gt" || operator === "greaterThan") {
      const ymd = parseYMD(rawVal);
      if (ymd) {
        return { gt: new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 5, 0, 0, 0)) };
      }
    }

    if (operator === "lte" || operator === "lessOrEqual") {
      const ymd = parseYMD(rawVal);
      if (ymd) {
        return { lt: new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + 1, 5, 0, 0, 0)) };
      }
    }

    if (operator === "lt" || operator === "lessThan") {
      const ymd = parseYMD(rawVal);
      if (ymd) {
        return { lt: new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 5, 0, 0, 0)) };
      }
    }

    if (operator === "eq" || operator === "equals") {
      const ymd = parseYMD(rawVal);
      if (ymd) {
        const startUtc = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 5, 0, 0, 0));
        const endUtc = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + 1, 5, 0, 0, 0));
        return { gte: startUtc, lt: endUtc };
      }
    }
  } else {
    // hasTime === false (@db.Date sin hora, en UTC directo inclusive)
    if (operator === "between" && Array.isArray(rawVal) && rawVal.length === 2) {
      const startUtc = new Date(String(rawVal[0]));
      const endUtc = new Date(String(rawVal[1]));
      return { gte: startUtc, lte: endUtc };
    }
  }

  const parsedVal = parseFilterValue(rawVal, "date");
  return buildCondition(operator, parsedVal);
}

function buildCondition(operator: string, parsedVal: unknown): unknown {
  switch (operator) {
    case "eq":
    case "equals":
      return parsedVal;
    case "neq":
    case "notEquals":
      return { not: parsedVal };
    case "in":
      return { in: Array.isArray(parsedVal) ? parsedVal : [parsedVal] };
    case "between":
      if (Array.isArray(parsedVal) && parsedVal.length === 2) {
        return { gte: parsedVal[0], lte: parsedVal[1] };
      }
      return parsedVal;
    case "gt":
    case "greaterThan":
      return { gt: parsedVal };
    case "lt":
    case "lessThan":
      return { lt: parsedVal };
    case "greaterOrEqual":
      return { gte: parsedVal };
    case "lessOrEqual":
      return { lte: parsedVal };
    case "startsWith":
      return { startsWith: String(parsedVal), mode: "insensitive" };
    case "contains":
      return { contains: String(parsedVal), mode: "insensitive" };
    default:
      return parsedVal;
  }
}

/**
 * Construye la cláusula where combinando el baseFilter del dataset y los filtros de usuario validados
 */
function buildWhereClause(
  filters: FilterRule[],
  fieldMap: Map<string, SemanticField>,
  baseFilter?: Record<string, unknown>
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...(baseFilter || {}) };

  for (const filter of filters) {
    const field = fieldMap.get(filter.field);
    if (!field) {
      throw new ValidationError(`Campo de filtro no permitido en la whitelist: '${filter.field}'.`);
    }

    const targetPath = field.prismaPath || field.prismaField || field.id;
    let condition: unknown;
    if (field.dataType === "date") {
      condition = buildDateCondition(filter.operator, filter.value, field.hasTime === true);
    } else {
      const parsedVal = parseFilterValue(filter.value, field.dataType);
      condition = buildCondition(filter.operator, parsedVal);
    }

    const parts = targetPath.split(".");
    if (parts.length === 1) {
      where[parts[0]] = condition;
    } else {
      let curr = where;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        curr[part] =
          typeof curr[part] === "object" && curr[part] !== null
            ? { ...(curr[part] as Record<string, unknown>) }
            : {};
        curr = curr[part] as Record<string, unknown>;
      }
      curr[parts[parts.length - 1]] = condition;
    }
  }

  return where;
}

/**
 * Extrae el valor de dimensión desde una fila cargada (escalar o relación)
 */
function extractDimensionValue(
  row: Record<string, unknown>,
  field: SemanticField,
  granularity?: DateGranularity
): string {
  let rawValue: unknown;

  if (field.customExtractor) {
    rawValue = field.customExtractor(row);
  } else if (field.prismaPath) {
    const parts = field.prismaPath.split(".");
    let current: unknown = row;
    for (const part of parts) {
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        current = undefined;
        break;
      }
    }
    rawValue = current;
  } else if (field.prismaField && field.prismaField in row) {
    rawValue = row[field.prismaField];
  } else if (field.id in row) {
    rawValue = row[field.id];
  }

  if (rawValue === null || rawValue === undefined) {
    return "(Vacío)";
  }

  // Traducción por valueLabels si existe
  const strVal = String(rawValue);
  if (field.valueLabels && field.valueLabels[strVal]) {
    return field.valueLabels[strVal];
  }

  // Formateo de fechas con hora Lima o UTC directo según hasTime
  if (field.dataType === "date" && (rawValue instanceof Date || typeof rawValue === "string")) {
    return formatSemanticDate(rawValue, field.hasTime === true, granularity);
  }

  return strVal;
}

/**
 * Valida la configuración de la consulta contra la whitelist semántica del dataset (sin tocar la base de datos).
 */
export function validateQueryConfigWhitelist(queryData: WidgetDataConfig): void {
  const dataset: SemanticDataset | undefined = SEMANTIC_DATASETS[queryData.dataset];
  if (!dataset) {
    throw new ValidationError(`Dataset no soportado: '${queryData.dataset}'.`);
  }

  const fieldMap = new Map<string, SemanticField>();
  for (const f of dataset.fields) {
    fieldMap.set(f.id, f);
  }

  if (queryData.axis) {
    const axisField = fieldMap.get(queryData.axis);
    if (!axisField) {
      throw new ValidationError(
        `El campo de eje '${queryData.axis}' no existe en la whitelist del dataset '${dataset.id}'.`
      );
    }
  }

  if (queryData.legend) {
    const legendField = fieldMap.get(queryData.legend);
    if (!legendField) {
      throw new ValidationError(
        `El campo de leyenda '${queryData.legend}' no existe en la whitelist del dataset '${dataset.id}'.`
      );
    }
  }

  if (!queryData.values || queryData.values.length === 0) {
    throw new ValidationError("Debe especificar al menos un valor de medida para el gráfico.");
  }

  for (const v of queryData.values) {
    const f = fieldMap.get(v.field);
    if (!f) {
      throw new ValidationError(`Campo de valor no permitido en la whitelist: '${v.field}'.`);
    }
    if (f.kind !== "measure" && f.dataType !== "number") {
      throw new ValidationError(`El campo '${v.field}' no puede ser agregado como medida.`);
    }
    if (f.allowedAggregations && !f.allowedAggregations.includes(v.agg)) {
      throw new ValidationError(
        `La agregación '${v.agg}' no está permitida para el campo '${v.field}'.`
      );
    }
  }

  if (queryData.filters && queryData.filters.length > 0) {
    for (const filter of queryData.filters) {
      if (!fieldMap.has(filter.field)) {
        throw new ValidationError(`Campo de filtro no permitido en la whitelist: '${filter.field}'.`);
      }
    }
  }

  if (queryData.sort) {
    const metricKeys = queryData.values.map((v) => `${v.field}_${v.agg}`);
    const allowedSort = new Set<string>([
      ...Array.from(fieldMap.keys()),
      ...metricKeys,
      ...queryData.values.map((v) => v.field),
    ]);
    if (!allowedSort.has(queryData.sort.by)) {
      throw new ValidationError(`Campo de ordenamiento no permitido en la whitelist: '${queryData.sort.by}'.`);
    }
  }
}

/**
 * Motor Analítico estilo Power BI para Dashboards.
 */
export async function executeDashboardQueryService(
  queryData: WidgetDataConfig,
  userContext?: QueryUserContext
): Promise<NormalizedQueryResult> {
  const dataset: SemanticDataset | undefined = SEMANTIC_DATASETS[queryData.dataset];
  if (!dataset) {
    throw new ValidationError(`Dataset no soportado: '${queryData.dataset}'.`);
  }

  // 1. Verificación de Seguridad y Permisos RBAC
  if (userContext && !userContext.superuser && userContext.userId) {
    const access = await permissionsForUser(userContext.userId);
    if (!access || !hasPermission(access, dataset.requiredPermission)) {
      throw new ForbiddenError(
        `Permiso insuficiente para consultar el dataset '${dataset.id}'. Se requiere: '${dataset.requiredPermission}'.`
      );
    }
  }

  // 2. Validación de campos contra Whitelist del dataset
  validateQueryConfigWhitelist(queryData);

  const metricKeys = queryData.values.map((v) => `${v.field}_${v.agg}`);

  const fieldMap = new Map<string, SemanticField>();
  for (const f of dataset.fields) {
    fieldMap.set(f.id, f);
  }

  const axisField = queryData.axis ? fieldMap.get(queryData.axis) : undefined;
  const legendField = queryData.legend ? fieldMap.get(queryData.legend) : undefined;

  let hasCalculatedMeasures = false;
  let hasCountDistinct = false;

  for (const v of queryData.values) {
    const f = fieldMap.get(v.field)!;
    if (f.isCalculated) {
      hasCalculatedMeasures = true;
    }
    if (v.agg === "countDistinct") {
      hasCountDistinct = true;
    }
  }

  const where = buildWhereClause(queryData.filters || [], fieldMap, dataset.baseFilter);
  const prismaModelName = dataset.prismaModel;
  const modelDelegate = (prisma as unknown as Record<string, unknown>)[prismaModelName] as {
    aggregate?: (args: unknown) => Promise<Record<string, Record<string, unknown>>>;
    groupBy?: (args: unknown) => Promise<Record<string, unknown>[]>;
    findMany?: (args: unknown) => Promise<Record<string, unknown>[]>;
    count?: (args: unknown) => Promise<number>;
  };

  if (!modelDelegate) {
    throw new ValidationError(`Modelo Prisma '${prismaModelName}' no disponible.`);
  }

  // --------------------------------------------------------------------------
  // CASO 1: Consulta sin Eje (Card / KPI de Valor Único)
  // --------------------------------------------------------------------------
  if (!axisField) {
    if (!hasCalculatedMeasures && !hasCountDistinct && modelDelegate.aggregate) {
      const aggArgs: Record<string, Record<string, boolean>> = {};

      for (const v of queryData.values) {
        const field = fieldMap.get(v.field)!;
        const aggKey = `_${v.agg}`;
        aggArgs[aggKey] = aggArgs[aggKey] || {};
        aggArgs[aggKey][field.prismaField || field.id] = true;
      }

      const aggregateResult = await modelDelegate.aggregate({
        where,
        ...aggArgs,
      });

      const singleRow: Record<string, number> = {};
      for (const v of queryData.values) {
        const field = fieldMap.get(v.field)!;
        const aggKey = `_${v.agg}`;
        const rawVal = aggregateResult?.[aggKey]?.[field.prismaField || field.id];
        singleRow[`${v.field}_${v.agg}`] = Math.round(toNumber(rawVal) * 100) / 100;
      }

      return {
        dataset: dataset.id,
        rows: [singleRow],
        meta: {
          metrics: metricKeys,
          totalRows: 1,
          truncated: false,
          engine: "prisma_aggregate",
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASO 2: Consulta con Eje Dimensión - Evaluación de Motor
  // --------------------------------------------------------------------------
  const hasRelations =
    Boolean(axisField?.prismaPath || axisField?.customExtractor) ||
    Boolean(legendField?.prismaPath || legendField?.customExtractor) ||
    Boolean(dataset.includeRelations);

  const isComplexDateGranularity =
    axisField?.dataType === "date" &&
    (queryData.granularity === "weekday" ||
      queryData.granularity === "hour" ||
      queryData.granularity === "hourOfDay" ||
      queryData.granularity === "quarter" ||
      axisField.hasTime === true);

  const isComplexLegendDateGranularity =
    legendField?.dataType === "date" &&
    (queryData.legendGranularity === "weekday" ||
      queryData.legendGranularity === "hour" ||
      queryData.legendGranularity === "hourOfDay" ||
      queryData.legendGranularity === "quarter" ||
      legendField.hasTime === true);

  const requiresInMemory =
    hasRelations ||
    hasCalculatedMeasures ||
    hasCountDistinct ||
    isComplexDateGranularity ||
    isComplexLegendDateGranularity ||
    !modelDelegate.groupBy;

  const isTimeSeries = axisField?.dataType === "date";
  const defaultLimit = isTimeSeries ? 1000 : 200;
  const effectiveLimit = queryData.limit ?? defaultLimit;

  // --------------------------------------------------------------------------
  // MOTOR A: Prisma groupBy (cuando todas las dimensiones son escalares nativas)
  // --------------------------------------------------------------------------
  if (!requiresInMemory && axisField && modelDelegate.groupBy) {
    const groupByFields: string[] = [axisField.prismaField || axisField.id];
    if (legendField && (legendField.prismaField || legendField.id) !== (axisField.prismaField || axisField.id)) {
      groupByFields.push(legendField.prismaField || legendField.id);
    }

    const aggArgs: Record<string, Record<string, boolean>> = {};
    for (const v of queryData.values) {
      const field = fieldMap.get(v.field)!;
      const aggKey = `_${v.agg}`;
      aggArgs[aggKey] = aggArgs[aggKey] || {};
      aggArgs[aggKey][field.prismaField || field.id] = true;
    }

    let groupByOrderBy: Record<string, unknown> = {};
    const sortCandidate = queryData.sort?.by;
    const matchedMetric = queryData.sort
      ? queryData.values.find(
          (v) => v.field === sortCandidate || `${v.field}_${v.agg}` === sortCandidate
        )
      : undefined;

    if (matchedMetric && queryData.sort) {
      const field = fieldMap.get(matchedMetric.field)!;
      const prismaCol = field.prismaField || field.id;
      groupByOrderBy = {
        [`_${matchedMetric.agg}`]: {
          [prismaCol]: queryData.sort.dir,
        },
      };
    } else {
      const matchedDim = sortCandidate
        ? groupByFields.find((f) => f === sortCandidate || f === fieldMap.get(sortCandidate)?.prismaField)
        : undefined;

      if (matchedDim && queryData.sort) {
        groupByOrderBy = { [matchedDim]: queryData.sort.dir };
      } else if (axisField.dataType === "date") {
        // Pedir desc para conservar los grupos más recientes si se trunca
        groupByOrderBy = { [groupByFields[0]]: "desc" };
      } else if (queryData.values.length > 0) {
        const firstMetric = queryData.values[0];
        const field = fieldMap.get(firstMetric.field)!;
        const prismaCol = field.prismaField || field.id;
        groupByOrderBy = {
          [`_${firstMetric.agg}`]: {
            [prismaCol]: "desc",
          },
        };
      } else {
        groupByOrderBy = { [groupByFields[0]]: "asc" };
      }
    }

    const rawGroups = await modelDelegate.groupBy({
      by: groupByFields,
      where,
      ...aggArgs,
      orderBy: groupByOrderBy,
      take: effectiveLimit + 1,
    });

    const isTruncated = rawGroups.length > effectiveLimit;
    if (isTruncated) {
      rawGroups.splice(effectiveLimit);
    }

    // Si era serie temporal por defecto o asc, reordenar a cronológico asc
    if (
      axisField.dataType === "date" &&
      (!queryData.sort || (queryData.sort.by === axisField.id && queryData.sort.dir === "asc"))
    ) {
      rawGroups.reverse();
    }

    const normalizedRows: Record<string, string | number | boolean | null>[] = [];
    const mapGrouped = new Map<string, Record<string, string | number | boolean | null>>();

    for (const g of rawGroups) {
      const axisKey = axisField.prismaField || axisField.id;
      const rawAxisVal = g[axisKey];
      let axisLabel: string;

      if (axisField.dataType === "date" && (rawAxisVal instanceof Date || typeof rawAxisVal === "string")) {
        axisLabel = formatSemanticDate(rawAxisVal, axisField.hasTime === true, queryData.granularity);
      } else {
        const rawStr = rawAxisVal !== null && rawAxisVal !== undefined ? String(rawAxisVal) : "(Vacío)";
        axisLabel = axisField.valueLabels?.[rawStr] || rawStr;
      }

      let legendLabel: string | undefined;
      if (legendField) {
        const legendKey = legendField.prismaField || legendField.id;
        const rawLegendVal = g[legendKey];
        if (legendField.dataType === "date" && (rawLegendVal instanceof Date || typeof rawLegendVal === "string")) {
          legendLabel = formatSemanticDate(rawLegendVal, legendField.hasTime === true, queryData.legendGranularity);
        } else {
          const rawStr = rawLegendVal !== null && rawLegendVal !== undefined ? String(rawLegendVal) : "(Vacío)";
          legendLabel = legendField.valueLabels?.[rawStr] || rawStr;
        }
      }

      const groupKey = legendLabel ? `${axisLabel}__${legendLabel}` : axisLabel;

      const legendKey =
        axisField && legendField && legendField.id === axisField.id
          ? `${legendField.id}_legend`
          : legendField?.id;

      if (!mapGrouped.has(groupKey)) {
        const newRow: Record<string, string | number | boolean | null> = {
          [axisField.id]: axisLabel,
        };
        if (legendKey && legendLabel !== undefined) {
          newRow[legendKey] = legendLabel;
        }
        for (const v of queryData.values) {
          newRow[`${v.field}_${v.agg}`] = 0;
        }
        mapGrouped.set(groupKey, newRow);
      }

      const targetRow = mapGrouped.get(groupKey)!;
      for (const v of queryData.values) {
        const field = fieldMap.get(v.field)!;
        const aggKey = `_${v.agg}`;
        const metricVal = toNumber(
          (g[aggKey] as Record<string, unknown> | undefined)?.[field.prismaField || field.id]
        );
        const currentVal = (targetRow[`${v.field}_${v.agg}`] as number) || 0;
        targetRow[`${v.field}_${v.agg}`] = Math.round((currentVal + metricVal) * 100) / 100;
      }
    }

    normalizedRows.push(...Array.from(mapGrouped.values()));

    // Ordenar los grupos consolidados según sort.by o por defecto (medida desc / fecha asc)
    let sortKey: string;
    let sortDir: "asc" | "desc";
    if (queryData.sort) {
      sortKey = queryData.sort.by;
      sortDir = queryData.sort.dir;
    } else if (axisField.dataType === "date") {
      sortKey = axisField.id;
      sortDir = "asc";
    } else if (queryData.values.length > 0) {
      const firstMetric = queryData.values[0];
      sortKey = `${firstMetric.field}_${firstMetric.agg}`;
      sortDir = "desc";
    } else {
      sortKey = axisField.id;
      sortDir = "asc";
    }

    const sortMultiplier = sortDir === "desc" ? -1 : 1;
    normalizedRows.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (valA === undefined) {
        const matchingKey = Object.keys(a).find((k) => k === sortKey || k.startsWith(`${sortKey}_`));
        if (matchingKey) {
          valA = a[matchingKey];
          valB = b[matchingKey];
        }
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * sortMultiplier;
      }
      return String(valA || "").localeCompare(String(valB || "")) * sortMultiplier;
    });

    return {
      dataset: dataset.id,
      rows: normalizedRows,
      meta: {
        axis: axisField.id,
        legend:
          axisField && legendField && legendField.id === axisField.id
            ? `${legendField.id}_legend`
            : legendField?.id,
        metrics: metricKeys,
        totalRows: normalizedRows.length,
        truncated: isTruncated,
        engine: "prisma_groupby",
      },
    };
  }

  // --------------------------------------------------------------------------
  // MOTOR B: Híbrido en Memoria (findMany con relaciones + agregación precisa)
  // --------------------------------------------------------------------------
  if (!modelDelegate.findMany) {
    throw new ValidationError(`Modelo Prisma '${prismaModelName}' no soporta findMany.`);
  }

  // Exigir filtro de fechas en datasets transaccionales para procesar en memoria
  if (dataset.isTransactional) {
    const hasDateFilter = queryData.filters?.some(
      (f) => fieldMap.get(f.field)?.dataType === "date"
    );
    if (!hasDateFilter) {
      throw new ValidationError(
        `El dataset transaccional '${dataset.id}' requiere al menos un filtro de fechas para ejecutarse en memoria.`
      );
    }
  }

  // Calcular dependencias para métricas grupales calculadas
  const internalValues = [...queryData.values];
  for (const v of queryData.values) {
    const f = fieldMap.get(v.field);
    if (f?.groupDependencies) {
      for (const dep of f.groupDependencies) {
        if (!internalValues.some((iv) => iv.field === dep.field && iv.agg === dep.agg)) {
          internalValues.push(dep);
        }
      }
    }
  }

  // Comprobar tope de registros de seguridad antes de cargar (si count está disponible)
  if (modelDelegate.count) {
    const totalCount = await modelDelegate.count({ where });
    if (totalCount > MAX_MEMORY_ROWS) {
      throw new ValidationError(
        `La consulta supera el límite de seguridad de ${MAX_MEMORY_ROWS.toLocaleString()} registros (${totalCount.toLocaleString()} filas encontradas). Por favor acote el rango de fechas o aplique más filtros.`
      );
    }
  }

  const rawRows = await modelDelegate.findMany({
    where,
    include: dataset.includeRelations,
    take: MAX_MEMORY_ROWS + 1,
  });

  if (rawRows.length > MAX_MEMORY_ROWS) {
    throw new ValidationError(
      `La consulta superó el tope máximo de ${MAX_MEMORY_ROWS.toLocaleString()} filas para procesamiento en memoria.`
    );
  }

  interface GroupAccumulator {
    axisLabel: string;
    legendLabel?: string;
    counts: Record<string, number>;
    sums: Record<string, number>;
    mins: Record<string, number>;
    maxs: Record<string, number>;
    distinctSets: Record<string, Set<unknown>>;
  }

  const groups = new Map<string, GroupAccumulator>();

  for (const row of rawRows) {
    const axisLabel = axisField
      ? extractDimensionValue(row, axisField, queryData.granularity)
      : "Total";
    const legendLabel = legendField
      ? extractDimensionValue(row, legendField, queryData.legendGranularity)
      : undefined;

    const groupKey = legendLabel ? `${axisLabel}__${legendLabel}` : axisLabel;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        axisLabel,
        legendLabel,
        counts: {},
        sums: {},
        mins: {},
        maxs: {},
        distinctSets: {},
      });
    }

    const acc = groups.get(groupKey)!;

    for (const v of internalValues) {
      const field = fieldMap.get(v.field)!;
      const metricKey = `${v.field}_${v.agg}`;

      acc.counts[metricKey] = (acc.counts[metricKey] || 0) + 1;

      if (v.agg === "countDistinct") {
        acc.distinctSets[metricKey] = acc.distinctSets[metricKey] || new Set<unknown>();
        const val = field.prismaField ? row[field.prismaField] : row[field.id];
        if (val !== null && val !== undefined) {
          acc.distinctSets[metricKey].add(val);
        }
        continue;
      }

      let rowVal = 0;
      if (field.isCalculated && field.calculate) {
        rowVal = field.calculate(row);
      } else if (field.prismaField && field.prismaField in row) {
        rowVal = toNumber(row[field.prismaField]);
      } else if (field.id in row) {
        rowVal = toNumber(row[field.id]);
      }

      acc.sums[metricKey] = (acc.sums[metricKey] || 0) + rowVal;
      acc.mins[metricKey] =
        metricKey in acc.mins ? Math.min(acc.mins[metricKey], rowVal) : rowVal;
      acc.maxs[metricKey] =
        metricKey in acc.maxs ? Math.max(acc.maxs[metricKey], rowVal) : rowVal;
    }
  }

  const normalizedRows: Record<string, string | number | boolean | null>[] = [];
  const resolvedLegendKey =
    axisField && legendField && legendField.id === axisField.id
      ? `${legendField.id}_legend`
      : legendField?.id;

  for (const acc of Array.from(groups.values())) {
    const rowRecord: Record<string, string | number | boolean | null> = {};

    if (axisField) {
      rowRecord[axisField.id] = acc.axisLabel;
    }
    if (resolvedLegendKey && acc.legendLabel !== undefined) {
      rowRecord[resolvedLegendKey] = acc.legendLabel;
    }

    const groupMetrics: Record<string, number> = {};

    // 1. Métricas estándar agregadas (calculadas para todas las variables internas requeridas)
    for (const v of internalValues) {
      const metricKey = `${v.field}_${v.agg}`;
      let finalVal = 0;

      switch (v.agg) {
        case "sum":
          finalVal = acc.sums[metricKey] || 0;
          break;
        case "avg": {
          const count = acc.counts[metricKey] || 1;
          finalVal = (acc.sums[metricKey] || 0) / count;
          break;
        }
        case "count":
          finalVal = acc.counts[metricKey] || 0;
          break;
        case "countDistinct":
          finalVal = acc.distinctSets[metricKey]?.size || 0;
          break;
        case "min":
          finalVal = acc.mins[metricKey] || 0;
          break;
        case "max":
          finalVal = acc.maxs[metricKey] || 0;
          break;
      }

      finalVal = Math.round(finalVal * 100) / 100;
      groupMetrics[metricKey] = finalVal;

      // Asignar al registro de salida solo si fue solicitada por el usuario
      if (queryData.values.some((qv) => qv.field === v.field && qv.agg === v.agg)) {
        rowRecord[metricKey] = finalVal;
      }
    }

    // 2. Medidas calculadas a nivel de grupo métrico (ej. ticketPromedio = total / pedidos)
    for (const v of queryData.values) {
      const field = fieldMap.get(v.field)!;
      if (field.isCalculated && field.calculateGroup) {
        const metricKey = `${v.field}_${v.agg}`;
        const calcVal = Math.round(field.calculateGroup(groupMetrics) * 100) / 100;
        rowRecord[metricKey] = calcVal;
      }
    }

    normalizedRows.push(rowRecord);
  }

  // 1. Ordenar y recortar los grupos ANTES de aplicar limit
  const isWeekday = isTimeSeries && queryData.granularity === "weekday";
  const isHourOfDay = isTimeSeries && queryData.granularity === "hourOfDay";
  let isTruncated = false;

  if (isWeekday && (!queryData.sort || queryData.sort.by === axisField?.id)) {
    // Orden especial para días de la semana: Lunes -> Domingo (o inverso si dir: 'desc')
    const sortMultiplier = queryData.sort?.dir === "desc" ? -1 : 1;
    normalizedRows.sort((a, b) => {
      const dayA = String(a[axisField!.id] || "");
      const dayB = String(b[axisField!.id] || "");
      const orderA = WEEKDAY_ORDER[dayA] ?? 99;
      const orderB = WEEKDAY_ORDER[dayB] ?? 99;
      return (orderA - orderB) * sortMultiplier;
    });

    if (axisField && normalizedRows.length > effectiveLimit) {
      isTruncated = true;
      normalizedRows.splice(effectiveLimit);
    }
  } else if (isHourOfDay && (!queryData.sort || queryData.sort.by === axisField?.id)) {
    // Orden numérico para hora del día: '00:00' -> '23:00' (o inverso si dir: 'desc')
    const sortMultiplier = queryData.sort?.dir === "desc" ? -1 : 1;
    normalizedRows.sort((a, b) => {
      const hourA = String(a[axisField!.id] || "");
      const hourB = String(b[axisField!.id] || "");
      return hourA.localeCompare(hourB) * sortMultiplier;
    });

    if (axisField && normalizedRows.length > effectiveLimit) {
      isTruncated = true;
      normalizedRows.splice(effectiveLimit);
    }
  } else if (
    isTimeSeries &&
    queryData.granularity !== "weekday" &&
    queryData.granularity !== "hourOfDay" &&
    (!queryData.sort || (queryData.sort.by === axisField?.id && queryData.sort.dir === "asc"))
  ) {
    // Serie temporal cronológica (por defecto o asc):
    // Para conservar los grupos MÁS RECIENTES si se trunca:
    // 1. Ordenar desc (los más recientes primero)
    normalizedRows.sort((a, b) => {
      const valA = String(a[axisField!.id] || "");
      const valB = String(b[axisField!.id] || "");
      return valB.localeCompare(valA);
    });

    // 2. Recortar al límite
    if (axisField && normalizedRows.length > effectiveLimit) {
      isTruncated = true;
      normalizedRows.splice(effectiveLimit);
    }

    // 3. Devolver en orden cronológico asc
    normalizedRows.reverse();
  } else {
    // Orden estándar por sort.by o por primera medida desc
    let sortKey: string;
    let sortDir: "asc" | "desc";
    if (queryData.sort) {
      sortKey = queryData.sort.by;
      sortDir = queryData.sort.dir;
    } else if (isTimeSeries) {
      sortKey = axisField!.id;
      sortDir = "asc";
    } else if (queryData.values.length > 0) {
      const firstMetric = queryData.values[0];
      sortKey = `${firstMetric.field}_${firstMetric.agg}`;
      sortDir = "desc";
    } else {
      sortKey = axisField?.id || "";
      sortDir = "asc";
    }

    const sortMultiplier = sortDir === "desc" ? -1 : 1;
    normalizedRows.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (valA === undefined) {
        const matchingKey = Object.keys(a).find((k) => k === sortKey || k.startsWith(`${sortKey}_`));
        if (matchingKey) {
          valA = a[matchingKey];
          valB = b[matchingKey];
        }
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * sortMultiplier;
      }
      return String(valA || "").localeCompare(String(valB || "")) * sortMultiplier;
    });

    if (axisField && normalizedRows.length > effectiveLimit) {
      isTruncated = true;
      normalizedRows.splice(effectiveLimit);
    }
  }

  // Si no había eje y no hubo registros en findMany, devolver fila con ceros
  if (!axisField && normalizedRows.length === 0) {
    const zeroRow: Record<string, number> = {};
    for (const v of queryData.values) {
      zeroRow[`${v.field}_${v.agg}`] = 0;
    }
    normalizedRows.push(zeroRow);
  }

  return {
    dataset: dataset.id,
    rows: normalizedRows,
    meta: {
      axis: axisField?.id,
      legend: resolvedLegendKey,
      metrics: metricKeys,
      totalRows: normalizedRows.length,
      truncated: isTruncated,
      engine: "in_memory_hybrid",
    },
  };
}
