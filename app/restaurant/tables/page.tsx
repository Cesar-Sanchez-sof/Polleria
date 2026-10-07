"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Armchair,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  Edit2,
  Trash2,
  Power,
  Layers,
  Utensils,
  Receipt,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TableOrder {
  id: number;
  orderTableId: number;
  code: string;
  orderType: string;
  orderedAt: string;
  status: string;
  tableNotes: string;
  total: number;
}

interface TableData {
  id: number;
  number: number;
  capacity: number;
  active: boolean;
  occupied: boolean;
  activeOrder: TableOrder | null;
}

export default function TablesManagementPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "disponible" | "ocupada" | "inactiva">("todos");

  // Modal Crear / Editar Mesa
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [formNumber, setFormNumber] = useState("");
  const [formCapacity, setFormCapacity] = useState("4");
  const [saving, setSaving] = useState(false);

  // Modal Confirmar Desactivación
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [tableToDeactivate, setTableToDeactivate] = useState<TableData | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tables?includeInactive=true");
      if (!res.ok) throw new Error("Error al obtener las mesas.");
      const json = await res.json();
      setTables(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar las mesas del restaurante.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const handleOpenCreateModal = () => {
    setEditingTable(null);
    // Sugerir el siguiente número de mesa disponible
    const maxNum = tables.reduce((max, t) => Math.max(max, t.number), 0);
    setFormNumber(String(maxNum + 1));
    setFormCapacity("4");
    setModalOpen(true);
  };

  const handleOpenEditModal = (table: TableData) => {
    setEditingTable(table);
    setFormNumber(String(table.number));
    setFormCapacity(String(table.capacity));
    setModalOpen(true);
  };

  const handleSaveTable = async () => {
    const number = Number(formNumber);
    const capacity = Number(formCapacity);

    if (!number || number <= 0) {
      toast.error("El número de mesa debe ser un entero positivo.");
      return;
    }
    if (!capacity || capacity < 1 || capacity > 30) {
      toast.error("La capacidad debe ser entre 1 y 30 personas.");
      return;
    }

    setSaving(true);
    try {
      const url = editingTable ? `/api/tables/${editingTable.id}` : "/api/tables";
      const method = editingTable ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, capacity }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar mesa.");

      toast.success(editingTable ? "Mesa actualizada exitosamente." : "Mesa registrada correctamente.");
      setModalOpen(false);
      void loadTables();
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar la mesa.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTableActive = async (table: TableData) => {
    if (table.occupied && table.active) {
      toast.error(`La Mesa #${table.number} está ocupada con pedidos activos y no puede desactivarse.`);
      return;
    }

    const nextState = !table.active;
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextState }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al actualizar mesa.");

      toast.success(
        nextState ? `Mesa #${table.number} activada en el salón.` : `Mesa #${table.number} desactivada.`
      );
      void loadTables();
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado.");
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!tableToDeactivate) return;
    try {
      const res = await fetch(`/api/tables/${tableToDeactivate.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al desactivar mesa.");

      toast.success(`Mesa #${tableToDeactivate.number} desactivada del salón.`);
      setDeactivateModalOpen(false);
      setTableToDeactivate(null);
      void loadTables();
    } catch (err: any) {
      toast.error(err.message || "No se pudo desactivar la mesa.");
    }
  };

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchesSearch = String(t.number).includes(search);
      let matchesStatus = true;
      if (statusFilter === "disponible") matchesStatus = t.active && !t.occupied;
      else if (statusFilter === "ocupada") matchesStatus = t.active && t.occupied;
      else if (statusFilter === "inactiva") matchesStatus = !t.active;
      return matchesSearch && matchesStatus;
    });
  }, [tables, search, statusFilter]);

  const metrics = useMemo(() => {
    const total = tables.length;
    const ocupadas = tables.filter((t) => t.active && t.occupied).length;
    const disponibles = tables.filter((t) => t.active && !t.occupied).length;
    const inactivas = tables.filter((t) => !t.active).length;
    const capacidadTotal = tables
      .filter((t) => t.active)
      .reduce((sum, t) => sum + t.capacity, 0);

    return { total, ocupadas, disponibles, inactivas, capacidadTotal };
  }, [tables]);

  return (
    <>
      <ModuleHeader
        title="Gestión de Mesas del Salón"
        subtitle="Registro de mesas, capacidades de comensales y control de disponibilidad física"
        icon={Armchair}
        iconClassName="bg-emerald-100 text-emerald-800"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadTables()}
            className="text-xs h-9 font-semibold gap-1.5 rounded-xl border-border hover:bg-muted cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refrescar</span>
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="text-xs h-9 font-bold gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Mesa</span>
          </Button>
        </div>
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Mesas
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5">
                {metrics.total}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center">
              <Armchair className="w-4 h-4" />
            </div>
          </Card>

          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                Mesas Disponibles
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {metrics.disponibles}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </Card>

          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
                Mesas Ocupadas
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">
                {metrics.ocupadas}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
          </Card>

          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                Aforo Salón (Sillas)
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-0.5">
                {metrics.capacidadTotal}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por número de mesa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs rounded-xl h-9"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs">
            {[
              { id: "todos", label: "Todas" },
              { id: "disponible", label: "Disponibles" },
              { id: "ocupada", label: "Ocupadas" },
              { id: "inactiva", label: "Inactivas" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                  statusFilter === f.id
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Grilla de Mesas */}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            Cargando mesas del salón...
          </div>
        ) : filteredTables.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-xs rounded-2xl border-dashed">
            No se encontraron mesas para el filtro seleccionado.
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {filteredTables.map((t) => {
              const isOccupied = t.active && t.occupied;
              const isAvailable = t.active && !t.occupied;
              const isInactive = !t.active;

              return (
                <Card
                  key={t.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                    isOccupied
                      ? "border-red-300 bg-red-50/50 dark:bg-red-950/20"
                      : isAvailable
                      ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-400"
                      : "border-slate-200 bg-slate-100/60 dark:bg-slate-900/40 opacity-60"
                  }`}
                >
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0 border-none ${
                        isOccupied
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : isAvailable
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {isOccupied ? "Ocupada" : isAvailable ? "Libre" : "Inactiva"}
                    </Badge>

                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold">
                      <Users className="w-3.5 h-3.5" />
                      <span>{t.capacity}</span>
                    </div>
                  </div>

                  {/* Mesa Center Info */}
                  <div className="py-2 text-center">
                    <div
                      className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center font-extrabold text-base mb-1 shadow-2xs ${
                        isOccupied
                          ? "bg-red-600 text-white"
                          : isAvailable
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      #{t.number}
                    </div>
                    <span className="text-xs font-bold text-foreground block">
                      Mesa #{t.number}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Hasta {t.capacity} comensales
                    </span>

                    {/* Si tiene comanda activa */}
                    {isOccupied && t.activeOrder && (
                      <div className="mt-2 p-1.5 rounded-lg bg-red-100/80 dark:bg-red-950/60 text-[10px] text-red-900 dark:text-red-200 font-mono font-bold">
                        <div>{t.activeOrder.code}</div>
                        <div className="text-xs text-red-700 dark:text-red-300">
                          S/ {t.activeOrder.total.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-1 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEditModal(t)}
                      className="h-7 px-2 text-[11px] rounded-lg text-primary hover:bg-muted font-semibold cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      <span>Editar</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleTableActive(t)}
                      className={`h-7 px-2 text-[11px] rounded-lg font-semibold cursor-pointer ${
                        t.active
                          ? "text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          : "text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      }`}
                      title={t.active ? "Desactivar mesa" : "Habilitar mesa"}
                    >
                      <Power className="w-3 h-3 mr-1" />
                      <span>{t.active ? "Pausar" : "Activar"}</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* MODAL: REGISTRAR O EDITAR MESA */}
      {/* =================================================================== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-5 bg-card">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Armchair className="w-5 h-5 text-emerald-600" />
              <span>{editingTable ? "Editar Mesa" : "Registrar Nueva Mesa"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Defina el número identificador de la mesa y la cantidad de comensales que puede albergar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Número de Mesa <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                placeholder="Ej: 1, 2, 3..."
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
                className="text-xs h-9 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Capacidad de Personas <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                max="30"
                placeholder="4"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                className="text-xs h-9 rounded-xl font-mono"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Comensales recomendados para este espacio o tamaño de mesa.
              </span>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTable}
              disabled={saving}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>{saving ? "Guardando..." : editingTable ? "Actualizar Mesa" : "Guardar Mesa"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
