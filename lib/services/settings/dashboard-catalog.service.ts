import {
  AVAILABLE_DATASETS,
  type MeasureAggregation,
  type DateGranularity,
  DATE_GRANULARITIES_WITH_TIME,
  DATE_GRANULARITIES_DATE_ONLY,
} from "@/lib/dashboards/semantic-model";
import { permissionsForUser, hasPermission } from "@/lib/auth/permissions";

export interface CatalogField {
  id: string;
  label: string;
  kind: "dimension" | "measure";
  dataType: "string" | "number" | "date";
  allowedAggregations?: MeasureAggregation[];
  hasTime?: boolean;
  supportedGranularities?: DateGranularity[];
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

export interface CatalogUserContext {
  userId?: number;
  superuser?: boolean;
}

/**
 * Servicio de Dominio para el Catálogo Semántico de Dashboards.
 * 
 * Devuelve únicamente los datasets para los cuales el usuario tiene permiso explícito (o superuser).
 * Excluye campos marcados como `hidden: true` y remueve funciones (customExtractor, calculate, etc.)
 * y rutas internas de base de datos (prismaField, prismaPath).
 */
export async function getDashboardCatalogService(
  userContext?: CatalogUserContext
): Promise<CatalogDataset[]> {
  let access: { superuser: boolean; codes: string[] } | null = null;
  if (userContext && !userContext.superuser && userContext.userId) {
    access = await permissionsForUser(userContext.userId);
  }

  const result: CatalogDataset[] = [];

  for (const ds of AVAILABLE_DATASETS) {
    // Verificar permiso si no es superuser
    if (userContext && !userContext.superuser && userContext.userId) {
      if (!access || !hasPermission(access, ds.requiredPermission)) {
        continue;
      }
    }

    const visibleFields = ds.fields.filter((f) => !f.hidden);
    const defaultDateField = ds.defaultDateField || visibleFields.find((f) => f.dataType === "date")?.id;

    const serializableFields: CatalogField[] = visibleFields.map((f) => {
      let granularities = f.supportedGranularities ? [...f.supportedGranularities] : undefined;
      if (f.dataType === "date") {
        granularities = f.hasTime ? DATE_GRANULARITIES_WITH_TIME : DATE_GRANULARITIES_DATE_ONLY;
      }
      return {
        id: f.id,
        label: f.label,
        kind: f.kind,
        dataType: f.dataType,
        allowedAggregations: f.allowedAggregations ? [...f.allowedAggregations] : undefined,
        hasTime: f.hasTime,
        supportedGranularities: granularities,
        valueLabels: f.valueLabels ? { ...f.valueLabels } : undefined,
        isCalculated: f.isCalculated,
        description: f.description,
      };
    });

    result.push({
      id: ds.id,
      label: ds.label,
      description: ds.description,
      isTransactional: ds.isTransactional ?? false,
      defaultDateField,
      fields: serializableFields,
    });
  }

  return result;
}
