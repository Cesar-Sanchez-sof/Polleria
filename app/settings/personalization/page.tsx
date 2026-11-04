"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Palette, Plus, RefreshCw, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ASSET_LABELS,
  ASSET_SLOTS,
  DEFAULT_BRANDING,
  MAX_ASSET_BYTES,
  MAX_UPDATES,
  type AssetSlot,
  type BrandingContent,
  type UpdateEntry,
} from "@/lib/branding/defaults";
import type { BrandingDto } from "@/lib/services/branding.service";

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

type LoginKey = keyof BrandingContent["login"];
type HomeTextKey = Exclude<keyof BrandingContent["home"], "updates">;

const BRAND_FIELDS: Array<{ key: "brandName" | "fullName" | "tagline" | "slogan"; label: string; hint: string }> = [
  { key: "brandName", label: "Nombre de la marca", hint: "Título grande del login. Ej.: Los Betos" },
  { key: "fullName", label: "Nombre completo", hint: "Pie de página y texto alternativo del logo. Ej.: Pollería Los Betos" },
  { key: "tagline", label: "Rubro o subtítulo", hint: "Ej.: Pollería & Brasas" },
  { key: "slogan", label: "Eslogan", hint: "Frase corta bajo el nombre" },
];

const LOGIN_FIELDS: Array<{ key: LoginKey; label: string }> = [
  { key: "eyebrow", label: "Texto superior izquierdo" },
  { key: "statusLabel", label: "Indicador de estado" },
  { key: "securityNote", label: "Aviso de seguridad (pie izquierdo)" },
  { key: "title", label: "Título del formulario" },
  { key: "subtitle", label: "Texto bajo el título" },
  { key: "restrictedNotice", label: "Aviso de acceso restringido" },
  { key: "rights", label: "Derechos reservados" },
];

const HOME_FIELDS: Array<{ key: HomeTextKey; label: string; kind?: "href" }> = [
  { key: "eyebrow", label: "Etiqueta sobre el título (se añade la fecha)" },
  { key: "title", label: "Título principal" },
  { key: "subtitle", label: "Descripción" },
  { key: "primaryLabel", label: "Botón principal: texto" },
  { key: "primaryHref", label: "Botón principal: ruta", kind: "href" },
  { key: "secondaryLabel", label: "Botón secundario: texto" },
  { key: "secondaryHref", label: "Botón secundario: ruta", kind: "href" },
  { key: "updatesTitle", label: "Panel de novedades: título" },
];

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
  placeholder,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  hint?: string;
  placeholder?: string;
}>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function PersonalizationPage() {
  const [data, setData] = useState<BrandingDto | null>(null);
  const [draft, setDraft] = useState<BrandingContent>(DEFAULT_BRANDING);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySlot, setBusySlot] = useState<AssetSlot | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const fileInputs = useRef<Partial<Record<AssetSlot, HTMLInputElement | null>>>({});

  useEffect(() => {
    let active = true;
    fetch("/api/settings/branding")
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "No se pudo cargar la personalización.");
        return json as { data: BrandingDto; canEdit?: boolean };
      })
      .then((json) => {
        if (!active) return;
        setData(json.data);
        setDraft(json.data.content);
        setCanEdit(json.canEdit === true);
      })
      .catch((err) => active && toast.error(errorMessage(err, "Error al cargar la personalización.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const reload = () => {
    setLoading(true);
    setReloadTick((tick) => tick + 1);
  };

  const dirty = data !== null && JSON.stringify(draft) !== JSON.stringify(data.content);
  const disabled = !canEdit || saving;

  const setTop = useCallback((key: "brandName" | "fullName" | "tagline" | "slogan", value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);
  const setLogin = (key: LoginKey, value: string) => setDraft((d) => ({ ...d, login: { ...d.login, [key]: value } }));
  const setHome = (key: HomeTextKey, value: string) => setDraft((d) => ({ ...d, home: { ...d.home, [key]: value } }));
  const setUpdate = (index: number, patch: Partial<UpdateEntry>) =>
    setDraft((d) => ({
      ...d,
      home: { ...d.home, updates: d.home.updates.map((item, i) => (i === index ? { ...item, ...patch } : item)) },
    }));
  const addUpdate = () =>
    setDraft((d) => ({
      ...d,
      home: {
        ...d.home,
        updates: [{ date: new Date().toISOString().slice(0, 10), title: "", description: "" }, ...d.home.updates].slice(0, MAX_UPDATES),
      },
    }));
  const removeUpdate = (index: number) =>
    setDraft((d) => ({ ...d, home: { ...d.home, updates: d.home.updates.filter((_, i) => i !== index) } }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo guardar.");
      setData(json.data);
      setDraft(json.data.content);
      toast.success("Personalización guardada. El login y el inicio ya muestran los cambios.");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar la personalización."));
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (slot: AssetSlot, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_ASSET_BYTES) {
      toast.error(`La imagen supera el máximo de ${MAX_ASSET_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setBusySlot(slot);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/settings/branding/assets/${slot}`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo subir la imagen.");
      setData((prev) => (prev ? { ...prev, assets: json.data.assets, customAssets: json.data.customAssets } : json.data));
      toast.success(`${ASSET_LABELS[slot]} actualizada.`);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo subir la imagen."));
    } finally {
      setBusySlot(null);
      const input = fileInputs.current[slot];
      if (input) input.value = "";
    }
  };

  const resetAsset = async (slot: AssetSlot) => {
    setBusySlot(slot);
    try {
      const res = await fetch(`/api/settings/branding/assets/${slot}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo restaurar la imagen.");
      setData((prev) => (prev ? { ...prev, assets: json.data.assets, customAssets: json.data.customAssets } : json.data));
      toast.success(`${ASSET_LABELS[slot]} restaurada a la predeterminada.`);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo restaurar la imagen."));
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <>
      <ModuleHeader
        title="Personalización"
        subtitle="Marca, pantalla de acceso e inicio del sistema"
        icon={Palette}
        iconClassName="bg-rose-100 text-rose-800"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={loading || saving}
            className="h-9 px-3 rounded-xl border-border text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </Button>
          {canEdit ? (
            <Button
              size="sm"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="h-9 px-3 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              <span>{saving ? "Guardando…" : "Guardar cambios"}</span>
            </Button>
          ) : null}
        </div>
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-4">
        <p className="text-xs text-muted-foreground">
          Lo que edites aquí se muestra en el login y en el inicio. Los cambios de texto se aplican al guardar; las imágenes, al
          subirlas. Todo queda en la auditoría.
          {!canEdit && !loading ? " Solo tienes permiso de lectura." : ""}
          {dirty ? " Tienes cambios sin guardar." : ""}
        </p>

        <Tabs defaultValue="marca" className="gap-4">
          <TabsList>
            <TabsTrigger value="marca">Marca y login</TabsTrigger>
            <TabsTrigger value="inicio">Inicio</TabsTrigger>
            <TabsTrigger value="imagenes">Imágenes</TabsTrigger>
          </TabsList>

          <TabsContent value="marca" className="space-y-4">
            <Card className="p-4 sm:p-5 rounded-2xl border-border shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-foreground pb-2 border-b border-border">Marca</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BRAND_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    id={`brand-${f.key}`}
                    label={f.label}
                    hint={f.hint}
                    value={draft[f.key]}
                    onChange={(v) => setTop(f.key, v)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </Card>
            <Card className="p-4 sm:p-5 rounded-2xl border-border shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-foreground pb-2 border-b border-border">Pantalla de acceso (login)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LOGIN_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    id={`login-${f.key}`}
                    label={f.label}
                    value={draft.login[f.key]}
                    onChange={(v) => setLogin(f.key, v)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="inicio" className="space-y-4">
            <Card className="p-4 sm:p-5 rounded-2xl border-border shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-foreground pb-2 border-b border-border">Portada y títulos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HOME_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    id={`home-${f.key}`}
                    label={f.label}
                    hint={f.kind === "href" ? "Ruta interna, por ejemplo /sales?tab=cashier" : undefined}
                    value={draft.home[f.key]}
                    onChange={(v) => setHome(f.key, v)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-5 rounded-2xl border-border shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
                <div>
                  <h3 className="font-bold text-sm text-foreground">Últimas actualizaciones</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Se muestran sobre la foto del inicio, en el orden de esta lista. Hasta {MAX_UPDATES}; sin novedades el panel se oculta.
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addUpdate}
                    disabled={saving || draft.home.updates.length >= MAX_UPDATES}
                    className="h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Agregar
                  </Button>
                ) : null}
              </div>
              {draft.home.updates.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No hay novedades: el panel no se mostrará en el inicio.</p>
              ) : null}
              {draft.home.updates.map((item, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[9rem_1fr_2fr_auto] gap-3 items-end pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="space-y-1.5">
                    <Label htmlFor={`upd-${i}-date`} className="text-xs font-semibold text-foreground">Fecha</Label>
                    <Input
                      id={`upd-${i}-date`}
                      type="date"
                      value={item.date}
                      onChange={(e) => setUpdate(i, { date: e.target.value })}
                      disabled={disabled}
                      className="h-9 text-sm"
                    />
                  </div>
                  <Field id={`upd-${i}-title`} label="Título" value={item.title} onChange={(v) => setUpdate(i, { title: v })} disabled={disabled} />
                  <Field id={`upd-${i}-description`} label="Descripción" value={item.description} onChange={(v) => setUpdate(i, { description: v })} disabled={disabled} />
                  {canEdit ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeUpdate(i)}
                      disabled={saving}
                      aria-label={`Quitar «${item.title || "novedad"}»`}
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="imagenes">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ASSET_SLOTS.map((slot) => {
                const custom = data?.customAssets.includes(slot) ?? false;
                const busy = busySlot === slot;
                return (
                  <Card key={slot} className="p-4 sm:p-5 rounded-2xl border-border shadow-xs space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                      <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        {ASSET_LABELS[slot]}
                      </h3>
                      <span className="text-[11px] text-muted-foreground">{custom ? "Personalizada" : "Predeterminada"}</span>
                    </div>
                    <div className="rounded-xl bg-muted/40 border border-border overflow-hidden h-48 flex items-center justify-center">
                      {data ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.assets[slot]} alt={ASSET_LABELS[slot]} className="max-h-full max-w-full object-contain" />
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {slot === "logo"
                        ? "Se ve en el login (escritorio y móvil). Mejor cuadrada y con fondo claro."
                        : "Fondo de la portada del inicio. Mejor horizontal y de buena resolución."}{" "}
                      JPG, PNG o WebP, hasta {MAX_ASSET_BYTES / 1024 / 1024} MB.
                    </p>
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={(el) => {
                            fileInputs.current[slot] = el;
                          }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => void uploadAsset(slot, e.target.files?.[0])}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => fileInputs.current[slot]?.click()}
                          className="h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          {busy ? "Procesando…" : "Cambiar imagen"}
                        </Button>
                        {custom ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void resetAsset(slot)}
                            className="h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Restaurar predeterminada
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {canEdit ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(DEFAULT_BRANDING)}
              disabled={saving}
              className="h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer text-muted-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Cargar textos originales (sin guardar)
            </Button>
          </div>
        ) : null}
      </main>
    </>
  );
}
