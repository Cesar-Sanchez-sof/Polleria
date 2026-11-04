import fs from "node:fs";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ASSET_FALLBACKS, ASSET_SLOTS, DEFAULT_BRANDING, detectImageMime } from "../lib/branding/defaults";

/**
 * Deja la personalización lista en la base de datos: los textos por defecto y las dos fotos del proyecto
 * (logo y foto del inicio). Solo completa lo que falta: nunca pisa lo que el usuario ya personalizó.
 */
export async function seedBranding(prisma: PrismaClient): Promise<void> {
  await prisma.brandingSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", content: DEFAULT_BRANDING as unknown as Prisma.InputJsonObject, updatedBy: "seed" },
  });

  for (const slot of ASSET_SLOTS) {
    if (await prisma.brandingAsset.findUnique({ where: { slot }, select: { slot: true } })) continue;
    const file = path.join(process.cwd(), "public", ASSET_FALLBACKS[slot]);
    if (!fs.existsSync(file)) {
      console.warn(`⚠ No se encontró ${file}; la ranura «${slot}» usará la imagen por defecto.`);
      continue;
    }
    const data = fs.readFileSync(file);
    const mimeType = detectImageMime(data);
    if (!mimeType) {
      console.warn(`⚠ ${file} no es una imagen JPG/PNG/WebP; se omite.`);
      continue;
    }
    await prisma.brandingAsset.create({ data: { slot, mimeType, data, sizeBytes: data.length, updatedBy: "seed" } });
    console.log(`✔ Imagen «${slot}» guardada en la base de datos (${Math.round(data.length / 1024)} KB).`);
  }
  console.log("✔ Personalización lista.");
}
