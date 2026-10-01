"use client";
import { useState } from "react";
import { Sun, Moon, Monitor, Utensils, Component, CreditCardReader, ChefHat, User, LogOut, X, Menu } from "lucide-react";
import Link from "next/link";

import React from "react";
import { usePathname } from "next/navigation";

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen: controlledOpen, onCloseMobile }: SidebarProps = {}) {
  const pathname = usePathname();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof onCloseMobile === "function";
  const mobileOpen = isControlled ? !!controlledOpen : internalOpen;

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
      return "justify-between flex items-center px-space-md py-1 rounded-lg text-[12px] font-bold transition-all bg-primary/10 text-primary shadow-xs";
    }
    return "justify-between flex items-center px-space-md py-1 rounded-lg text-[12px] font-medium transition-all text-on-surface-variant hover:bg-surface-container hover:text-on-surface";
  };

  const getIconLinkClass = (href: string) => {
    const active = isLinkActive(href);
    if (active) {
      return "flex items-center gap-2 px-space-md py-1.5 rounded-lg text-[12px] font-bold transition-all bg-primary/10 text-primary shadow-xs";
    }
    return "flex items-center gap-2 px-space-md py-1.5 rounded-lg text-[12px] font-semibold transition-all text-on-surface hover:bg-surface-container";
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

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={handleOpen}
          className="fixed top-3 left-3 z-40 md:hidden p-2 rounded-xl bg-white/95 border border-slate-200 text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
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
        className={`fixed left-0 top-0 h-screen w-64 bg-surface z-50 flex flex-col justify-between p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-surface-container-high transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col gap-space-sm overflow-y-auto">
          {/* Header */}
          <div className="relative flex flex-col items-center justify-center p-space-sm gap-space-xs text-center">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-0 top-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden cursor-pointer"
              aria-label="Cerrar menú lateral"
            >
              <X className="w-5 h-5" />
            </button>
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
                className={getIconLinkClass("/restaurant/tables")}
                data-path="tables"
                href="/restaurant/tables"
                target="_top"
                onClick={handleLinkClick}
              >
                <Utensils className="w-4.5 h-4.5 text-primary" />
                <span>Mesas y Salón</span>
              </Link>
              <Link
                className={getIconLinkClass("/restaurant/kitchen")}
                data-path="kitchen"
                href="/restaurant/kitchen"
                target="_top"
                onClick={handleLinkClick}
              >
                <ChefHat className="w-4.5 h-4.5 text-tertiary" />
                <span>Cocina (KDS)</span>
              </Link>
              <Link
                className={getIconLinkClass("/restaurant/cashier")}
                data-path="cashier"
                href="/restaurant/cashier"
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
                  className={getLinkClass("/sales?tab=tables")}
                  data-path="ordenes-de-venta"
                  href="/sales?tab=tables"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Gestión de Mesas y Ventas
                </Link>
                <Link
                  className={getLinkClass("/sales?tab=customers")}
                  data-path="clientes"
                  href="/sales?tab=customers"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Clientes
                </Link>
                <Link
                  className={getLinkClass("/sales?tab=invoices")}
                  data-path="facturas-de-venta"
                  href="/sales?tab=invoices"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Facturas de Venta
                </Link>
                <Link
                  className={getLinkClass("/sales?tab=payments")}
                  data-path="cobros-pendientes"
                  href="/sales?tab=payments"
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
                  href="/purchases"
                  onClick={handleLinkClick}
                  className="font-label text-[11px] font-bold text-on-surface hover:text-primary transition-colors"
                >
                  COMPRAS E INVENTARIO
                </Link>
              </div>
              <div className="flex flex-col pl-2 gap-0.5">
                <Link
                  className={getLinkClass("/purchases/add")}
                  data-path="add"
                  href="/purchases/add"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Órdenes de Compra
                </Link>
                <Link
                  className={getLinkClass("/purchases/receiving")}
                  data-path="receiving"
                  href="/purchases/receiving"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Recepción de Compra
                </Link>
                <Link
                  className={getLinkClass("/purchases/supplier-invoices")}
                  data-path="supplier-invoices"
                  href="/purchases/supplier-invoices"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Facturas y Pagos
                </Link>
                <Link
                  className={getLinkClass("/purchases/inventory")}
                  data-path="inventory"
                  href="/purchases/inventory"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Inventario / Insumos
                </Link>
                <Link
                  className={getLinkClass("/purchases/transformation")}
                  data-path="transformation"
                  href="/purchases/transformation"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Transformación
                </Link>
                <Link
                  className={getLinkClass("/purchases/suppliers")}
                  data-path="suppliers"
                  href="/purchases/suppliers"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Proveedores
                </Link>
                <Link
                  className={getLinkClass("/purchases/purchase-without-voucher")}
                  data-path="purchase-without-voucher"
                  href="/purchases/purchase-without-voucher"
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
                  className={getLinkClass("/accounting/entries")}
                  data-path="dashboard-contabilidad"
                  href="/accounting/entries"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Asientos contables
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /* bg-rose-600 */ />
                </Link>
                <Link
                  className={getLinkClass("/accounting/accounts")}
                  data-path="dashboard-contabilidad"
                  href="/accounting/accounts"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  <span>Cuentas contables</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /* bg-rose-600 */ />
                </Link>
                <Link
                  className={getLinkClass("/accounting/journal")}
                  data-path="libro-diario"
                  href="/accounting/journal"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Libro Diario
                </Link>
                <Link
                  className={getLinkClass("/accounting/ledger")}
                  data-path="libro-mayor"
                  href="/accounting/ledger"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Libro Mayor
                </Link>
                <Link
                  className={getLinkClass("/accounting/balance")}
                  data-path="balance-general"
                  href="/accounting/balance"
                  target="_top"
                  onClick={handleLinkClick}
                >
                  Balance General
                </Link>
                <Link
                  className={getLinkClass("/accounting/income-statement")}
                  data-path="estado-de-resultados"
                  href="/accounting/income-statement"
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
