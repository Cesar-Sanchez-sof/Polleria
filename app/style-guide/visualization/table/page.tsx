"use client";

import { useState } from "react";
import { Building2, CreditCard, Eye, Pencil, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { PrimaryCellTone } from "@/components/shared/PrimaryCell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type DataTableColumn, type DataTableDensity, type DataTableSort } from "@/components/shared/DataTable";
import { ControlGrid, ControlGroup, DocPage, Section, Panel, Toggle, Choice, CodeBlock, NumberField, PropsTable, TextField, type PropDoc, UsedByViews } from "@/components/style-guide/doc-kit";

// ─── Table ────────────────────────────────────────────────────────────────────

interface PurchaseRow {
  id: number;
  date: string;
  supplier: string;
  ruc: string;
  voucher: string;
  subtotal: number;
  igv: number;
  total: number;
  registeredBy: string;
  status: "Pagado" | "Parcial" | "Pendiente";
  pending: number;
}

const SUPPLIERS = ["Avícola San Fernando", "Distribuidora Andina", "Makro Supermayorista", "Bodega Don Lucho", "Packing del Sur"];
const STATUSES = ["Pagado", "Parcial", "Pendiente"] as const;

const SAMPLE_ROWS: PurchaseRow[] = Array.from({ length: 22 }, (_, index) => {
  const subtotal = 120 + ((index * 83) % 900);
  const igv = Math.round(subtotal * 18) / 100;
  const status = STATUSES[index % 3];
  return {
    id: index + 1,
    date: `${String(1 + (index % 28)).padStart(2, "0")}/10/2026`,
    supplier: SUPPLIERS[index % SUPPLIERS.length],
    ruc: `2010${String(1000000 + index * 7919).slice(0, 7)}`,
    voucher: `${index % 4 === 0 ? "Boleta B001" : "Factura F001"}-${String(100 + index * 3).padStart(8, "0")}`,
    subtotal,
    igv,
    total: subtotal + igv,
    registeredBy: ["Leandro M.", "Cesar S.", "Ana P."][index % 3],
    status,
    pending: status === "Parcial" ? Math.round((subtotal + igv) * 40) / 100 : 0,
  };
});

const COLUMN_PROPS: readonly PropDoc[] = [
  { name: "key / header", type: "string / ReactNode", description: "Identificador y texto de la cabecera." },
  { name: "cell", type: "(row, index) => ReactNode", description: "Renderizador libre de la celda." },
  { name: "primary", type: "DataTablePrimaryCell", description: "Celda principal declarativa: title, subtitle, icon, iconTone, onClick, href, newTab, showLinkIcon, titleMono, subtitleMono, enableIcon, enableSubtitle. Reemplaza a cell." },
  { name: "align / width / cellClassName", type: "string", description: "Alineación (left, center, right), clases de ancho y clases extra de las celdas." },
  { name: "info", type: "ReactNode", description: "Contenido del tooltip del icono ⓘ junto al encabezado (p. ej. las unidades permitidas)." },
  { name: "infoPlacement", type: "top | bottom", default: "bottom", description: "Lado donde se abre el tooltip." },
  { name: "headerIcon", type: "ReactNode", description: "Icono después del texto (p. ej. el lápiz de las columnas editables)." },
  { name: "sortable / sortValue", type: "boolean / (row) => value", description: "Cabecera ordenable y valor con el que se ordena (por defecto row[key])." },
];

const money = (value: number) => `S/ ${value.toFixed(2)}`;

const TABLE_PROPS: readonly PropDoc[] = [
  { name: "columns", type: "DataTableColumn<T>[]", description: "{ key, header, cell(row, index), align?, width?, cellClassName? }." },
  { name: "rows / rowKey", type: "T[] / (row) => key", description: "Datos y clave única de cada fila." },
  { name: "density", type: "\"compact\" | \"comfortable\" | \"spacious\"", default: "\"comfortable\"", description: "Alto de las filas (py-2, py-3.5, py-5)." },
  { name: "striped", type: "boolean", default: "false", description: "Fondo alterno en filas pares." },
  { name: "hoverable", type: "boolean", default: "true", description: "Resalta la fila bajo el cursor." },
  { name: "stickyHeader / maxHeight", type: "boolean / string", description: "Cabecera fija; requiere una clase de alto máximo, p. ej. \"max-h-96\"." },
  { name: "enableCard", type: "boolean", default: "true", description: "Envuelve la tabla en una tarjeta con borde redondeado." },
  { name: "enableSorting", type: "boolean", default: "true", description: "Permite ordenar las columnas marcadas sortable (clic: ascendente, descendente, sin orden)." },
  { name: "defaultSort / onSortChange", type: "{ key, direction } | null / (sort) => void", description: "Orden inicial y aviso cada vez que cambia." },
  { name: "selectable", type: "boolean", default: "false", description: "Agrega una columna de casillas con «seleccionar todo» (página actual)." },
  { name: "selectedKeys / onSelectionChange", type: "key[] / (keys) => void", description: "Selección controlada; si se omiten, la tabla la administra sola." },
  { name: "pagination", type: "boolean | { pageSizeOptions, defaultPageSize, itemLabel }", default: "false", description: "Activa el pie de paginación (15 filas por defecto)." },
  { name: "loading", type: "boolean", default: "false", description: "Marca la tabla como cargando (ver loadingMode)." },
  { name: "loadingMode", type: "\"skeleton\" | \"dim\" | \"auto\"", default: "\"skeleton\"", description: "skeleton reemplaza las filas, dim las atenúa, auto = skeleton sin filas y dim con filas." },
  { name: "skeletonRows", type: "number", default: "5", description: "Cantidad de filas esqueleto." },
  { name: "error / onRetry", type: "string | null / () => void", description: "Error de carga: reemplaza las filas por el mensaje y un botón «Reintentar»." },
  { name: "sort / manualSort", type: "DataTableSort | null / boolean", description: "Orden controlado desde afuera; con manualSort las filas ya vienen ordenadas (servidor) y la tabla solo dibuja los indicadores." },
  { name: "footer", type: "ReactNode", description: "Contenido dentro de la tarjeta bajo la tabla (p. ej. una paginación del servidor)." },
  { name: "pageResetKey", type: "unknown", description: "Al cambiar su valor la paginación vuelve a la página 1 (filtros, búsqueda)." },
  { name: "prependRows / appendRows", type: "ReactNode", description: "Filas <TableRow> extra antes y después de los datos (saldo anterior, totales). Las de después solo se dibujan si hay filas." },
  { name: "groupBy / renderGroupHeader", type: "(row) => key / (key, rows) => ReactNode", description: "Agrupa filas: dibuja una fila de cabecera antes de cada grupo (las filas deben llegar agrupadas). Ej.: períodos por año fiscal." },
  { name: "rowClassName / rowTitle", type: "(row) => string / string", description: "Clases extra por fila (p. ej. atenuar anulados) y tooltip nativo de cada fila." },
  { name: "emptyState", type: "{ icon?, title, description?, action? }", description: "Contenido cuando no hay filas." },
  { name: "onRowClick", type: "(row) => void", description: "Hace clickeable la fila completa." },
];

function TableSection() {
  const [density, setDensity] = useState<DataTableDensity>("comfortable");
  const [striped, setStriped] = useState(false);
  const [hoverable, setHoverable] = useState(true);
  const [pagination, setPagination] = useState(true);
  const [stickyHeader, setStickyHeader] = useState(false);
  const [enableCard, setEnableCard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"skeleton" | "dim" | "auto">("skeleton");
  const [skeletonRows, setSkeletonRows] = useState(5);
  const [showError, setShowError] = useState(false);
  const [errorText, setErrorText] = useState("No se pudieron cargar las compras.");
  const [showFooter, setShowFooter] = useState(false);
  const [fadePaid, setFadePaid] = useState(false);
  const [rowTitle, setRowTitle] = useState("");
  const [controlledSort, setControlledSort] = useState(false);
  const [externalSort, setExternalSort] = useState<DataTableSort | null>({ key: "date", direction: "desc" });
  const [resetKey, setResetKey] = useState(0);
  const [grouped, setGrouped] = useState(false);
  const [extraRows, setExtraRows] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<"5" | "8" | "15">("8");
  const [itemLabel, setItemLabel] = useState("comprobantes");
  const [maxHeight, setMaxHeight] = useState<"max-h-64" | "max-h-96" | "max-h-[32rem]">("max-h-96");
  const [rowClick, setRowClick] = useState(true);
  const [customEmpty, setCustomEmpty] = useState(true);
  const [extraClass, setExtraClass] = useState("");
  const [enableSorting, setEnableSorting] = useState(true);
  const [selectable, setSelectable] = useState(true);
  const [sortPreset, setSortPreset] = useState<"none" | "date-asc" | "total-desc">("none");
  const [showInfo, setShowInfo] = useState(true);
  const [infoPlacement, setInfoPlacement] = useState<"top" | "bottom">("bottom");
  const [showHeaderIcon, setShowHeaderIcon] = useState(true);
  const [primaryIcon, setPrimaryIcon] = useState(true);
  const [primarySubtitle, setPrimarySubtitle] = useState(true);
  const [primaryClickable, setPrimaryClickable] = useState(false);
  const [primaryLinkIcon, setPrimaryLinkIcon] = useState(false);
  const [primaryMono, setPrimaryMono] = useState(false);
  const [primaryTone, setPrimaryTone] = useState<PrimaryCellTone>("blue");

  const columns: DataTableColumn<PurchaseRow>[] = [
    {
      key: "date",
      header: "Fecha",
      width: "w-28",
      sortable: true,
      sortValue: (row) => Number(row.date.split("/").reverse().join("")),
      cell: (row) => <span className="text-xs font-medium">{row.date}</span>,
    },
    {
      key: "supplier",
      header: "Proveedor",
      width: "min-w-[220px]",
      sortable: true,
      sortValue: (row) => row.supplier,
      primary: {
        title: (row) => row.supplier,
        subtitle: (row) => `RUC: ${row.ruc}`,
        icon: <Building2 />,
        iconTone: primaryTone,
        enableIcon: primaryIcon,
        enableSubtitle: primarySubtitle,
        onClick: primaryClickable ? (row) => setSelected(row.id) : undefined,
        showLinkIcon: primaryLinkIcon,
        titleMono: primaryMono,
      },
    },
    {
      key: "voucher",
      header: "Comprobante",
      width: "min-w-[170px]",
      info: showInfo ? (
        <div>
          <p className="mb-1 font-semibold">Tipos de comprobante:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li><strong>Factura</strong> — da derecho a crédito fiscal</li>
            <li><strong>Boleta</strong> — no da crédito fiscal</li>
          </ul>
        </div>
      ) : undefined,
      infoPlacement,
      cell: (row) => <span className="text-xs">{row.voucher}</span> },
    { key: "subtotal", header: "Subtotal", align: "right", sortable: true, sortValue: (row) => row.subtotal, width: "w-28", cellClassName: "font-mono text-xs text-muted-foreground", cell: (row) => money(row.subtotal) },
    { key: "igv", header: "IGV", align: "right", width: "w-24", cellClassName: "font-mono text-xs text-muted-foreground", cell: (row) => money(row.igv) },
    { key: "total", header: "Total", align: "right", sortable: true, sortValue: (row) => row.total, width: "w-32", cellClassName: "font-mono text-xs font-bold", cell: (row) => money(row.total) },
    { key: "by", header: "Registrado por", width: "min-w-[150px]", headerIcon: showHeaderIcon ? <Pencil /> : undefined, cell: (row) => <span className="text-xs">{row.registeredBy}</span> },
    {
      key: "status",
      header: "Estado de pago",
      align: "center",
      width: "w-36",
      cell: (row) => (
        <StatusBadge
          tone={row.status === "Pagado" ? "success" : row.status === "Parcial" ? "warning" : "danger"}
          size={row.status === "Parcial" ? "sm" : "md"}
          pulse={row.status === "Pagado"}
          detail={row.status === "Parcial" ? `Resta ${money(row.pending)}` : undefined}
        >
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-28",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={(e) => { e.stopPropagation(); setSelected(row.id); }}>
            <Eye className="mr-1 h-3.5 w-3.5 text-blue-600" /> Detalle
          </Button>
          {row.status !== "Pagado" ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg border border-blue-200/80 bg-blue-50/80 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100" onClick={(e) => e.stopPropagation()}>
              <CreditCard className="mr-1 h-3.5 w-3.5" /> Pagar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const displayRows = grouped ? [...SAMPLE_ROWS].sort((a, b) => a.supplier.localeCompare(b.supplier)) : SAMPLE_ROWS;

  const code = `<DataTable
  columns={columns}
  rows={invoices}
  rowKey={(invoice) => invoice.id}${density === "comfortable" ? "" : `\n  density="${density}"`}${striped ? "\n  striped" : ""}${hoverable ? "" : "\n  hoverable={false}"}${stickyHeader ? `\n  stickyHeader\n  maxHeight="${maxHeight}"` : ""}${enableCard ? "" : "\n  enableCard={false}"}${pagination ? `\n  pagination={{ defaultPageSize: ${pageSize}, pageSizeOptions: [5, 8, 15, 30], itemLabel: "${itemLabel}" }}` : ""}${loading ? `\n  loading${loadingMode === "skeleton" ? "" : `\n  loadingMode="${loadingMode}"`}${skeletonRows === 5 ? "" : `\n  skeletonRows={${skeletonRows}}`}` : ""}${showError ? `\n  error="${errorText}"\n  onRetry={reload}` : ""}${showFooter ? "\n  footer={<ServerPagination />}" : ""}${controlledSort ? "\n  sort={sort}\n  manualSort\n  onSortChange={setSort}" : ""}${fadePaid ? '\n  rowClassName={(invoice) => (invoice.status === "Pagado" ? "opacity-50" : undefined)}' : ""}${rowTitle ? `\n  rowTitle="${rowTitle}"` : ""}${resetKey ? "\n  pageResetKey={filtersSignature}" : ""}${enableSorting ? "" : "\n  enableSorting={false}"}${sortPreset === "none" ? "" : `\n  defaultSort={{ key: "${sortPreset === "date-asc" ? "date" : "total"}", direction: "${sortPreset === "date-asc" ? "asc" : "desc"}" }}`}${selectable ? "\n  selectable" : ""}${extraRows ? "\n  prependRows={<PreviousBalanceRow />}\n  appendRows={<TotalsRow />}" : ""}${grouped ? "\n  groupBy={(invoice) => invoice.supplier}\n  renderGroupHeader={(supplier, rows) => <GroupHeader supplier={supplier} count={rows.length} />}" : ""}${rowClick ? "\n  onRowClick={(invoice) => openDetail(invoice)}" : ""}${customEmpty ? '\n  emptyState={{ title: "Aún no tienes compras registradas", description: "Registra tu primera compra." }}' : ""}${extraClass ? `\n  className="${extraClass}"` : ""}
/>`;

  return (
    <Section title="Tabla de datos" description="Tabla de «Compras» (purchases/list): cabecera en mayúsculas, filas divididas, estado de pago y acciones.">
      <Panel title="Parámetros">
        <ControlGrid>
          <ControlGroup title="Apariencia">
            <Choice label="density" value={density} options={["compact", "comfortable", "spacious"] as const} onChange={setDensity} />
            <Toggle label="striped" checked={striped} onChange={setStriped} />
            <Toggle label="hoverable" checked={hoverable} onChange={setHoverable} />
            <Toggle label="enableCard" checked={enableCard} onChange={setEnableCard} />
            <TextField label="className" value={extraClass} onChange={setExtraClass} width="w-28" />
          </ControlGroup>
          <ControlGroup title="Cabecera fija y alto">
            <Toggle label="stickyHeader" checked={stickyHeader} onChange={setStickyHeader} />
            <Choice label="maxHeight" value={maxHeight} options={["max-h-64", "max-h-96", "max-h-[32rem]"] as const} onChange={setMaxHeight} />
          </ControlGroup>
          <ControlGroup title="Ordenamiento">
            <Toggle label="enableSorting" checked={enableSorting} onChange={setEnableSorting} />
            <Toggle label="sort controlado + manualSort" checked={controlledSort} onChange={setControlledSort} />
            <Choice label="defaultSort" value={sortPreset} options={["none", "date-asc", "total-desc"] as const} onChange={setSortPreset} />
          </ControlGroup>
          <ControlGroup title="Selección y clic en fila">
            <Toggle label="selectable" checked={selectable} onChange={setSelectable} />
            <Toggle label="onRowClick" checked={rowClick} onChange={setRowClick} />
          </ControlGroup>
          <ControlGroup title="Cabecera de columna">
            <Toggle label="column.info (Comprobante)" checked={showInfo} onChange={setShowInfo} />
            <Choice label="column.infoPlacement" value={infoPlacement} options={["bottom", "top"] as const} onChange={setInfoPlacement} />
            <Toggle label="column.headerIcon (Registrado por)" checked={showHeaderIcon} onChange={setShowHeaderIcon} />
          </ControlGroup>
          <ControlGroup title="Celda principal (columna Proveedor)">
            <Toggle label="primary.enableIcon" checked={primaryIcon} onChange={setPrimaryIcon} />
            <Toggle label="primary.enableSubtitle" checked={primarySubtitle} onChange={setPrimarySubtitle} />
            <Toggle label="primary.onClick" checked={primaryClickable} onChange={setPrimaryClickable} />
            <Toggle label="primary.showLinkIcon" checked={primaryLinkIcon} onChange={setPrimaryLinkIcon} />
            <Toggle label="primary.titleMono" checked={primaryMono} onChange={setPrimaryMono} />
            <Choice label="primary.iconTone" value={primaryTone} options={["blue", "emerald", "indigo", "amber", "rose", "neutral"] as const} onChange={setPrimaryTone} />
          </ControlGroup>
          <ControlGroup title="Filas y pie">
            <Toggle label="rowClassName (atenuar pagados)" checked={fadePaid} onChange={setFadePaid} />
            <Toggle label="groupBy (por proveedor)" checked={grouped} onChange={setGrouped} />
            <Toggle label="prependRows / appendRows" checked={extraRows} onChange={setExtraRows} />
            <TextField label="rowTitle" value={rowTitle} onChange={setRowTitle} width="w-40" />
            <Toggle label="footer" checked={showFooter} onChange={setShowFooter} />
            <button
              type="button"
              onClick={() => setResetKey((value) => value + 1)}
              className="h-7 cursor-pointer rounded-md border border-slate-200 bg-white px-2 text-left text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <code className="font-mono">pageResetKey</code> → cambiar ({resetKey})
            </button>
          </ControlGroup>
          <ControlGroup title="Paginación">
            <Toggle label="pagination" checked={pagination} onChange={setPagination} />
            <Choice label="pagination.defaultPageSize" value={pageSize} options={["5", "8", "15"] as const} onChange={setPageSize} />
            <TextField label="pagination.itemLabel" value={itemLabel} onChange={setItemLabel} width="w-28" />
          </ControlGroup>
          <ControlGroup title="Estados">
            <Toggle label="loading" checked={loading} onChange={setLoading} />
            <Choice label="loadingMode" value={loadingMode} options={["skeleton", "dim", "auto"] as const} onChange={setLoadingMode} />
            <NumberField label="skeletonRows" value={skeletonRows} onChange={setSkeletonRows} min={1} max={12} />
            <Toggle label="error (+ onRetry)" checked={showError} onChange={setShowError} />
            <TextField label="error (texto)" value={errorText} onChange={setErrorText} width="w-44" />
            <Toggle label="emptyState personalizado" checked={customEmpty} onChange={setCustomEmpty} />
            <Toggle label="(demo) sin filas" checked={empty} onChange={setEmpty} />
          </ControlGroup>
        </ControlGrid>
      </Panel>
      <DataTable
        key={`${pageSize}-${pagination}-${sortPreset}`}
        columns={columns}
        rows={empty ? [] : displayRows}
        prependRows={extraRows ? (
          <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
            <TableCell colSpan={9} className="px-4 py-2 text-xs font-semibold italic text-muted-foreground">prependRows: saldo anterior al periodo</TableCell>
          </TableRow>
        ) : undefined}
        appendRows={extraRows ? (
          <TableRow className="bg-slate-50/70 font-bold hover:bg-slate-50/70">
            <TableCell colSpan={9} className="px-4 py-3 text-xs uppercase tracking-wider">appendRows: total {money(displayRows.reduce((sum, row) => sum + row.total, 0))}</TableCell>
          </TableRow>
        ) : undefined}
        groupBy={grouped ? (row) => row.supplier : undefined}
        renderGroupHeader={grouped ? (key, groupRows) => (
          <span className="text-xs font-semibold">
            {key} <span className="font-normal text-muted-foreground">· {groupRows.length} comprobantes</span>
          </span>
        ) : undefined}
        rowKey={(row) => row.id}
        density={density}
        striped={striped}
        hoverable={hoverable}
        stickyHeader={stickyHeader}
        maxHeight={stickyHeader ? maxHeight : undefined}
        enableCard={enableCard}
        pagination={pagination ? { defaultPageSize: Number(pageSize), pageSizeOptions: [5, 8, 15, 30], itemLabel } : false}
        loading={loading}
        loadingMode={loadingMode}
        skeletonRows={skeletonRows}
        error={showError ? errorText : null}
        onRetry={() => setShowError(false)}
        footer={showFooter ? <div className="border-t border-slate-200/80 px-4 py-2 text-xs text-muted-foreground dark:border-slate-800">Contenido de <code className="font-mono">footer</code>: totales, paginación del servidor…</div> : undefined}
        pageResetKey={resetKey}
        rowClassName={fadePaid ? (row) => (row.status === "Pagado" ? "opacity-50" : undefined) : undefined}
        rowTitle={rowTitle || undefined}
        sort={controlledSort ? externalSort : undefined}
        manualSort={controlledSort}
        onSortChange={controlledSort ? (next) => setExternalSort(next) : undefined}
        enableSorting={enableSorting}
        defaultSort={sortPreset === "none" ? null : sortPreset === "date-asc" ? { key: "date", direction: "asc" } : { key: "total", direction: "desc" }}
        selectable={selectable}
        onRowClick={rowClick ? (row) => setSelected(row.id) : undefined}
        className={extraClass || undefined}
        emptyState={customEmpty ? { icon: <Receipt className="h-7 w-7" />, title: "Aún no tienes compras registradas en este período", description: "Registra tu primera compra con sus insumos y comprobante fiscal." } : undefined}
      />
      {selected !== null ? (
        <p className="text-xs text-muted-foreground">
          Fila seleccionada (demo de <code className="font-mono">onRowClick</code>): #{selected}
        </p>
      ) : null}
      <CodeBlock code={code} />
      <PropsTable docs={TABLE_PROPS} />
      <p className="text-sm font-semibold text-foreground">Props de columna</p>
      <PropsTable docs={COLUMN_PROPS} />
    </Section>
  );
}

export default function TablePage() {
  return (
    <DocPage title="Table / DataTable" category="Visualización" description="Tablas de datos con densidad, filas alternas, cabecera fija, paginación y estados de carga y vacío. Solo se declaran columnas y datos; el componente construye el marcado.">
      <TableSection />
      <UsedByViews component="table" />
    </DocPage>
  );
}
