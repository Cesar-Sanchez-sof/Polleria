"use client";

import React, { useState, useMemo } from "react";
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
import { SupplierDialog } from "@/components/purchases/suppliers/SupplierDialog";
import { SupplyDialog } from "@/components/purchases/inventory/SupplyDialog";
import { createPurchaseOrder } from "@/lib/services/purchases/purchase-order";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, UserPlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Supplier {
  id: number;
  ruc: string;
  businessName: string;
}

interface Supply {
  id: number;
  name: string;
  unitOfMeasure: string;
}

interface PurchaseOrderFormProps {
  initialSuppliers: Supplier[];
  initialSupplies: Supply[];
}

interface LineForm {
  supplyId: number | "";
  quantityOrdered: number | "";
  unitPrice: number | "";
}

export function PurchaseOrderForm({
  initialSuppliers,
  initialSupplies,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [supplies, setSupplies] = useState<Supply[]>(initialSupplies);

  const [supplierId, setSupplierId] = useState<number | "">("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([
    { supplyId: "", quantityOrdered: 1, unitPrice: 0 },
  ]);
  const [loading, setLoading] = useState(false);

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [lineTargetSupply, setLineTargetSupply] = useState<number | null>(null);

  const handleAddLine = () => {
    setLines((prev) => [...prev, { supplyId: "", quantityOrdered: 1, unitPrice: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (
    index: number,
    field: keyof LineForm,
    val: number | string
  ) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const { subtotal, igv, total } = useMemo(() => {
    let sub = 0;
    lines.forEach((l) => {
      const qty = Number(l.quantityOrdered) || 0;
      const price = Number(l.unitPrice) || 0;
      sub += qty * price;
    });
    const i = Math.round(sub * 0.18 * 100) / 100;
    const tot = sub + i;
    return { subtotal: sub, igv: i, total: tot };
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Debe seleccionar un proveedor");
      return;
    }
    const validItems = lines.filter(
      (l) => l.supplyId !== "" && Number(l.quantityOrdered) > 0
    );
    if (validItems.length === 0) {
      toast.error("Debe ingresar al menos un insumo con cantidad válida");
      return;
    }

    setLoading(true);
    try {
      const res = await createPurchaseOrder({
        supplierId: Number(supplierId),
        expectedAt: expectedDate || null,
        notes: notes || undefined,
        items: validItems.map((l) => ({
          supplyId: Number(l.supplyId),
          quantityOrdered: Number(l.quantityOrdered),
          unitPrice: Number(l.unitPrice),
        })),
      });

      toast.success(`Orden de Compra ${res.orderNumber} creada exitosamente`);

      setSupplierId("");
      setExpectedDate("");
      setNotes("");
      setLines([{ supplyId: "", quantityOrdered: 1, unitPrice: 0 }]);

      router.push("/purchases/receiving");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al crear la orden de compra");
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierCreated = (created: any) => {
    if (created) {
      setSuppliers((prev) => [created, ...prev]);
      setSupplierId(created.id);
    }
  };

  const handleSupplyCreated = (created: any) => {
    if (created) {
      setSupplies((prev) => [created, ...prev]);
      if (lineTargetSupply !== null) {
        handleLineChange(lineTargetSupply, "supplyId", created.id);
      }
    }
  };

  const selectedSupplier = suppliers.find((p) => p.id === Number(supplierId));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-base font-semibold border-b pb-2">Datos Principales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="supplier">Proveedor *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-primary flex items-center gap-1"
                onClick={() => setSupplierDialogOpen(true)}
              >
                <UserPlus className="h-3 w-3" /> + Nuevo Proveedor
              </Button>
            </div>
            <Select
              value={supplierId ? supplierId.toString() : ""}
              onValueChange={(val) => setSupplierId(Number(val))}
            >
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Seleccionar Proveedor">
                  {selectedSupplier ? selectedSupplier.businessName : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expectedAt">Fecha Esperada de Entrega</Label>
            <Input
              id="expectedAt"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Observaciones / Notas</Label>
          <Textarea
            id="notes"
            placeholder="Especificaciones de entrega, horario o lugar..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-base font-semibold">Detalle de Insumos Pedidos</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLine}
            className="flex items-center gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar Fila
          </Button>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => {
            const selectedSupply = supplies.find((i) => i.id === Number(line.supplyId));
            const lineSubtotal =
              (Number(line.quantityOrdered) || 0) * (Number(line.unitPrice) || 0);

            return (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 items-center bg-muted/30 p-3 rounded-md border"
              >
                <div className="col-span-12 md:col-span-5 space-y-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Insumo #{index + 1}</Label>
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => {
                        setLineTargetSupply(index);
                        setSupplyDialogOpen(true);
                      }}
                    >
                      + Crear Insumo
                    </button>
                  </div>
                  <Select
                    value={line.supplyId ? line.supplyId.toString() : ""}
                    onValueChange={(val) =>
                      handleLineChange(index, "supplyId", Number(val))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar insumo">
                        {selectedSupply ? selectedSupply.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {supplies.map((i) => (
                        <SelectItem key={i.id} value={i.id.toString()}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={line.quantityOrdered}
                    onChange={(e) =>
                      handleLineChange(index, "quantityOrdered", parseFloat(e.target.value) || "")
                    }
                  />
                </div>

                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs">Precio Unit. (S/)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.unitPrice}
                    onChange={(e) =>
                      handleLineChange(
                        index,
                        "unitPrice",
                        parseFloat(e.target.value) || ""
                      )
                    }
                  />
                </div>

                <div className="col-span-10 md:col-span-2 space-y-1 text-right">
                  <Label className="text-xs text-muted-foreground">Subtotal</Label>
                  <div className="font-semibold text-sm py-1.5">
                    S/ {lineSubtotal.toFixed(2)}
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1 text-right pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLine(index)}
                    disabled={lines.length === 1}
                    className="text-destructive hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal Insumos:</span>
              <span className="font-medium text-foreground">S/ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IGV (18%):</span>
              <span className="font-medium text-foreground">S/ {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-foreground border-t pt-2">
              <span>Monto Total:</span>
              <span className="text-primary">S/ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/purchases")}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          {loading ? <Spinner className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          Generar Orden de Compra
        </Button>
      </div>

      <SupplierDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onSuccess={handleSupplierCreated}
      />

      <SupplyDialog
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        onSuccess={handleSupplyCreated}
      />
    </form>
  );
}
