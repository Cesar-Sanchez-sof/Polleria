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
import { DialogInsumo } from "./DialogInsumo";
import { DialogAjuste } from "./DialogAjuste";
import { Plus, Search, SlidersHorizontal, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Insumo {
  id_insumo: number;
  nombre: string;
  tipo: "MateriaPrima" | "ProductoTerminado";
  unidad_medida: string;
  stock_actual: number | string;
  stock_minimo: number | string;
  estado: boolean;
}

interface TablaInventarioProps {
  initialInsumos: Insumo[];
}

export function TablaInventario({ initialInsumos }: TablaInventarioProps) {
  const [insumos, setInsumos] = useState<Insumo[]>(initialInsumos);
  const [search, setSearch] = useState("");
  const [dialogInsumoOpen, setDialogInsumoOpen] = useState(false);
  const [dialogAjusteOpen, setDialogAjusteOpen] = useState(false);
  const [insumoAAjustar, setInsumoAAjustar] = useState<Insumo | null>(null);

  const filtered = insumos.filter((i) => {
    const q = search.toLowerCase();
    const codigo = `INS-${i.id_insumo.toString().padStart(3, "0")}`.toLowerCase();
    return (
      i.nombre.toLowerCase().includes(q) ||
      codigo.includes(q) ||
      i.tipo.toLowerCase().includes(q)
    );
  });

  const handleNuevoInsumoSuccess = (nuevo: Insumo) => {
    setInsumos((prev) => [nuevo, ...prev]);
  };

  const handleAjusteSuccess = (actualizado: Insumo) => {
    setInsumos((prev) =>
      prev.map((i) => (i.id_insumo === actualizado.id_insumo ? actualizado : i))
    );
  };

  const handleAbrirAjuste = (insumo: Insumo) => {
    setInsumoAAjustar(insumo);
    setDialogAjusteOpen(true);
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
        <Button onClick={() => setDialogInsumoOpen(true)} className="flex items-center gap-2">
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
                const codigo = `INS-${item.id_insumo.toString().padStart(3, "0")}`;
                const stActual = Number(item.stock_actual);
                const stMin = Number(item.stock_minimo);
                const bajoStock = stActual <= stMin;

                return (
                  <TableRow key={item.id_insumo}>
                    <TableCell className="font-mono text-xs font-semibold">{codigo}</TableCell>
                    <TableCell className="font-medium">{item.nombre}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.tipo === "MateriaPrima"
                            ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 font-medium"
                            : "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 font-medium"
                        }
                      >
                        {item.tipo === "MateriaPrima" ? "Materia Prima" : "Producto Terminado"}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.unidad_medida}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {stActual.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {stMin.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {bajoStock ? (
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
                        onClick={() => handleAbrirAjuste(item)}
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

      <DialogInsumo
        open={dialogInsumoOpen}
        onOpenChange={setDialogInsumoOpen}
        onSuccess={handleNuevoInsumoSuccess}
      />

      <DialogAjuste
        open={dialogAjusteOpen}
        onOpenChange={setDialogAjusteOpen}
        insumo={insumoAAjustar}
        onSuccess={handleAjusteSuccess}
      />
    </div>
  );
}
