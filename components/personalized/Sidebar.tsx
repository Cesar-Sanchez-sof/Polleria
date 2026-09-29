"use client";

import React from "react";
import {
  Sun,
  Moon,
  Monitor,
  Utensils,
  Component,
  CreditCardReader,
  ChefHat,
  User,
  LogOut,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps = {}) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (!pathname || href === "#") return false;
    const cleanHref = href.split("?")[0];
    if (cleanHref === "/") return pathname === "/";
    if (pathname === cleanHref || pathname.startsWith(cleanHref + "/")) return true;
    return false;
  };

  const getLinkClass = (href: string) => {
    const active = isLinkActive(href);
    if (active) {
      return "flex items-center px-space-md py-1 rounded-lg text-[12px] font-bold transition-all bg-primary/10 text-primary shadow-xs";
    }
    return "flex items-center px-space-md py-1 rounded-lg text-[12px] font-medium transition-all text-on-surface-variant hover:bg-surface-container hover:text-on-surface";
  };

  const getIconLinkClass = (href: string) => {
    const active = isLinkActive(href);
    if (active) {
      return "flex items-center gap-2 px-space-md py-1.5 rounded-lg text-[12px] font-bold transition-all bg-primary/10 text-primary shadow-xs";
    }
    return "flex items-center gap-2 px-space-md py-1.5 rounded-lg text-[12px] font-semibold transition-all text-on-surface hover:bg-surface-container";
  };

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-surface z-50 flex flex-col justify-between p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-surface-container-high transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col gap-space-sm overflow-y-auto">
          {/* Header */}
          <div className="relative flex flex-col items-center justify-center p-space-sm gap-space-xs text-center">
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="absolute right-0 top-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden cursor-pointer"
                aria-label="Cerrar menú lateral"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <Component className="w-7 text-primary-container" />
            </div>
            <Link
              className="font-headline text-[16px] font-bold text-on-surface tracking-wider mt-space-xs uppercase"
              href="/"
              target="_top"
              onClick={handleLinkClick}
            >
              ERP EMPRESARIAL
            </Link>
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              SISTEMA INTEGRAL
            </span>
          </div>

          {/* Theme toggle */}
          <div className="flex items-center justify-center bg-surface-container-low rounded-full p-1 gap-1 mx-space-sm">
            <button
              className="flex-1 py-1 flex items-center justify-center rounded-full bg-surface-container-lowest text-primary-container shadow-sm hover:text-on-surface transition-colors"
              type="button"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              className="flex-1 py-1 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
              type="button"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              className="flex-1 py-1 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
              type="button"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 px-space-xs mt-space-xs">
            {/* RESTAURANTE & SALÓN Section */}
            <div className="px-space-md pt-1 pb-0.5">
              <span className="font-label text-[10px] uppercase text-outline font-bold tracking-wider">
                Restaurante & Salón
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <Link
                className={getIconLinkClass("/restaurante/mesas")}
                data-path="mesas"
                href="/restaurante/mesas"
                target="_top"
                onClick={handleLinkClick}
              >
                <Utensils className="w-4.5 h-4.5 text-primary" />
                <span>Mesas y Salón</span>
              </Link>
              <Link
                className={getIconLinkClass("/restaurante/cocina")}
                data-path="cocina"
                href="/restaurante/cocina"
                target="_top"
                onClick={handleLinkClick}
              >
                <ChefHat className="w-4.5 h-4.5 text-tertiary" />
                <span>Cocina (KDS)</span>
              </Link>
              <Link
                className={getIconLinkClass("/restaurante/caja")}
                data-path="caja"
                href="/restaurante/caja"
                target="_top"
                onClick={handleLinkClick}
              >
                <CreditCardReader className="w-4.5 h-4.5 text-secondary" />
                <span>Caja y Cobro</span>
              </Link>
            </div>

            <div className="px-space-md pt-2 pb-0.5">
              <span className="font-label text-[10px] uppercase text-outline font-bold tracking-wider">
                Módulos ERP
              </span>
            </div>

            {/* VENTAS Section */}
            <div className="flex flex-col gap-0.5">
              <div className="px-space-md pt-1">
                <span className="font-label text-[11px] font-bold text-on-surface">
                  VENTAS
                </span>
              </div>
              <div className="flex flex-col pl-2 gap-0.5">
                <Link
                  className={getLinkClass("/ventas?tab=mesas")}
                  data-path="ordenes-de-venta"
                  href="/ventas?tab=mesas"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Gestión de Mesas y Ventas
                </Link>
                <Link
                  className={getLinkClass("/ventas?tab=clientes")}
                  data-path="clientes"
                  href="/ventas?tab=clientes"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Clientes
                </Link>
                <Link
                  className={getLinkClass("/ventas?tab=facturas")}
                  data-path="facturas-de-venta"
                  href="/ventas?tab=facturas"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Facturas de Venta
                </Link>
                <Link
                  className={getLinkClass("/ventas?tab=cobros")}
                  data-path="cobros-pendientes"
                  href="/ventas?tab=cobros"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Cobros No Cobrados
                </Link>
              </div>
            </div>

            {/* COMPRAS E INVENTARIO Section */}
            <div className="flex flex-col gap-0.5 mt-1">
              <div className="px-space-md pt-1">
                <Link
                  href="/compras"
                  onClick={handleLinkClick}
                  className="font-label text-[11px] font-bold text-on-surface hover:text-primary transition-colors"
                >
                  COMPRAS E INVENTARIO
                </Link>
              </div>
              <div className="flex flex-col pl-2 gap-0.5">
                <Link
                  className={getLinkClass("/compras/anadir")}
                  data-path="anadir"
                  href="/compras/anadir"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Órdenes de Compra
                </Link>
                <Link
                  className={getLinkClass("/compras/recepcion")}
                  data-path="recepcion"
                  href="/compras/recepcion"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Recepción de Compra
                </Link>
                <Link
                  className={getLinkClass("/compras/facturas-proveedor")}
                  data-path="facturas-de-proveedor"
                  href="/compras/facturas-proveedor"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Facturas y Pagos
                </Link>
                <Link
                  className={getLinkClass("/compras/inventario")}
                  data-path="inventario"
                  href="/compras/inventario"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Inventario / Insumos
                </Link>
                <Link
                  className={getLinkClass("/compras/transformacion")}
                  data-path="transformacion"
                  href="/compras/transformacion"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Transformación
                </Link>
                <Link
                  className={getLinkClass("/compras/proveedores")}
                  data-path="proveedores"
                  href="/compras/proveedores"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Proveedores
                </Link>
                <Link
                  className={getLinkClass("/compras/compra-sin-comprobante")}
                  data-path="compra-sin-comprobante"
                  href="/compras/compra-sin-comprobante"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Compra Menor sin Comprobante
                </Link>
              </div>
            </div>

            {/* CONTABILIDAD Section */}
            <div className="flex flex-col gap-0.5 mt-1">
              <div className="px-space-md pt-1">
                <span className="font-label text-[11px] font-bold text-on-surface">
                  CONTABILIDAD
                </span>
              </div>
              <div className="flex flex-col pl-2 gap-0.5">
                <Link
                  className={getLinkClass("/asientos")}
                  data-path="dashboard-contabilidad"
                  href="/asientos"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Asientos contables
                </Link>
                <Link
                  className={getLinkClass("#")}
                  data-path="libro-diario"
                  href="#"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Libro Diario
                </Link>
                <Link
                  className={getLinkClass("/mayor")}
                  data-path="libro-mayor"
                  href="/mayor"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Libro Mayor
                </Link>
                <Link
                  className={getLinkClass("/balance")}
                  data-path="balance-general"
                  href="/balance"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Balance General
                </Link>
                <Link
                  className={getLinkClass("/estado")}
                  data-path="estado-de-resultados"
                  href="/estado"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Estado de Resultados
                </Link>
              </div>
            </div>
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
                Admin User
              </span>
              <span className="font-label text-[10px] text-on-surface-variant leading-tight">
                Pollería Central
              </span>
            </div>
          </div>
          <button
            className="text-on-surface-variant hover:text-error transition-colors p-1"
            type="button"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </aside>
    </>
  );
}
