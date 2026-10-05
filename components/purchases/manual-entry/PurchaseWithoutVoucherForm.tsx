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
  id: number;
  name: string;
  unitOfMeasure: string;
}

interface PurchaseWithoutVoucherFormProps {
  supplies: Supply[];
}

export function PurchaseWithoutVoucherForm({
  supplies: initialSupplies,
}: PurchaseWithoutVoucherFormProps) {
  const router = useRouter();
  const [suppliesList, setSuppliesList] = useState<Supply[]>(initialSupplies);
  const [loading, setLoading] = useState(false);

  const [supplyId, setSupplyId] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [amountPaid, setAmountPaid] = useState<number | "">("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [informalPlaceOrVendor, setInformalPlaceOrVendor] = useState("");
  const [reason, setReason] = useState("");

  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);

  const selectedSupply = suppliesList.find((i) => i.id === Number(supplyId));
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
        supplyId: Number(supplyId),
        quantity: Number(quantity),
        amountPaid: Number(amountPaid),
        date,
        informalPlaceOrVendor: informalPlaceOrVendor || undefined,
        reason: reason || undefined,
      });

      toast.success("Compra menor registrada exitosamente");
      router.refresh();
      setSupplyId("");
      setQuantity(1);
      setAmountPaid("");
      setInformalPlaceOrVendor("");
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
      setSupplyId(created.id);
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
          <Plus className="h-3.5 w-3.5" /> + Crear Insumo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-1">
          <Label htmlFor="supply">Insumo Comprado *</Label>
          <Select
            value={supplyId ? supplyId.toString() : ""}
            onValueChange={(val) => setSupplyId(Number(val))}
          >
            <SelectTrigger id="supply">
              <SelectValue placeholder="Seleccionar insumo">
                {selectedSupply ? selectedSupply.name : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliesList.map((i) => (
                <SelectItem key={i.id} value={i.id.toString()}>
                  {i.name} ({i.unitOfMeasure})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quantity">Cantidad *</Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            min="0.01"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || "")}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amountPaid">Monto Pagado Total (S/) *</Label>
          <Input
            id="amountPaid"
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
          <Label htmlFor="date">Fecha de Compra</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="informalPlaceOrVendor">Lugar / Proveedor Informal</Label>
          <Input
            id="informalPlaceOrVendor"
            placeholder="Ej: Mercado Central, Bodega Don José, Vendedor Ambulante"
            value={informalPlaceOrVendor}
            onChange={(e) => setInformalPlaceOrVendor(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Motivo / Justificación</Label>
        <Textarea
          id="reason"
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
            S/ {calculatedUnitCost.toFixed(2)} / {selectedSupply?.unitOfMeasure || "unidad"}
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
