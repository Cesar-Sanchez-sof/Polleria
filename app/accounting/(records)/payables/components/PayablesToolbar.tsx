"use client";

import Link from "next/link";
import { ArrowUpDown, BookOpen, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdvancedFilterToggle } from "@/components/shared/AdvancedFilterToggle";

interface PayablesToolbarProps {
  filtersOpen: boolean;
  onToggleFilters: () => void;
  sortOrder: "desc" | "asc";
  onToggleSort: () => void;
  onExport: () => void;
}

/** Búsqueda, orden y acciones de Cuentas por Pagar; vive en el header de la página. */
export function PayablesToolbar({ filtersOpen, onToggleFilters, sortOrder, onToggleSort, onExport }: Readonly<PayablesToolbarProps>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdvancedFilterToggle open={filtersOpen} onToggle={onToggleFilters} />
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
