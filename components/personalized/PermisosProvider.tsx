"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface Estado {
  cargando: boolean;
  superusuario: boolean;
  permisos: string[];
}

interface ContextoPermisos extends Estado {
  puede: (codigo: string) => boolean;
  puedeAlguno: (codigos: string[]) => boolean;
}

const Contexto = createContext<ContextoPermisos>({
  cargando: true,
  superusuario: false,
  permisos: [],
  puede: () => false,
  puedeAlguno: () => false,
});

/** Carga los permisos del usuario (desde /api/auth/me) y los comparte con el menú y las pantallas. */
export function PermisosProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado>({ cargando: true, superusuario: false, permisos: [] });

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelado = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((datos) => {
        if (cancelado) return;
        if (!datos) {
          setEstado((e) => ({ ...e, cargando: false }));
          return;
        }
        setEstado({
          cargando: false,
          superusuario: Boolean(datos.superusuario),
          permisos: Array.isArray(datos.permisos) ? datos.permisos : [],
        });
      })
      .catch(() => {
        if (!cancelado) setEstado((e) => ({ ...e, cargando: false }));
      });
    return () => {
      cancelado = true;
    };
  }, [pathname]);

  const valor = useMemo<ContextoPermisos>(() => {
    const puede = (codigo: string) => estado.superusuario || estado.permisos.includes(codigo);
    return { ...estado, puede, puedeAlguno: (codigos) => codigos.some(puede) };
  }, [estado]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePermisos(): ContextoPermisos {
  return useContext(Contexto);
}