"use client";
import { useEffect, useState } from "react";
import { Component, User, LogOut, X, Menu, ChevronDown } from "lucide-react";
import Link from "next/link";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePermisos } from "@/components/personalized/PermisosProvider";
import { SECCIONES, permisoDeEnlace } from "@/lib/auth/rutas-permisos";

/** Enlace del menú: no se muestra si el usuario no tiene el permiso "ver" de esa pantalla. */
function NavLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const { puede } = usePermisos();
  const permiso = typeof href === "string" ? permisoDeEnlace(href) : null;
  if (permiso && !puede(permiso)) return null;
  return <Link href={href} {...props} />;
}

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen: controlledOpen, onCloseMobile }: SidebarProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { puedeAlguno } = usePermisos();
  const [internalOpen, setInternalOpen] = useState(false);
  const [usuario, setUsuario] = useState<{ username: string; rol: string } | null>(null);
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

    let cancelado = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          if (!cancelado && pathname !== "/login") {
            window.location.href = "/login";
          }
          return null;
        }
        return res.json();
      })
      .then((datos) => {
        if (cancelado) return;
        if (!datos) {
          if (pathname !== "/login") {
            window.location.href = "/login";
          }
          return;
        }
        setUsuario(datos);
      })
      .catch(() => {
        if (!cancelado && pathname !== "/login") {
          window.location.href = "/login";
        }
        setUsuario(null);
      });

    return () => {
      cancelado = true;
    };
  }, [pathname]);

  async function cerrarSesion() {
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
      return "justify-between flex items-center px-space-md py-1 rounded-lg text-[12px] font-bold transition-all bg-primary/10 text-primary shadow-xs";
    }
    return "justify-between flex items-center px-space-md py-1 rounded-lg text-[12px] font-medium transition-all text-on-surface-variant hover:bg-surface-container hover:text-on-surface";
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
            {/* VENTAS Section */}
            {puedeAlguno(SECCIONES.ventas) && (
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => toggleSection("ventas")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  VENTAS
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("ventas") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("ventas") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/sales?tab=tables")}
                    data-path="ordenes-de-venta"
                    href="/sales?tab=tables"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Salón de mesas
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/sales?tab=drinks")}
                    data-path="despacho-bebidas"
                    href="/sales?tab=drinks"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Despacho de Bebidas
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/sales?tab=kitchen")}
                    data-path="kitchen"
                    href="/sales?tab=kitchen"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Pedidos Listos
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/sales?tab=payments")}
                    data-path="cobros-pendientes"
                    href="/sales?tab=payments"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Cobros No Realizados
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/sales?tab=cashier")}
                    data-path="caja-ventanilla"
                    href="/sales?tab=cashier"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Caja y ventanilla
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/sales?tab=customers")}
                    data-path="clientes"
                    href="/sales?tab=customers"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Clientes
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/sales?tab=invoices")}
                    data-path="facturas-de-venta"
                    href="/sales?tab=invoices"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Facturas de Venta
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-600" />
                  </NavLink>
                </div>
              )}
            </div>

            )}
            {/* COCINA Section */}
            {puedeAlguno(SECCIONES.cocina) && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => toggleSection("cocina")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  COCINA
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("cocina") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("cocina") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/restaurant/kitchen")}
                    data-path="cocina-kds"
                    href="/restaurant/kitchen"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Cocina (KDS)
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/restaurant/dishes")}
                    data-path="platos-recetas"
                    href="/restaurant/dishes"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Platos e Ingredientes (Carta)
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/restaurant/tables")}
                    data-path="gestion-mesas"
                    href="/restaurant/tables"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Registrar y Gestionar Mesas
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                </div>
              )}
            </div>

            )}
            {/* COMPRAS E INVENTARIO Section */}
            {puedeAlguno(SECCIONES.compras) && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => toggleSection("compras")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  COMPRAS E INVENTARIO
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("compras") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("compras") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/purchases")}
                    data-path="purchases-home"
                    href="/purchases"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Resumen Compras
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/purchases/add")}
                    data-path="add"
                    href="/purchases/add"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Añadir Compra
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/purchases/list")}
                    data-path="list"
                    href="/purchases/list"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Listar Compras
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/purchases/inventory")}
                    data-path="inventory"
                    href="/purchases/inventory"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Inventario / Insumos
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/purchases/transformation")}
                    data-path="transformation"
                    href="/purchases/transformation"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Transformación
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/purchases/suppliers")}
                    data-path="suppliers"
                    href="/purchases/suppliers"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Proveedores
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/purchases/purchase-without-voucher")}
                    data-path="purchase-without-voucher"
                    href="/purchases/purchase-without-voucher"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Compra Menor sin Comprobante
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                </div>
              )}
            </div>

            )}
            {/* REGISTROS CONTABLES Section */}
            {puedeAlguno(SECCIONES.registros) && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => toggleSection("registros")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  REGISTROS CONTABLES
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("registros") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("registros") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/accounting/entries")}
                    data-path="asientos-contables"
                    href="/accounting/entries"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Asientos Contables
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/entries?journal=Caja%20y%20bancos")}
                    data-path="contabilidad-caja"
                    href="/accounting/entries?journal=Caja%20y%20bancos"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Contabilidad Caja
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/payables")}
                    data-path="cuentas-por-pagar"
                    href="/accounting/payables"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Cuentas por Pagar
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/accounts")}
                    data-path="cuentas-contables"
                    href="/accounting/accounts"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Cuentas Contables
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/periods")}
                    data-path="periodos-contables"
                    href="/accounting/periods"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Periodos Contables
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/guide")}
                    data-path="guide-contable"
                    href="/accounting/guide"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Guía Contable
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                </div>
              )}
            </div>

            )}
            {/* REPORTES CONTABLES Section */}
            {puedeAlguno(SECCIONES.reportes) && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => toggleSection("reportes")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  REPORTES CONTABLES
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("reportes") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("reportes") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/accounting/dashboard")}
                    data-path="dashboard-contable"
                    href="/accounting/dashboard"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Dashboard Contable
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/executive-summary")}
                    data-path="resumen-ejecutivo"
                    href="/accounting/executive-summary"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Resumen Ejecutivo
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/trial-balance")}
                    data-path="balance-de-comprobacion"
                    href="/accounting/trial-balance"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Balance de Comprobación
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/cash-flow")}
                    data-path="flujo-de-efectivo"
                    href="/accounting/cash-flow"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Flujo de Efectivo
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/balance")}
                    data-path="balance-general"
                    href="/accounting/balance"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Balance General
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/income-statement")}
                    data-path="estado-de-resultados"
                    href="/accounting/income-statement"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Estado de Resultados
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/accounting/ledger")}
                    data-path="libro-mayor"
                    href="/accounting/ledger"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Libro Mayor
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                </div>
              )}
            </div>

            )}
            {/* SEGURIDAD Section */}
            {puedeAlguno(SECCIONES.seguridad) && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => toggleSection("seguridad")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  SEGURIDAD
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("seguridad") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("seguridad") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/usuarios")}
                    data-path="usuarios"
                    href="/usuarios"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Usuarios
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/roles")}
                    data-path="roles"
                    href="/roles"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Roles y Permisos
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/audit")}
                    data-path="auditoria"
                    href="/audit"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Auditoría
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                </div>
              )}
            </div>

            )}
            {/* CONFIGURACIÓN Section */}
            {puedeAlguno(SECCIONES.configuracion) && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => toggleSection("configuracion")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  CONFIGURACIÓN
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("configuracion") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("configuracion") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/restaurant/tables")}
                    data-path="gestion-mesas"
                    href="/restaurant/tables"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Registrar y Gestionar Mesas
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/restaurant/areas")}
                    data-path="salones-areas"
                    href="/restaurant/areas"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Salones y Áreas
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/restaurant/settings/business")}
                    data-path="datos-empresa"
                    href="/restaurant/settings/business"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Datos del Restaurante
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/restaurant/settings/printers")}
                    data-path="impresoras-comanderas"
                    href="/restaurant/settings/printers"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Comprobantes e Impresión
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                </div>
              )}
            </div>

            )}
            {/* DOCUMENTACIÓN Section */}
            {puedeAlguno(SECCIONES.documentacion) && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => toggleSection("documentacion")}
                className="w-full flex items-center justify-between px-space-md py-1 text-left rounded-lg hover:bg-surface-container/60 transition-colors cursor-pointer group select-none"
              >
                <span className="font-label text-[11px] font-bold text-on-surface tracking-wider group-hover:text-primary transition-colors">
                  DOCUMENTACIÓN
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSectionOpen("documentacion") ? "rotate-0" : "rotate-180"
                    }`}
                />
              </button>
              {isSectionOpen("documentacion") && (
                <div className="flex flex-col pl-2 gap-0.5">
                  <NavLink
                    className={getLinkClass("/swagger")}
                    data-path="endpoints"
                    href="/swagger"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Endpoints
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </NavLink>
                  <NavLink
                    className={getLinkClass("/db-diagram")}
                    data-path="db-diagram"
                    href="/db-diagram"
                    target="_top"
                    onClick={handleLinkClick}
                  >
                    Diagrama DB
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-600" />
                  </NavLink>
                </div>
              )}
            </div>
            )}
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
                {usuario?.username ?? "Sin sesión"}
              </span>
              <span className="font-label text-[10px] text-on-surface-variant leading-tight">
                {usuario?.rol ?? "Inicia sesión"}
              </span>
            </div>
          </div>
          <button
            className="text-on-surface-variant hover:text-error transition-colors p-1 cursor-pointer"
            type="button"
            title={usuario ? "Cerrar sesión" : "Iniciar sesión"}
            aria-label={usuario ? "Cerrar sesión" : "Iniciar sesión"}
            onClick={usuario ? cerrarSesion : () => (window.location.href = "/login")}
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </aside>
    </>
  );
}
