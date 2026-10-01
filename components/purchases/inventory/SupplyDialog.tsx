"use client";

import React, { useState } from "react";
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
import { createSupply, SupplyInput } from "@/lib/services/purchases/supply";
import { TipoInsumoEnum } from "@prisma/client";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface SupplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (createdSupply: any) => void;
  prefilledNombre?: string;
  prefilledTipo?: TipoInsumoEnum;
}

export function SupplyDialog({
  open,
  onOpenChange,
  onSuccess,
  prefilledNombre = "",
  prefilledTipo = TipoInsumoEnum.MateriaPrima,
}: SupplyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SupplyInput>({
    nombre: prefilledNombre,
    tipo: prefilledTipo,
    unidad_medida: "KG",
    stock_minimo: 5,
  });

  React.useEffect(() => {
    if (open) {
      setFormData({
        nombre: prefilledNombre,
        tipo: prefilledTipo,
        unidad_medida: "KG",
        stock_minimo: 5,
      });
    }
  }, [open, prefilledNombre, prefilledTipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createSupply(formData);
      toast.success("Insumo creado exitosamente");
      onSuccess(created);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al crear insumo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Nuevo Supply</DialogTitle>
          <DialogDescription>
            Crea un created insumo. El stock inicial siempre comienza en 0.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre del Supply *</Label>
            <Input
              id="nombre"
              placeholder="Ej: Pollo Entero, Papa Amarilla, Aceite"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de Supply</Label>
              <Select
                value={formData.tipo}
                onValueChange={(val) =>
                  setFormData({ ...formData, tipo: val as TipoInsumoEnum })
                }
              >
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TipoInsumoEnum.MateriaPrima}>Materia Prima</SelectItem>
                  <SelectItem value={TipoInsumoEnum.ProductoTerminado}>
                    Producto Terminado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unidad_medida">Unidad de Medida *</Label>
              <Input
                id="unidad_medida"
                placeholder="KG, UND, LT, PAQ"
                value={formData.unidad_medida}
                onChange={(e) =>
                  setFormData({ ...formData, unidad_medida: e.target.value.toUpperCase() })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock_minimo">Stock Mínimo de Alerta</Label>
            <Input
              id="stock_minimo"
              type="number"
              step="0.01"
              min="0"
              value={formData.stock_minimo}
              onChange={(e) =>
                setFormData({ ...formData, stock_minimo: parseFloat(e.target.value) || 0 })
              }
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
              Guardar Supply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
