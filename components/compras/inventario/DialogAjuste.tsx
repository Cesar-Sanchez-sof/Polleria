"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registrarAjusteInventario } from "@/lib/services/compras/insumo";
import { TipoMovimientoEnum } from "@prisma/client";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface Insumo {
  id_insumo: number;
  nombre: string;
  unidad_medida: string;
  stock_actual: number | string;
}

interface DialogAjusteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumo: Insumo | null;
  onSuccess: (updatedInsumo: any) => void;
}

export function DialogAjuste({
  open,
  onOpenChange,
  insumo,
  onSuccess,
}: DialogAjusteProps) {
  const [loading, setLoading] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoEnum>(TipoMovimientoEnum.Ajuste);
  const [cantidadReal, setCantidadReal] = useState<number>(0);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (insumo) {
      setCantidadReal(Number(insumo.stock_actual));
      setTipoMovimiento(TipoMovimientoEnum.Ajuste);
      setMotivo("");
    }
  }, [insumo, open]);

  if (!insumo) return null;

  const stockActualNum = Number(insumo.stock_actual);
  const diferencia = cantidadReal - stockActualNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      toast.error("El motivo del ajuste o merma es obligatorio");
      return;
    }
    setLoading(true);
    try {
      const { insumo: insumoActualizado } = await registrarAjusteInventario(
        insumo.id_insumo,
        cantidadReal,
        motivo,
        tipoMovimiento
      );
      toast.success(
        `${tipoMovimiento === TipoMovimientoEnum.Merma ? "Merma" : "Ajuste"} de inventario registrado correctamente`
      );
      onSuccess(insumoActualizado);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al registrar ajuste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Registrar Ajuste / Merma de Inventario</DialogTitle>
          <DialogDescription>
            Ajusta el stock real para el insumo <strong>{insumo.nombre}</strong>. Se
            generará un movimiento en el Kardex por la diferencia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock Sistema Actual:</span>
              <span className="font-semibold">
                {stockActualNum.toFixed(2)} {insumo.unidad_medida}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Diferencia calculada:</span>
              <span
                className={`font-semibold ${
                  diferencia > 0
                    ? "text-emerald-600"
                    : diferencia < 0
                    ? "text-rose-600"
                    : "text-muted-foreground"
                }`}
              >
                {diferencia > 0 ? `+${diferencia.toFixed(2)}` : diferencia.toFixed(2)}{" "}
                {insumo.unidad_medida}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo_movimiento">Tipo de Registro *</Label>
            <Select
              value={tipoMovimiento}
              onValueChange={(val) => setTipoMovimiento(val as TipoMovimientoEnum)}
            >
              <SelectTrigger id="tipo_movimiento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TipoMovimientoEnum.Ajuste}>
                  Ajuste de Inventario (Conteo físico / Diferencia)
                </SelectItem>
                <SelectItem value={TipoMovimientoEnum.Merma}>
                  Merma (Vencimiento / Deterioro / Rotura)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cantidad_real">Stock Físico Real Encontrado *</Label>
            <Input
              id="cantidad_real"
              type="number"
              step="0.01"
              min="0"
              value={cantidadReal}
              onChange={(e) => setCantidadReal(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo / Justificación *</Label>
            <Input
              id="motivo"
              placeholder={
                tipoMovimiento === TipoMovimientoEnum.Merma
                  ? "Ej: Descomposición por corte de luz, envase quebrado"
                  : "Ej: Conteo físico mensual, corrección de inventario"
              }
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              Confirmar Registro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
