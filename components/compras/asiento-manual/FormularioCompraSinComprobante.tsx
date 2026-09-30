"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogInsumo } from "@/components/compras/inventario/DialogInsumo";
import { registrarCompraSinComprobante } from "@/lib/services/compras/compra-sin-comprobante";
import { toast } from "sonner";
import { Plus, Receipt } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Insumo {
  id_insumo: number;
  nombre: string;
  unidad_medida: string;
}

interface FormularioCompraSinComprobanteProps {
  insumos: Insumo[];
}

export function FormularioCompraSinComprobante({ insumos: initialInsumos }: FormularioCompraSinComprobanteProps) {
  const router = useRouter();
  const [insumosList, setInsumosList] = useState<Insumo[]>(initialInsumos);
  const [loading, setLoading] = useState(false);

  const [idInsumo, setIdInsumo] = useState<number | "">("");
  const [cantidad, setCantidad] = useState<number | "">(1);
  const [montoPagado, setMontoPagado] = useState<number | "">("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [proveedorInformal, setProveedorInformal] = useState("");
  const [motivo, setMotivo] = useState("");

  const [dialogInsumoOpen, setDialogInsumoOpen] = useState(false);

  const insumoSel = insumosList.find((i) => i.id_insumo === Number(idInsumo));
  const costoUnitarioCalculado =
    Number(cantidad) > 0 && Number(montoPagado) > 0
      ? Number(montoPagado) / Number(cantidad)
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idInsumo) {
      toast.error("Debe seleccionar un insumo");
      return;
    }
    if (!cantidad || Number(cantidad) <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    if (!montoPagado || Number(montoPagado) <= 0) {
      toast.error("El monto pagado debe ser mayor a 0");
      return;
    }

    setLoading(true);
    try {
      await registrarCompraSinComprobante({
        id_insumo: Number(idInsumo),
        cantidad: Number(cantidad),
        monto_pagado: Number(montoPagado),
        fecha,
        lugar_o_proveedor_informal: proveedorInformal || undefined,
        motivo: motivo || undefined,
      });

      toast.success("Compra menor registrada exitosamente");
      router.refresh();
      setIdInsumo("");
      setCantidad(1);
      setMontoPagado("");
      setProveedorInformal("");
      setMotivo("");
    } catch (err: any) {
      toast.error(err.message || "Error al registrar la compra menor");
    } finally {
      setLoading(false);
    }
  };

  const handleInsumoCreado = (nuevo: Insumo) => {
    if (nuevo) {
      setInsumosList((prev) => [...prev, nuevo]);
      setIdInsumo(nuevo.id_insumo);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-amber-600" />
          Registrar Compra Menor Directa
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogInsumoOpen(true)}
          className="h-7 text-xs flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> + Crear Insumo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-1">
          <Label htmlFor="insumo">Insumo Comprado *</Label>
          <Select
            value={idInsumo ? idInsumo.toString() : ""}
            onValueChange={(val) => setIdInsumo(Number(val))}
          >
            <SelectTrigger id="insumo">
              <SelectValue placeholder="Seleccionar insumo">
                {insumoSel ? insumoSel.nombre : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {insumosList.map((i) => (
                <SelectItem key={i.id_insumo} value={i.id_insumo.toString()}>
                  {i.nombre} ({i.unidad_medida})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cantidad">
            Cantidad *
          </Label>
          <Input
            id="cantidad"
            type="number"
            step="0.01"
            min="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(parseFloat(e.target.value) || "")}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="monto_pagado">Monto Pagado Total (S/) *</Label>
          <Input
            id="monto_pagado"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={montoPagado}
            onChange={(e) => setMontoPagado(parseFloat(e.target.value) || "")}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha de Compra</Label>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prov_informal">Lugar / Proveedor Informal</Label>
          <Input
            id="prov_informal"
            placeholder="Ej: Mercado Central, Bodega Don José, Vendedor Ambulante"
            value={proveedorInformal}
            onChange={(e) => setProveedorInformal(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="motivo">Motivo / Justificación</Label>
        <Textarea
          id="motivo"
          placeholder="Ej: Faltó cilantro para el turno noche, compra de emergencia sin comprobante..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
        />
      </div>

      {costoUnitarioCalculado > 0 && (
        <div className="text-xs text-muted-foreground flex justify-between bg-muted/30 p-2 rounded border">
          <span>Costo unitario implícito:</span>
          <span className="font-semibold text-foreground">
            S/ {costoUnitarioCalculado.toFixed(2)} / {insumoSel?.unidad_medida || "unidad"}
          </span>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          {loading && <Spinner className="h-4 w-4" />}
          Guardar Compra Menor
        </Button>
      </div>

      <DialogInsumo
        open={dialogInsumoOpen}
        onOpenChange={setDialogInsumoOpen}
        onSuccess={handleInsumoCreado}
      />
    </form>
  );
}
