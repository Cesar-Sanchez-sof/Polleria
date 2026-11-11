"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { WidgetDataConfig } from "@/lib/dashboards/widget-schema";
import { resolveDateRange, resolvePreviousRange } from "@/lib/dashboards/date-utils";

export interface CatalogField {
  id: string;
  label: string;
  kind: "dimension" | "measure";
  dataType: "string" | "number" | "date";
  allowedAggregations?: string[];
  hasTime?: boolean;
  supportedGranularities?: string[];
  valueLabels?: Record<string, string>;
  isCalculated?: boolean;
  description?: string;
}

export interface CatalogDataset {
  id: string;
  label: string;
  description: string;
  isTransactional: boolean;
  defaultDateField?: string;
  fields: CatalogField[];
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

export interface VisualDataResult {
  data: NormalizedQueryResult | null;
  previousData?: NormalizedQueryResult | null;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  isTruncated: boolean;
  mutate: () => Promise<unknown>;
}

/**
 * Fetcher para la API de consulta analítica estilo Power BI.
 */
async function queryFetcher([url, queryData]: [string, WidgetDataConfig]): Promise<NormalizedQueryResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queryData),
  });

  if (res.status === 403) {
    throw new Error("Sin permiso para ver estos datos");
  }

  if (res.status === 400) {
    const errorBody = await res.json().catch(() => null);
    const friendlyMessage =
      errorBody?.error || "La consulta no pudo completarse. Revisa la configuración de campos o filtros.";
    throw new Error(friendlyMessage);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || `Error inesperado al cargar datos (${res.status}).`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Hook cliente para consultar datos analíticos de un visual con caché SWR.
 */
export function useVisualData(dataConfig?: WidgetDataConfig | null): VisualDataResult {
  // Resuelve dateRange relativo a un filtro between concreto antes de llamar a /query
  const resolvedConfig = useMemo(() => {
    if (!dataConfig) return null;
    let filters = [...(dataConfig.filters || [])];
    if (dataConfig.dateRange) {
      const resolvedRange = resolveDateRange(dataConfig.dateRange);
      // Reemplaza o agrega el filtro between sobre el campo de fecha indicado
      filters = filters.filter((f) => f.field !== dataConfig.dateRange?.field);
      filters.push({
        field: dataConfig.dateRange.field,
        operator: "between",
        value: resolvedRange,
      });
    }
    return {
      ...dataConfig,
      filters,
    };
  }, [dataConfig]);

  // Un visual está listo para consultar si tiene dataset y al menos una medida configurada
  const isValid = Boolean(
    resolvedConfig &&
      resolvedConfig.dataset &&
      resolvedConfig.dataset.trim() !== "" &&
      resolvedConfig.values &&
      resolvedConfig.values.length > 0
  );

  // La clave de SWR usa el payload con el filtro ya resuelto
  const key = isValid ? (["/api/dashboards/query", resolvedConfig] as [string, WidgetDataConfig]) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<NormalizedQueryResult, Error>(
    key,
    queryFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      shouldRetryOnError: false,
    }
  );

  // Configuración para el período anterior si se especificó compare: 'previousPeriod'
  const previousConfig = useMemo(() => {
    if (!dataConfig || dataConfig.compare !== "previousPeriod" || !dataConfig.dateRange) {
      return null;
    }
    const previousRange = resolvePreviousRange(dataConfig.dateRange);
    let filters = [...(dataConfig.filters || [])];
    filters = filters.filter((f) => f.field !== dataConfig.dateRange?.field);
    filters.push({
      field: dataConfig.dateRange.field,
      operator: "between",
      value: previousRange,
    });
    return {
      ...dataConfig,
      dateRange: undefined,
      filters,
    };
  }, [dataConfig]);

  const prevKey = previousConfig && isValid ? (["/api/dashboards/query", previousConfig] as [string, WidgetDataConfig]) : null;

  const { data: previousData } = useSWR<NormalizedQueryResult, Error>(
    prevKey,
    queryFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      shouldRetryOnError: false,
    }
  );

  return {
    data: data || null,
    previousData: previousData || null,
    isLoading: isValid ? isLoading : false,
    isValidating,
    error: error ? error.message : null,
    isTruncated: Boolean(data?.meta?.truncated),
    mutate,
  };
}

/**
 * Fetcher para el catálogo semántico de dashboards.
 */
async function catalogFetcher(url: string): Promise<CatalogDataset[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("No se pudo cargar el catálogo de datasets.");
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Hook para obtener los metadatos serializables de los datasets permitidos por RBAC.
 */
export function useDashboardCatalog() {
  const { data, error, isLoading, mutate } = useSWR<CatalogDataset[], Error>(
    "/api/dashboards/catalog",
    catalogFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    catalog: data || [],
    isLoading,
    error: error ? error.message : null,
    mutate,
  };
}
