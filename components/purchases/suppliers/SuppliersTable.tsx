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
import { Plus, Search, Edit2, Power, Users, UserCheck, UserX, FileText } from "lucide-react";

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

const STATUS_LABELS: Record<string, string> = {
  all: "Todos",
  active: "Solo activos",
  inactive: "Solo inactivos",
};

export function SuppliersTable({ initialSuppliers }: SuppliersTableProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  // KPI calculations (over full suppliers list, not filtered)
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((p) => p.active).length;
  const inactiveSuppliers = suppliers.filter((p) => !p.active).length;
  const withRuc = suppliers.filter((p) => p.ruc.length === 11).length;

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

  const hasActiveFilter = search.trim() !== "" || statusFilter !== "all";

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
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2 shrink-0">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{totalSuppliers}</p>
            <p className="text-xs text-muted-foreground mt-1">Total proveedores</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 p-2 shrink-0">
            <UserCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-emerald-700">{activeSuppliers}</p>
            <p className="text-xs text-muted-foreground mt-1">Activos</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-rose-100 p-2 shrink-0">
            <UserX className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-rose-700">{inactiveSuppliers}</p>
            <p className="text-xs text-muted-foreground mt-1">Inactivos</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-amber-100 p-2 shrink-0">
            <FileText className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-amber-700">{withRuc}</p>
            <p className="text-xs text-muted-foreground mt-1">Con RUC</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
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
            onValueChange={(val) => setStatusFilter((val as "all" | "active" | "inactive") ?? "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue>{STATUS_LABELS[statusFilter]}</SelectValue>
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
                <TableCell colSpan={6} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-4">
                      {hasActiveFilter ? (
                        <Search className="h-7 w-7 text-muted-foreground" />
                      ) : (
                        <Users className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {hasActiveFilter
                          ? "No se encontraron coincidencias"
                          : "No hay proveedores registrados"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hasActiveFilter
                          ? "Prueba con otros términos o cambia el filtro de estado."
                          : "Registra tu primer proveedor para comenzar."}
                      </p>
                    </div>
                    {!hasActiveFilter && (
                      <Button size="sm" onClick={handleNew} className="mt-1 flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Nuevo Proveedor
                      </Button>
                    )}
                  </div>
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
