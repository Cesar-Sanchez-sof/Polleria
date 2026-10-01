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
import { SupplyDialog } from "@/components/purchases/inventory/SupplyDialog";
import { registerPurchaseWithoutVoucher } from "@/lib/services/purchases/purchase-without-voucher";
import { toast } from "sonner";
import { Plus, Receipt } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Supply {
  id_insumo: number;
  nombre: string;
  unidad_medida: string;
}

interface PurchaseWithoutVoucherFormProps {
  supplies: Supply[];
}

export function PurchaseWithoutVoucherForm({ supplies: initialSupplies }: PurchaseWithoutVoucherFormProps) {
  const router = useRouter();
  const [suppliesList, setSuppliesList] = useState<Supply[]>(initialSupplies);
  const [loading, setLoading] = useState(false);

  const [supplyId, setSupplyId] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [amountPaid, setAmountPaid] = useState<number | "">("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [informalSupplier, setInformalSupplier] = useState("");
  const [reason, setReason] = useState("");

  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);

  const selectedSupply = suppliesList.find((i) => i.id_insumo === Number(supplyId));
  const calculatedUnitCost =
    Number(quantity) > 0 && Number(amountPaid) > 0
      ? Number(amountPaid) / Number(quantity)
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplyId) {
      toast.error("Debe seleccionar un insumo");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    if (!amountPaid || Number(amountPaid) <= 0) {
      toast.error("El monto pagado debe ser mayor a 0");
      return;
    }

    setLoading(true);
    try {
      await registerPurchaseWithoutVoucher({
        id_insumo: Number(supplyId),
        cantidad: Number(quantity),
        monto_pagado: Number(amountPaid),
        fecha: date,
        lugar_o_proveedor_informal: informalSupplier || undefined,
        motivo: reason || undefined,
      });

      toast.success("Compra menor registrada exitosamente");
      router.refresh();
      setSupplyId("");
      setQuantity(1);
      setAmountPaid("");
      setInformalSupplier("");
      setReason("");
    } catch (err: any) {
      toast.error(err.message || "Error al registrar la compra menor");
    } finally {
      setLoading(false);
    }
  };

  const handleSupplyCreated = (created: Supply) => {
    if (created) {
      setSuppliesList((prev) => [...prev, created]);
      setSupplyId(created.id_insumo);
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
          onClick={() => setSupplyDialogOpen(true)}
          className="h-7 text-xs flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> + Crear Supply
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-1">
          <Label htmlFor="insumo">Insumo Comprado *</Label>
          <Select
            value={supplyId ? supplyId.toString() : ""}
            onValueChange={(val) => setSupplyId(Number(val))}
          >
            <SelectTrigger id="insumo">
              <SelectValue placeholder="Seleccionar insumo">
                {selectedSupply ? selectedSupply.nombre : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliesList.map((i) => (
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
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || "")}
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
            value={amountPaid}
            onChange={(e) => setAmountPaid(parseFloat(e.target.value) || "")}
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
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prov_informal">Lugar / Supplier Informal</Label>
          <Input
            id="prov_informal"
            placeholder="Ej: Mercado Central, Bodega Don José, Vendedor Ambulante"
            value={informalSupplier}
            onChange={(e) => setInformalSupplier(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="motivo">Motivo / Justificación</Label>
        <Textarea
          id="motivo"
          placeholder="Ej: Faltó cilantro para el turno noche, compra de emergencia sin comprobante..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
      </div>

      {calculatedUnitCost > 0 && (
        <div className="text-xs text-muted-foreground flex justify-between bg-muted/30 p-2 rounded border">
          <span>Costo unitario implícito:</span>
          <span className="font-semibold text-foreground">
            S/ {calculatedUnitCost.toFixed(2)} / {selectedSupply?.unidad_medida || "unidad"}
          </span>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          {loading && <Spinner className="h-4 w-4" />}
          Guardar Compra Menor
        </Button>
      </div>

      <SupplyDialog
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        onSuccess={handleSupplyCreated}
      />
    </form>
  );
}
