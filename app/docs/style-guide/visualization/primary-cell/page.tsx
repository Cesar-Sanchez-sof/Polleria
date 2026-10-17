"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { PrimaryCell, type PrimaryCellTitleStyle, type PrimaryCellTone } from "@/components/shared/PrimaryCell";
import {
  Choice,
  CodeBlock,
  DocPage,
  Panel,
  PropsTable,
  Section,
  TextField,
  Toggle,
  type PropDoc,
  UsedByViews,
} from "@/components/style-guide/doc-kit";

const PROPS: readonly PropDoc[] = [
  { name: "title", type: "ReactNode", description: "Texto principal de la celda." },
  { name: "subtitle", type: "ReactNode", description: "Segunda línea bajo el título (RUC, referencia…)." },
  { name: "icon / iconTone", type: "ReactNode / tono", default: "\"blue\"", description: "Icono dentro de un cuadro de color: blue, emerald, indigo, amber, rose o neutral." },
  { name: "onClick", type: "() => void", description: "Hace clickeable el título (botón). No dispara el onRowClick de la fila." },
  { name: "href / newTab", type: "string / boolean", default: "false", description: "Convierte el título en enlace; newTab lo abre en otra pestaña." },
  { name: "titleStyle", type: "\"default\" | \"link\"", description: "«link» pinta el título en rojo de acento. Por defecto es «link» si es clickeable." },
  { name: "showLinkIcon", type: "boolean", default: "false", description: "Icono de enlace externo después de un título clickeable." },
  { name: "enableIcon", type: "boolean", default: "true", description: "Muestra el cuadro del icono." },
  { name: "enableSubtitle", type: "boolean", default: "true", description: "Muestra el subtítulo." },
  { name: "subtitleMono / titleMono", type: "boolean", default: "true / false", description: "Tipografía monoespaciada para subtítulo o título (códigos)." },
  { name: "truncate", type: "boolean", default: "true", description: "Recorta con puntos suspensivos los textos largos." },
  { name: "className", type: "string", description: "Clases extra del contenedor." },
];

const TONES = ["blue", "emerald", "indigo", "amber", "rose", "neutral"] as const;
const STYLES = ["auto", "default", "link"] as const;

function PrimaryCellDemo() {
  const [clickable, setClickable] = useState(true);
  const [asLink, setAsLink] = useState(false);
  const [showLinkIcon, setShowLinkIcon] = useState(true);
  const [enableIcon, setEnableIcon] = useState(true);
  const [enableSubtitle, setEnableSubtitle] = useState(true);
  const [titleMono, setTitleMono] = useState(true);
  const [subtitleMono, setSubtitleMono] = useState(true);
  const [truncate, setTruncate] = useState(true);
  const [iconTone, setIconTone] = useState<PrimaryCellTone>("blue");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("auto");
  const [clicks, setClicks] = useState(0);
  const [title, setTitle] = useState("MISC/2026/10/0001");
  const [subtitle, setSubtitle] = useState("Provisión de Factura F001-157");
  const [newTab, setNewTab] = useState(false);
  const [extraClass, setExtraClass] = useState("");

  const titleStyle: PrimaryCellTitleStyle | undefined = style === "auto" ? undefined : style;

  const code = `<PrimaryCell
  title="${title}"${enableSubtitle ? `\n  subtitle="${subtitle}"` : ""}${enableIcon ? `\n  icon={<Building2 />}${iconTone === "blue" ? "" : `\n  iconTone="${iconTone}"`}` : ""}${clickable ? (asLink ? `\n  href="/accounting/entries/1"${newTab ? "\n  newTab" : ""}` : "\n  onClick={() => openEntry(entry.id)}") : ""}${showLinkIcon && clickable ? "\n  showLinkIcon" : ""}${titleStyle ? `\n  titleStyle="${titleStyle}"` : ""}${titleMono ? "\n  titleMono" : ""}${subtitleMono ? "" : "\n  subtitleMono={false}"}${enableIcon ? "" : "\n  enableIcon={false}"}${enableSubtitle ? "" : "\n  enableSubtitle={false}"}${truncate ? "" : "\n  truncate={false}"}${extraClass ? `\n  className="${extraClass}"` : ""}
/>`;

  return (
    <>
      <Section title="Celda principal" description="Primera columna de una tabla: icono opcional, título (clickeable o no) y subtítulo. Cubre el proveedor de Compras («Avícola San Fernando / RUC») y el código de asiento clickeable.">
        <Panel title="Vista previa">
          <div className="max-w-sm">
            <PrimaryCell
              title={title}
              subtitle={subtitle}
              newTab={newTab}
              className={extraClass || undefined}
              icon={<Building2 />}
              iconTone={iconTone}
              onClick={!asLink && clickable ? () => setClicks((value) => value + 1) : undefined}
              href={asLink && clickable ? "#" : undefined}
              showLinkIcon={showLinkIcon}
              titleStyle={titleStyle}
              titleMono={titleMono}
              subtitleMono={subtitleMono}
              enableIcon={enableIcon}
              enableSubtitle={enableSubtitle}
              truncate={truncate}
            />
          </div>
          {clickable && !asLink ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Clics recibidos por <code className="font-mono">onClick</code>: {clicks}
            </p>
          ) : null}
        </Panel>
        <Panel title="Parámetros">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Toggle label="clickeable (onClick / href)" checked={clickable} onChange={setClickable} />
            <Toggle label="usar href" checked={asLink} onChange={setAsLink} />
            <Toggle label="showLinkIcon" checked={showLinkIcon} onChange={setShowLinkIcon} />
            <Toggle label="enableIcon" checked={enableIcon} onChange={setEnableIcon} />
            <Toggle label="enableSubtitle" checked={enableSubtitle} onChange={setEnableSubtitle} />
            <Toggle label="titleMono" checked={titleMono} onChange={setTitleMono} />
            <Toggle label="subtitleMono" checked={subtitleMono} onChange={setSubtitleMono} />
            <Toggle label="truncate" checked={truncate} onChange={setTruncate} />
            <Toggle label="newTab (con href)" checked={newTab} onChange={setNewTab} />
            <TextField label="title" value={title} onChange={setTitle} width="w-44" />
            <TextField label="subtitle" value={subtitle} onChange={setSubtitle} width="w-56" />
            <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
            <Choice label="iconTone" value={iconTone} options={TONES} onChange={setIconTone} />
            <Choice label="titleStyle" value={style} options={STYLES} onChange={setStyle} />
          </div>
        </Panel>
        <CodeBlock code={code} />
      </Section>

      <Section title="Combinaciones frecuentes" description="Los tres usos más comunes en las tablas del ERP.">
        <div className="grid gap-6 sm:grid-cols-3">
          <Panel title="Con icono y subtítulo">
            <PrimaryCell title="Avícola San Fernando" subtitle="RUC: 20101000000" icon={<Building2 />} />
          </Panel>
          <Panel title="Solo título clickeable">
            <PrimaryCell title="MISC/2026/10/0001" titleMono showLinkIcon onClick={() => undefined} />
          </Panel>
          <Panel title="Enlace con subtítulo">
            <PrimaryCell title="Factura F001-00000157" subtitle="05/10/2026" href="#" titleStyle="default" />
          </Panel>
        </div>
      </Section>

      <Section title="Props" description="Todos los parámetros del componente.">
        <PropsTable docs={PROPS} />
      </Section>
    </>
  );
}

export default function PrimaryCellPage() {
  return (
    <DocPage
      title="PrimaryCell"
      category="Visualización"
      description="Celda principal de una fila de tabla: puede ser clickeable, llevar icono y subtítulo, todo configurable por parámetros."
    >
      <PrimaryCellDemo />
      <UsedByViews component="primary-cell" />
    </DocPage>
  );
}
