"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupplierDialog } from "./SupplierDialog";
import { setSupplierStatus } from "@/lib/services/purchases/supplier";
import { toast } from "sonner";
import { Plus, Search, Edit2, Power } from "lucide-react";

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

interface SuppliersTableProps {
  initialSuppliers: Supplier[];
}

export function SuppliersTable({ initialSuppliers }: SuppliersTableProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const filtered = suppliers.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.ruc.toLowerCase().includes(q) ||
      p.businessName.toLowerCase().includes(q) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.active) ||
      (statusFilter === "inactive" && !p.active);

    return matchesSearch && matchesStatus;
  });

  const handleNew = () => {
    setSupplierToEdit(null);
    setDialogOpen(true);
  };

  const handleEdit = (proveedor: Supplier) => {
    setSupplierToEdit(proveedor);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (proveedor: Supplier) => {
    const newStatus = !proveedor.active;
    try {
      await setSupplierStatus(proveedor.id, newStatus);
      setSuppliers((prev) =>
        prev.map((p) =>
          p.id === proveedor.id ? { ...p, active: newStatus } : p
        )
      );
      toast.success(
        `Proveedor ${newStatus ? "activado" : "desactivado"} exitosamente`
      );
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado");
    }
  };

  const handleSuccess = (saved?: Supplier) => {
    if (!saved) return;
    setSuppliers((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por RUC, Razón Social o Contacto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val ?? "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Solo activos</SelectItem>
              <SelectItem value="inactive">Solo inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nuevo Proveedor
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Documento</TableHead>
              <TableHead>Razón Social / Proveedor</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Teléfono / Correo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No se encontraron proveedores registrados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-medium">
                    <span className="text-xs text-muted-foreground block">
                      {p.ruc.length === 8 ? "DNI" : "RUC"}
                    </span>
                    {p.ruc}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-foreground">{p.businessName}</span>
                  </TableCell>
                  <TableCell>{p.contactPerson || "-"}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {p.phone && <div>Tel: {p.phone}</div>}
                      {p.email && <div className="text-muted-foreground">{p.email}</div>}
                      {!p.phone && !p.email && "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        p.active
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                          : "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                      }
                    >
                      {p.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(p)}
                      title="Editar proveedor"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(p)}
                      className={p.active ? "text-destructive" : "text-emerald-600"}
                      title={p.active ? "Desactivar" : "Activar"}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplierToEdit={supplierToEdit}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
