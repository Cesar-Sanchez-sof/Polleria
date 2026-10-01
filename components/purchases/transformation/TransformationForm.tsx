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
import { TipoInsumoEnum } from "@prisma/client";
import { toast } from "sonner";
import { Plus, Trash2, Repeat, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Supply {
  id_insumo: number;
  nombre: string;
  tipo: TipoInsumoEnum;
  unidad_medida: string;
  stock_actual: number | string;
}

interface TransformationFormProps {
  supplies: Supply[];
}

interface TransformationLine {
  id_insumo: number | "";
  cantidad: number | "";
}

export function TransformationForm({ supplies: initialSupplies }: TransformationFormProps) {
  const router = useRouter();
  const [suppliesList, setSuppliesList] = useState<Supply[]>(initialSupplies);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const [consumptions, setConsumptions] = useState<TransformationLine[]>([
    { id_insumo: "", cantidad: 1 },
  ]);

  const [outputs, setOutputs] = useState<TransformationLine[]>([
    { id_insumo: "", cantidad: 1 },
  ]);

  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);

  const rawMaterials = suppliesList.filter((i) => i.tipo === TipoInsumoEnum.MateriaPrima);
  const finishedGoods = suppliesList.filter((i) => i.tipo === TipoInsumoEnum.ProductoTerminado);

  const handleAddConsumption = () => {
    setConsumptions((prev) => [...prev, { id_insumo: "", cantidad: 1 }]);
  };
  const handleRemoveConsumption = (index: number) => {
    if (consumptions.length === 1) return;
    setConsumptions((prev) => prev.filter((_, i) => i !== index));
  };
  const handleConsumptionChange = (index: number, field: keyof TransformationLine, val: string | number) => {
    setConsumptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAddOutput = () => {
    setOutputs((prev) => [...prev, { id_insumo: "", cantidad: 1 }]);
  };
  const handleRemoveOutput = (index: number) => {
    if (outputs.length === 1) return;
    setOutputs((prev) => prev.filter((_, i) => i !== index));
  };
  const handleOutputChange = (index: number, field: keyof TransformationLine, val: string | number) => {
    setOutputs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const consumosValidos = consumptions.filter((c) => c.id_insumo !== "" && Number(c.cantidad) > 0);
    const producidosValidos = outputs.filter((p) => p.id_insumo !== "" && Number(p.cantidad) > 0);

    if (consumosValidos.length === 0) {
      toast.error("Debe agregar al menos una materia prima a consumir");
      return;
    }
    if (producidosValidos.length === 0) {
      toast.error("Debe agregar al menos un producto terminado a producir");
      return;
    }

    setLoading(true);
    try {
      await registerTransformation({
        observacion: note || undefined,
        consumos: consumosValidos.map((c) => ({
          id_insumo: Number(c.id_insumo),
          cantidad: Number(c.cantidad),
        })),
        producidos: producidosValidos.map((p) => ({
          id_insumo: Number(p.id_insumo),
          cantidad: Number(p.cantidad),
        })),
      });

      toast.success("Transformación de inventario registrada con éxito");
      router.refresh();
      setConsumptions([{ id_insumo: "", cantidad: 1 }]);
      setOutputs([{ id_insumo: "", cantidad: 1 }]);
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
        {/* Consumo Section (Materia Prima) */}
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
              <Plus className="h-3.5 w-3.5" /> Agregar Supply
            </Button>
          </div>

          <div className="space-y-3">
            {consumptions.map((linea, index) => {
              const selectedSupply = suppliesList.find((i) => i.id_insumo === Number(linea.id_insumo));

              return (
                <div key={index} className="flex gap-3 items-end bg-rose-50/50 p-2.5 rounded-md border border-rose-100">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-rose-900">Materia Prima #{index + 1}</Label>
                    <Select
                      value={linea.id_insumo ? linea.id_insumo.toString() : ""}
                      onValueChange={(val) => handleConsumptionChange(index, "id_insumo", Number(val))}
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue placeholder="Seleccionar insumo">
                          {selectedSupply ? selectedSupply.nombre : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {rawMaterials.map((i) => (
                          <SelectItem key={i.id_insumo} value={i.id_insumo.toString()}>
                            {i.nombre} (Stock: {Number(i.stock_actual)} {i.unidad_medida})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32 space-y-1">
                    <Label className="text-xs text-rose-900">
                      Cantidad
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={linea.cantidad}
                      onChange={(e) => handleConsumptionChange(index, "cantidad", parseFloat(e.target.value) || "")}
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

        {/* Producido Section (Producto Terminado) */}
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
                <Sparkles className="h-3 w-3" /> + Nuevo Supply
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOutput}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar Supply
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {outputs.map((linea, index) => {
              const selectedSupply = suppliesList.find((i) => i.id_insumo === Number(linea.id_insumo));

              return (
                <div key={index} className="flex gap-3 items-end bg-emerald-50/50 p-2.5 rounded-md border border-emerald-100">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-emerald-900">Producto Terminado #{index + 1}</Label>
                    <Select
                      value={linea.id_insumo ? linea.id_insumo.toString() : ""}
                      onValueChange={(val) => handleOutputChange(index, "id_insumo", Number(val))}
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue placeholder="Seleccionar producto">
                          {selectedSupply ? selectedSupply.nombre : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {finishedGoods.map((i) => (
                          <SelectItem key={i.id_insumo} value={i.id_insumo.toString()}>
                            {i.nombre} (Stock: {Number(i.stock_actual)} {i.unidad_medida})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32 space-y-1">
                    <Label className="text-xs text-emerald-900">
                      Cantidad
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={linea.cantidad}
                      onChange={(e) => handleOutputChange(index, "cantidad", parseFloat(e.target.value) || "")}
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
        <Label htmlFor="obs_transf">Observaciones del Lote de Transformación</Label>
        <Textarea
          id="obs_transf"
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
        prefilledTipo={TipoInsumoEnum.ProductoTerminado}
      />
    </form>
  );
}
