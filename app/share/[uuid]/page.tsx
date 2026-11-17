import React from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, AlertCircle, ArrowLeft, Lock } from "lucide-react";
import { currentSession } from "@/lib/auth/current-session";
import { getDashboardAccess } from "@/lib/services/dashboards/dashboard-access.service";
import { logAudit } from "@/lib/services/security/audit.service";
import { getShareWithDashboard } from "@/lib/services/dashboards/dashboard-share-reader.service";
import { ShareModeProvider } from "@/components/dashboards/share-mode-context";
import { WidgetRenderer } from "@/components/dashboards/WidgetRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrossFilterChip } from "@/components/dashboards/CrossFilterChip";
import { CrossFilterClearButton } from "@/components/dashboards/CrossFilterClearButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: "noindex",
};

interface SharePageProps {
  params: Promise<{ uuid: string }>;
}

export default async function SharePage(props: SharePageProps) {
  const { uuid } = await props.params;

  // 1. Verificar sesión
  const session = await currentSession();
  if (!session) {
    redirect(`/login?callbackUrl=/share/${uuid}`);
  }

  // 2. Buscar el share link — si no existe o está inactivo → pantalla de "Enlace no disponible"
  const share = await getShareWithDashboard(uuid).catch(() => null);

  if (!share || !share.isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 p-6 text-center select-none">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border/80 bg-background shadow-xs flex flex-col items-center">
          <div className="size-14 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center mb-4">
            <AlertCircle className="size-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Enlace no disponible
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Este enlace compartido no existe, ha expirado o ha sido revocado por un administrador.
          </p>
          <Link href="/dashboards">
            <Button variant="outline" className="gap-2 cursor-pointer">
              <ArrowLeft className="size-4" />
              <span>Volver a tableros</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Verificar acceso al dashboard
  let canView = false;
  try {
    const access = await getDashboardAccess(session.userId, share.dashboardId);
    canView = access.canView;
  } catch {
    canView = false;
  }

  if (!canView) {
    // Registrar intento de acceso denegado
    await logAudit({
      actor: { userId: session.userId, username: session.username },
      action: "STATUS_CHANGE",
      module: "dashboards",
      entity: "DashboardShare",
      entityId: uuid,
      description: `Acceso denegado a enlace compartido del tablero ${share.dashboardId}`,
    }).catch(() => void 0);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 p-6 text-center select-none">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border/80 bg-background shadow-xs flex flex-col items-center">
          <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <Lock className="size-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Acceso no autorizado
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            No tienes los permisos requeridos para visualizar la información de este tablero compartido.
          </p>
          <Link href="/dashboards">
            <Button variant="outline" className="gap-2 cursor-pointer">
              <ArrowLeft className="size-4" />
              <span>Volver a tableros</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const dashboard = share.dashboard;
  const widgets = dashboard.widgets ?? [];

  return (
    <ShareModeProvider value={true}>
      <div className="flex flex-col min-h-screen bg-muted/20">
        {/* Header de modo share (sin sidebar, layout limpio) */}
        <header className="h-14 border-b border-border/80 bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <LayoutDashboard className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  {dashboard.name}
                </h1>
                {dashboard.section && (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {dashboard.section.name}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-[10px] h-4.5 px-2 font-medium bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40"
                >
                  Vista compartida
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Acceso de solo lectura
              </p>
            </div>
          </div>
        </header>

        {/* Lienzo principal */}
        <main className="flex-1 p-6">
          <CrossFilterChip />

          {widgets.length === 0 ? (
            <div className="min-h-[420px] border-2 border-dashed border-border/70 rounded-2xl bg-card/30 flex flex-col items-center justify-center text-center p-8">
              <LayoutDashboard className="size-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Este tablero no contiene widgets configurados.</p>
            </div>
          ) : (
            <div
              className="grid gap-4 w-full"
              style={{
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                gridAutoRows: "80px",
              }}
            >
              {widgets.map((widget) => {
                const colStart = (widget.x ?? 0) + 1;
                const colSpan = widget.w ?? 4;
                const rowStart = (widget.y ?? 0) + 1;
                const rowSpan = widget.h ?? 2;

                return (
                  <div
                    key={widget.id}
                    className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col"
                    style={{
                      gridColumn: `${colStart} / span ${colSpan}`,
                      gridRow: `${rowStart} / span ${rowSpan}`,
                    }}
                  >
                    <WidgetRenderer widget={widget} isEditMode={false} isShareMode={true} />
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <CrossFilterClearButton />
      </div>
    </ShareModeProvider>
  );
}
