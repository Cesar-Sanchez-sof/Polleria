"use client";

import { useState } from "react";
import { IdCard } from "lucide-react";
import { Tag, TagCell, type TagSize, type TagTone, type TagVariant } from "@/components/shared/TagCell";
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

const CELL_PROPS: readonly PropDoc[] = [
  { name: "tag", type: "ReactNode", description: "Texto del tag (p. ej. «RUC», «DNI»)." },
  { name: "value", type: "ReactNode", description: "Valor junto al tag (número de documento)." },
  { name: "tone", type: "\"amber\" | \"blue\" | \"emerald\" | \"rose\" | \"indigo\" | \"neutral\"", default: "\"amber\"", description: "Color del tag." },
  { name: "variant", type: "\"soft\" | \"outline\" | \"solid\"", default: "\"soft\"", description: "Relleno suave, solo borde o relleno intenso." },
  { name: "size", type: "\"sm\" | \"md\"", default: "\"md\"", description: "Tamaño del tag." },
  { name: "tagIcon", type: "ReactNode", description: "Icono dentro del tag." },
  { name: "tagPosition", type: "\"start\" | \"end\"", default: "\"start\"", description: "Tag antes o después del valor." },
  { name: "enableTag", type: "boolean", default: "true", description: "Muestra el tag." },
  { name: "valueMono", type: "boolean", default: "true", description: "Valor en monoespaciada y negrita." },
  { name: "stacked", type: "boolean", default: "false", description: "Apila tag y valor en dos líneas." },
  { name: "extraTags", type: "{ label, tone?, variant? }[]", description: "Tags adicionales después del valor (rol, estado…)." },
];

const TONES = ["amber", "blue", "emerald", "rose", "indigo", "neutral"] as const;
const VARIANTS = ["soft", "outline", "solid"] as const;
const SIZES = ["sm", "md"] as const;
const POSITIONS = ["start", "end"] as const;

function TagCellDemo() {
  const [tone, setTone] = useState<TagTone>("amber");
  const [variant, setVariant] = useState<TagVariant>("soft");
  const [size, setSize] = useState<TagSize>("md");
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>("start");
  const [enableTag, setEnableTag] = useState(true);
  const [valueMono, setValueMono] = useState(true);
  const [stacked, setStacked] = useState(false);
  const [withIcon, setWithIcon] = useState(false);
  const [withExtra, setWithExtra] = useState(false);
  const [tag, setTag] = useState("RUC");
  const [value, setValue] = useState("20608300393");
  const [extraLabel, setExtraLabel] = useState("Activo");
  const [extraTone, setExtraTone] = useState<TagTone>("emerald");
  const [extraVariant, setExtraVariant] = useState<TagVariant>("soft");
  const [extraClass, setExtraClass] = useState("");

  const code = `<TagCell
  tag="${tag}"
  value="${value}"${tone === "amber" ? "" : `\n  tone="${tone}"`}${variant === "soft" ? "" : `\n  variant="${variant}"`}${size === "md" ? "" : `\n  size="${size}"`}${withIcon ? "\n  tagIcon={<IdCard />}" : ""}${position === "start" ? "" : `\n  tagPosition="${position}"`}${enableTag ? "" : "\n  enableTag={false}"}${valueMono ? "" : "\n  valueMono={false}"}${stacked ? "\n  stacked" : ""}${withExtra ? `\n  extraTags={[{ label: "${extraLabel}", tone: "${extraTone}"${extraVariant === "soft" ? "" : `, variant: "${extraVariant}"`} }]}` : ""}${extraClass ? `\n  className="${extraClass}"` : ""}
/>`;

  return (
    <>
      <Section title="Celda con tag" description="Columna «Documento fiscal»: un tag con el tipo de documento y el número al lado. Admite tags extra (estado, rol).">
        <Panel title="Vista previa">
          <TagCell
            tag={tag}
            value={value}
            className={extraClass || undefined}
            tone={tone}
            variant={variant}
            size={size}
            tagIcon={withIcon ? <IdCard /> : undefined}
            tagPosition={position}
            enableTag={enableTag}
            valueMono={valueMono}
            stacked={stacked}
            extraTags={withExtra ? [{ label: extraLabel, tone: extraTone, variant: extraVariant }] : undefined}
          />
        </Panel>
        <Panel title="Parámetros">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Choice label="tone" value={tone} options={TONES} onChange={setTone} />
            <Choice label="variant" value={variant} options={VARIANTS} onChange={setVariant} />
            <Choice label="size" value={size} options={SIZES} onChange={setSize} />
            <Choice label="tagPosition" value={position} options={POSITIONS} onChange={setPosition} />
            <Toggle label="enableTag" checked={enableTag} onChange={setEnableTag} />
            <Toggle label="valueMono" checked={valueMono} onChange={setValueMono} />
            <Toggle label="stacked" checked={stacked} onChange={setStacked} />
            <Toggle label="tagIcon" checked={withIcon} onChange={setWithIcon} />
            <Toggle label="extraTags" checked={withExtra} onChange={setWithExtra} />
            <TextField label="tag" value={tag} onChange={setTag} width="w-24" />
            <TextField label="value" value={value} onChange={setValue} width="w-36" />
            <TextField label="extraTags[0].label" value={extraLabel} onChange={setExtraLabel} width="w-24" />
            <Choice label="extraTags[0].tone" value={extraTone} options={TONES} onChange={setExtraTone} />
            <Choice label="extraTags[0].variant" value={extraVariant} options={VARIANTS} onChange={setExtraVariant} />
            <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
          </div>
        </Panel>
        <CodeBlock code={code} />
      </Section>

      <Section title="Tag suelto" description="El mismo tag se puede usar solo, fuera de una celda: <Tag tone variant size icon>.">
        <div className="flex flex-wrap items-center gap-2">
          {TONES.map((value) => (
            <Tag key={value} tone={value}>
              {value}
            </Tag>
          ))}
          {TONES.map((value) => (
            <Tag key={`o-${value}`} tone={value} variant="outline">
              {value}
            </Tag>
          ))}
          {TONES.map((value) => (
            <Tag key={`s-${value}`} tone={value} variant="solid" size="sm">
              {value}
            </Tag>
          ))}
        </div>
      </Section>

      <Section title="Props de TagCell" description="Los parámetros del tag suelto (Tag) son tone, variant, size e icon.">
        <PropsTable docs={CELL_PROPS} />
      </Section>
    </>
  );
}

export default function TagCellPage() {
  return (
    <DocPage
      title="TagCell / Tag"
      category="Visualización"
      description="Celda con un tag y un valor (tipo y número de documento), con tonos, variantes, tamaños y tags adicionales."
    >
      <TagCellDemo />
      <UsedByViews component="tag-cell" />
    </DocPage>
  );
}
