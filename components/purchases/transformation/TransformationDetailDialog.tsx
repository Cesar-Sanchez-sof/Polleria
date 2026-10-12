"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, ArrowRight, Package, Sparkles } from "lucide-react";

export interface TransformationDetailItem {
  id: number;
  itemType: string;
  quantity: number | string;
  unitCost?: number | string | null;
  supply: {
    id: number;
    name: string;
    unitOfMeasure: string;
  };
}

export interface TransformationDetailRecord {
  id: number;
  date: Date | string;
  notes?: string | null;
  anulado?: boolean;
  anuladoAt?: Date | string | null;
  anuladoPor?: number | null;
  motivoAnulacion?: string | null;
  employee: {
    firstName: string;
    paternalLastName?: string | null;
  };
  annulledBy?: {
    firstName: string;
    paternalLastName?: string | null;
  } | null;
  items: TransformationDetailItem[];
}

interface TransformationDetailDialogProps {
  transformation: TransformationDetailRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransformationDetailDialog({
  transformation,
  open,
  onOpenChange,
}: TransformationDetailDialogProps) {
  if (!transformation) return null;

  const dateStr = new Date(transformation.date).toLocaleString("es-PE");
  const consumptions = transformation.items.filter((i) => i.itemType === "Consumo");
  const productions = transformation.items.filter((i) => i.itemType === "Producido");

  const totalConsumedValue = consumptions.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const totalProducedValue = productions.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Detalle del Lote TR-{transformation.id.toString().padStart(4, "0")}
            </DialogTitle>
            {transformation.anulado && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300">
                Anulada
              </span>
            )}
          </div>
          <DialogDescription>
            Auditoría de insumos consumidos y productos producidos en la transformación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Banner de anulación si aplica */}
          {transformation.anulado && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-700">Transformación Anulada</span>
                {transformation.anuladoAt && (
                  <span className="text-[11px] text-rose-600">
                    {new Date(transformation.anuladoAt).toLocaleString("es-PE")}
                  </span>
                )}
              </div>
              {transformation.annulledBy && (
                <p className="text-[11px]">
                  <span className="text-muted-foreground">Anulado por:</span>{" "}
                  {transformation.annulledBy.firstName}{" "}
                  {transformation.annulledBy.paternalLastName || ""}
                </p>
              )}
              {transformation.motivoAnulacion && (
                <p className="text-[11px] italic bg-white/60 p-1.5 rounded border border-rose-100">
                  <span className="font-medium not-italic">Motivo:</span>{" "}
                  {transformation.motivoAnulacion}
                </p>
              )}
            </div>
          )}

          {/* Metadatos principales */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
            <div>
              <span className="text-muted-foreground block text-[11px]">Fecha y Hora:</span>
              <span className="font-semibold text-foreground">{dateStr}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Responsable:</span>
              <span className="font-semibold text-foreground">
                {transformation.employee.firstName}{" "}
                {transformation.employee.paternalLastName || ""}
              </span>
            </div>
            {transformation.notes && (
              <div className="col-span-2 pt-1 border-t">
                <span className="text-muted-foreground block text-[11px]">Observaciones:</span>
                <span className="text-foreground">{transformation.notes}</span>
              </div>
            )}
          </div>

          {/* Tabla de Consumo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-700 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Insumos Consumidos (Salida)
              </span>
              <span className="font-medium text-muted-foreground">
                Total: S/ {totalConsumedValue.toFixed(2)}
              </span>
            </div>
            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Total (S/)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptions.map((item) => {
                    const qty = Number(item.quantity) || 0;
                    const unitCost = Number(item.unitCost) || 0;
                    const lineTotal = qty * unitCost;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.supply.name}</TableCell>
                        <TableCell className="text-right">
                          {qty.toFixed(2)} {item.supply.unitOfMeasure}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          S/ {unitCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          S/ {lineTotal.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Tabla de Producción */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Productos Producidos (Entrada)
              </span>
              <span className="font-medium text-muted-foreground">
                Total: S/ {totalProducedValue.toFixed(2)}
              </span>
            </div>
            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto Terminado</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Total (S/)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productions.map((item) => {
                    const qty = Number(item.quantity) || 0;
                    const unitCost = Number(item.unitCost) || 0;
                    const lineTotal = qty * unitCost;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.supply.name}</TableCell>
                        <TableCell className="text-right">
                          {qty.toFixed(2)} {item.supply.unitOfMeasure}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          S/ {unitCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          S/ {lineTotal.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-medium">
            <span>Balance de Costos:</span>
            <span>
              S/ {totalConsumedValue.toFixed(2)} consumidos{" "}
              <ArrowRight className="inline h-3.5 w-3.5 mx-1" /> S/ {totalProducedValue.toFixed(2)}{" "}
              producidos
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
