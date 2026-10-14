"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { usePermisos } from "@/components/personalized/PermisosProvider";
import { permisosRequeridos } from "@/lib/auth/rutas-permisos";

/** Muestra "Acceso denegado" en lugar de la pantalla si el rol del usuario no la incluye. */
export function GuardaRuta({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { cargando, puedeAlguno } = usePermisos();
  const requeridos = permisosRequeridos(pathname);

  if (!requeridos) return <>{children}</>;
  if (cargando) {
    return <div className="p-6 text-sm text-muted-foreground">Verificando permisos…</div>;
  }
  if (puedeAlguno(requeridos)) return <>{children}</>;

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