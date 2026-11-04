"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Link2,
  ArrowLeft,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfigNavHeader() {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Secciones",
      href: "/dashboards/config/secciones",
      icon: Layers,
    },
    {
      label: "Tableros",
      href: "/dashboards/config/tableros",
      icon: LayoutDashboard,
    },
    {
      label: "Compartir Enlaces",
      href: "/dashboards/config/enlaces",
      icon: Link2,
    },
  ];

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur-xs px-6 pt-4 pb-0 shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboards">
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 rounded-md hover:bg-muted"
              title="Volver a la vista de tableros"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Settings className="size-4" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground leading-none">
                Configuración de Tableros
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Administración centralizada de vistas, permisos y enlaces
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboards">
            <Button variant="outline" size="xs" className="h-7 text-xs gap-1.5">
              <LayoutDashboard className="size-3.5" />
              <span>Ver Tableros</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Menú de Pestañas estilo Odoo */}
      <div className="flex items-center gap-1 -mb-px">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-all select-none ${
                isActive
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
