"use client";

import React, { useState, useEffect } from "react";
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
import { crearProveedor, actualizarProveedor, ProveedorInput } from "@/lib/services/compras/proveedor";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface Proveedor {
  id_proveedor: number;
  ruc: string;
  razon_social: string;
  persona_contacto?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  estado: boolean;
}

interface DialogProveedorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedorAEditar?: Proveedor | null;
  onSuccess: (nuevoProveedor?: Proveedor) => void;
}

export function DialogProveedor({
  open,
  onOpenChange,
  proveedorAEditar,
  onSuccess,
}: DialogProveedorProps) {
  const [loading, setLoading] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState<"RUC" | "DNI">("RUC");
  const [formData, setFormData] = useState<ProveedorInput>({
    ruc: "",
    razon_social: "",
    persona_contacto: "",
    direccion: "",
    telefono: "",
    correo: "",
  });

  useEffect(() => {
    if (proveedorAEditar) {
      const doc = proveedorAEditar.ruc || "";
      setTipoDocumento(doc.length === 8 ? "DNI" : "RUC");
      setFormData({
        ruc: doc,
        razon_social: proveedorAEditar.razon_social,
        persona_contacto: proveedorAEditar.persona_contacto || "",
        direccion: proveedorAEditar.direccion || "",
        telefono: proveedorAEditar.telefono || "",
        correo: proveedorAEditar.correo || "",
        estado: proveedorAEditar.estado,
      });
    } else {
      setTipoDocumento("RUC");
      setFormData({
        ruc: "",
        razon_social: "",
        persona_contacto: "",
        direccion: "",
        telefono: "",
        correo: "",
        estado: true,
      });
    }
  }, [proveedorAEditar, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const docLength = tipoDocumento === "RUC" ? 11 : 8;
    if (formData.ruc.trim().length !== docLength) {
      toast.error(`El ${tipoDocumento} debe tener exactamente ${docLength} dígitos`);
      return;
    }

    setLoading(true);
    try {
      if (proveedorAEditar) {
        const res = await actualizarProveedor(proveedorAEditar.id_proveedor, formData);
        toast.success("Proveedor actualizado exitosamente");
        onSuccess(res as unknown as Proveedor);
      } else {
        const res = await crearProveedor(formData);
        toast.success("Proveedor registrado exitosamente");
        onSuccess(res as unknown as Proveedor);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al guardar proveedor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {proveedorAEditar ? "Editar Proveedor" : "Nuevo Proveedor"}
          </DialogTitle>
          <DialogDescription>
            {proveedorAEditar
              ? "Modifica los datos del proveedor seleccionado."
              : "Ingresa la información para registrar un nuevo proveedor en el catálogo."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4 space-y-1.5">
              <Label htmlFor="tipo_doc">Tipo Documento *</Label>
              <Select
                value={tipoDocumento}
                onValueChange={(val) => {
                  const td = val as "RUC" | "DNI";
                  setTipoDocumento(td);
                  if (td === "DNI" && formData.ruc.length > 8) {
                    setFormData({ ...formData, ruc: formData.ruc.slice(0, 8) });
                  }
                }}
              >
                <SelectTrigger id="tipo_doc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RUC">RUC (11 dígitos)</SelectItem>
                  <SelectItem value="DNI">DNI (8 dígitos)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-8 space-y-1.5">
              <Label htmlFor="nro_doc">
                N° Documento ({tipoDocumento}) *
              </Label>
              <Input
                id="nro_doc"
                maxLength={tipoDocumento === "RUC" ? 11 : 8}
                placeholder={tipoDocumento === "RUC" ? "20123456789" : "45678901"}
                value={formData.ruc}
                onChange={(e) =>
                  setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, "") })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="razon_social">Razón Social / Nombre del Proveedor *</Label>
            <Input
              id="razon_social"
              placeholder="Ej: Distribuidora Avícola San Fernando S.A.C."
              value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="persona_contacto">Persona de Contacto</Label>
            <Input
              id="persona_contacto"
              placeholder="Ej: Juan Carlos Pérez (Asesor Comercial)"
              value={formData.persona_contacto}
              onChange={(e) => setFormData({ ...formData, persona_contacto: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono / Celular</Label>
              <Input
                id="telefono"
                maxLength={9}
                placeholder="987654321"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="correo">Correo Electrónico</Label>
              <Input
                id="correo"
                type="email"
                placeholder="ventas@proveedor.com"
                value={formData.correo}
                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="direccion">Dirección Fiscal / Ubicación</Label>
            <Input
              id="direccion"
              placeholder="Av. Naranjal 456, Los Olivos, Lima"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            />
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
              {proveedorAEditar ? "Guardar Cambios" : "Registrar Proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
