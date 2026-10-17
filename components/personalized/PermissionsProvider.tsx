"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface Status {
  loading: boolean;
  superuser: boolean;
  permissions: string[];
}

interface PermissionsContext extends Status {
  can: (code: string) => boolean;
  canAny: (codes: string[]) => boolean;
}

const Context = createContext<PermissionsContext>({
  loading: true,
  superuser: false,
  permissions: [],
  can: () => false,
  canAny: () => false,
});

/** Carga los permisos del usuario (desde /api/auth/me) y los comparte con el menú y las pantallas. */
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>({ loading: true, superuser: false, permissions: [] });

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setStatus((e) => ({ ...e, loading: false }));
          return;
        }
        setStatus({
          loading: false,
          superuser: Boolean(data.superuser),
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
        });
      })
      .catch(() => {
        if (!cancelled) setStatus((e) => ({ ...e, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const value = useMemo<PermissionsContext>(() => {
    const can = (code: string) => status.superuser || status.permissions.includes(code);
    return { ...status, can, canAny: (codes) => codes.some(can) };
  }, [status]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePermissions(): PermissionsContext {
  return useContext(Context);
}