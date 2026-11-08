"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldAlert, TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { DeveloperSettingDto } from "@/lib/services/settings/developer-settings.service";

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export default function DeveloperSettingsPage() {
  const [settings, setSettings] = useState<DeveloperSettingDto[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DeveloperSettingDto | null>(null);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/developer")
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "No se pudieron cargar los interruptores.");
        return json as { data: DeveloperSettingDto[]; canEdit?: boolean };
      })
      .then((json) => {
        if (!active) return;
        setSettings(json.data);
        setCanEdit(json.canEdit === true);
      })
      .catch((err) => active && toast.error(errorMessage(err, "Error al cargar los interruptores.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const reload = () => {
    setLoading(true);
    setReloadTick((tick) => tick + 1);
  };

  const groups = useMemo(() => {
    const byGroup = new Map<string, DeveloperSettingDto[]>();
    for (const setting of settings) byGroup.set(setting.group, [...(byGroup.get(setting.group) ?? []), setting]);
    return [...byGroup.entries()];
  }, [settings]);

  const save = async (setting: DeveloperSettingDto, enabled: boolean) => {
    setPendingKey(setting.key);
    try {
      const res = await fetch("/api/settings/developer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: setting.key, enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo guardar el interruptor.");
      setSettings(json.data);
      toast.success(`${setting.label}: ${enabled ? "encendido" : "apagado"}.`);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar el interruptor."));
    } finally {
      setPendingKey(null);
    }
  };

  // Apagar es siempre inmediato; encender una bandera sensible pide confirmación.
  const toggle = (setting: DeveloperSettingDto, enabled: boolean) => {
    if (enabled && setting.sensitive) setConfirm(setting);
    else void save(setting, enabled);
  };

  return (
    <>
      <ModuleHeader
        title="Desarrollador"
        subtitle="Interruptores del sistema que antes se configuraban en variables de entorno"
        icon={TerminalSquare}
        iconClassName="bg-slate-100 text-slate-800"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={loading}
          className="h-9 px-3 rounded-xl border-border text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          <span>Recargar</span>
        </Button>
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
        <p className="text-xs text-muted-foreground">
          Los cambios se aplican en segundos y quedan en la auditoría. Las claves, tokens y URLs siguen en el entorno del servidor.
          {!canEdit && !loading ? " Solo tienes permiso de lectura." : ""}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {groups.map(([group, items]) => (
          <Card key={group} className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-border shadow-xs space-y-1">
            <h3 className="font-bold text-sm text-foreground pb-2 border-b border-border">{group}</h3>
            <ul className="divide-y divide-border">
              {items.map((setting) => (
                <li key={setting.key} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={setting.key} className="text-sm font-semibold text-foreground">
                        {setting.label}
                      </label>
                      {setting.sensitive ? (
                        <Badge variant="outline" className="gap-1 text-[10px] border-amber-300 text-amber-700">
                          <ShieldAlert className="w-3 h-3" /> Sensible
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                    <p className="text-[11px] text-muted-foreground/80 break-words">
                      <code>{setting.key}</code>
                      {setting.updatedAt
                        ? ` · ${setting.updatedBy ?? "—"}, ${new Date(setting.updatedAt).toLocaleString("es-PE")}`
                        : " · sin cambios"}
                    </p>
                  </div>
                  <Switch
                    id={setting.key}
                    checked={setting.enabled}
                    disabled={!canEdit || loading || pendingKey === setting.key}
                    onCheckedChange={(checked) => toggle(setting, checked)}
                    className="mt-1 shrink-0 cursor-pointer"
                  />
                </li>
              ))}
            </ul>
          </Card>
        ))}
        </div>
      </main>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Encender «{confirm?.label}»?</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) void save(confirm, true);
                setConfirm(null);
              }}
            >
              Encender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
