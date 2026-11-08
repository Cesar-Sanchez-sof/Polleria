import { NextRequest, NextResponse } from "next/server";
import { authorize, hasPermission, permissionsForUser } from "@/lib/auth/permissions";
import { getBranding, saveBrandingContent } from "@/lib/services/settings/branding.service";
import { requestIp } from "@/lib/services/security/audit.service";

export const dynamic = "force-dynamic";

/** Personalización vigente (textos e imágenes); `canEdit` indica si el usuario puede cambiarla. */
export async function GET() {
  const auth = await authorize("personalizacion.ver");
  if (!auth.ok) return auth.response;
  try {
    const [data, access] = await Promise.all([getBranding(), permissionsForUser(auth.session.userId)]);
    return NextResponse.json({ data, canEdit: hasPermission(access, "personalizacion.editar") });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la personalización." }, { status: 500 });
  }
}

/** Guarda los textos: el cuerpo es el contenido completo; lo inválido se sanea o vuelve al valor por defecto. */
export async function PUT(request: NextRequest) {
  const auth = await authorize("personalizacion.editar");
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Datos de entrada inválidos." }, { status: 400 });
  }
  try {
    const data = await saveBrandingContent(body, {
      actor: { userId: auth.session.userId, username: auth.session.username },
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la personalización." }, { status: 500 });
  }
}
