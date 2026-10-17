"use client";

import { useState } from "react";
import { DollarSign, Percent, ShoppingCart, TrendingUp } from "lucide-react";
import { StatCard, type StatCardLayout, type StatCardOrientation, type StatCardTone, type StatCardValueSize } from "@/components/shared/StatCard";
import {
  Choice,
  CodeBlock,
  DocPage,
  NumberField,
  Panel,
  PropsTable,
  Section,
  TextField,
  Toggle,
  type PropDoc,
  UsedByViews,
} from "@/components/style-guide/doc-kit";

const PROPS: readonly PropDoc[] = [
  { name: "label", type: "ReactNode", description: "Texto pequeño sobre el valor." },
  { name: "value / unit", type: "ReactNode", description: "Valor grande y texto a su lado (p. ej. «comprobantes»). value es opcional: sin él la tarjeta muestra solo la etiqueta y la nota." },
  { name: "icon", type: "ReactNode", description: "Icono del cuadro de color." },
  { name: "badge / badgeIcon / badgeMono", type: "ReactNode / ReactNode / boolean", default: "false", description: "Píldora superior derecha; badgeMono la escribe en monoespaciada." },
  { name: "footerLeft / footerRight", type: "ReactNode", description: "Textos de la línea inferior (el derecho va en negrita)." },
  { name: "progress", type: "number (0-100)", description: "Barra de progreso bajo el valor." },
  { name: "layout", type: "\"icon-first\" | \"label-first\"", default: "\"icon-first\"", description: "icon-first: icono a la izquierda con etiqueta y valor a su derecha, píldora arriba a la derecha (compras). label-first: etiqueta en mayúsculas con el color del tono e icono a su derecha (resumen de ventas). tinted: tarjeta rellena con el tono, icono sólido, etiqueta, valor y nota (resumen de cocina)." },
  { name: "orientation", type: "\"horizontal\" | \"vertical\"", default: "\"horizontal\"", description: "Solo en tinted: icono al lado del texto o centrado encima." },
  { name: "enableDivider", type: "boolean", default: "true en icon-first", description: "Línea sobre el pie; en label-first está apagada por defecto." },
  { name: "tone", type: "blue | emerald | indigo | cyan | purple | amber | rose | brand | neutral", default: "\"blue\"", description: "Color de icono, píldora, degradado y barra." },
  { name: "colorValue", type: "boolean", default: "false", description: "Pinta el valor con el color del tono." },
  { name: "valueSize", type: "\"md\" | \"lg\" | \"xl\"", default: "\"md\" en icon-first, \"lg\" en los demás", description: "Tamaño del valor." },
  { name: "enableIcon", type: "boolean", default: "true", description: "Muestra el cuadro del icono." },
  { name: "enableBadge", type: "boolean", default: "true", description: "Muestra la píldora superior." },
  { name: "enableFooter", type: "boolean", default: "true", description: "Muestra la línea inferior." },
  { name: "enableProgress", type: "boolean", default: "true", description: "Muestra la barra cuando progress está definido." },
  { name: "enableGradient", type: "boolean", default: "true", description: "Degradado suave con el color del tono." },
  { name: "enableHover", type: "boolean", default: "true", description: "Sombra más marcada al pasar el cursor." },
  { name: "className", type: "string", description: "Clases extra del contenedor." },
];

const TONES = ["blue", "emerald", "indigo", "cyan", "purple", "amber", "rose", "brand", "neutral"] as const;
const LAYOUTS = ["icon-first", "label-first", "tinted"] as const;
const ORIENTATIONS = ["horizontal", "vertical"] as const;
const SIZES = ["md", "lg", "xl"] as const;

function StatCardDemo() {
  const [tone, setTone] = useState<StatCardTone>("emerald");
  const [valueSize, setValueSize] = useState<StatCardValueSize>("md");
  const [colorValue, setColorValue] = useState(true);
  const [enableIcon, setEnableIcon] = useState(true);
  const [enableBadge, setEnableBadge] = useState(true);
  const [enableFooter, setEnableFooter] = useState(true);
  const [enableProgress, setEnableProgress] = useState(false);
  const [enableGradient, setEnableGradient] = useState(true);
  const [enableHover, setEnableHover] = useState(true);
  const [layout, setLayout] = useState<StatCardLayout>("icon-first");
  const [enableDivider, setEnableDivider] = useState(true);
  const [withValue, setWithValue] = useState(true);
  const [orientation, setOrientation] = useState<StatCardOrientation>("horizontal");
  const [badgeMono, setBadgeMono] = useState(true);
  const [withBadgeIcon, setWithBadgeIcon] = useState(false);
  const [label, setLabel] = useState("Facturación (Este Mes (Octubre))");
  const [value, setValue] = useState("S/ 514.02");
  const [unit, setUnit] = useState("");
  const [badge, setBadge] = useState("PEN (S/)");
  const [footerLeft, setFooterLeft] = useState("Base: S/ 435.61");
  const [footerRight, setFooterRight] = useState("IGV: S/ 78.41");
  const [progress, setProgress] = useState(72);
  const [extraClass, setExtraClass] = useState("");

  const code = `<StatCard
  tone="${tone}"${layout === "icon-first" ? "" : `\n  layout="${layout}"`}${layout === "tinted" && orientation !== "horizontal" ? `\n  orientation="${orientation}"` : ""}${enableDivider ? "" : "\n  enableDivider={false}"}
  icon={<DollarSign />}
  badge="${badge}"${withBadgeIcon ? "\n  badgeIcon={<TrendingUp />}" : ""}${badgeMono ? "\n  badgeMono" : ""}
  label="${label}"
${withValue ? `\n  value="${value}"` : ""}${unit ? `\n  unit="${unit}"` : ""}${colorValue ? "\n  colorValue" : ""}${valueSize === (layout === "icon-first" ? "md" : "lg") ? "" : `\n  valueSize="${valueSize}"`}
  footerLeft="${footerLeft}"
  footerRight="${footerRight}"${enableProgress ? `\n  progress={${progress}}` : ""}${enableIcon ? "" : "\n  enableIcon={false}"}${enableBadge ? "" : "\n  enableBadge={false}"}${enableFooter ? "" : "\n  enableFooter={false}"}${enableGradient ? "" : "\n  enableGradient={false}"}${enableHover ? "" : "\n  enableHover={false}"}${extraClass ? `\n  className="${extraClass}"` : ""}
/>`;

  return (
    <>
      <Section title="Tarjeta de indicador (KPI)" description="Las tarjetas del resumen de Compras: icono, píldora, valor grande y línea inferior. Solo se declaran los datos; el componente construye el marcado y los colores.">
        <Panel title="Vista previa">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              tone="blue"
              icon={<ShoppingCart />}
              badge="Este Mes (Octubre)"
              badgeIcon={<TrendingUp />}
              label="Compras del Período"
              value="3"
              unit="comprobantes"
              footerLeft="Histórico total:"
              footerRight="3 compras"
            />
            <StatCard
              tone={tone}
              layout={layout}
              orientation={orientation}
              enableDivider={enableDivider}
              icon={enableIcon ? <DollarSign /> : undefined}
              badge={badge}
              badgeIcon={withBadgeIcon ? <TrendingUp /> : undefined}
              badgeMono={badgeMono}
              label={label}
              value={withValue ? value : undefined}
              unit={unit || undefined}
              colorValue={colorValue}
              valueSize={valueSize}
              footerLeft={footerLeft}
              footerRight={footerRight}
              progress={progress}
              className={extraClass || undefined}
              enableIcon={enableIcon}
              enableBadge={enableBadge}
              enableFooter={enableFooter}
              enableProgress={enableProgress}
              enableGradient={enableGradient}
              enableHover={enableHover}
            />
          </div>
        </Panel>
        <Panel title="Parámetros (tarjeta de la derecha)">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Choice label="tone" value={tone} options={TONES} onChange={setTone} />
            <Choice label="layout" value={layout} options={LAYOUTS} onChange={setLayout} />
            <Choice label="orientation (tinted)" value={orientation} options={ORIENTATIONS} onChange={setOrientation} />
            <Toggle label="value (sin value: solo etiqueta y nota)" checked={withValue} onChange={setWithValue} />
            <Toggle label="enableDivider" checked={enableDivider} onChange={setEnableDivider} />
            <Choice label="valueSize" value={valueSize} options={SIZES} onChange={setValueSize} />
            <Toggle label="colorValue" checked={colorValue} onChange={setColorValue} />
            <Toggle label="badgeMono" checked={badgeMono} onChange={setBadgeMono} />
            <Toggle label="enableIcon" checked={enableIcon} onChange={setEnableIcon} />
            <Toggle label="enableBadge" checked={enableBadge} onChange={setEnableBadge} />
            <Toggle label="enableFooter" checked={enableFooter} onChange={setEnableFooter} />
            <Toggle label="enableProgress" checked={enableProgress} onChange={setEnableProgress} />
            <Toggle label="enableGradient" checked={enableGradient} onChange={setEnableGradient} />
            <Toggle label="enableHover" checked={enableHover} onChange={setEnableHover} />
            <Toggle label="badgeIcon" checked={withBadgeIcon} onChange={setWithBadgeIcon} />
            <NumberField label="progress" value={progress} onChange={setProgress} />
            <TextField label="label" value={label} onChange={setLabel} width="w-56" />
            <TextField label="value" value={value} onChange={setValue} width="w-28" />
            <TextField label="unit" value={unit} onChange={setUnit} width="w-28" />
            <TextField label="badge" value={badge} onChange={setBadge} width="w-28" />
            <TextField label="footerLeft" value={footerLeft} onChange={setFooterLeft} width="w-36" />
            <TextField label="footerRight" value={footerRight} onChange={setFooterRight} width="w-36" />
            <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
          </div>
        </Panel>
        <CodeBlock code={code} />
      </Section>

      <Section title="Variantes de tono" description="Los seis tonos disponibles, con barra de progreso.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TONES.map((value, index) => (
            <StatCard
              key={value}
              tone={value}
              icon={index % 2 ? <Percent /> : <ShoppingCart />}
              badge={value}
              label="Cuentas por Pagar"
              value={`${(index + 1) * 12}%`}
              colorValue
              progress={(index + 1) * 12}
              footerLeft="Pagado"
              footerRight={`S/ ${(index + 1) * 120}.00`}
            />
          ))}
        </div>
      </Section>

      <Section title="Props" description="Todos los parámetros del componente.">
        <PropsTable docs={PROPS} />
      </Section>
    </>
  );
}

export default function StatCardPage() {
  return (
    <DocPage
      title="StatCard"
      category="Visualización"
      description="Tarjeta de indicador con icono, píldora, valor grande, barra de progreso y línea inferior, todo configurable por parámetros."
    >
      <StatCardDemo />
      <UsedByViews component="stat-card" />
    </DocPage>
  );
}
