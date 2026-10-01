"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SupplyDialog } from "./SupplyDialog";
import { AdjustmentDialog } from "./AdjustmentDialog";
import { Plus, Search, SlidersHorizontal, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SupplyType } from "@prisma/client";

interface Supply {
  id: number;
  name: string;
  type: SupplyType | "RawMaterial" | "FinishedProduct";
  unitOfMeasure: string;
  currentStock: number | string;
  minimumStock: number | string;
  active: boolean;
}

interface InventoryTableProps {
  initialSupplies: Supply[];
}

export function InventoryTable({ initialSupplies }: InventoryTableProps) {
  const [supplies, setSupplies] = useState<Supply[]>(initialSupplies);
  const [search, setSearch] = useState("");
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [supplyToAdjust, setSupplyToAdjust] = useState<Supply | null>(null);

  const filtered = supplies.filter((i) => {
    const q = search.toLowerCase();
    const code = `INS-${i.id.toString().padStart(3, "0")}`.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      code.includes(q) ||
      i.type.toLowerCase().includes(q)
    );
  });

  const handleNewSupplySuccess = (created: Supply) => {
    setSupplies((prev) => [created, ...prev]);
  };

  const handleAdjustmentSuccess = (updated: Supply) => {
    setSupplies((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
  };

  const handleOpenAdjustment = (supply: Supply) => {
    setSupplyToAdjust(supply);
    setAdjustmentDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, insumo o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setSupplyDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nuevo Insumo
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre Insumo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock Actual</TableHead>
              <TableHead className="text-right">Stock Mínimo</TableHead>
              <TableHead>Estado Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                  No se encontraron insumos en el inventario.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const code = `INS-${item.id.toString().padStart(3, "0")}`;
                const currentStock = Number(item.currentStock);
                const minStock = Number(item.minimumStock);
                const lowStock = currentStock <= minStock;
                const isRawMaterial =
                  item.type === SupplyType.RawMaterial || item.type === "RawMaterial";

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-semibold">{code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isRawMaterial
                            ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 font-medium"
                            : "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 font-medium"
                        }
                      >
                        {isRawMaterial ? "Materia Prima" : "Producto Terminado"}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.unitOfMeasure}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {currentStock.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {minStock.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {lowStock ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="h-3 w-3" /> Bajo Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Óptimo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAdjustment(item)}
                        className="flex items-center gap-1.5 ml-auto text-xs"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <SupplyDialog
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        onSuccess={handleNewSupplySuccess}
      />

      <AdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        supply={supplyToAdjust}
        onSuccess={handleAdjustmentSuccess}
      />
    </div>
  );
}
