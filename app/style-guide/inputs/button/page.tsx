"use client";

import { useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import {
  AppButton,
  type AppButtonRounded,
  type AppButtonSize,
  type AppButtonVariant,
} from "@/components/shared/AppButton";
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
  { name: "children", type: "ReactNode", description: "Texto del botón. Sin texto, el botón es solo icono (cuadrado) y requiere ariaLabel." },
  { name: "icon / iconPosition", type: "ReactNode / \"start\" | \"end\"", default: "\"start\"", description: "Icono y su lado (el «+» de «Nuevo Proveedor»)." },
  { name: "variant", type: "\"primary\" | \"secondary\" | \"soft\" | \"ghost\" | \"danger\" | \"success\"", default: "\"primary\"", description: "Primary es la acción principal (rojo de acento); secondary con borde; soft tintado; ghost sin fondo." },
  { name: "size", type: "\"sm\" | \"md\" | \"lg\"", default: "\"md\"", description: "Alto y tamaño del texto (h-8, h-10, h-11)." },
  { name: "rounded", type: "\"lg\" | \"xl\" | \"full\"", default: "\"xl\"", description: "Radio de las esquinas." },
  { name: "loading", type: "boolean", default: "false", description: "Muestra un spinner y bloquea los clics." },
  { name: "disabled", type: "boolean", default: "false", description: "Deshabilita el botón." },
  { name: "fullWidth", type: "boolean", default: "false", description: "Ocupa todo el ancho del contenedor." },
  { name: "enableIcon", type: "boolean", default: "true", description: "Muestra u oculta el icono." },
  { name: "enableShadow", type: "boolean", default: "true en primary", description: "Sombra suave de los botones de barra de herramientas." },
  { name: "href", type: "string", description: "Renderiza un enlace de Next.js en lugar de un botón." },
  { name: "type / onClick / ariaLabel / className", type: "—", description: "Atributos estándar del botón." },
];

const VARIANTS = ["primary", "secondary", "soft", "ghost", "danger", "success"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const ROUNDS = ["lg", "xl", "full"] as const;
const POSITIONS = ["start", "end"] as const;

function ButtonDemo() {
  const [variant, setVariant] = useState<AppButtonVariant>("primary");
  const [size, setSize] = useState<AppButtonSize>("md");
  const [rounded, setRounded] = useState<AppButtonRounded>("xl");
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>("start");
  const [enableIcon, setEnableIcon] = useState(true);
  const [enableShadow, setEnableShadow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [fullWidth, setFullWidth] = useState(false);
  const [iconOnly, setIconOnly] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [text, setText] = useState("Nuevo Proveedor");
  const [asLink, setAsLink] = useState(false);
  const [type, setType] = useState<"button" | "submit" | "reset">("button");
  const [ariaLabel, setAriaLabel] = useState("Nuevo proveedor");
  const [extraClass, setExtraClass] = useState("");

  const code = `<AppButton${variant === "primary" ? "" : `\n  variant="${variant}"`}${size === "md" ? "" : `\n  size="${size}"`}${rounded === "xl" ? "" : `\n  rounded="${rounded}"`}
  icon={<Plus />}${position === "start" ? "" : `\n  iconPosition="${position}"`}${enableIcon ? "" : "\n  enableIcon={false}"}${enableShadow ? "" : "\n  enableShadow={false}"}${loading ? "\n  loading" : ""}${disabled ? "\n  disabled" : ""}${fullWidth ? "\n  fullWidth" : ""}${iconOnly ? `\n  ariaLabel="${ariaLabel}"` : ""}${asLink ? '\n  href="/purchases/suppliers/new"' : "\n  onClick={handleNew}"}${type === "button" ? "" : `\n  type="${type}"`}${extraClass ? `\n  className="${extraClass}"` : ""}
>${iconOnly ? "" : `\n  ${text}\n`}</AppButton>`;

  return (
    <>
      <Section title="Botón principal" description="El botón de acción principal de una barra de herramientas («+ Nuevo Proveedor»). Se declara texto e icono; el componente construye colores, estados y foco.">
        <Panel title="Vista previa">
          <div className="flex min-h-14 items-center">
            <AppButton
              variant={variant}
              size={size}
              rounded={rounded}
              icon={<Plus />}
              iconPosition={position}
              enableIcon={enableIcon}
              enableShadow={enableShadow}
              loading={loading}
              disabled={disabled}
              fullWidth={fullWidth}
              ariaLabel={iconOnly ? ariaLabel : undefined}
              href={asLink ? "#" : undefined}
              type={type}
              className={extraClass || undefined}
              onClick={() => setClicks((value) => value + 1)}
            >
              {iconOnly ? undefined : text}
            </AppButton>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Clics: <code className="font-mono">{clicks}</code>
          </p>
        </Panel>
        <Panel title="Parámetros">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Choice label="variant" value={variant} options={VARIANTS} onChange={setVariant} />
            <Choice label="size" value={size} options={SIZES} onChange={setSize} />
            <Choice label="rounded" value={rounded} options={ROUNDS} onChange={setRounded} />
            <Choice label="iconPosition" value={position} options={POSITIONS} onChange={setPosition} />
            <Toggle label="enableIcon" checked={enableIcon} onChange={setEnableIcon} />
            <Toggle label="enableShadow" checked={enableShadow} onChange={setEnableShadow} />
            <Toggle label="loading" checked={loading} onChange={setLoading} />
            <Toggle label="disabled" checked={disabled} onChange={setDisabled} />
            <Toggle label="fullWidth" checked={fullWidth} onChange={setFullWidth} />
            <Toggle label="solo icono (sin children)" checked={iconOnly} onChange={setIconOnly} />
            <Toggle label="href" checked={asLink} onChange={setAsLink} />
            <Choice label="type" value={type} options={["button", "submit", "reset"] as const} onChange={setType} />
            <TextField label="children" value={text} onChange={setText} width="w-40" />
            <TextField label="ariaLabel" value={ariaLabel} onChange={setAriaLabel} width="w-40" />
            <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
          </div>
        </Panel>
        <CodeBlock code={code} />
      </Section>

      <Section title="Variantes" description="Las seis variantes en los tres tamaños.">
        <div className="space-y-4">
          {SIZES.map((value) => (
            <div key={value} className="flex flex-wrap items-center gap-3">
              <code className="w-8 font-mono text-xs text-muted-foreground">{value}</code>
              <AppButton size={value} icon={<Plus />}>Nuevo</AppButton>
              <AppButton size={value} variant="secondary" icon={<Download />}>Exportar</AppButton>
              <AppButton size={value} variant="soft">Detalle</AppButton>
              <AppButton size={value} variant="ghost">Cancelar</AppButton>
              <AppButton size={value} variant="danger" icon={<Trash2 />}>Eliminar</AppButton>
              <AppButton size={value} variant="success">Guardar</AppButton>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Props" description="Todos los parámetros del componente.">
        <PropsTable docs={PROPS} />
      </Section>
    </>
  );
}

export default function ButtonPage() {
  return (
    <DocPage
      title="AppButton"
      category="Entradas"
      description="Botón estándar del ERP: acción principal, secundaria, tintada, sin fondo y de estado, con icono, carga y tamaños configurables."
    >
      <ButtonDemo />
      <UsedByViews component="button" />
    </DocPage>
  );
}
