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
import { registerTransformation } from "@/lib/services/purchases/transformation";
import { SupplyType } from "@prisma/client";
import { toast } from "sonner";
import { Plus, Trash2, Repeat, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Supply {
  id: number;
  name: string;
  type: SupplyType;
  unitOfMeasure: string;
  currentStock: number | string;
}

interface TransformationFormProps {
  supplies: Supply[];
}

interface TransformationLine {
  supplyId: number | "";
  quantity: number | "";
}

export function TransformationForm({ supplies: initialSupplies }: TransformationFormProps) {
  const router = useRouter();
  const [suppliesList, setSuppliesList] = useState<Supply[]>(initialSupplies);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const [consumptions, setConsumptions] = useState<TransformationLine[]>([
    { supplyId: "", quantity: 1 },
  ]);

  const [outputs, setOutputs] = useState<TransformationLine[]>([
    { supplyId: "", quantity: 1 },
  ]);

  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);

  const rawMaterials = suppliesList.filter((i) => i.type === SupplyType.RawMaterial);
  const finishedGoods = suppliesList.filter((i) => i.type === SupplyType.FinishedProduct);

  const handleAddConsumption = () => {
    setConsumptions((prev) => [...prev, { supplyId: "", quantity: 1 }]);
  };
  const handleRemoveConsumption = (index: number) => {
    if (consumptions.length === 1) return;
    setConsumptions((prev) => prev.filter((_, i) => i !== index));
  };
  const handleConsumptionChange = (
    index: number,
    field: keyof TransformationLine,
    val: string | number
  ) => {
    setConsumptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAddOutput = () => {
    setOutputs((prev) => [...prev, { supplyId: "", quantity: 1 }]);
  };
  const handleRemoveOutput = (index: number) => {
    if (outputs.length === 1) return;
    setOutputs((prev) => prev.filter((_, i) => i !== index));
  };
  const handleOutputChange = (
    index: number,
    field: keyof TransformationLine,
    val: string | number
  ) => {
    setOutputs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validConsumptions = consumptions.filter(
      (c) => c.supplyId !== "" && Number(c.quantity) > 0
    );
    const validOutputs = outputs.filter(
      (p) => p.supplyId !== "" && Number(p.quantity) > 0
    );

    if (validConsumptions.length === 0) {
      toast.error("Debe agregar al menos una materia prima a consumir");
      return;
    }
    if (validOutputs.length === 0) {
      toast.error("Debe agregar al menos un producto terminado a producir");
      return;
    }

    setLoading(true);
    try {
      await registerTransformation({
        notes: note || undefined,
        consumos: validConsumptions.map((c) => ({
          supplyId: Number(c.supplyId),
          quantity: Number(c.quantity),
        })),
        producidos: validOutputs.map((p) => ({
          supplyId: Number(p.supplyId),
          quantity: Number(p.quantity),
        })),
      });

      toast.success("Transformación de inventario registrada con éxito");
      router.refresh();
      setConsumptions([{ supplyId: "", quantity: 1 }]);
      setOutputs([{ supplyId: "", quantity: 1 }]);
      setNote("");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Error al registrar la transformación");
    } finally {
      setLoading(false);
    }
  };

  const handleNewSupplyCreated = (created: Supply) => {
    if (created) {
      setSuppliesList((prev) => [...prev, created]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-base font-semibold text-rose-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              1. Consumo (Salida de Materia Prima)
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddConsumption}
              className="h-7 text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar Insumo
            </Button>
          </div>

          <div className="space-y-3">
            {consumptions.map((line, index) => {
              const selectedSupply = suppliesList.find(
                (i) => i.id === Number(line.supplyId)
              );

              return (
                <div
                  key={index}
                  className="flex gap-3 items-end bg-rose-50/50 p-2.5 rounded-md border border-rose-100"
                >
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-rose-900">
                      Materia Prima #{index + 1}
                    </Label>
                    <Select
                      value={line.supplyId ? line.supplyId.toString() : ""}
                      onValueChange={(val) =>
                        handleConsumptionChange(index, "supplyId", Number(val))
                      }
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue placeholder="Seleccionar insumo">
                          {selectedSupply ? selectedSupply.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {rawMaterials.map((i) => (
                          <SelectItem key={i.id} value={i.id.toString()}>
                            {i.name} (Stock: {Number(i.currentStock)} {i.unitOfMeasure})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32 space-y-1">
                    <Label className="text-xs text-rose-900">Cantidad</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.quantity}
                      onChange={(e) =>
                        handleConsumptionChange(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || ""
                        )
                      }
                      className="h-9 bg-white"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveConsumption(index)}
                    disabled={consumptions.length === 1}
                    className="h-9 w-9 p-0 text-rose-600 hover:bg-rose-100 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-base font-semibold text-emerald-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              2. Producido (Entrada de Producto Terminado)
            </h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary flex items-center gap-1"
                onClick={() => setSupplyDialogOpen(true)}
              >
                <Sparkles className="h-3 w-3" /> + Nuevo Insumo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOutput}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar Insumo
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {outputs.map((line, index) => {
              const selectedSupply = suppliesList.find(
                (i) => i.id === Number(line.supplyId)
              );

              return (
                <div
                  key={index}
                  className="flex gap-3 items-end bg-emerald-50/50 p-2.5 rounded-md border border-emerald-100"
                >
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-emerald-900">
                      Producto Terminado #{index + 1}
                    </Label>
                    <Select
                      value={line.supplyId ? line.supplyId.toString() : ""}
                      onValueChange={(val) =>
                        handleOutputChange(index, "supplyId", Number(val))
                      }
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue placeholder="Seleccionar producto">
                          {selectedSupply ? selectedSupply.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {finishedGoods.map((i) => (
                          <SelectItem key={i.id} value={i.id.toString()}>
                            {i.name} (Stock: {Number(i.currentStock)} {i.unitOfMeasure})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32 space-y-1">
                    <Label className="text-xs text-emerald-900">Cantidad</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.quantity}
                      onChange={(e) =>
                        handleOutputChange(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || ""
                        )
                      }
                      className="h-9 bg-white"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOutput(index)}
                    disabled={outputs.length === 1}
                    className="h-9 w-9 p-0 text-emerald-600 hover:bg-emerald-100 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <Label htmlFor="transformationNotes">
          Observaciones del Lote de Transformación
        </Label>
        <Textarea
          id="transformationNotes"
          placeholder="Ej: Lote #45 - Trozado de 10 pollos enteros en cuartos y pechugas..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          {loading ? <Spinner className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          Ejecutar Transformación de Inventario
        </Button>
      </div>

      <SupplyDialog
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        onSuccess={handleNewSupplyCreated}
        prefilledType={SupplyType.FinishedProduct}
      />
    </form>
  );
}
