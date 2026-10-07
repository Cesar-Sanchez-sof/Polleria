"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupplierDialog } from "./SupplierDialog";
import { setSupplierStatus } from "@/lib/services/purchases/supplier";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Edit2,
  Power,
  Building2,
  Trophy,
  CreditCard,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  X,
  User,
  TrendingUp,
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
  totalPagado: number | string;
  saldoPendiente: number | string;
  estadoPago: "Pendiente" | "Parcial" | "Pagado";
  supplier?: {
    businessName: string;
    ruc: string;
  };
}

interface SuppliersTableProps {
  initialSuppliers: Supplier[];
  vouchers?: SupplierVoucherSummary[];
}

export function SuppliersTable({ initialSuppliers, vouchers = [] }: SuppliersTableProps) {
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
  const withDni = suppliers.filter((p) => p.ruc.length === 8).length;

  // 2. Proveedor Principal (Top Compras)
  const topSupplier = useMemo<{ name: string; ruc: string; total: number; count: number } | null>(() => {
    if (vouchers.length === 0) return null;

    const map = new Map<number, { name: string; ruc: string; total: number; count: number }>();
    vouchers.forEach((v) => {
      const sup = suppliers.find((s) => s.id === v.supplierId) || v.supplier;
      const name = sup?.businessName || `Proveedor #${v.supplierId}`;
      const ruc = sup?.ruc || "";
      const current = map.get(v.supplierId) || { name, ruc, total: 0, count: 0 };
      current.total += Number(v.totalAmount);
      current.count += 1;
      map.set(v.supplierId, current);
    });

    let top: { name: string; ruc: string; total: number; count: number } | null = null;
    map.forEach((data) => {
      if (!top || data.total > top.total) {
        top = data;
      }
    });

    return top;
  }, [vouchers, suppliers]);

  // 3. Compras al Crédito vs Contado
  const { contadoCount, creditoCount, contadoRatio } = useMemo(() => {
    let contado = 0;
    let credito = 0;
    vouchers.forEach((v) => {
      if (v.estadoPago === "Pagado" && Number(v.saldoPendiente) === 0) {
        contado += 1;
      } else {
        credito += 1;
      }
    });
    const total = contado + credito;
    const ratio = total > 0 ? Math.round((contado / total) * 100) : 100;
    return { contadoCount: contado, creditoCount: credito, contadoRatio: ratio };
  }, [vouchers]);

  // 4. Cuentas por Pagar Vivas (Saldos Pendientes a Proveedores)
  const { totalPendingDebt, suppliersWithDebtCount, pendingInvoicesCount } = useMemo(() => {
    let debt = 0;
    const debtSuppliersSet = new Set<number>();
    let pendingCount = 0;

    vouchers.forEach((v) => {
      const saldo = Number(v.saldoPendiente);
      if (saldo > 0.005) {
        debt += saldo;
        debtSuppliersSet.add(v.supplierId);
        pendingCount += 1;
      }
    });

    return {
      totalPendingDebt: debt,
      suppliersWithDebtCount: debtSuppliersSet.size,
      pendingInvoicesCount: pendingCount,
    };
  }, [vouchers]);

  // ─── Filtrado ───
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
    <div className="space-y-6">

      {/* ── Dashboard Executive Cards (Opción B: Abastecimiento y Finanzas de Proveedores) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Padrón de Proveedores */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-blue-50/20 dark:to-blue-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/60 shadow-2xs">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 rounded-full">
              Padrón Comercial
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Directorio de Proveedores</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
                {totalSuppliers}
              </span>
              <span className="text-xs text-muted-foreground">registrados</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{activeSuppliers} activos</span>
            <span>{withRuc} con RUC • {withDni} con DNI</span>
          </div>
        </div>

        {/* Card 2: Proveedor Principal (Top Compras) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-amber-50/20 dark:to-amber-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/60 shadow-2xs">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Top Proveedor
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Mayor Volumen de Compra</p>
            {topSupplier ? (
              <div className="mt-1">
                <p className="text-base sm:text-lg font-bold text-foreground truncate" title={topSupplier.name}>
                  {topSupplier.name}
                </p>
                <p className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 mt-0.5">
                  S/ {topSupplier.total.toFixed(2)}
                  <span className="text-[11px] font-normal text-muted-foreground ml-1.5">
                    ({topSupplier.count} compras)
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-1">
                <p className="text-sm font-semibold text-muted-foreground">Sin compras aún</p>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">S/ 0.00</p>
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Proveedor líder</span>
            <span className="font-semibold text-foreground">
              {topSupplier?.ruc ? `RUC: ${topSupplier.ruc}` : "Esperando compras"}
            </span>
          </div>
        </div>

        {/* Card 3: Modalidad de Pago (Crédito vs Contado) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-indigo-50/20 dark:to-indigo-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
              <CreditCard className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 px-2 py-0.5 rounded-full font-mono">
              {contadoRatio}% Contado
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Modalidad de Operaciones</p>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${contadoRatio}%` }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-indigo-700 dark:text-indigo-400 font-medium">Contado: {contadoCount} op.</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium">Crédito: {creditoCount} op.</span>
          </div>
        </div>

        {/* Card 4: Cuentas por Pagar Vivas (Deuda a Proveedores) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-rose-50/20 dark:to-rose-950/10 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/60 shadow-2xs">
              <AlertCircle className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 px-2 py-0.5 rounded-full">
              Cuentas x Pagar
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Deuda Viva con Proveedores</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-800 dark:text-rose-300 font-mono">
                S/ {totalPendingDebt.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{suppliersWithDebtCount} proveedores con saldo</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {pendingInvoicesCount} facturas pendientes
            </span>
          </div>
        </div>
      </div>

      {/* ── Toolbar Inteligente (Buscador + Filtros Segmentados + Botón Nuevo Proveedor) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-card border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xs">
        
        {/* Izquierda: Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por RUC, DNI, razón social, contacto o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-10 text-xs bg-background rounded-xl border-slate-200 dark:border-slate-800"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
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
              onClick={() => setStatusFilter("all")}
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
              onClick={() => setStatusFilter("active")}
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
              onClick={() => setStatusFilter("inactive")}
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
              onClick={() => setStatusFilter("ruc")}
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
            className="h-10 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Proveedor</span>
          </Button>
        </div>
      </div>

      {/* ── Tabla Moderna de Proveedores ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800">
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-40">Documento Fiscal</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[260px]">Razón Social / Proveedor</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[180px]">Persona de Contacto</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[220px]">Teléfono y Correo</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center w-32">Estado</TableHead>
                <TableHead className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-28">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto">
                      <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted-foreground">
                        <Building2 className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">
                          {hasActiveFilter
                            ? "No se encontraron proveedores con esos filtros"
                            : "Aún no tienes proveedores registrados"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {hasActiveFilter
                            ? "Prueba cambiando los términos de búsqueda o selecciona otro filtro."
                            : "Comienza registrando a tus distribuidores e intermediarios para compras."}
                        </p>
                      </div>
                      {hasActiveFilter ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("all");
                          }}
                          className="mt-2 text-xs rounded-xl"
                        >
                          Limpiar filtros
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleNew}
                          className="mt-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" /> Registrar Primer Proveedor
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const isRuc = p.ruc.length === 11;

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                      
                      {/* Documento */}
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              isRuc
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {isRuc ? "RUC" : "DNI"}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {p.ruc}
                          </span>
                        </div>
                      </TableCell>

                      {/* Razón Social y Dirección */}
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-blue-50/80 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100/70">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground block truncate">
                              {p.businessName}
                            </span>
                            {p.address ? (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {p.address}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60">
                                Sin dirección fiscal registrada
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Contacto */}
                      <TableCell className="py-3.5 px-4">
                        {p.contactPerson ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{p.contactPerson}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">-</span>
                        )}
                      </TableCell>

                      {/* Teléfono y Correo */}
                      <TableCell className="py-3.5 px-4">
                        <div className="space-y-1 text-xs">
                          {p.phone ? (
                            <div className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                              <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span>{p.phone}</span>
                            </div>
                          ) : null}
                          {p.email ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                              <Mail className="h-3 w-3 text-blue-600 shrink-0" />
                              <span className="truncate">{p.email}</span>
                            </div>
                          ) : null}
                          {!p.phone && !p.email && (
                            <span className="text-muted-foreground/60">Sin canales registrados</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="py-3.5 px-4 text-center">
                        {p.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-900 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100/80 text-rose-900 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                            Inactivo
                          </span>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(p)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                            title="Editar proveedor"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                          </Button>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(p)}
                            className={`h-8 w-8 p-0 rounded-lg transition-all cursor-pointer ${
                              p.active
                                ? "text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            }`}
                            title={p.active ? "Desactivar proveedor" : "Activar proveedor"}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
