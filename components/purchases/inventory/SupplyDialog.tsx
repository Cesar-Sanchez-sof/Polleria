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
import { SupplyType, AffectationIgv } from "@prisma/client";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface SupplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (createdSupply: any) => void;
  prefilledName?: string;
  prefilledType?: SupplyType;
  prefilledAffectationIgv?: AffectationIgv;
}

export function SupplyDialog({
  open,
  onOpenChange,
  onSuccess,
  prefilledName = "",
  prefilledType = SupplyType.RawMaterial,
  prefilledAffectationIgv = AffectationIgv.Excluded,
}: SupplyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SupplyInput>({
    name: prefilledName,
    type: prefilledType,
    affectationIgv: prefilledAffectationIgv,
    unitOfMeasure: "KG",
    minimumStock: 5,
  });

  React.useEffect(() => {
    if (open) {
      setFormData({
        name: prefilledName,
        type: prefilledType,
        affectationIgv: prefilledAffectationIgv,
        unitOfMeasure: "KG",
        minimumStock: 5,
      });
    }
  }, [open, prefilledName, prefilledType, prefilledAffectationIgv]);

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
          <DialogTitle>Nuevo Insumo</DialogTitle>
          <DialogDescription>
            Crea un nuevo insumo. El stock inicial siempre comienza en 0.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre del Insumo *</Label>
            <Input
              id="name"
              placeholder="Ej: Pollo Entero, Papa Amarilla, Aceite"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipo de Insumo</Label>
              <Select
                value={formData.type}
                onValueChange={(val) =>
                  setFormData({ ...formData, type: val as SupplyType })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SupplyType.RawMaterial}>Materia Prima</SelectItem>
                  <SelectItem value={SupplyType.FinishedProduct}>
                    Producto Terminado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="affectationIgv">Afectación IGV</Label>
              <Select
                value={formData.affectationIgv}
                onValueChange={(val) =>
                  setFormData({ ...formData, affectationIgv: val as AffectationIgv })
                }
              >
                <SelectTrigger id="affectationIgv">
                  <SelectValue placeholder="Seleccionar afectación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AffectationIgv.Excluded}>Excluido</SelectItem>
                  <SelectItem value={AffectationIgv.Included}>Incluido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="unitOfMeasure">Unidad de Medida *</Label>
              <Input
                id="unitOfMeasure"
                placeholder="KG, UND, LT, PAQ"
                value={formData.unitOfMeasure}
                onChange={(e) =>
                  setFormData({ ...formData, unitOfMeasure: e.target.value.toUpperCase() })
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minimumStock">Stock Mínimo de Alerta</Label>
              <Input
                id="minimumStock"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimumStock}
                onChange={(e) =>
                  setFormData({ ...formData, minimumStock: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
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
              Guardar Insumo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
