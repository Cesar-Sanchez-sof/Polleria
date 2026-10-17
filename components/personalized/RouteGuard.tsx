"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { requiredPermissions } from "@/lib/auth/route-permissions";

/** Muestra "Acceso denegado" en lugar de la pantalla si el rol del usuario no la incluye. */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, canAny } = usePermissions();
  const required = requiredPermissions(pathname);

  if (!required) return <>{children}</>;
  if (loading) {
    return <PermissionsLoading />;
  }
  if (canAny(required)) return <>{children}</>;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Acceso denegado</h1>
        <p className="text-sm text-muted-foreground">
          Tu rol no tiene permiso para ver esta pantalla. Si lo necesitas, pídeselo a un administrador.
        </p>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

/**
 * Loading state while the permissions arrive: a page skeleton (header, filters, table) so the layout
 * does not jump, plus a message that fades in after a short delay (no flash on fast connections).
 */
function PermissionsLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-1 flex-col">
      <span className="sr-only">Verificando permisos…</span>

      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>

      <div className="relative flex-1 space-y-4 p-6">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="ml-auto h-9 w-32 rounded-xl" />
        </div>
        <div className="space-y-2 rounded-2xl border border-border p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div
            aria-hidden="true"
            className="flex items-center gap-2.5 rounded-full border border-border bg-background/95 px-4 py-2 text-xs font-medium text-muted-foreground shadow-md backdrop-blur animate-in fade-in-0 duration-300 delay-300 fill-mode-backwards"
          >
            <ShieldCheck className="h-4 w-4 animate-pulse text-primary" />
            Verificando tus permisos…
          </div>
        </div>
      </div>
    </div>
  );
}
