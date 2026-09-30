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
import { DialogProveedor } from "@/components/compras/proveedores/DialogProveedor";
import { DialogInsumo } from "@/components/compras/inventario/DialogInsumo";
import { crearOrdenCompra } from "@/lib/services/compras/orden-compra";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, UserPlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Proveedor {
  id_proveedor: number;
  ruc: string;
  razon_social: string;
}

interface Insumo {
  id_insumo: number;
  nombre: string;
  unidad_medida: string;
}

interface FormularioOrdenCompraProps {
  initialProveedores: Proveedor[];
  initialInsumos: Insumo[];
}

interface LineaForm {
  id_insumo: number | "";
  cantidad: number | "";
  precio_unitario: number | "";
}

export function FormularioOrdenCompra({
  initialProveedores,
  initialInsumos,
}: FormularioOrdenCompraProps) {
  const router = useRouter();
  const [proveedores, setProveedores] = useState<Proveedor[]>(initialProveedores);
  const [insumos, setInsumos] = useState<Insumo[]>(initialInsumos);

  const [idProveedor, setIdProveedor] = useState<number | "">("");
  const [fechaEsperada, setFechaEsperada] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([
    { id_insumo: "", cantidad: 1, precio_unitario: 0 },
  ]);
  const [loading, setLoading] = useState(false);

  // Dialog states for creating provider or insumo on the fly
  const [dialogProveedorOpen, setDialogProveedorOpen] = useState(false);
  const [dialogInsumoOpen, setDialogInsumoOpen] = useState(false);
  const [lineaTargetInsumo, setLineaTargetInsumo] = useState<number | null>(null);

  const handleAgregarLinea = () => {
    setLineas((prev) => [...prev, { id_insumo: "", cantidad: 1, precio_unitario: 0 }]);
  };

  const handleEliminarLinea = (index: number) => {
    if (lineas.length === 1) return;
    setLineas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineaChange = (
    index: number,
    field: keyof LineaForm,
    val: number | string
  ) => {
    setLineas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Calculations
  const { subtotal, igv, total } = useMemo(() => {
    let sub = 0;
    lineas.forEach((l) => {
      const cant = Number(l.cantidad) || 0;
      const prec = Number(l.precio_unitario) || 0;
      sub += cant * prec;
    });
    const i = Math.round(sub * 0.18 * 100) / 100;
    const tot = sub + i;
    return { subtotal: sub, igv: i, total: tot };
  }, [lineas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idProveedor) {
      toast.error("Debe seleccionar un proveedor");
      return;
    }
    const detallesValidos = lineas.filter(
      (l) => l.id_insumo !== "" && Number(l.cantidad) > 0
    );
    if (detallesValidos.length === 0) {
      toast.error("Debe ingresar al menos un insumo con cantidad válida");
      return;
    }

    setLoading(true);
    try {
      const res = await crearOrdenCompra({
        id_proveedor: Number(idProveedor),
        fecha_esperada: fechaEsperada || null,
        observaciones: observaciones || undefined,
        detalles: detallesValidos.map((l) => ({
          id_insumo: Number(l.id_insumo),
          cantidad_pedida: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario),
        })),
      });

      toast.success(`Orden de Compra ${res.numero_orden} creada exitosamente`);
      
      // Limpiar casilleros
      setIdProveedor("");
      setFechaEsperada("");
      setObservaciones("");
      setLineas([{ id_insumo: "", cantidad: 1, precio_unitario: 0 }]);

      router.push("/compras/recepcion");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al crear la orden de compra");
    } finally {
      setLoading(false);
    }
  };

  const handleProveedorCreado = (nuevo: any) => {
    if (nuevo) {
      setProveedores((prev) => [nuevo, ...prev]);
      setIdProveedor(nuevo.id_proveedor);
    }
  };

  const handleInsumoCreado = (nuevo: any) => {
    if (nuevo) {
      setInsumos((prev) => [nuevo, ...prev]);
      if (lineaTargetInsumo !== null) {
        handleLineaChange(lineaTargetInsumo, "id_insumo", nuevo.id_insumo);
      }
    }
  };

  const proveedorSel = proveedores.find((p) => p.id_proveedor === Number(idProveedor));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-base font-semibold border-b pb-2">Datos Principales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="proveedor">Proveedor *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-primary flex items-center gap-1"
                onClick={() => setDialogProveedorOpen(true)}
              >
                <UserPlus className="h-3 w-3" /> + Nuevo Proveedor
              </Button>
            </div>
            <Select
              value={idProveedor ? idProveedor.toString() : ""}
              onValueChange={(val) => setIdProveedor(Number(val))}
            >
              <SelectTrigger id="proveedor">
                <SelectValue placeholder="Seleccionar Proveedor">
                  {proveedorSel ? proveedorSel.razon_social : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id_proveedor} value={p.id_proveedor.toString()}>
                    {p.razon_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fecha_esperada">Fecha Esperada de Entrega</Label>
            <Input
              id="fecha_esperada"
              type="date"
              value={fechaEsperada}
              onChange={(e) => setFechaEsperada(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observaciones">Observaciones / Notas</Label>
          <Textarea
            id="observaciones"
            placeholder="Especificaciones de entrega, horario o lugar..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
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
            onClick={handleAgregarLinea}
            className="flex items-center gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar Fila
          </Button>
        </div>

        <div className="space-y-3">
          {lineas.map((linea, index) => {
            const insumoSel = insumos.find((i) => i.id_insumo === Number(linea.id_insumo));
            const subtotalLinea =
              (Number(linea.cantidad) || 0) * (Number(linea.precio_unitario) || 0);

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
                        setLineaTargetInsumo(index);
                        setDialogInsumoOpen(true);
                      }}
                    >
                      + Crear Insumo
                    </button>
                  </div>
                  <Select
                    value={linea.id_insumo ? linea.id_insumo.toString() : ""}
                    onValueChange={(val) =>
                      handleLineaChange(index, "id_insumo", Number(val))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar insumo">
                        {insumoSel ? insumoSel.nombre : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.map((i) => (
                        <SelectItem key={i.id_insumo} value={i.id_insumo.toString()}>
                          {i.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs">
                    Cantidad
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={linea.cantidad}
                    onChange={(e) =>
                      handleLineaChange(index, "cantidad", parseFloat(e.target.value) || "")
                    }
                  />
                </div>

                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs">Precio Unit. (S/)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={linea.precio_unitario}
                    onChange={(e) =>
                      handleLineaChange(
                        index,
                        "precio_unitario",
                        parseFloat(e.target.value) || ""
                      )
                    }
                  />
                </div>

                <div className="col-span-10 md:col-span-2 space-y-1 text-right">
                  <Label className="text-xs text-muted-foreground">Subtotal</Label>
                  <div className="font-semibold text-sm py-1.5">
                    S/ {subtotalLinea.toFixed(2)}
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1 text-right pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEliminarLinea(index)}
                    disabled={lineas.length === 1}
                    className="text-destructive hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen Totales */}
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
          onClick={() => router.push("/compras")}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          {loading ? <Spinner className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          Generar Orden de Compra
        </Button>
      </div>

      <DialogProveedor
        open={dialogProveedorOpen}
        onOpenChange={setDialogProveedorOpen}
        onSuccess={handleProveedorCreado}
      />

      <DialogInsumo
        open={dialogInsumoOpen}
        onOpenChange={setDialogInsumoOpen}
        onSuccess={handleInsumoCreado}
      />
    </form>
  );
}
