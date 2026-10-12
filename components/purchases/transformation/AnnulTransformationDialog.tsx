"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Ban, Loader2, Package, Sparkles } from "lucide-react";
import { TransformationDetailRecord } from "./TransformationDetailDialog";
import { annulTransformation } from "@/lib/services/purchases/transformation";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AnnulTransformationDialogProps {
  transformation: TransformationDetailRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AnnulTransformationDialog({
  transformation,
  open,
  onOpenChange,
  onSuccess,
}: AnnulTransformationDialogProps) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!transformation) return null;

  const consumptions = transformation.items.filter((i) => i.itemType === "Consumo");
  const productions = transformation.items.filter((i) => i.itemType === "Producido");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivo.trim()) {
      toast.error("El motivo de anulación es obligatorio");
      return;
    }

    try {
      setIsSubmitting(true);
      await annulTransformation(transformation.id, motivo.trim());
      toast.success(
        `Transformación TR-${transformation.id.toString().padStart(4, "0")} anulada correctamente`
      );
      setMotivo("");
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (error: any) {
      console.error("Error al anular transformación:", error);
      toast.error(error?.message || "Error al anular la transformación");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isSubmitting) {
          if (!val) setMotivo("");
          onOpenChange(val);
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600">
            <Ban className="h-5 w-5" />
            Anular Transformación TR-{transformation.id.toString().padStart(4, "0")}
          </DialogTitle>
          <DialogDescription>
            Esta acción revertirá el stock de los insumos involucrados y marcará el registro como anulado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Advertencia visual */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-xs">Advertencia de Reversión de Stock</p>
              <p className="text-[11px] leading-relaxed">
                El stock de materias primas volverá a incrementarse y el stock de productos terminados será descontado.
                Si no hay suficiente stock del producto terminado, la anulación será bloqueada.
              </p>
            </div>
          </div>

          {/* Resumen de reversión */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg border text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Se devolverá al stock:
              </span>
              <ul className="space-y-0.5 pl-1">
                {consumptions.map((c) => (
                  <li key={c.id} className="text-foreground">
                    + {Number(c.quantity).toFixed(2)} {c.supply.unitOfMeasure} {c.supply.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-rose-700 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Se descontará del stock:
              </span>
              <ul className="space-y-0.5 pl-1">
                {productions.map((p) => (
                  <li key={p.id} className="text-foreground">
                    - {Number(p.quantity).toFixed(2)} {p.supply.unitOfMeasure} {p.supply.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Motivo obligatorio */}
          <div className="space-y-1.5">
            <Label htmlFor="motivo-anulacion" className="text-xs font-medium">
              Motivo de anulación <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="motivo-anulacion"
              placeholder="Indique la razón de la anulación (ej. Error de digitación, receta cancelada)..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={200}
              className="text-xs resize-none"
              disabled={isSubmitting}
              required
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Obligatorio</span>
              <span>{motivo.length}/200 caracteres</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting || !motivo.trim()}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Anulando...
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" />
                  Confirmar Anulación
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
