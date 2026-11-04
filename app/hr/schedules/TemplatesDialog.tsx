"use client";

import { useState } from "react";
import { Edit2, Layers, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ShiftTemplateDto } from "@/lib/services/hr/shift-templates.service";
import { useShiftTemplates } from "../_components/useShiftTemplates";
import { api } from "../_lib/hr-client";

/**
 * Turnos base: los bloques horarios con los que se pacta el horario en cada contrato
 * y con los que se programa la semana.
 */
export function TemplatesDialog({ open, onClose, canEdit }: { open: boolean; onClose: () => void; canEdit: boolean }) {
  const { templates, reload } = useShiftTemplates(open);
  const [editing, setEditing] = useState<ShiftTemplateDto | "new" | null>(null);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function edit(t: ShiftTemplateDto | "new") {
    setEditing(t);
    setError(null);
    setName(t === "new" ? "" : t.name);
    setStart(t === "new" ? "" : t.start_time);
    setEnd(t === "new" ? "" : t.end_time);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { name, start_time: start, end_time: end };
      if (editing === "new") await api("/api/shift-templates", { method: "POST", body });
      else if (editing) await api(`/api/shift-templates/${editing.id}`, { method: "PUT", body });
      toast.success("Turno base guardado");
      setEditing(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(t: ShiftTemplateDto) {
    try {
      await api(`/api/shift-templates/${t.id}`, { method: "PATCH", body: { active: !t.active } });
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Turnos base
          </DialogTitle>
          <DialogDescription>
            Bloques de horario con los que se pacta la jornada de cada contrato. Un turno que usan contratos vigentes no cambia de horas: crea uno nuevo
            y registra una adenda.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {t.start_time}–{t.end_time} · {t.hours} h{t.overnight ? " · termina al día siguiente" : ""} · {t.contracts_in_use} contrato(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={t.active ? "success" : "neutral"}>{t.active ? "Activo" : "Inactivo"}</StatusBadge>
                {canEdit && (
                  <RowActions
                    size="sm"
                    actions={[
                      { key: "edit", label: "Editar", icon: <Edit2 />, tone: "amber", onClick: () => edit(t) },
                      { key: "toggle", label: t.active ? "Desactivar" : "Activar", icon: <Power />, tone: t.active ? "rose" : "emerald", onClick: () => toggle(t) },
                    ]}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
        {canEdit && editing === null && (
          <AppButton size="sm" variant="soft" icon={<Plus />} onClick={() => edit("new")}>
            Nuevo turno base
          </AppButton>
        )}
        {editing !== null && (
          <div className="grid grid-cols-3 gap-3 rounded-xl border p-3">
            <div className="col-span-3 flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor="tpl-name">Nombre</Label>
              <Input id="tpl-name" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mañana" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-start">Inicio</Label>
              <Input id="tpl-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-end">Fin</Label>
              <Input id="tpl-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            {error && <p className="col-span-3 text-sm font-medium text-rose-600">{error}</p>}
            <div className="col-span-3 flex justify-end gap-2">
              <AppButton size="sm" variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancelar
              </AppButton>
              <AppButton size="sm" loading={saving} onClick={save}>
                Guardar
              </AppButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
