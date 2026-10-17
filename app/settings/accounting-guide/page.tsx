"use client";

import { useState, useMemo } from "react";
import {
  Calculator,
  Search,
  BookOpen,
  Copy,
  Check,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  RotateCcw,
  Receipt,
  Scale,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";

type CategoryFilter = "all" | "basics" | "sales" | "purchases" | "credit_notes" | "advances";

interface EntryLine {
  side: "DEBE" | "HABER";
  account: string;
  detail: string;
}

interface AccountingGuideEntry {
  category: CategoryFilter;
  categoryLabel: string;
  title: string;
  lines: EntryLine[];
}

const GUIDE_ENTRIES: AccountingGuideEntry[] = [
  // Ventas
  {
    category: "sales",
    categoryLabel: "Ventas",
    title: "1. Asiento de Provisión de la Venta (Facturación)",
    lines: [
      {
        side: "DEBE",
        account: "12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121)",
        detail: "Por el precio de venta total (incluido IGV).",
      },
      {
        side: "HABER",
        account: "40 Tributos, contraprestaciones y aportes al sistema público de pensiones y de salud por pagar (Subcuenta 40111 IGV – Cuenta propia)",
        detail: "Por el IGV generado en la venta (18%).",
      },
      {
        side: "HABER",
        account: "70 Ventas (Subcuenta 701 Mercaderías, 702 Productos terminados o 703 Servicios terminados)",
        detail: "Por el valor neto de la venta (sin impuestos).",
      },
    ],
  },
  {
    category: "sales",
    categoryLabel: "Ventas",
    title: "2. Asiento del Costo de Ventas (Salida de Almacén)",
    lines: [
      {
        side: "DEBE",
        account: "69 Costo de ventas (Subcuenta 691 Mercaderías o 692 Productos terminados)",
        detail: "Por el costo.",
      },
      {
        side: "HABER",
        account: "20 Inventario (Mercaderías)",
        detail: "Por el costo del bien vendido.",
      },
    ],
  },
  {
    category: "sales",
    categoryLabel: "Ventas",
    title: "3. Asiento de Cobro (Cancelación de la Venta)",
    lines: [
      {
        side: "DEBE",
        account: "10 Caja/Bancos (Subcuenta 101/104)",
        detail: "Por el total recibido.",
      },
      {
        side: "HABER",
        account: "12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121)",
        detail: "Por el total cobrado.",
      },
    ],
  },

  // Compras
  {
    category: "purchases",
    categoryLabel: "Compras",
    title: "1. Asiento de Provisión de la Compra (Factura del Proveedor)",
    lines: [
      {
        side: "DEBE",
        account: "60 Compras (Subcuenta 601 Mercaderías, 602 Materias primas, etc.)",
        detail: "Por el valor neto de la compra (sin impuestos).",
      },
      {
        side: "DEBE",
        account: "40 Tributos, contraprestaciones y aportes al sistema público de pensiones y de salud por pagar (Subcuenta 40111 IGV – Cuenta propia)",
        detail: "Por el IGV generado en la compra (18%).",
      },
      {
        side: "HABER",
        account: "42 Cuentas por pagar comerciales – Terceros (Subcuenta 421 Facturas, boletas y otros comprobantes por pagar)",
        detail: "Por el precio total a pagar al proveedor.",
      },
    ],
  },
  {
    category: "purchases",
    categoryLabel: "Compras",
    title: "2. Asiento de Destino (Ingreso al Almacén)",
    lines: [
      {
        side: "DEBE",
        account: "20 Mercaderías (o 24 Materias primas, 25 Suministros)",
        detail: "Por el ingreso físico de los bienes al inventario.",
      },
      {
        side: "HABER",
        account: "61 Variación de inventarios (Subcuenta 611 Mercaderías, 612 Materias primas)",
        detail: "Como cuenta correctora / contrapartida del costo asignado a inventarios.",
      },
    ],
  },
  {
    category: "purchases",
    categoryLabel: "Compras",
    title: "3. Asiento de Pago (Cancelación al Proveedor)",
    lines: [
      {
        side: "DEBE",
        account: "42 Cuentas por pagar comerciales – Terceros (Subcuenta 421)",
        detail: "Por la cancelación total o parcial del comprobante.",
      },
      {
        side: "HABER",
        account: "10 Efectivo y equivalentes de efectivo (Subcuenta 104 Cuentas corrientes o 101 Caja)",
        detail: "Por la salida de efectivo o transferencia bancaria.",
      },
    ],
  },

  // Notas de Crédito
  {
    category: "credit_notes",
    categoryLabel: "Notas de Crédito sobre Ventas",
    title: "1. Asiento de Provisión de la Nota de Crédito",
    lines: [
      {
        side: "DEBE",
        account: "74 Descuentos, rebajas y bonificaciones concedidos (o 709 Devoluciones sobre ventas)",
        detail: "Por el valor neto del descuento o devolución.",
      },
      {
        side: "DEBE",
        account: "40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV – Cuenta propia)",
        detail: "Por el ajuste/crédito del IGV (18%).",
      },
      {
        side: "HABER",
        account: "12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121 Facturas por cobrar)",
        detail: "Por el monto total de la Nota de Crédito.",
      },
    ],
  },
  {
    category: "credit_notes",
    categoryLabel: "Notas de Crédito sobre Ventas",
    title: "2. Asiento de Reingreso al Almacén (Solo si hubo devolución física de mercadería)",
    lines: [
      {
        side: "DEBE",
        account: "20 Mercaderías (Subcuenta 201)",
        detail: "Por el costo de adquisición de los bienes devueltos.",
      },
      {
        side: "HABER",
        account: "69 Costo de ventas (Subcuenta 691 Mercaderías)",
        detail: "Extornando / reduciendo el costo de ventas previamente reconocido.",
      },
    ],
  },

  // Anticipos
  {
    category: "advances",
    categoryLabel: "Venta con Anticipo de Clientes",
    title: "1. Asiento de Cobro del Anticipo (Emisión del Comprobante de Anticipo)",
    lines: [
      {
        side: "DEBE",
        account: "10 Efectivo y equivalentes de efectivo (Subcuenta 101 / 104)",
        detail: "Por el dinero total recibido.",
      },
      {
        side: "HABER",
        account: "40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV – Cuenta propia)",
        detail: "Por el IGV generado en el anticipo.",
      },
      {
        side: "HABER",
        account: "12 Cuentas por cobrar comerciales – Terceros (Subcuenta 122 Anticipos de clientes)",
        detail: "Por el valor neto del adelanto.",
      },
    ],
  },
  {
    category: "advances",
    categoryLabel: "Venta con Anticipo de Clientes",
    title: "2. Asiento de Aplicación del Anticipo en la Factura Final",
    lines: [
      {
        side: "DEBE",
        account: "12 Cuentas por cobrar comerciales – Terceros (Subcuenta 122 Anticipos de clientes)",
        detail: "Por el valor neto anticipado previamente.",
      },
      {
        side: "DEBE",
        account: "12 Cuentas por cobrar comerciales – Terceros (Subcuenta 121 Facturas por cobrar)",
        detail: "Por el saldo neto pendiente de cobro (si aplica).",
      },
      {
        side: "DEBE",
        account: "40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV)",
        detail: "Por el IGV correspondiente al saldo pendiente.",
      },
      {
        side: "HABER",
        account: "70 Ventas (Subcuenta 701 Mercaderías)",
        detail: "Por el valor de venta total del bien o servicio.",
      },
      {
        side: "HABER",
        account: "40 Tributos, contraprestaciones y aportes por pagar (Subcuenta 40111 IGV)",
        detail: "Por el IGV total de la operación.",
      },
    ],
  },
];

export default function AccountingGuidePage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    return GUIDE_ENTRIES.filter((entry) => {
      const matchCategory =
        selectedCategory === "all" || entry.category === selectedCategory;
      if (!matchCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = entry.title.toLowerCase().includes(q);
      const matchCategoryText = entry.categoryLabel.toLowerCase().includes(q);
      const matchLines = entry.lines.some(
        (l) => l.account.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q)
      );
      return matchTitle || matchCategoryText || matchLines;
    });
  }, [selectedCategory, searchQuery]);

  const showBasics =
    (selectedCategory === "all" || selectedCategory === "basics") &&
    (!searchQuery.trim() ||
      "conceptos básicos debe haber cuenta 10 efectivo"
        .toLowerCase()
        .includes(searchQuery.toLowerCase()));

  const copyEntry = (entry: AccountingGuideEntry) => {
    const text = [
      entry.title,
      ...entry.lines.map((l) => `  [${l.side}] ${l.account} — ${l.detail}`),
    ].join("\n");
    void navigator.clipboard.writeText(text);
    setCopiedTitle(entry.title);
    setTimeout(() => setCopiedTitle(null), 2000);
  };

  return (
    <>
      <ModuleHeader
        title="Guía Contable"
        subtitle="Reglas y procesos contables para la Pollería conforme al Plan Contable General Empresarial (PCGE)."
        icon={Calculator}
        iconClassName="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
      >
        <SegmentedTabs
          ariaLabel="Filtrar por tema"
          value={selectedCategory}
          onValueChange={(v) => setSelectedCategory(v as CategoryFilter)}
          className="max-w-full overflow-x-auto"
          items={[
            { value: "all", label: "Todos los temas", tone: "brand" },
            { value: "basics", label: "Conceptos Básicos", icon: <Scale />, tone: "info" },
            { value: "sales", label: "Ventas", icon: <TrendingUp />, tone: "success" },
            { value: "purchases", label: "Compras", icon: <ShoppingBag />, tone: "danger" },
            { value: "credit_notes", label: "Notas de Crédito", icon: <RotateCcw />, tone: "warning" },
            { value: "advances", label: "Anticipos de Clientes", icon: <Receipt />, tone: "cyan" },
          ]}
        />
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-5 md:p-6">
        <div className="flex flex-col w-full gap-5 max-w-5xl mx-auto">
          {/* Barra de Filtros y Búsqueda Rápida */}
          <Card className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-col gap-3.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar cuenta (ej: 12, 40, 70, IGV, Anticipo)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="text-xs h-8 text-muted-foreground"
                >
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          </Card>

          {/* SECCIÓN 1: CONCEPTOS BÁSICOS (CUENTA T VISUAL) */}
          {showBasics && (
            <Card className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Conceptos básicos</h2>
                    <p className="text-xs text-muted-foreground">Fundamentos de la partida doble y dinámica de cuentas</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex flex-col gap-1">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                      DEBE
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      qué recibí / qué se reconoce
                    </span>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 flex flex-col gap-1">
                    <span className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      HABER
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      qué entregué / de dónde salió
                    </span>
                  </div>
                </div>
              </div>

              {/* Ejemplo Visual Cuenta T */}
              <div className="rounded-2xl border border-border/80 bg-muted/20 overflow-hidden">
                <div className="border-b border-border/70 bg-card p-3.5 text-center">
                  <span className="text-xs font-bold text-foreground">
                    Ejemplo: Cuenta 10 — Efectivo y equivalentes de efectivo
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60">
                  {/* Columna DEBE */}
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/50">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        DEBE
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        La cuenta es debitada
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block mb-2">
                        Es debitada por (DEBE):
                      </span>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>Ingreso de dinero en efectivo.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>Cobros a clientes.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>Depósitos recibidos.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Columna HABER */}
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/50">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        HABER
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        La cuenta es acreditada
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block mb-2">
                        Es acreditada por (HABER):
                      </span>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <span>Pagos realizados en efectivo.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <span>Retiros de dinero.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <span>Transferencias o desembolsos.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Callout: La idea clave */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-foreground">La idea clave es:</span>
                  <p className="text-muted-foreground">
                    “Es debitada por” → ¿qué operaciones aumentan/disminuyen la cuenta por el DEBE?
                  </p>
                  <p className="text-muted-foreground">
                    “Es acreditada por” → ¿qué operaciones se registran por el HABER?
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* SECCIÓN 2: REGLAS ACTUALES PARA CREAR ASIENTOS CONTABLES */}
          {selectedCategory !== "basics" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Reglas actuales para crear asientos contables
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Guía de imputación por tipo de operación comercial
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {filteredEntries.length} asiento{filteredEntries.length === 1 ? "" : "s"} disponible{filteredEntries.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* Lista de Asientos Formateados */}
              <div className="flex flex-col gap-4">
                {filteredEntries.map((entry) => (
                  <Card
                    key={entry.title}
                    className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    {/* Header del Asiento */}
                    <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                          {entry.categoryLabel}
                        </span>
                        <h3 className="text-sm font-bold text-foreground">
                          {entry.title}
                        </h3>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                        onClick={() => copyEntry(entry)}
                        title="Copiar estructura de este asiento"
                      >
                        {copiedTitle === entry.title ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold text-[11px]">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span className="text-[11px]">Copiar</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Líneas del Asiento */}
                    <div className="flex flex-col gap-2">
                      {entry.lines.map((line, idx) => {
                        const isDebit = line.side === "DEBE";
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5 rounded-xl p-2.5 transition-colors ${isDebit
                              ? "bg-emerald-500/5 border border-emerald-500/15"
                              : "bg-blue-500/5 border border-blue-500/15 sm:ml-5"
                              }`}
                          >
                            <span
                              className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-black shrink-0 tracking-wider ${isDebit
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                }`}
                            >
                              {line.side}
                            </span>
                            <div className="flex-1 text-xs">
                              <span className="font-bold text-foreground">
                                {line.account}
                              </span>
                              <span className="text-muted-foreground mx-1.5">—</span>
                              <span className="text-muted-foreground">
                                {line.detail}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}

                {filteredEntries.length === 0 && (
                  <Card className="p-8 text-center bg-card border border-dashed border-border rounded-2xl">
                    <p className="text-sm font-semibold text-foreground">No se encontraron asientos coincidentes</p>
                    <p className="text-xs text-muted-foreground mt-1">Prueba con otra palabra clave o selecciona otra categoría.</p>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
