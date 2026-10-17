"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupplierDialog } from "./SupplierDialog";
import { setSupplierStatus } from "@/lib/services/purchases/supplier";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import {
  Plus,
  Search,
  Edit2,
  Power,
  Building2,
  Phone,
  Mail,
  X,
  User,
} from "lucide-react";

export interface Supplier {
  id: number;
  ruc: string;
  businessName: string;
  contactPerson?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
}

export interface SupplierVoucherSummary {
  id: number;
  supplierId: number;
  totalAmount: number | string;
  totalPaid: number | string;
  pendingBalance: number | string;
  paymentStatus: "Pendiente" | "Parcial" | "Pagado";
  supplier?: {
    businessName: string;
    ruc: string;
  };
}

interface SuppliersTableProps {
  initialSuppliers: Supplier[];
}

export function SuppliersTable({ initialSuppliers }: SuppliersTableProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "ruc">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  // ─── Métricas de Opción B (Abastecimiento y Operativa Financiera) ───

  // 1. Total Proveedores y desglose
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((p) => p.active).length;
  const inactiveSuppliers = suppliers.filter((p) => !p.active).length;
  const withRuc = suppliers.filter((p) => p.ruc.length === 11).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return suppliers.filter((p) => {
      const matchesSearch =
        !q ||
        p.ruc.toLowerCase().includes(q) ||
        p.businessName.toLowerCase().includes(q) ||
        (p.contactPerson && p.contactPerson.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q));

      let matchesStatus = true;
      if (statusFilter === "active") matchesStatus = p.active;
      if (statusFilter === "inactive") matchesStatus = !p.active;
      if (statusFilter === "ruc") matchesStatus = p.ruc.length === 11;

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, search, statusFilter]);

  const hasActiveFilter = search.trim() !== "" || statusFilter !== "all";

  const handleNew = () => {
    setSupplierToEdit(null);
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    const newStatus = !supplier.active;
    try {
      await setSupplierStatus(supplier.id, newStatus);
      setSuppliers((prev) =>
        prev.map((p) =>
          p.id === supplier.id ? { ...p, active: newStatus } : p
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

  const columns: DataTableColumn<Supplier>[] = [
    {
      key: "document",
      header: "Documento Fiscal",
      width: "w-48",
      sortable: true,
      sortValue: (p) => p.ruc,
      cell: (p) => (
        <div className="flex items-center gap-2">
          <Tag tone={p.ruc.length === 11 ? "amber" : "indigo"} size="sm">
            {p.ruc.length === 11 ? "RUC" : "DNI"}
          </Tag>
          <span className="font-mono text-xs font-bold text-foreground">{p.ruc}</span>
        </div>
      ),
    },
    {
      key: "businessName",
      header: "Razón Social / Proveedor",
      width: "min-w-[260px]",
      sortable: true,
      sortValue: (p) => p.businessName,
      primary: {
        title: (p) => p.businessName,
        subtitle: (p) => p.address || "Sin dirección fiscal registrada",
        icon: <Building2 />,
        iconTone: "amber",
      },
    },
    {
      key: "contactPerson",
      header: "Persona de Contacto",
      width: "min-w-[170px]",
      sortable: true,
      sortValue: (p) => p.contactPerson,
      cell: (p) =>
        p.contactPerson ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{p.contactPerson}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">-</span>
        ),
    },
    {
      key: "channels",
      header: "Teléfono y Correo",
      width: "min-w-[200px]",
      cell: (p) => (
        <div className="space-y-1 text-xs">
          {p.phone ? (
            <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
              <Phone className="h-3 w-3 shrink-0 text-emerald-600" />
              <span>{p.phone}</span>
            </div>
          ) : null}
          {p.email ? (
            <div className="flex items-center gap-1.5 truncate text-muted-foreground" title={p.email}>
              <Mail className="h-3 w-3 shrink-0 text-amber-600" />
              <span className="truncate">{p.email}</span>
            </div>
          ) : null}
          {!p.phone && !p.email && <span className="text-muted-foreground/60">Sin canales registrados</span>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "w-32",
      sortable: true,
      sortValue: (p) => (p.active ? 1 : 0),
      cell: (p) => (
        <StatusBadge tone={p.active ? "success" : "danger"} pulse={p.active}>
          {p.active ? "Activo" : "Inactivo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-28",
      cell: (p) => (
        <RowActions
          size="sm"
          actions={[
            { key: "edit", label: "Editar proveedor", icon: <Edit2 />, tone: "amber", onClick: () => handleEdit(p) },
            {
              key: "toggle",
              label: p.active ? "Desactivar proveedor" : "Activar proveedor",
              icon: <Power />,
              tone: p.active ? "rose" : "emerald",
              onClick: () => handleToggleStatus(p),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── Toolbar Inteligente (Buscador + Filtros Segmentados + Botón Nuevo Proveedor) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-card border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xs">
        
        {/* Izquierda: Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por RUC, DNI, razón social, contacto o teléfono..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="pl-9 pr-8 h-10 text-xs bg-background rounded-xl border-slate-200 dark:border-slate-800"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Centro / Derecha: Segmented Control de Estados + Botón Nuevo Proveedor */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Control */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "all"
                  ? "bg-white dark:bg-slate-800 text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded-full font-mono">
                {totalSuppliers}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("active");
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "active"
                  ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Activos</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                {activeSuppliers}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("inactive");
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "inactive"
                  ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Inactivos</span>
              {inactiveSuppliers > 0 && (
                <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                  {inactiveSuppliers}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ruc");
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "ruc"
                  ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Con RUC</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                {withRuc}
              </span>
            </button>
          </div>

          {/* Botón Crear Proveedor */}
          <Button
            onClick={handleNew}
            size="sm"
            className="h-10 px-4 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Proveedor</span>
          </Button>
        </div>
      </div>

      {/* ── Tabla de Proveedores ── */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.id}
        defaultSort={{ key: "businessName", direction: "asc" }}
        pageResetKey={`${search}|${statusFilter}`}
        pagination={{ defaultPageSize: 15, itemLabel: "proveedores" }}
        emptyState={{
          icon: <Building2 className="h-7 w-7" />,
          title: hasActiveFilter
            ? "No se encontraron proveedores con esos filtros"
            : "Aún no tienes proveedores registrados",
          description: hasActiveFilter
            ? "Prueba cambiando los términos de búsqueda o selecciona otro filtro."
            : "Comienza registrando a tus distribuidores e intermediarios para compras.",
          action: hasActiveFilter ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="text-xs rounded-xl"
            >
              Limpiar filtros
            </Button>
          ) : (
            <Button size="sm" onClick={handleNew} className="flex cursor-pointer items-center gap-1.5 rounded-xl text-xs">
              <Plus className="h-3.5 w-3.5" /> Registrar Primer Proveedor
            </Button>
          ),
        }}
      />

      {/* ── Dialog ── */}
      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplierToEdit={supplierToEdit}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
