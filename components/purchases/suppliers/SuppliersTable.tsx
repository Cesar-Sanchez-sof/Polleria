"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SupplierDialog } from "./SupplierDialog";
import { setSupplierStatus } from "@/lib/services/purchases/supplier";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { AdvancedFilterToggle } from "@/components/shared/AdvancedFilterToggle";
import {
  AdvancedFilterBar,
  normalizeFilterText,
} from "@/components/shared/AdvancedFilterBar";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit2,
  Power,
  Building2,
  Phone,
  Mail,
  User,
  Users,
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [documentFilter, setDocumentFilter] = useState<"all" | "ruc" | "dni">("all");
  const [contactFilter, setContactFilter] = useState<
    "all" | "complete" | "incomplete" | "without_phone" | "without_email"
  >("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  // ─── Métricas de Opción B (Abastecimiento y Operativa Financiera) ───

  // 1. Total Proveedores y desglose
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((p) => p.active).length;
  const inactiveSuppliers = suppliers.filter((p) => !p.active).length;
  const withRuc = suppliers.filter((p) => p.ruc.length === 11).length;

  const filtered = useMemo(() => {
    const q = normalizeFilterText(search.trim());

    return suppliers.filter((p) => {
      const matchesSearch =
        !q ||
        [
          p.ruc,
          p.businessName,
          p.contactPerson ?? "",
          p.address ?? "",
          p.phone ?? "",
          p.email ?? "",
        ].some((value) => normalizeFilterText(value).includes(q));

      let matchesStatus = true;
      if (statusFilter === "active") matchesStatus = p.active;
      if (statusFilter === "inactive") matchesStatus = !p.active;
      const matchesDocument =
        documentFilter === "all" ||
        (documentFilter === "ruc" && p.ruc.length === 11) ||
        (documentFilter === "dni" && p.ruc.length !== 11);
      const hasPhone = Boolean(p.phone?.trim());
      const hasEmail = Boolean(p.email?.trim());
      const matchesContact =
        contactFilter === "all" ||
        (contactFilter === "complete" && hasPhone && hasEmail) ||
        (contactFilter === "incomplete" && (!hasPhone || !hasEmail)) ||
        (contactFilter === "without_phone" && !hasPhone) ||
        (contactFilter === "without_email" && !hasEmail);

      return matchesSearch && matchesStatus && matchesDocument && matchesContact;
    });
  }, [suppliers, search, statusFilter, documentFilter, contactFilter]);

  const activeFilterCount =
    Number(statusFilter !== "all") +
    Number(documentFilter !== "all") +
    Number(contactFilter !== "all");
  const hasActiveFilter = search.trim() !== "" || activeFilterCount > 0;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDocumentFilter("all");
    setContactFilter("all");
  };

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
    <>
      <ModuleHeader
        title="Gestión de Proveedores"
        subtitle="Catálogo de proveedores y datos de contacto"
        icon={Users}
        iconClassName="bg-amber-100 text-amber-800"
      >
        <AdvancedFilterToggle
          open={filtersOpen}
          onToggle={() => setFiltersOpen((open) => !open)}
        />
        <Button
          onClick={handleNew}
          size="sm"
          className="h-9 gap-1.5 rounded-lg px-4 text-xs font-semibold"
        >
          <Plus className="h-4 w-4" />
          Nuevo Proveedor
        </Button>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="space-y-6">

      {filtersOpen && <AdvancedFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar RUC, razón social, contacto, dirección o teléfono..."
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilter}
        onClear={clearFilters}
        resultCount={filtered.length}
        itemLabel={`de ${totalSuppliers} proveedores`}
      >
        <FilterSelect
          label="Estado"
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
          options={[
            { value: "all", label: `Todos (${totalSuppliers})` },
            { value: "active", label: `Activos (${activeSuppliers})` },
            { value: "inactive", label: `Inactivos (${inactiveSuppliers})` },
          ]}
        />
        <FilterSelect
          label="Documento"
          value={documentFilter}
          onValueChange={(value) => setDocumentFilter(value as typeof documentFilter)}
          options={[
            { value: "all", label: "Todo documento" },
            { value: "ruc", label: `RUC (${withRuc})` },
            { value: "dni", label: "DNI / otros" },
          ]}
        />
        <FilterSelect
          label="Contacto"
          value={contactFilter}
          onValueChange={(value) => setContactFilter(value as typeof contactFilter)}
          options={[
            { value: "all", label: "Cualquier contacto" },
            { value: "complete", label: "Teléfono y correo" },
            { value: "incomplete", label: "Datos incompletos" },
            { value: "without_phone", label: "Sin teléfono" },
            { value: "without_email", label: "Sin correo" },
          ]}
        />
      </AdvancedFilterBar>}

      {/* ── Tabla de Proveedores ── */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.id}
        defaultSort={{ key: "businessName", direction: "asc" }}
        pageResetKey={`${search}|${statusFilter}|${documentFilter}|${contactFilter}`}
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
                clearFilters();
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
      </main>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-[145px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
      <Select
        value={value}
        items={options}
        onValueChange={(nextValue) => onValueChange(nextValue ?? options[0].value)}
      >
        <SelectTrigger className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
