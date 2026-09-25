"use client";
import React, { useEffect } from 'react';
import { Sun, Moon, Monitor, Table, Utensils, Component, CreditCardReader, ChefHat, User, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function Sidebar() {
  useEffect(() => {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('nav a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
        link.classList.remove('text-on-surface-variant');
        link.classList.add('bg-primary/10', 'text-primary', 'font-bold', 'shadow-xs');
      }
    });
  }, []);
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface z-50 flex flex-col justify-between p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-surface-container-high">
      <div className="flex flex-col gap-space-sm overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col items-center justify-center p-space-sm gap-space-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
            <Component className="w-7 text-primary-container" />
          </div>
          <a className="font-headline text-[16px] font-bold text-on-surface tracking-wider mt-space-xs uppercase" href="/" target="_top">
            ERP EMPRESARIAL
          </a>
          <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
            SISTEMA INTEGRAL
          </span>
        </div>
        {/* Theme toggle */}
        <div className="flex items-center justify-center bg-surface-container-low rounded-full p-1 gap-1 mx-space-sm">
          <button className="flex-1 py-1 flex items-center justify-center rounded-full bg-surface-container-lowest text-primary-container shadow-sm hover:text-on-surface transition-colors" type="button">
            <Sun className="w-4 h-4" />
          </button>
          <button className="flex-1 py-1 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface transition-colors" type="button">
            <Moon className="w-4 h-4" />
          </button>
          <button className="flex-1 py-1 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface transition-colors" type="button">
            <Monitor className="w-4 h-4" />
          </button>
        </div>
        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-space-xs mt-space-xs" data-active-classes="bg-primary-fixed text-primary font-bold shadow-sm">
          <div className="px-space-md pt-1 pb-0.5">
            <span className="font-label text-[10px] uppercase text-outline font-bold tracking-wider">
              Restaurante & Salón
            </span>
          </div>
          {/* Restaurante Section */}
          <div className="flex flex-col gap-0.5">
            <Link
              className="flex items-center gap-2 px-space-md py-1.5 rounded-lg text-on-surface hover:bg-surface-container text-[12px] font-semibold transition-all"
              data-path="mesas"
              href="/restaurante/mesas"
              target="_top"
            >
              <Utensils className="w-4.5 h-4.5 text-primary" />
              <span>Mesas y Salón</span>
            </Link>
            <Link
              className="flex items-center gap-2 px-space-md py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-semibold transition-all"
              data-path="cocina"
              href="/Utensilse/cocina"
              target="_top"
            >
              <ChefHat className="w-4.5 h-4.5 text-tertiary" />
              <span>Cocina (KDS)</span>
            </Link>
            <Link
              className="flex items-center gap-2 px-space-md py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-semibold transition-all"
              data-path="caja"
              href="/restaurante/caja"
              target="_top"
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
          {/* Ventas Section */}
          <div className="flex flex-col gap-0.5">
            <div className="px-space-md pt-1">
              <span className="font-label text-[11px] font-bold text-on-surface">VENTAS</span>
            </div>
            <div className="flex flex-col pl-2 gap-0.5">
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="ordenes-de-venta"
                href="/ventas"
                target="_top"
              >
                Órdenes de Venta
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="clientes"
                href="#"
                target="_top"
              >
                Clientes
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="facturas-de-venta"
                href="#"
                target="_top"
              >
                Facturas de Venta
              </Link>
            </div>
          </div>
          {/* Compras Section */}
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="px-space-md pt-1">
              <span className="font-label text-[11px] font-bold text-on-surface">COMPRAS</span>
            </div>
            <div className="flex flex-col pl-2 gap-0.5">
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="proveedores"
                href="#"
                target="_top"
              >
                Proveedores
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="facturas-de-proveedor"
                href="#"
                target="_top"
              >
                Facturas de Proveedor
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="ordenes-de-compra"
                href="/compras/anadir"
                target="_top"
              >
                Añadir compra
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="ordenes-de-compra"
                href="/compras/listar"
                target="_top"
              >
                Listar compras
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="ordenes-de-compra"
                href="/compras/inventario"
                target="_top"
              >
                Inventario
              </Link>
            </div>
          </div>
          {/* Contabilidad Section */}
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="px-space-md pt-1">
              <span className="font-label text-[11px] font-bold text-on-surface">CONTABILIDAD</span>
            </div>
            <div className="flex flex-col pl-2 gap-0.5">
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="dashboard-contabilidad"
                href="/asientos"
                target="_top"
              >
                Asientos contables
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="libro-diario"
                href="#"
                target="_top"
              >
                Libro Diario
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="libro-mayor"
                href="/mayor"
                target="_top"
              >
                Libro Mayor
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="balance-general"
                href="/balance"
                target="_top"
              >
                Balance General
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="estado-de-resultados"
                href="/estado"
                target="_top"
              >
                Estado de Resultados
              </Link>
              <Link
                className="flex items-center px-space-md py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-[12px] font-medium transition-all"
                data-path="flujo-de-efectivo"
                href="#"
                target="_top"
              >
                Flujo de Efectivo
              </Link>
            </div>
          </div>
        </nav>
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-space-sm py-space-xs bg-surface-container-low rounded-xl border border-surface-container-high mt-space-xs">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
            <User className='w-4.5 h-4.5 text-white'></User>
          </div>
          <div className="flex flex-col">
            <span className="font-label text-[11px] font-bold text-on-surface leading-tight">Admin User</span>
            <span className="font-label text-[10px] text-on-surface-variant leading-tight">Pollería Central</span>
          </div>
        </div>
        <button className="text-on-surface-variant hover:text-error transition-colors p-1" type="button">
          <LogOut className='w-4.5 h-4.5 '></LogOut>
        </button>
      </div>
      {/* Active link handling moved to useEffect */}

    </aside>
  );
}
