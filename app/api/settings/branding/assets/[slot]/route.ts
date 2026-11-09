import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/permissions";
import { isAssetSlot, MAX_ASSET_BYTES } from "@/lib/branding/defaults";
import { BrandingInputError, resetBrandingAsset, saveBrandingAsset } from "@/lib/services/settings/branding.service";
import { requestIp } from "@/lib/services/security/audit.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slot: string }> };

/** Sube o reemplaza una imagen: formulario `multipart/form-data` con el archivo en el campo `file`. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await authorize("personalizacion.editar");
  if (!auth.ok) return auth.response;
  const { slot } = await params;
  if (!isAssetSlot(slot)) return NextResponse.json({ error: "Imagen desconocida." }, { status: 404 });

  // Se rechaza antes de leer el cuerpo si ya declara ser demasiado grande (con margen para el formulario).
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ASSET_BYTES + 64 * 1024) {
    return NextResponse.json({ error: `La imagen supera el máximo de ${MAX_ASSET_BYTES / 1024 / 1024} MB.` }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo de la imagen." }, { status: 400 });

  try {
    const data = await saveBrandingAsset(slot, new Uint8Array(await file.arrayBuffer()), {
      actor: { userId: auth.session.userId, username: auth.session.username },
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof BrandingInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "No se pudo guardar la imagen." }, { status: 500 });
  }
}

/** Quita la imagen propia y vuelve a la predeterminada. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await authorize("personalizacion.editar");
  if (!auth.ok) return auth.response;
  const { slot } = await params;
  if (!isAssetSlot(slot)) return NextResponse.json({ error: "Imagen desconocida." }, { status: 404 });
  try {
    const data = await resetBrandingAsset(slot, {
      actor: { userId: auth.session.userId, username: auth.session.username },
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "No se pudo restaurar la imagen." }, { status: 500 });
  }
}
