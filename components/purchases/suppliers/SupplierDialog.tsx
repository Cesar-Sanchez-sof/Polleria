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
import { lookupDocument } from "@/lib/services/purchases/document-lookup";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Search } from "lucide-react";

interface Supplier {
  id: number;
  ruc: string;
  businessName: string;
  contactPerson?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
}

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierToEdit?: Supplier | null;
  onSuccess: (createdSupplier?: Supplier) => void;
  prefilledRucOrName?: string;
}

export function SupplierDialog({
  open,
  onOpenChange,
  supplierToEdit,
  onSuccess,
  prefilledRucOrName = "",
}: SupplierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [documentType, setDocumentType] = useState<"RUC" | "DNI">("RUC");
  const [formData, setFormData] = useState<SupplierInput>({
    ruc: "",
    businessName: "",
    contactPerson: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (supplierToEdit) {
      const doc = supplierToEdit.ruc || "";
      setDocumentType(doc.length === 8 ? "DNI" : "RUC");
      setFormData({
        ruc: doc,
        businessName: supplierToEdit.businessName,
        contactPerson: supplierToEdit.contactPerson || "",
        address: supplierToEdit.address || "",
        phone: supplierToEdit.phone || "",
        email: supplierToEdit.email || "",
        active: supplierToEdit.active,
      });
    } else {
      const isNumeric = /^\d+$/.test(prefilledRucOrName.trim());
      const isDni = isNumeric && prefilledRucOrName.trim().length === 8;
      setDocumentType(isDni ? "DNI" : "RUC");
      setFormData({
        ruc: isNumeric ? prefilledRucOrName.trim().slice(0, 11) : "",
        businessName: !isNumeric ? prefilledRucOrName.trim() : "",
        contactPerson: "",
        address: "",
        phone: "",
        email: "",
        active: true,
      });
    }
  }, [supplierToEdit, open, prefilledRucOrName]);

  const docLength = documentType === "RUC" ? 11 : 8;
  const canLookup =
    formData.ruc.trim().length === docLength && !lookupLoading && !loading;

  const handleLookup = async () => {
    if (!canLookup) return;
    setLookupLoading(true);
    try {
      const result = await lookupDocument(formData.ruc.trim());
      if (!result.success || !result.data) {
        toast.error(result.error || "No se encontró información para ese documento");
        return;
      }

      const { data } = result;
      const newBusinessName = data.businessName || "";
      const newAddress = data.address
        ? [data.address, data.district, data.province, data.department]
            .filter(Boolean)
            .join(", ")
        : "";

      // Solo sobreescribir campos vacíos; si ya tienen contenido preguntar
      const currentBusinessName = formData.businessName.trim();
      const currentAddress = formData.address?.trim() || "";

      const willOverwriteBusinessName =
        currentBusinessName !== "" && currentBusinessName !== newBusinessName;
      const willOverwriteAddress =
        currentAddress !== "" && currentAddress !== newAddress;

      if (willOverwriteBusinessName || willOverwriteAddress) {
        // Rellenar solo los campos vacíos, no sobrescribir los que ya tienen valor
        setFormData((prev) => ({
          ...prev,
          businessName: prev.businessName.trim() === "" ? newBusinessName : prev.businessName,
          address: (prev.address || "").trim() === "" ? newAddress : prev.address,
        }));
        toast.success(
          "Datos encontrados. Los campos con datos existentes no fueron modificados.",
          { duration: 4000 }
        );
      } else {
        setFormData((prev) => ({
          ...prev,
          businessName: newBusinessName || prev.businessName,
          address: newAddress || prev.address || "",
        }));
        toast.success("Datos encontrados y autocompletados");
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.ruc.trim().length !== docLength) {
      toast.error(`El ${documentType} debe tener exactamente ${docLength} dígitos`);
      return;
    }

    setLoading(true);
    try {
      if (supplierToEdit) {
        const res = await updateSupplier(supplierToEdit.id, formData);
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
              <Label htmlFor="documentType">
                Tipo Documento <span className="text-red-500">*</span>
              </Label>
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
                <SelectTrigger id="documentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RUC">RUC</SelectItem>
                  <SelectItem value="DNI">DNI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-8 space-y-1.5">
              <Label htmlFor="documentNumber">
                N° Documento ({documentType}) <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="documentNumber"
                  maxLength={documentType === "RUC" ? 11 : 8}
                  placeholder={documentType === "RUC" ? "20123456789" : "45678901"}
                  value={formData.ruc}
                  onChange={(e) =>
                    setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, "") })
                  }
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleLookup}
                  disabled={!canLookup}
                  title={
                    canLookup
                      ? `Buscar ${documentType} en SUNAT`
                      : `Ingresa ${docLength} dígitos para buscar`
                  }
                  className="shrink-0"
                >
                  {lookupLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {canLookup || formData.ruc.trim().length === 0
                  ? ""
                  : `Faltan ${docLength - formData.ruc.trim().length} dígito(s)`}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="businessName">
              Razón Social / Nombre del Proveedor <span className="text-red-500">*</span>
            </Label>
            <Input
              id="businessName"
              placeholder="Ej: Distribuidora Avícola San Fernando S.A.C."
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactPerson">Persona de Contacto</Label>
            <Input
              id="contactPerson"
              placeholder="Ej: Juan Carlos Pérez (Asesor Comercial)"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono / Celular</Label>
              <Input
                id="phone"
                maxLength={9}
                placeholder="987654321"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="ventas@proveedor.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Dirección Fiscal / Ubicación</Label>
            <Input
              id="address"
              placeholder="Av. Naranjal 456, Los Olivos, Lima"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || lookupLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || lookupLoading}>
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              {supplierToEdit ? "Guardar Cambios" : "Registrar Proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
