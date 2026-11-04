import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ASSET_MIME_TYPES,
  ASSET_SLOTS,
  MAX_ASSET_BYTES,
  DEFAULT_BRANDING,
  assetUrl,
  detectImageMime,
  resolveBranding,
  type AssetSlot,
  type BrandingContent,
} from "@/lib/branding/defaults";
import { logAudit, type AuditActor } from "@/lib/services/audit.service";

const ROW_ID = "default";

export type BrandingAssetUrls = Record<AssetSlot, string>;

export interface BrandingDto {
  content: BrandingContent;
  /** Dirección de cada imagen; siempre responde (si no hay subida, sirve la imagen por defecto). */
  assets: BrandingAssetUrls;
  /** Ranuras con imagen propia en la base de datos. */
  customAssets: AssetSlot[];
}

export class BrandingInputError extends Error {}

/**
 * Personalización vigente. Nunca lanza: si la base no responde (o la tabla aún no existe) se usan los valores
 * por defecto, para que el login y el inicio sigan funcionando.
 */
export async function getBranding(): Promise<BrandingDto> {
  try {
    const [setting, assets] = await Promise.all([
      prisma.brandingSetting.findUnique({ where: { id: ROW_ID }, select: { content: true } }),
      prisma.brandingAsset.findMany({ select: { slot: true, updatedAt: true } }),
    ]);
    const versions = new Map(assets.map((a) => [a.slot, a.updatedAt.getTime()]));
    return {
      content: resolveBranding(setting?.content),
      assets: Object.fromEntries(ASSET_SLOTS.map((slot) => [slot, assetUrl(slot, versions.get(slot))])) as BrandingAssetUrls,
      customAssets: ASSET_SLOTS.filter((slot) => versions.has(slot)),
    };
  } catch (error) {
    console.error("[personalizacion] no se pudo leer; se usan los valores por defecto:", error);
    return {
      content: DEFAULT_BRANDING,
      assets: Object.fromEntries(ASSET_SLOTS.map((slot) => [slot, assetUrl(slot)])) as BrandingAssetUrls,
      customAssets: [],
    };
  }
}

interface WriteContext {
  actor: AuditActor | null;
  ipAddress?: string | null;
}

export async function saveBrandingContent(input: unknown, ctx: WriteContext): Promise<BrandingDto> {
  const content = resolveBranding(input) as unknown as Prisma.InputJsonObject;
  await prisma.brandingSetting.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, content, updatedBy: ctx.actor?.username ?? null },
    update: { content, updatedBy: ctx.actor?.username ?? null },
  });
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    module: "configuracion",
    entity: "branding",
    entityId: ROW_ID,
    description: "Actualizó la personalización (textos de marca, login e inicio)",
    ipAddress: ctx.ipAddress,
  });
  return getBranding();
}

export async function saveBrandingAsset(slot: AssetSlot, bytes: Uint8Array, ctx: WriteContext): Promise<BrandingDto> {
  if (bytes.length === 0) throw new BrandingInputError("El archivo está vacío.");
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new BrandingInputError(`La imagen supera el máximo de ${MAX_ASSET_BYTES / 1024 / 1024} MB.`);
  }
  const mimeType = detectImageMime(bytes);
  if (!mimeType || !ASSET_MIME_TYPES.includes(mimeType)) {
    throw new BrandingInputError("Formato no válido. Usa una imagen JPG, PNG o WebP.");
  }
  const data = Buffer.from(bytes);
  await prisma.brandingAsset.upsert({
    where: { slot },
    create: { slot, mimeType, data, sizeBytes: data.length, updatedBy: ctx.actor?.username ?? null },
    update: { mimeType, data, sizeBytes: data.length, updatedBy: ctx.actor?.username ?? null },
  });
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    module: "configuracion",
    entity: "branding_asset",
    entityId: slot,
    description: `Cambió la imagen «${slot}»`,
    ipAddress: ctx.ipAddress,
  });
  return getBranding();
}

/** Quita la imagen propia: vuelve a mostrarse la que viene por defecto. */
export async function resetBrandingAsset(slot: AssetSlot, ctx: WriteContext): Promise<BrandingDto> {
  await prisma.brandingAsset.deleteMany({ where: { slot } });
  await logAudit({
    actor: ctx.actor,
    action: "UPDATE",
    module: "configuracion",
    entity: "branding_asset",
    entityId: slot,
    description: `Restauró la imagen «${slot}» a la predeterminada`,
    ipAddress: ctx.ipAddress,
  });
  return getBranding();
}

export async function findBrandingAsset(slot: AssetSlot): Promise<{ mimeType: string; data: Buffer; updatedAt: Date } | null> {
  const row = await prisma.brandingAsset.findUnique({ where: { slot }, select: { mimeType: true, data: true, updatedAt: true } });
  return row ? { mimeType: row.mimeType, data: Buffer.from(row.data), updatedAt: row.updatedAt } : null;
}
