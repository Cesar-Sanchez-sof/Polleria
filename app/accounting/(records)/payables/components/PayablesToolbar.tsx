"use client";

import Link from "next/link";
import { ArrowUpDown, BookOpen, Download, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PayablesToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  sortOrder: "desc" | "asc";
  onToggleSort: () => void;
  onExport: () => void;
}

/** Búsqueda, orden y acciones de Cuentas por Pagar; vive en el header de la página. */
export function PayablesToolbar({ search, onSearch, sortOrder, onToggleSort, onExport }: Readonly<PayablesToolbarProps>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-64">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por proveedor, RUC o N° comprobante..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-9 pl-9 pr-8 text-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            className="absolute right-2.5 top-2.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onToggleSort} className="h-9 text-xs" title="Cambiar orden por fecha de emisión">
        <ArrowUpDown className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
        <span>{sortOrder === "desc" ? "Más recientes" : "Más antiguos"}</span>
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={onExport} className="h-9 border-border/80 text-xs">
        <Download className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
        <span>Exportar CSV</span>
      </Button>

      <Link href="/accounting/entries" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 border-border/80 text-xs")}>
        <BookOpen className="mr-1 h-3.5 w-3.5 text-primary" />
        <span>Libro Diario</span>
      </Link>
    </div>
  );
}
