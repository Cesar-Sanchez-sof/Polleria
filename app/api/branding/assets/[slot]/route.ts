import { NextRequest, NextResponse } from "next/server";
import { ASSET_FALLBACKS, isAssetSlot } from "@/lib/branding/defaults";
import { findBrandingAsset } from "@/lib/services/settings/branding.service";

export const dynamic = "force-dynamic";

/**
 * Imagen de la marca (logo, foto del inicio). Es pública a propósito: el login la necesita antes de que
 * haya sesión, y son imágenes de la marca, no datos del negocio. Solo sirve ranuras conocidas; si no hay
 * una imagen subida (o la base no responde) redirige a la imagen predeterminada del proyecto.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slot: string }> }) {
  const { slot } = await params;
  if (!isAssetSlot(slot)) return new NextResponse("No encontrado", { status: 404 });

  const asset = await findBrandingAsset(slot).catch(() => null);
  if (!asset) return NextResponse.redirect(new URL(ASSET_FALLBACKS[slot], request.url), 307);

  // La dirección lleva `?v=<fecha>`: cambia cuando se sube otra imagen, así que puede cachearse sin riesgo.
  const versioned = request.nextUrl.searchParams.has("v");
  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.data.length),
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
