"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Share2,
  Star,
  ChevronDown,
  Layers,
  LayoutDashboard,
  Link2,
  Settings,
  Check,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function DashboardHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentDashboardId = searchParams.get("id");

  const isConfigRoute = pathname.startsWith("/dashboards/config");
  const isDashboardsActive = !isConfigRoute;

  const [isFavorite, setIsFavorite] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Estado para el menú desplegable de Configuración
  const [configOpen, setConfigOpen] = useState(false);
  const configMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        configMenuRef.current &&
        !configMenuRef.current.contains(event.target as Node)
      ) {
        setConfigOpen(false);
      }
    }

    if (configOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [configOpen]);

  const toggleFavorite = () => {
    setIsFavorite((prev) => {
      const next = !prev;
      if (next) {
        toast.success("Tablero agregado a tus favoritos");
      } else {
        toast.info("Tablero removido de tus favoritos");
      }
      return next;
    });
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        toast.success("Enlace copiado al portapapeles");
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <>
      <header className="relative z-50 h-14 border-b border-border bg-card/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none">
        {/* Lado Izquierdo: Pestañas de Navegación estilo Odoo */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Pestaña Única: Tableros (Izquierda) */}
          <Link
            href="/dashboards"
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              isDashboardsActive
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <LayoutDashboard className="size-4" />
            <span className="tracking-tight">Tableros</span>
          </Link>

          {/* Botón Acceso Rápido: Configuración (Dropdown desplegable) */}
          <div className="relative" ref={configMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfigOpen((prev) => !prev);
              }}
              aria-expanded={configOpen}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isConfigRoute
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <Settings className="size-3.5 sm:size-4" />
              <span>Configuración</span>
              <ChevronDown
                className={`size-3.5 opacity-60 ml-0.5 transition-transform duration-200 ${
                  configOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Menú de Opciones Desplegable */}
            {configOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Ajustes de Tableros
                </div>
                <div className="h-px bg-border my-1" />

                <Link
                  href="/dashboards/config/secciones"
                  onClick={() => setConfigOpen(false)}
                  className="w-full flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground text-left cursor-pointer transition-colors"
                >
                  <Layers className="size-4 text-muted-foreground" />
                  <span>Secciones</span>
                </Link>

                <Link
                  href="/dashboards/config/tableros"
                  onClick={() => setConfigOpen(false)}
                  className="w-full flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground text-left cursor-pointer transition-colors"
                >
                  <LayoutDashboard className="size-4 text-muted-foreground" />
                  <span>Tableros</span>
                </Link>

                <Link
                  href="/dashboards/config/enlaces"
                  onClick={() => setConfigOpen(false)}
                  className="w-full flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground text-left cursor-pointer transition-colors"
                >
                  <Link2 className="size-4 text-muted-foreground" />
                  <span>Compartir enlaces</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Acciones (Compartir y Favorito) solo en la vista de tableros */}
        {!isConfigRoute && (
          <div className="flex items-center gap-2">
            {/* Botón de Compartir */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareDialogOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            >
              <Share2 className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Compartir</span>
            </Button>

            {/* Botón de Favorito */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleFavorite}
              aria-label="Marcar como favorito"
              className="size-8 cursor-pointer hover:bg-muted"
              title={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
            >
              <Star
                className={`size-4 transition-colors ${
                  isFavorite
                    ? "fill-amber-400 text-amber-500"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              />
            </Button>
          </div>
        )}
      </header>

      {/* Diálogo de Compartir */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              Compartir Tablero
            </DialogTitle>
            <DialogDescription>
              {currentDashboardId
                ? "Copia el enlace para compartir la vista de este tablero con tu equipo."
                : "Genera un enlace público o comparte el acceso directo a este módulo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">
              Enlace directo al tablero
            </label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={
                  typeof window !== "undefined"
                    ? window.location.href
                    : "https://erp.polleria.local/dashboards"
                }
                className="text-xs font-mono h-9 bg-muted/30"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopyLink}
                className="shrink-0 h-9 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-green-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Los usuarios con permisos de visualización podrán acceder directamente usando este vínculo.
            </p>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareDialogOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
