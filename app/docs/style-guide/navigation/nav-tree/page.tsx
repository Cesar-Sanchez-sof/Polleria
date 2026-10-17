"use client";

import { useState } from "react";
import { FileText, FolderTree, Home, Settings } from "lucide-react";
import {
  NavTree,
  type NavTreeDefaultOpen,
  type NavTreeMatch,
  type NavTreeNode,
  type NavTreeSize,
} from "@/components/shared/NavTree";
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

const TREE_PROPS: readonly PropDoc[] = [
  { name: "nodes", type: "NavTreeNode[]", description: "Árbol: { key, label, icon?, href?, children?, badge?, disabled? }. Un nodo con children es un grupo desplegable; sin href, la hoja llama a onSelect." },
  { name: "activeKey", type: "string", description: "Hoja activa. Si se omite se deduce de la ruta actual y el href de cada hoja." },
  { name: "matchMode", type: "\"exact\" | \"prefix\"", default: "\"exact\"", description: "Cómo se compara la ruta con el href: igual o por prefijo (/reports activa /reports/ledger)." },
  { name: "onSelect", type: "(node) => void", description: "Se llama al elegir una hoja (con o sin href)." },
  { name: "defaultOpen", type: "\"active\" | \"all\" | \"none\"", default: "\"active\"", description: "Grupos abiertos al inicio: el que contiene la hoja activa, todos o ninguno. Al navegar se abre el grupo de la nueva hoja activa." },
  { name: "accordion", type: "boolean", default: "false", description: "Mantiene un solo grupo abierto a la vez." },
  { name: "collapsible", type: "boolean", default: "true", description: "Permite plegar grupos. En false todos quedan siempre abiertos." },
  { name: "enableIcons", type: "boolean", default: "true", description: "Muestra los iconos de los nodos." },
  { name: "enableGuide", type: "boolean", default: "true", description: "Línea vertical junto a los hijos." },
  { name: "enableBadges", type: "boolean", default: "true", description: "Muestra el badge de las hojas." },
  { name: "size", type: "\"sm\" | \"md\"", default: "\"md\"", description: "Tamaño del texto y del espaciado." },
  { name: "ariaLabel / className", type: "string", description: "Accesibilidad y clases extra del contenedor." },
];

const SIZES = ["sm", "md"] as const;
const OPEN = ["active", "all", "none"] as const;
const MATCH = ["exact", "prefix"] as const;

const NODES: readonly NavTreeNode[] = [
  { key: "home", label: "Inicio", icon: <Home />, href: undefined },
  {
    key: "docs",
    label: "Documentos",
    icon: <FileText />,
    children: [
      { key: "docs/invoices", label: "Facturas", badge: "12" },
      { key: "docs/receipts", label: "Boletas", badge: "48" },
      { key: "docs/notes", label: "Notas de crédito", disabled: true },
    ],
  },
  {
    key: "files",
    label: "Archivos",
    icon: <FolderTree />,
    children: [
      { key: "files/ple", label: "Libros PLE" },
      { key: "files/exports", label: "Exportaciones", badge: "Nuevo" },
    ],
  },
  {
    key: "settings",
    label: "Configuración",
    icon: <Settings />,
    children: [{ key: "settings/profile", label: "Perfil" }],
  },
];

function NavTreeDemo() {
  const [activeKey, setActiveKey] = useState("docs/invoices");
  const [defaultOpen, setDefaultOpen] = useState<NavTreeDefaultOpen>("active");
  const [accordion, setAccordion] = useState(false);
  const [collapsible, setCollapsible] = useState(true);
  const [enableIcons, setEnableIcons] = useState(true);
  const [enableGuide, setEnableGuide] = useState(true);
  const [enableBadges, setEnableBadges] = useState(true);
  const [size, setSize] = useState<NavTreeSize>("md");
  const [matchMode, setMatchMode] = useState<NavTreeMatch>("exact");
  const [ariaLabel, setAriaLabel] = useState("Menú de ejemplo");
  const [extraClass, setExtraClass] = useState("");

  const code = `<NavTree
  nodes={[
    { key: "home", label: "Inicio", icon: <Home />, href: "/" },
    {
      key: "docs",
      label: "Documentos",
      icon: <FileText />,
      children: [
        { key: "docs/invoices", label: "Facturas", href: "/docs/invoices", badge: "12" },
        { key: "docs/receipts", label: "Boletas", href: "/docs/receipts" },
      ],
    },
  ]}${defaultOpen === "active" ? "" : `\n  defaultOpen="${defaultOpen}"`}${accordion ? "\n  accordion" : ""}${collapsible ? "" : "\n  collapsible={false}"}${enableIcons ? "" : "\n  enableIcons={false}"}${enableGuide ? "" : "\n  enableGuide={false}"}${enableBadges ? "" : "\n  enableBadges={false}"}${size === "md" ? "" : `\n  size="${size}"`}${matchMode === "exact" ? "" : `\n  matchMode="${matchMode}"`}${ariaLabel ? `\n  ariaLabel="${ariaLabel}"` : ""}${extraClass ? `\n  className="${extraClass}"` : ""}
/>`;

  return (
    <>
      <Section title="Árbol de navegación" description="Menú interno de esta guía: grupos con icono y flecha, hoja activa resaltada, línea guía, badges y modo acordeón. Es el mismo componente que usa el menú de la izquierda.">
        <Panel title="Vista previa">
          <div className="max-w-xs rounded-xl border border-slate-200/80 bg-card p-3 dark:border-slate-800">
            <NavTree
              key={`${defaultOpen}-${accordion}-${collapsible}`}
              nodes={NODES}
              activeKey={activeKey}
              onSelect={(node) => setActiveKey(node.key)}
              defaultOpen={defaultOpen}
              accordion={accordion}
              collapsible={collapsible}
              enableIcons={enableIcons}
              enableGuide={enableGuide}
              enableBadges={enableBadges}
              size={size}
              matchMode={matchMode}
              ariaLabel={ariaLabel}
              className={extraClass || undefined}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hoja activa: <code className="font-mono">{activeKey}</code>
          </p>
        </Panel>
        <Panel title="Parámetros">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Choice label="defaultOpen" value={defaultOpen} options={OPEN} onChange={setDefaultOpen} />
            <Choice label="size" value={size} options={SIZES} onChange={setSize} />
            <Choice label="matchMode" value={matchMode} options={MATCH} onChange={setMatchMode} />
            <Toggle label="accordion" checked={accordion} onChange={setAccordion} />
            <Toggle label="collapsible" checked={collapsible} onChange={setCollapsible} />
            <Toggle label="enableIcons" checked={enableIcons} onChange={setEnableIcons} />
            <Toggle label="enableGuide" checked={enableGuide} onChange={setEnableGuide} />
            <Toggle label="enableBadges" checked={enableBadges} onChange={setEnableBadges} />
            <TextField label="ariaLabel" value={ariaLabel} onChange={setAriaLabel} width="w-40" />
            <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-32" />
          </div>
        </Panel>
        <CodeBlock code={code} />
      </Section>

      <Section title="Props" description="Parámetros de NavTree y de cada NavTreeNode.">
        <PropsTable docs={TREE_PROPS} />
      </Section>
    </>
  );
}

export default function NavTreePage() {
  return (
    <DocPage
      title="NavTree"
      category="Navegación"
      description="Árbol de navegación plegable con iconos, hoja activa, badges, línea guía y modo acordeón. Es el menú interno de la guía de estilos."
    >
      <NavTreeDemo />
      <UsedByViews component="nav-tree" />
    </DocPage>
  );
}
