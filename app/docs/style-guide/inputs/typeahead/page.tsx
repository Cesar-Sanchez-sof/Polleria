"use client";

import { useState } from "react";
import { Typeahead, type TypeaheadItem } from "@/components/shared/Typeahead";
import {
  CodeBlock,
  DocPage,
  Panel,
  PropsTable,
  Section,
  TextField,
  Toggle,
  UsedByViews,
  type PropDoc,
} from "@/components/style-guide/doc-kit";

const PROPS: readonly PropDoc[] = [
  { name: "items", type: "TypeaheadItem[]", description: "Opciones: value, label y, opcionalmente, description, prefix, keywords y disabled." },
  { name: "value / onValueChange", type: "string / (value) => void", description: "Valor seleccionado («» = sin selección) y callback; el componente es controlado." },
  { name: "placeholder", type: "string", default: "\"Seleccione…\"", description: "Texto cuando no hay selección." },
  { name: "ariaLabel", type: "string", description: "Etiqueta accesible del campo." },
  { name: "clearable", type: "boolean", default: "true", description: "Muestra la X para quitar la selección." },
  { name: "disabled", type: "boolean", default: "false", description: "Deshabilita el campo." },
  { name: "emptyText", type: "string", default: "\"Sin resultados\"", description: "Mensaje cuando la búsqueda no encuentra nada." },
  { name: "className", type: "string", default: "\"w-64\"", description: "Clases del contenedor (ancho, márgenes)." },
];

const ACCOUNTS: TypeaheadItem[] = [
  { value: "10", label: "Efectivo y equivalentes de efectivo", description: "Activo" },
  { value: "12", label: "Cuentas por cobrar comerciales", description: "Activo" },
  { value: "20", label: "Mercaderías", description: "Activo" },
  { value: "42", label: "Cuentas por pagar comerciales", description: "Pasivo" },
  { value: "40", label: "Tributos por pagar", description: "Pasivo" },
  { value: "70", label: "Ventas", description: "Ingreso" },
  { value: "60", label: "Compras", description: "Gasto" },
  { value: "63", label: "Gastos de servicios", description: "Gasto" },
];

function TypeaheadDemo() {
  const [value, setValue] = useState("");
  const [withPrefix, setWithPrefix] = useState(true);
  const [withDescription, setWithDescription] = useState(true);
  const [clearable, setClearable] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [placeholder, setPlaceholder] = useState("Cuenta contable");
  const [width, setWidth] = useState("w-72");

  const items: TypeaheadItem[] = ACCOUNTS.map((account) => ({
    ...account,
    description: withDescription ? account.description : undefined,
    prefix: withPrefix ? <span className="font-bold tabular-nums text-red-700">{account.value}</span> : undefined,
  }));

  const code = `<Typeahead
  items={accounts.map((a) => ({ value: a.code, label: a.name${withDescription ? ", description: a.type" : ""}${withPrefix ? ", prefix: <b>{a.code}</b>" : ""} }))}
  value={code}
  onValueChange={setCode}
  placeholder="${placeholder}"${clearable ? "" : "\n  clearable={false}"}${disabled ? "\n  disabled" : ""}${width === "w-64" ? "" : `\n  className="${width}"`}
/>`;

  return (
    <>
      <Section title="Select con búsqueda" description="Se abre como un select normal, pero también se puede escribir para filtrar la lista (sin distinguir tildes ni mayúsculas). Flechas, Enter y Escape funcionan.">
        <Panel title="Vista previa">
          <div className="min-h-72 rounded-xl border border-slate-200/80 bg-card p-4 dark:border-slate-800">
            <Typeahead
              items={items}
              value={value}
              onValueChange={setValue}
              placeholder={placeholder}
              clearable={clearable}
              disabled={disabled}
              ariaLabel="Cuenta contable"
              className={width}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Valor: <code className="font-mono">{value || "—"}</code>
            </p>
          </div>
        </Panel>
        <Panel title="Parámetros">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Toggle label="item.prefix (código)" checked={withPrefix} onChange={setWithPrefix} />
            <Toggle label="item.description (tipo)" checked={withDescription} onChange={setWithDescription} />
            <Toggle label="clearable" checked={clearable} onChange={setClearable} />
            <Toggle label="disabled" checked={disabled} onChange={setDisabled} />
            <TextField label="placeholder" value={placeholder} onChange={setPlaceholder} width="w-44" />
            <TextField label="className (ancho)" value={width} onChange={setWidth} width="w-28" />
          </div>
        </Panel>
        <CodeBlock code={code} />
      </Section>

      <Section title="Props" description="Parámetros de Typeahead y de cada TypeaheadItem.">
        <PropsTable docs={PROPS} />
      </Section>
    </>
  );
}

export default function TypeaheadPage() {
  return (
    <DocPage
      title="Typeahead"
      category="Entradas"
      description="Select con búsqueda: se elige de una lista o se escribe para filtrarla. Ideal para listas largas como el plan de cuentas."
    >
      <TypeaheadDemo />
      <UsedByViews component="typeahead" />
    </DocPage>
  );
}
