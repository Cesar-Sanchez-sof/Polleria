import { NextRequest, NextResponse } from "next/server";
import { authorize, hasPermission, permissionsForUser } from "@/lib/auth/permissions";
import { isDeveloperSettingKey } from "@/lib/developer-settings/catalog";
import { listDeveloperSettings, setDeveloperSetting } from "@/lib/services/developer-settings.service";
import { requestIp } from "@/lib/services/audit.service";

export const dynamic = "force-dynamic";

/** Interruptores de desarrollador con su estado; `canEdit` indica si el usuario puede cambiarlos. */
export async function GET() {
  const auth = await authorize("desarrollador.ver");
  if (!auth.ok) return auth.response;
  try {
    const [data, access] = await Promise.all([listDeveloperSettings(), permissionsForUser(auth.session.userId)]);
    return NextResponse.json({ data, canEdit: hasPermission(access, "desarrollador.editar") });
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar los interruptores." }, { status: 500 });
  }
}

/** Enciende o apaga un interruptor: `{ key, enabled }`. */
export async function PUT(request: NextRequest) {
  const auth = await authorize("desarrollador.editar");
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as { key?: unknown; enabled?: unknown } | null;
  if (!body || !isDeveloperSettingKey(body.key) || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Datos de entrada inválidos." }, { status: 400 });
  }
  try {
    const data = await setDeveloperSetting(body.key, body.enabled, {
      actor: { userId: auth.session.userId, username: auth.session.username },
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el interruptor." }, { status: 500 });
  }
}
