"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Layers,
  Plus,
  RefreshCw,
  Users,
  Edit2,
  Trash2,
  Armchair,
  CheckCircle2,
  Building2,
  Check,
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

interface AreaTable {
  id: number;
  number: number;
  capacity: number;
}

interface EnrichedArea {
  id: string;
  name: string;
  level: string;
  description: string;
  tableNumbers: number[];
  active: boolean;
  color?: string;
  tableCount: number;
  totalCapacity: number;
  tables: AreaTable[];
}

export default function RestaurantAreasPage() {
  const [areas, setAreas] = useState<EnrichedArea[]>([]);
  const [allTables, setAllTables] = useState<AreaTable[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Crear / Editar Área
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<EnrichedArea | null>(null);
  const [formName, setFormName] = useState("");
  const [formLevel, setFormLevel] = useState("Piso 1");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("emerald");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal Asignar Mesas
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [areaToAssign, setAreaToAssign] = useState<EnrichedArea | null>(null);
  const [selectedTableNumbers, setSelectedTableNumbers] = useState<number[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  const loadAreas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/areas");
      if (!res.ok) throw new Error("Error al obtener los salones.");
      const json = await res.json();
      setAreas(json.data || []);
      setAllTables(json.allTables || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar salones y áreas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  const handleOpenCreateModal = () => {
    setEditingArea(null);
    setFormName("");
    setFormLevel("Piso 1");
    setFormDescription("");
    setFormColor("emerald");
    setFormActive(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (area: EnrichedArea) => {
    setEditingArea(area);
    setFormName(area.name);
    setFormLevel(area.level);
    setFormDescription(area.description);
    setFormColor(area.color || "emerald");
    setFormActive(area.active);
    setModalOpen(true);
  };

  const handleSaveArea = async () => {
    if (!formName.trim()) {
      toast.error("El nombre del salón es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editingArea ? editingArea.id : undefined,
        name: formName.trim(),
        level: formLevel.trim() || "Piso 1",
        description: formDescription.trim(),
        color: formColor,
        active: formActive,
        tableNumbers: editingArea ? editingArea.tableNumbers : [],
      };

      const res = await fetch("/api/settings/areas", {
        method: editingArea ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo guardar el salón.");
      }

      toast.success(editingArea ? "Salón actualizado con éxito." : "Nuevo salón registrado.");
      setModalOpen(false);
      await loadAreas();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar salón.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArea = async (areaId: string, areaName: string) => {
    if (!confirm(`¿Estás seguro de eliminar el salón "${areaName}"?`)) return;

    try {
      const res = await fetch(`/api/settings/areas?id=${encodeURIComponent(areaId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar el salón.");
      toast.success(`Salón "${areaName}" eliminado.`);
      await loadAreas();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar el salón.");
    }
  };

  const handleOpenAssignModal = (area: EnrichedArea) => {
    setAreaToAssign(area);
    setSelectedTableNumbers([...area.tableNumbers]);
    setAssignModalOpen(true);
  };

  const toggleTableSelection = (tableNum: number) => {
    setSelectedTableNumbers((prev) =>
      prev.includes(tableNum) ? prev.filter((n) => n !== tableNum) : [...prev, tableNum].sort((a, b) => a - b)
    );
  };

  const handleSaveAssignment = async () => {
    if (!areaToAssign) return;
    setSavingAssign(true);
    try {
      const res = await fetch("/api/settings/areas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: areaToAssign.id,
          tableNumbers: selectedTableNumbers,
        }),
      });

      if (!res.ok) throw new Error("No se pudo actualizar la distribución de mesas.");
      toast.success(`Mesas actualizadas para ${areaToAssign.name}.`);
      setAssignModalOpen(false);
      await loadAreas();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar asignación de mesas.");
    } finally {
      setSavingAssign(false);
    }
  };

  const totalGlobalCapacity = areas.reduce((acc, a) => acc + a.totalCapacity, 0);
  const totalTablesAssigned = areas.reduce((acc, a) => acc + a.tableCount, 0);

  return (
    <>
      <ModuleHeader
        title="Salones y Áreas del Restaurante"
        subtitle="Estructuración física, niveles de salón y distribución de mesas para el equipo de atención"
        icon={Layers}
        iconClassName="bg-emerald-100 text-emerald-800"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAreas}
            disabled={loading}
            className="h-9 px-3 rounded-xl border-border hover:bg-muted text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="h-9 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Nuevo Salón</span>
          </Button>
        </div>
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* Tarjetas de Resumen de Aforo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Salones Configurados
              </span>
              <span className="text-xl font-extrabold text-foreground">{areas.length}</span>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Aforo Total Salones
              </span>
              <span className="text-xl font-extrabold text-foreground">
                {totalGlobalCapacity} <span className="text-xs font-normal text-muted-foreground">comensales</span>
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Mesas Distribuidas
              </span>
              <span className="text-xl font-extrabold text-foreground">
                {totalTablesAssigned}{" "}
                <span className="text-xs font-normal text-muted-foreground">de {allTables.length} mesas</span>
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Grid de Salones */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {areas.map((area) => (
          <Card
            key={area.id}
            className={`rounded-2xl bg-white dark:bg-slate-900 border transition-all overflow-hidden flex flex-col justify-between ${
              area.active ? "border-border shadow-xs" : "border-slate-200/60 opacity-60 bg-muted/20"
            }`}
          >
            <div>
              {/* Header Salón */}
              <div className="p-4 border-b border-border/70 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="font-bold text-sm sm:text-base text-foreground">{area.name}</h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-semibold block mt-0.5">
                    {area.level}
                  </span>
                </div>
                <Badge
                  variant={area.active ? "default" : "secondary"}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    area.active
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {area.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              {/* Descripción */}
              <div className="p-4 space-y-3">
                {area.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{area.description}</p>
                )}

                {/* Métricas del Salón */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border/60">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block">Capacidad</span>
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      {area.totalCapacity} comensales
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold block">Mesas</span>
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Armchair className="w-3.5 h-3.5 text-primary" />
                      {area.tableCount} asignadas
                    </span>
                  </div>
                </div>

                {/* Mesas del Salón */}
                <div>
                  <span className="text-[11px] font-bold text-foreground block mb-1.5">
                    Mesas en este ambiente:
                  </span>
                  {area.tables.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {area.tables.map((t) => (
                        <span
                          key={t.id}
                          className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold"
                        >
                          Mesa #{t.number}{" "}
                          <span className="font-normal text-[9px] text-emerald-600">({t.capacity}p)</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">
                      Sin mesas asignadas aún. Haz clic en &ldquo;Asignar Mesas&rdquo;.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="p-3 border-t border-border/70 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAssignModal(area)}
                className="h-7 text-[11px] font-semibold rounded-lg border-border"
              >
                <Layers className="w-3 h-3 mr-1 text-primary" />
                <span>Asignar Mesas</span>
              </Button>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEditModal(area)}
                  className="h-7 px-2 text-[11px] font-semibold rounded-lg text-primary hover:bg-muted"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  <span>Editar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteArea(area.id, area.name)}
                  className="h-7 px-2 text-[11px] font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal Crear / Editar Salón */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {editingArea ? `Editar Salón: ${editingArea.name}` : "Registrar Nuevo Salón / Área"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configura los detalles del ambiente para el control de aforo y ubicación de mesas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Nombre del Salón *</label>
              <Input
                placeholder="Ej: Salón Terraza VIP"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="text-xs h-9 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Nivel / Piso</label>
              <Input
                placeholder="Ej: Piso 1, 2do Piso, Balcón"
                value={formLevel}
                onChange={(e) => setFormLevel(e.target.value)}
                className="text-xs h-9 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Descripción Operativa</label>
              <textarea
                placeholder="Detalles sobre capacidad, clima o recomendaciones para el mozo..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="w-full text-xs p-2 rounded-xl border border-input bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/30">
              <span className="text-xs font-bold text-foreground">Estado del Salón</span>
              <button
                type="button"
                onClick={() => setFormActive(!formActive)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  formActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {formActive ? "Habilitado" : "Deshabilitado"}
              </button>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveArea}
              disabled={saving}
              className="text-xs rounded-xl bg-primary text-white font-bold"
            >
              {saving ? "Guardando..." : "Guardar Salón"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Asignar Mesas a Salón */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-5 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Asignar Mesas a: {areaToAssign?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecciona las mesas que pertenecen físicamente a este salón o ambiente.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3">
            <span className="text-xs font-bold text-foreground block mb-2">
              Haz clic en cada mesa para incluirla o retirarla de este salón:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
              {allTables.map((t) => {
                const isSelected = selectedTableNumbers.includes(t.number);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTableSelection(t.number)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-bold"
                        : "bg-background border-border text-foreground hover:bg-muted font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Armchair className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-bold">Mesa #{t.number}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{t.capacity} personas</span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAssignment}
              disabled={savingAssign}
              className="text-xs rounded-xl bg-primary text-white font-bold"
            >
              {savingAssign ? "Guardando..." : "Guardar Asignación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </>
  );
}
