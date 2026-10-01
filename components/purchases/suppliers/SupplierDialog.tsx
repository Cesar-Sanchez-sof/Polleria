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
import { createSupplier, updateSupplier, SupplierInput } from "@/lib/services/purchases/supplier";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

interface Supplier {
  id_proveedor: number;
  ruc: string;
  razon_social: string;
  persona_contacto?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  estado: boolean;
}

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierToEdit?: Supplier | null;
  onSuccess: (createdSupplier?: Supplier) => void;
}

export function SupplierDialog({
  open,
  onOpenChange,
  supplierToEdit,
  onSuccess,
}: SupplierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [documentType, setDocumentType] = useState<"RUC" | "DNI">("RUC");
  const [formData, setFormData] = useState<SupplierInput>({
    ruc: "",
    razon_social: "",
    persona_contacto: "",
    direccion: "",
    telefono: "",
    correo: "",
  });

  useEffect(() => {
    if (supplierToEdit) {
      const doc = supplierToEdit.ruc || "";
      setDocumentType(doc.length === 8 ? "DNI" : "RUC");
      setFormData({
        ruc: doc,
        razon_social: supplierToEdit.razon_social,
        persona_contacto: supplierToEdit.persona_contacto || "",
        direccion: supplierToEdit.direccion || "",
        telefono: supplierToEdit.telefono || "",
        correo: supplierToEdit.correo || "",
        estado: supplierToEdit.estado,
      });
    } else {
      setDocumentType("RUC");
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
  }, [supplierToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const docLength = documentType === "RUC" ? 11 : 8;
    if (formData.ruc.trim().length !== docLength) {
      toast.error(`El ${tipoDocumento} debe tener exactamente ${docLength} dígitos`);
      return;
    }

    setLoading(true);
    try {
      if (supplierToEdit) {
        const res = await updateSupplier(supplierToEdit.id_proveedor, formData);
        toast.success("Proveedor actualizado exitosamente");
        onSuccess(res as unknown as Supplier);
      } else {
        const res = await createSupplier(formData);
        toast.success("Proveedor registrado exitosamente");
        onSuccess(res as unknown as Supplier);
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
            {supplierToEdit ? "Editar Proveedor" : "Nuevo Proveedor"}
          </DialogTitle>
          <DialogDescription>
            {supplierToEdit
              ? "Modifica los datos del proveedor seleccionado."
              : "Ingresa la información para registrar un nuevo proveedor en el catálogo."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4 space-y-1.5">
              <Label htmlFor="tipo_doc">Tipo Documento *</Label>
              <Select
                value={documentType}
                onValueChange={(val) => {
                  const td = val as "RUC" | "DNI";
                  setDocumentType(td);
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
                N° Documento ({documentType}) *
              </Label>
              <Input
                id="nro_doc"
                maxLength={documentType === "RUC" ? 11 : 8}
                placeholder={documentType === "RUC" ? "20123456789" : "45678901"}
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
              {supplierToEdit ? "Guardar Cambios" : "Registrar Proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
