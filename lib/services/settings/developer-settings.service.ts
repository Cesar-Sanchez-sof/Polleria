import { prisma } from "@/lib/prisma";
import {
  ALL_FLAGS_OFF,
  DEVELOPER_SETTINGS,
  type DeveloperFlags,
  type DeveloperSettingKey,
} from "@/lib/developer-settings/catalog";
import { logAudit, type AuditActor } from "@/lib/services/security/audit.service";

export interface DeveloperSettingDto {
  key: DeveloperSettingKey;
  group: string;
  label: string;
  description: string;
  sensitive: boolean;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Lectura frecuente (cada petición del asistente): se cachea unos segundos por instancia del servidor. */
export const FLAGS_TTL_MS = 5_000;
let cache: { flags: DeveloperFlags; expiresAt: number } | null = null;

export function clearDeveloperFlagsCache(): void {
  cache = null;
}

/**
 * Banderas vigentes. Una bandera sin fila está apagada; si la base falla, todo queda apagado (falla cerrado)
 * y no se cachea el error. En varias instancias un cambio tarda como máximo `FLAGS_TTL_MS` en verse.
 */
export async function getDeveloperFlags(now: () => number = Date.now): Promise<DeveloperFlags> {
  if (cache && cache.expiresAt > now()) return cache.flags;
  try {
    const rows = await prisma.developerSetting.findMany({ select: { key: true, enabled: true } });
    const enabled = new Set(rows.filter((r) => r.enabled).map((r) => r.key));
    const flags = Object.fromEntries(DEVELOPER_SETTINGS.map((s) => [s.key, enabled.has(s.key)])) as Record<DeveloperSettingKey, boolean>;
    cache = { flags, expiresAt: now() + FLAGS_TTL_MS };
    return flags;
  } catch (error) {
    console.warn("[developer-settings] No se pudieron leer las banderas; se asume todo apagado:", error);
    return ALL_FLAGS_OFF;
  }
}

/** Catálogo con el estado y la última modificación de cada interruptor, para la pantalla. */
export async function listDeveloperSettings(): Promise<DeveloperSettingDto[]> {
  const rows = await prisma.developerSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return DEVELOPER_SETTINGS.map((s) => {
    const row = byKey.get(s.key);
    return {
      key: s.key,
      group: s.group,
      label: s.label,
      description: s.description,
      sensitive: "sensitive" in s && s.sensitive === true,
      enabled: row?.enabled ?? false,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  });
}

/** Enciende o apaga un interruptor y deja constancia en la bitácora. */
export async function setDeveloperSetting(
  key: DeveloperSettingKey,
  enabled: boolean,
  options: { actor: AuditActor | null; ipAddress?: string | null },
): Promise<DeveloperSettingDto[]> {
  const updatedBy = options.actor?.username ?? null;
  const previous = await prisma.developerSetting.findUnique({ where: { key }, select: { enabled: true } });
  await prisma.developerSetting.upsert({
    where: { key },
    create: { key, enabled, updatedBy },
    update: { enabled, updatedBy },
  });
  clearDeveloperFlagsCache();
  try {
    await logAudit({
      actor: options.actor,
      action: "UPDATE",
      module: "Configuracion",
      entity: "DeveloperSetting",
      entityId: key,
      description: `${enabled ? "Encendió" : "Apagó"} el interruptor de desarrollador ${key}`,
      details: { antes: previous?.enabled ?? false, despues: enabled },
      ipAddress: options.ipAddress ?? null,
    });
  } catch (auditError) {
    console.warn("[developer-settings] Aviso al registrar auditoría:", auditError);
  }
  return listDeveloperSettings();
}
