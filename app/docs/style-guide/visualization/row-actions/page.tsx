"use client";

import { useState } from "react";
import { CreditCard, Eye, Pencil, Power, Trash2 } from "lucide-react";
import {
  RowActions,
  type RowAction,
  type RowActionTone,
  type RowActionsMode,
  type RowActionsSize,
  type RowActionsVariant,
} from "@/components/shared/RowActions";
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
  { name: "actions", type: "RowAction[]", description: "Botones de la fila." },
  { name: "mode", type: "\"icon\" | \"label\" | \"both\"", default: "\"icon\"", description: "Solo icono, solo palabra, o icono y palabra." },
  { name: "variant", type: "\"ghost\" | \"outline\" | \"soft\"", default: "\"ghost\"", description: "Sin fondo, con borde o con fondo suave." },
  { name: "size", type: "\"sm\" | \"md\"", default: "\"md\"", description: "Tamaño de los botones." },
  { name: "align", type: "\"start\" | \"center\" | \"end\"", default: "\"end\"", description: "Alineación dentro de la celda." },
  { name: "RowAction.key / label", type: "string", description: "Identificador y texto; el texto es también el tooltip y el aria-label." },
  { name: "RowAction.icon", type: "ReactNode", description: "Icono. Si falta, el botón muestra siempre la palabra." },
  { name: "RowAction.tone", type: "\"neutral\" | \"amber\" | \"blue\" | \"emerald\" | \"rose\"", default: "\"neutral\"", description: "Color del botón." },
  { name: "RowAction.onClick / href", type: "() => void / string", description: "Acción del botón o enlace de navegación." },
  { name: "RowAction.disabled / hidden", type: "boolean", description: "Deshabilita u oculta la acción (p. ej. «Pagar» en facturas pagadas)." },
  { name: "RowAction.mode", type: "\"icon\" | \"label\" | \"both\"", description: "Sobrescribe el modo para una sola acción." },
];

const TONES = ["neutral", "amber", "blue", "emerald", "rose"] as const;
const MODES = ["icon", "label", "both"] as const;
const VARIANTS = ["ghost", "outline", "soft"] as const;
const SIZES = ["sm", "md"] as const;
const ALIGNS = ["start", "center", "end"] as const;

function RowActionsDemo() {
  const [mode, setMode] = useState<RowActionsMode>("icon");
  const [variant, setVariant] = useState<RowActionsVariant>("ghost");
  const [size, setSize] = useState<RowActionsSize>("md");
  const [align, setAlign] = useState<(typeof ALIGNS)[number]>("start");
  const [showDelete, setShowDelete] = useState(false);
  const [disableEdit, setDisableEdit] = useState(false);
  const [mixed, setMixed] = useState(false);
  const [last, setLast] = useState("—");
  const [editTone, setEditTone] = useState<RowActionTone>("amber");
  const [editAsLink, setEditAsLink] = useState(false);
  const [noIcon, setNoIcon] = useState(false);
  const [hidePay, setHidePay] = useState(false);
  const [extraClass, setExtraClass] = useState("");

  const actions: RowAction[] = [
    { key: "edit", label: "Editar", icon: <Pencil />, tone: editTone, onClick: () => setLast("Editar"), href: editAsLink ? "#" : undefined, disabled: disableEdit },
    { key: "toggle", label: "Desactivar", icon: noIcon ? undefined : <Power />, tone: "neutral", onClick: () => setLast("Desactivar") },
    { key: "delete", label: "Eliminar", icon: <Trash2 />, tone: "rose", onClick: () => setLast("Eliminar"), hidden: !showDelete },
    { key: "pay", label: "Pagar", icon: <CreditCard />, tone: "blue", onClick: () => setLast("Pagar"), hidden: hidePay, mode: mixed ? "both" : undefined },
  ];

  const code = `<RowActions
  actions={[
    { key: "edit", label: "Editar", icon: <Pencil />, tone: "${editTone}", ${editAsLink ? 'href: `/security/users/${row.id}/edit`' : "onClick: () => edit(row)"}${disableEdit ? ", disabled: true" : ""} },
    { key: "toggle", label: "Desactivar", ${noIcon ? "" : "icon: <Power />, "}onClick: () => toggle(row) },${showDelete ? '\n    { key: "delete", label: "Eliminar", icon: <Trash2 />, tone: "rose", onClick: () => remove(row) },' : ""}
    { key: "pay", label: "Pagar", icon: <CreditCard />, tone: "blue", hidden: ${hidePay ? "true" : "row.paid"}${mixed ? ', mode: "both"' : ""} },
  ]}${mode === "icon" ? "" : `\n  mode="${mode}"`}${variant === "ghost" ? "" : `\n  variant="${variant}"`}${size === "md" ? "" : `\n  size="${size}"`}${align === "end" ? "" : `\n  align="${align}"`}${extraClass ? `\n  className="${extraClass}"` : ""}
/>`;

  return (
    <>
      <Section title="Botones de acción" description="Columna «Acciones»: lápiz para editar, power para activar/desactivar, etc. Cada botón puede ir solo con icono, solo con palabra o con ambos.">
        <Panel title="Vista previa">
          <div className="max-w-md rounded-xl border border-slate-200/80 bg-card p-3 dark:border-slate-800">
            <RowActions actions={actions} mode={mode} variant={variant} size={size} align={align} className={extraClass || undefined} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Última acción: <code className="font-mono">{last}</code>
          </p>
        </Panel>
        <Panel title="Parámetros">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Choice label="mode" value={mode} options={MODES} onChange={setMode} />
            <Choice label="variant" value={variant} options={VARIANTS} onChange={setVariant} />
            <Choice label="size" value={size} options={SIZES} onChange={setSize} />
            <Choice label="align" value={align} options={ALIGNS} onChange={setAlign} />
            <Toggle label="action.hidden (Eliminar)" checked={!showDelete} onChange={(value) => setShowDelete(!value)} />
            <Toggle label="action.disabled (Editar)" checked={disableEdit} onChange={setDisableEdit} />
            <Toggle label="action.mode (Pagar: both)" checked={mixed} onChange={setMixed} />
            <Toggle label="action.hidden (Pagar)" checked={hidePay} onChange={setHidePay} />
            <Toggle label="action.href (Editar)" checked={editAsLink} onChange={setEditAsLink} />
            <Toggle label="sin action.icon (Desactivar)" checked={noIcon} onChange={setNoIcon} />
            <Choice label="action.tone (Editar)" value={editTone} options={TONES} onChange={setEditTone} />
            <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
          </div>
        </Panel>
        <CodeBlock code={code} />
      </Section>

      <Section title="Combinaciones frecuentes" description="Los patrones más comunes en las tablas del ERP.">
        <div className="grid gap-6 sm:grid-cols-3">
          <Panel title="Solo iconos (usuarios, cuentas)">
            <RowActions
              align="start"
              actions={[
                { key: "e", label: "Editar", icon: <Pencil />, tone: "amber" },
                { key: "p", label: "Desactivar", icon: <Power /> },
              ]}
            />
          </Panel>
          <Panel title="Icono y palabra (compras)">
            <RowActions
              align="start"
              mode="both"
              variant="soft"
              actions={[
                { key: "d", label: "Detalle", icon: <Eye />, tone: "blue" },
                { key: "p", label: "Pagar", icon: <CreditCard />, tone: "emerald" },
              ]}
            />
          </Panel>
          <Panel title="Solo palabras">
            <RowActions
              align="start"
              mode="label"
              variant="outline"
              actions={[
                { key: "d", label: "Ver", tone: "blue" },
                { key: "x", label: "Anular", tone: "rose" },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section title="Props" description="Parámetros de RowActions y de cada RowAction.">
        <PropsTable docs={PROPS} />
      </Section>
    </>
  );
}

export default function RowActionsPage() {
  return (
    <DocPage
      title="RowActions"
      category="Visualización"
      description="Botones de acción de una fila de tabla, con icono, con palabra o con ambos, en tonos y variantes configurables."
    >
      <RowActionsDemo />
      <UsedByViews component="row-actions" />
    </DocPage>
  );
}
