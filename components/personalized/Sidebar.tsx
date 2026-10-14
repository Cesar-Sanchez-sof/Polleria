"use client";
import { useEffect, useState } from "react";
import {
  Component, User, LogOut, X, Menu, ChevronDown, Ticket, ChefHat, ShoppingCart, Percent,
  FileText, UtensilsCrossed, Wallet, ShieldCheck, Settings, BookOpen, type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { SECTIONS, linkPermission } from "@/lib/auth/route-permissions";

/** Enlace del menú: no se muestra si el usuario no tiene el permiso "ver" de esa pantalla. */
function NavLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const { can } = usePermissions();
  const permission = typeof href === "string" ? linkPermission(href) : null;
  if (permission && !can(permission)) return null;
  return <Link href={href} {...props} />;
}

interface NavItem {
  /** Subgrupo dentro del grupo; los ítems sin subgrupo se muestran sueltos. */
  group?: string;
  label: string;
  href: string;
  path: string;
}

interface NavSection {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Clave en SECTIONS: permisos cuya presencia hace visible el grupo. */
  permissions: string;
  items: NavItem[];
}

const SUBGROUP_ICONS: Record<string, LucideIcon> = {
  "Salón": UtensilsCrossed,
  "Cocina": ChefHat,
  "Caja": Wallet,
};

const NAV_SECTIONS: NavSection[] = [
  {
    key: "ventas", label: "VENTAS", icon: Ticket, permissions: "restaurant",
    items: [
      { group: "Salón", label: "Salón de mesas", href: "/sales?tab=tables", path: "ordenes-de-venta" },
      { group: "Salón", label: "Despacho de Bebidas", href: "/sales?tab=drinks", path: "despacho-bebidas" },
      { group: "Salón", label: "Pedidos Listos", href: "/sales?tab=kitchen", path: "kitchen" },
      { group: "Salón", label: "Pedidos no cobrados", href: "/sales?tab=payments", path: "cobros-pendientes" },
      { group: "Cocina", label: "Cocina (KDS)", href: "/restaurant/kitchen", path: "cocina-kds" },
      { group: "Cocina", label: "Platos e Ingredientes (Carta)", href: "/restaurant/dishes", path: "platos-recetas" },
      { group: "Caja", label: "Ventanilla", href: "/sales?tab=cashier", path: "caja-ventanilla" },
      { group: "Caja", label: "Clientes", href: "/sales?tab=customers", path: "clientes" },
      { group: "Caja", label: "Facturas de Venta", href: "/sales?tab=invoices", path: "facturas-de-venta" },
    ],
  },
  {
    key: "compras", label: "COMPRAS E INVENTARIO", icon: ShoppingCart, permissions: "purchases",
    items: [
      { label: "Compras", href: "/purchases/list", path: "list" },
      { label: "Inventario / Insumos", href: "/purchases/inventory", path: "inventory" },
      { label: "Transformación", href: "/purchases/transformation", path: "transformation" },
      { label: "Proveedores", href: "/purchases/suppliers", path: "suppliers" },
    ],
  },
  {
    key: "registros", label: "REGISTROS CONTABLES", icon: Percent, permissions: "records",
    items: [
      { label: "Asientos Contables", href: "/accounting/entries", path: "asientos-contables" },
      { label: "Cuentas por Pagar", href: "/accounting/payables", path: "cuentas-por-pagar" },
      { label: "Cuentas Contables", href: "/accounting/accounts", path: "cuentas-contables" },
      { label: "Periodos Contables", href: "/accounting/periods", path: "periodos-contables" },
    ],
  },
  {
    key: "reportes", label: "REPORTES CONTABLES", icon: FileText, permissions: "reports",
    items: [
      { label: "Balance de Comprobación", href: "/accounting/trial-balance", path: "balance-de-comprobacion" },
      { label: "Balance General", href: "/accounting/balance", path: "balance-general" },
      { label: "Dashboard Contable", href: "/accounting/dashboard", path: "dashboard-contable" },
      { label: "Estado de Resultados", href: "/accounting/income-statement", path: "estado-de-resultados" },
      { label: "Flujo de Efectivo", href: "/accounting/cash-flow", path: "flujo-de-efectivo" },
      { label: "Libro Mayor", href: "/accounting/ledger", path: "libro-mayor" },
      { label: "Resumen Ejecutivo", href: "/accounting/executive-summary", path: "resumen-ejecutivo" },
    ],
  },
  {
    key: "seguridad", label: "SEGURIDAD", icon: ShieldCheck, permissions: "security",
    items: [
      { label: "Usuarios", href: "/users", path: "users" },
      { label: "Roles y Permisos", href: "/roles", path: "roles" },
      { label: "Auditoría", href: "/audit", path: "auditoria" },
    ],
  },
  {
    key: "configuracion", label: "CONFIGURACIÓN", icon: Settings, permissions: "settings",
    items: [
      { label: "Comprobantes e Impresión", href: "/restaurant/settings/printers", path: "impresoras-comanderas" },
      { label: "Datos del Restaurante", href: "/restaurant/settings/business", path: "datos-empresa" },
      { label: "Guía Contable", href: "/accounting/guide", path: "guide-contable" },
      { label: "Mesas", href: "/restaurant/tables", path: "gestion-mesas" },
      { label: "Salones y Áreas", href: "/restaurant/areas", path: "salones-areas" },
    ],
  },
  {
    key: "documentacion", label: "DOCUMENTACIÓN", icon: BookOpen, permissions: "documentation",
    items: [
      { label: "Endpoints", href: "/swagger", path: "endpoints" },
      { label: "Diagrama DB", href: "/db-diagram", path: "db-diagram" },
    ],
  },
];

/** Agrupa los ítems por subgrupo conservando el orden de aparición. */
function groupItems(items: NavItem[]): Array<{ group?: string; items: NavItem[] }> {
  const out: Array<{ group?: string; items: NavItem[] }> = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out;
}

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen: controlledOpen, onCloseMobile }: SidebarProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, canAny } = usePermissions();
  const [internalOpen, setInternalOpen] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isSectionOpen = (key: string) => !!openSections[key];

  useEffect(() => {
    if (pathname === "/login") return;

    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          if (!cancelled && pathname !== "/login") {
            window.location.href = "/login";
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          if (pathname !== "/login") {
            window.location.href = "/login";
          }
          return;
        }
        setUser(data);
      })
      .catch(() => {
        if (!cancelled && pathname !== "/login") {
          window.location.href = "/login";
        }
        setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function closeSession() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }
  const isControlled = typeof onCloseMobile === "function";
  const mobileOpen = isControlled ? !!controlledOpen : internalOpen;

  const isLinkActive = (href: string) => {
    if (!pathname || href === "#") return false;

    const [hrefPath, hrefQuery = ""] = href.split("?");
    const cleanHref = hrefPath || "/";

    if (cleanHref === "/") return pathname === "/";
    if (!(pathname === cleanHref || pathname.startsWith(cleanHref + "/"))) return false;

    // Si el enlace trae query (p.ej. ?tab=tables), solo activo si coincide exactamente
    if (hrefQuery) {
      const wanted = new URLSearchParams(hrefQuery);
      for (const [key, value] of wanted.entries()) {
        const current = searchParams.get(key);
        // /sales sin ?tab se trata como pestaña "tables" por defecto
        if (key === "tab" && value === "tables" && cleanHref === "/sales") {
          if (current && current !== "tables") return false;
          continue;
        }
        if (current !== value) return false;
      }
      return true;
    }

    // Enlace sin query a /sales: activo solo si no hay tab o es el default "tables"
    if (cleanHref === "/sales") {
      const tab = searchParams.get("tab");
      return !tab || tab === "tables";
    }

    // Enlace sin query a /accounting/entries: activo solo si no hay journal especificado
    if (cleanHref === "/accounting/entries" && !hrefQuery) {
      const journal = searchParams.get("journal");
      return !journal;
    }

    return true;
  };

  const getLinkClass = (href: string) => {
    const active = isLinkActive(href);
    if (active) {
      return "flex items-center px-space-md py-1 rounded-lg text-[12px] font-bold transition-all bg-primary/10 text-primary shadow-xs";
    }
    return "flex items-center px-space-md py-1 rounded-lg text-[12px] font-medium transition-all text-on-surface-variant hover:bg-surface-container hover:text-on-surface";
  };

  const handleClose = () => {
    if (isControlled) onCloseMobile?.();
    else setInternalOpen(false);
  };

  const handleOpen = () => {
    if (!isControlled) setInternalOpen(true);
  };

  const handleLinkClick = () => {
    handleClose();
  };

  // Abre el grupo que contiene la página actual para que siempre se vea dónde estás.
  useEffect(() => {
    for (const sec of NAV_SECTIONS) {
      const item = sec.items.find((it) => isLinkActive(it.href));
      if (!item) continue;
      const keys = [sec.key, ...(item.group ? [`${sec.key}:${item.group}`] : [])];
      setOpenSections((prev) => (keys.every((k) => prev[k]) ? prev : { ...prev, ...Object.fromEntries(keys.map((k) => [k, true])) }));
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // La pantalla de login se muestra sin menú lateral.
  if (pathname === "/login") return null;

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={handleOpen}
          className="fixed top-3 left-3 z-40 md:hidden p-2 rounded-xl bg-card/95 border border-border text-foreground shadow-xs hover:bg-muted cursor-pointer"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-surface z-50 flex flex-col justify-between p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-surface-container-high transition-transform duration-300 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
      >
        <div className="flex flex-col gap-space-sm overflow-y-auto">
          {/* Header */}
          <div className="relative flex flex-col items-center justify-center p-space-sm gap-space-xs text-center">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-0 top-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden cursor-pointer"
              aria-label="Cerrar menú lateral"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <Component className="w-7 text-primary-container" />
            </div>
            <NavLink
              className="font-headline text-[16px] font-bold text-on-surface tracking-wider mt-space-xs uppercase"
              href="/"
              target="_top"
              onClick={handleLinkClick}
            >
              ERP EMPRESARIAL
            </NavLink>
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              SISTEMA INTEGRAL
            </span>
          </div>

          <ThemeToggle />

          {/* Navigation */}
          <nav className="flex flex-col gap-1 px-space-xs">
            {NAV_SECTIONS.map((section) => {
              if (!canAny(SECTIONS[section.permissions])) return null;
              const Icon = section.icon;
              const open = isSectionOpen(section.key);
              const hasActive = section.items.some((item) => isLinkActive(item.href));
              return (
                <div key={section.key} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={open}
                    className={`w-full flex items-center gap-space-sm px-space-md py-1.5 text-left rounded-lg transition-colors cursor-pointer group select-none hover:bg-surface-container/60 ${hasActive && !open ? "bg-primary/5" : ""}`}
                  >
                    <Icon
                      className={`block w-4 h-4 shrink-0 transition-colors ${hasActive ? "text-primary" : "text-on-surface-variant group-hover:text-primary"}`}
                    />
                    <span
                      className={`flex-1 font-label text-[11px] leading-4 font-bold tracking-wider transition-colors group-hover:text-primary ${hasActive ? "text-primary" : "text-on-surface"}`}
                    >
                      {section.label}
                    </span>
                    <ChevronDown
                      className={`block w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
                    />
                  </button>
                  {open && (
                    <div className="flex flex-col ml-[1.15rem] pl-2 gap-0.5 border-l border-surface-container-high">
                      {groupItems(section.items).map(({ group, items }) => {
                        const visible = items.filter((item) => {
                          const permission = linkPermission(item.href);
                          return !permission || can(permission);
                        });
                        if (visible.length === 0) return null;
                        const links = visible.map((item) => (
                          <NavLink
                            key={item.href}
                            className={getLinkClass(item.href)}
                            data-path={item.path}
                            href={item.href}
                            target="_top"
                            onClick={handleLinkClick}
                          >
                            {item.label}
                          </NavLink>
                        ));
                        if (!group) return <React.Fragment key="_">{links}</React.Fragment>;

                        const subKey = `${section.key}:${group}`;
                        const SubIcon = SUBGROUP_ICONS[group];
                        const subOpen = isSectionOpen(subKey);
                        const subActive = visible.some((item) => isLinkActive(item.href));
                        return (
                          <div key={subKey} className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => toggleSection(subKey)}
                              aria-expanded={subOpen}
                              className={`w-full flex items-center gap-space-sm px-space-sm py-1 text-left rounded-lg transition-colors cursor-pointer group select-none hover:bg-surface-container/60 ${subActive && !subOpen ? "bg-primary/5" : ""}`}
                            >
                              {SubIcon && (
                                <SubIcon
                                  className={`block w-3.5 h-3.5 shrink-0 transition-colors ${subActive ? "text-primary" : "text-on-surface-variant group-hover:text-primary"}`}
                                />
                              )}
                              <span
                                className={`flex-1 font-label text-[11px] leading-4 font-bold tracking-wider transition-colors group-hover:text-primary ${subActive ? "text-primary" : "text-on-surface"}`}
                              >
                                {group.toUpperCase()}
                              </span>
                              <ChevronDown
                                className={`block w-3 h-3 shrink-0 text-muted-foreground transition-transform duration-200 ${subOpen ? "rotate-0" : "-rotate-90"}`}
                              />
                            </button>
                            {subOpen && (
                              <div className="flex flex-col ml-[0.9rem] pl-2 gap-0.5 border-l border-surface-container-high">
                                {links}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-space-sm py-space-xs bg-surface-container-low rounded-xl border border-surface-container-high mt-space-xs">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
              <User className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-label text-[11px] font-bold text-on-surface leading-tight">
                {user?.username ?? "Sin sesión"}
              </span>
              <span className="font-label text-[10px] text-on-surface-variant leading-tight">
                {user?.role ?? "Inicia sesión"}
              </span>
            </div>
          </div>
          <button
            className="text-on-surface-variant hover:text-error transition-colors p-1 cursor-pointer"
            type="button"
            title={user ? "Cerrar sesión" : "Iniciar sesión"}
            aria-label={user ? "Cerrar sesión" : "Iniciar sesión"}
            onClick={user ? closeSession : () => (window.location.href = "/login")}
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </aside>
    </>
  );
}
