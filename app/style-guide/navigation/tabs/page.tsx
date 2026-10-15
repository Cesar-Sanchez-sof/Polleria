"use client";

import { useMemo, useState } from "react";
import { Package, PackageX } from "lucide-react";
import {
  SegmentedTabs,
  type SegmentedTabItem,
  type SegmentedTabsRounded,
  type SegmentedTabsSize,
  type SegmentedTabsVariant,
} from "@/components/shared/SegmentedTabs";
import { DocPage, Section, Panel, Toggle, Choice, CodeBlock, PropsTable, TextField, NumberField, type PropDoc, UsedByViews } from "@/components/style-guide/doc-kit";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS_PROPS: readonly PropDoc[] = [
  { name: "items", type: "SegmentedTabItem[]", description: "Pestañas: { value, label, count?, tone?, icon?, disabled? }." },
  { name: "value / onValueChange", type: "string / (value) => void", description: "Pestaña activa (componente controlado)." },
  { name: "enableCount", type: "boolean", default: "true", description: "Muestra el número (badge) de cada pestaña que define count." },
  { name: "enableIcons", type: "boolean", default: "true", description: "Muestra el icon de cada pestaña." },
  { name: "enableTones", type: "boolean", default: "true", description: "Colorea badge y texto activo según el tone de la pestaña." },
  { name: "hideZeroCount", type: "boolean", default: "false", description: "Oculta el badge cuando el número es 0." },
  { name: "maxCount", type: "number", description: "Los números mayores se muestran como \"max+\" (p. ej. 99+)." },
  { name: "size", type: "\"sm\" | \"md\" | \"lg\"", default: "\"md\"", description: "Tamaño del texto y del espaciado." },
  { name: "variant", type: "\"segmented\" | \"underline\"", default: "\"segmented\"", description: "Control segmentado (inventario) o pestañas con línea inferior." },
  { name: "rounded", type: "\"md\" | \"lg\" | \"xl\" | \"full\"", default: "\"xl\"", description: "Radio de la barra y de cada pestaña (solo segmented)." },
  { name: "fullWidth", type: "boolean", default: "false", description: "Reparte las pestañas en todo el ancho." },
  { name: "ariaLabel / className", type: "string", description: "Accesibilidad y clases extra del contenedor." },
];

type StockFilter = "all" | "active" | "inactive";

function TabsSection() {
  const [value, setValue] = useState<StockFilter>("all");
  const [enableCount, setEnableCount] = useState(true);
  const [enableIcons, setEnableIcons] = useState(false);
  const [enableTones, setEnableTones] = useState(true);
  const [hideZeroCount, setHideZeroCount] = useState(false);
  const [withZero, setWithZero] = useState(false);
  const [maxCount, setMaxCount] = useState(0);
  const [ariaLabel, setAriaLabel] = useState("Estado del insumo");
  const [disableInactive, setDisableInactive] = useState(false);
  const [extraClass, setExtraClass] = useState("");
  const [fullWidth, setFullWidth] = useState(false);
  const [size, setSize] = useState<SegmentedTabsSize>("md");
  const [variant, setVariant] = useState<SegmentedTabsVariant>("segmented");
  const [rounded, setRounded] = useState<SegmentedTabsRounded>("xl");

  const items: SegmentedTabItem<StockFilter>[] = useMemo(
    () => [
      { value: "all", label: "Todos", count: maxCount > 0 ? 120 : 6, icon: <Package /> },
      { value: "active", label: "Activos", count: 4, tone: "success", icon: <Package /> },
      { value: "inactive", label: "Inactivos", count: withZero ? 0 : 2, tone: "danger", icon: <PackageX />, disabled: disableInactive },
    ],
    [withZero, disableInactive, maxCount]
  );

  const code = `<SegmentedTabs
  items={[
    { value: "all", label: "Todos", count: supplies.length },
    { value: "active", label: "Activos", count: activeCount, tone: "success" },
    { value: "inactive", label: "Inactivos", count: inactiveCount, tone: "danger" },
  ]}
  value={statusFilter}
  onValueChange={setStatusFilter}${enableCount ? "" : "\n  enableCount={false}"}${enableIcons ? "" : ""}${enableTones ? "" : "\n  enableTones={false}"}${hideZeroCount ? "\n  hideZeroCount" : ""}${size === "md" ? "" : `\n  size="${size}"`}${variant === "segmented" ? "" : `\n  variant="${variant}"`}${rounded === "xl" ? "" : `\n  rounded="${rounded}"`}${fullWidth ? "\n  fullWidth" : ""}${maxCount > 0 ? `\n  maxCount={${maxCount}}` : ""}${ariaLabel ? `\n  ariaLabel="${ariaLabel}"` : ""}${extraClass ? `\n  className="${extraClass}"` : ""}
/>`;

  return (
    <Section title="Tabs (control segmentado)" description="Filtro por estado con contador. Base: pestañas «Todos / Activos / Inactivos» de Compras e Inventario.">
      <Panel title="Vista previa">
        <div className="flex min-h-16 items-center">
          <SegmentedTabs
            items={items}
            value={value}
            onValueChange={setValue}
            enableCount={enableCount}
            enableIcons={enableIcons}
            enableTones={enableTones}
            hideZeroCount={hideZeroCount}
            size={size}
            variant={variant}
            rounded={rounded}
            fullWidth={fullWidth}
            maxCount={maxCount > 0 ? maxCount : undefined}
            ariaLabel={ariaLabel}
            className={extraClass || undefined}
          />
        </div>
      </Panel>
      <Panel title="Parámetros">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Toggle label="enableCount" checked={enableCount} onChange={setEnableCount} />
          <Toggle label="enableIcons" checked={enableIcons} onChange={setEnableIcons} />
          <Toggle label="enableTones" checked={enableTones} onChange={setEnableTones} />
          <Toggle label="hideZeroCount" checked={hideZeroCount} onChange={setHideZeroCount} />
          <Toggle label="fullWidth" checked={fullWidth} onChange={setFullWidth} />
          <Toggle label="(demo) Inactivos = 0" checked={withZero} onChange={setWithZero} />
          <Toggle label="item.disabled (Inactivos)" checked={disableInactive} onChange={setDisableInactive} />
          <NumberField label="maxCount (0 = sin límite)" value={maxCount} onChange={setMaxCount} max={999} />
          <TextField label="ariaLabel" value={ariaLabel} onChange={setAriaLabel} />
          <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
          <Choice label="size" value={size} options={["sm", "md", "lg"] as const} onChange={setSize} />
          <Choice label="variant" value={variant} options={["segmented", "underline"] as const} onChange={setVariant} />
          <Choice label="rounded" value={rounded} options={["md", "lg", "xl", "full"] as const} onChange={setRounded} />
        </div>
      </Panel>
      <CodeBlock code={code} />
      <PropsTable docs={TABS_PROPS} />
    </Section>
  );
}

export default function TabsPage() {
  return (
    <DocPage title="Tabs / SegmentedTabs" category="Navegación" description="Pestañas para filtrar una vista por estado, con contador, iconos, tonos y variantes. Se declaran solo los ítems; el componente construye el marcado, los colores y la navegación por teclado.">
      <TabsSection />
      <UsedByViews component="tabs" />
    </DocPage>
  );
}
