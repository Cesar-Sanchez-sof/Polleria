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
import { registrarTransformacion } from "@/lib/services/compras/transformacion";
import { TipoInsumoEnum } from "@prisma/client";
import { toast } from "sonner";
import { Plus, Trash2, Repeat, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Insumo {
  id_insumo: number;
  nombre: string;
  tipo: TipoInsumoEnum;
  unidad_medida: string;
  stock_actual: number | string;
}

interface FormularioTransformacionProps {
  insumos: Insumo[];
}

interface LineaTransformacion {
  id_insumo: number | "";
  cantidad: number | "";
}

export function FormularioTransformacion({ insumos: initialInsumos }: FormularioTransformacionProps) {
  const router = useRouter();
  const [insumosList, setInsumosList] = useState<Insumo[]>(initialInsumos);
  const [loading, setLoading] = useState(false);
  const [observacion, setObservacion] = useState("");

  const [consumos, setConsumos] = useState<LineaTransformacion[]>([
    { id_insumo: "", cantidad: 1 },
  ]);

  const [producidos, setProducidos] = useState<LineaTransformacion[]>([
    { id_insumo: "", cantidad: 1 },
  ]);

  const [dialogInsumoOpen, setDialogInsumoOpen] = useState(false);

  const materiasPrimas = insumosList.filter((i) => i.tipo === TipoInsumoEnum.MateriaPrima);
  const productosTerminados = insumosList.filter((i) => i.tipo === TipoInsumoEnum.ProductoTerminado);

  const handleAddConsumo = () => {
    setConsumos((prev) => [...prev, { id_insumo: "", cantidad: 1 }]);
  };
  const handleRemoveConsumo = (index: number) => {
    if (consumos.length === 1) return;
    setConsumos((prev) => prev.filter((_, i) => i !== index));
  };
  const handleConsumoChange = (index: number, field: keyof LineaTransformacion, val: string | number) => {
    setConsumos((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAddProducido = () => {
    setProducidos((prev) => [...prev, { id_insumo: "", cantidad: 1 }]);
  };
  const handleRemoveProducido = (index: number) => {
    if (producidos.length === 1) return;
    setProducidos((prev) => prev.filter((_, i) => i !== index));
  };
  const handleProducidoChange = (index: number, field: keyof LineaTransformacion, val: string | number) => {
    setProducidos((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const consumosValidos = consumos.filter((c) => c.id_insumo !== "" && Number(c.cantidad) > 0);
    const producidosValidos = producidos.filter((p) => p.id_insumo !== "" && Number(p.cantidad) > 0);

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
      await registrarTransformacion({
        observacion: observacion || undefined,
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
      setConsumos([{ id_insumo: "", cantidad: 1 }]);
      setProducidos([{ id_insumo: "", cantidad: 1 }]);
      setObservacion("");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Error al registrar la transformación");
    } finally {
      setLoading(false);
    }
  };

  const handleNuevoInsumoCreado = (nuevo: Insumo) => {
    if (nuevo) {
      setInsumosList((prev) => [...prev, nuevo]);
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
              onClick={handleAddConsumo}
              className="h-7 text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar Insumo
            </Button>
          </div>

          <div className="space-y-3">
            {consumos.map((linea, index) => {
              const insumoSel = insumosList.find((i) => i.id_insumo === Number(linea.id_insumo));

              return (
                <div key={index} className="flex gap-3 items-end bg-rose-50/50 p-2.5 rounded-md border border-rose-100">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-rose-900">Materia Prima #{index + 1}</Label>
                    <Select
                      value={linea.id_insumo ? linea.id_insumo.toString() : ""}
                      onValueChange={(val) => handleConsumoChange(index, "id_insumo", Number(val))}
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue placeholder="Seleccionar insumo">
                          {insumoSel ? insumoSel.nombre : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {materiasPrimas.map((i) => (
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
                      onChange={(e) => handleConsumoChange(index, "cantidad", parseFloat(e.target.value) || "")}
                      className="h-9 bg-white"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveConsumo(index)}
                    disabled={consumos.length === 1}
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
                onClick={() => setDialogInsumoOpen(true)}
              >
                <Sparkles className="h-3 w-3" /> + Nuevo Insumo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddProducido}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar Insumo
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {producidos.map((linea, index) => {
              const insumoSel = insumosList.find((i) => i.id_insumo === Number(linea.id_insumo));

              return (
                <div key={index} className="flex gap-3 items-end bg-emerald-50/50 p-2.5 rounded-md border border-emerald-100">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-emerald-900">Producto Terminado #{index + 1}</Label>
                    <Select
                      value={linea.id_insumo ? linea.id_insumo.toString() : ""}
                      onValueChange={(val) => handleProducidoChange(index, "id_insumo", Number(val))}
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue placeholder="Seleccionar producto">
                          {insumoSel ? insumoSel.nombre : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {productosTerminados.map((i) => (
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
                      onChange={(e) => handleProducidoChange(index, "cantidad", parseFloat(e.target.value) || "")}
                      className="h-9 bg-white"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProducido(index)}
                    disabled={producidos.length === 1}
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
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          {loading ? <Spinner className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          Ejecutar Transformación de Inventario
        </Button>
      </div>

      <DialogInsumo
        open={dialogInsumoOpen}
        onOpenChange={setDialogInsumoOpen}
        onSuccess={handleNuevoInsumoCreado}
        prefilledTipo={TipoInsumoEnum.ProductoTerminado}
      />
    </form>
  );
}
