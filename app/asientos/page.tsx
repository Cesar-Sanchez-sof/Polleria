"use client";

import React, { useState } from "react";
import Sidebar from "../../components/personalized/Sidebar";
import {
  User,
  Search,
  Bell,
  HelpCircle,
  Receipt,
  TrendingUp,
  ArrowDown,
  SlidersHorizontal,
  Plus,
  Settings,
  Filter,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  Kanban,
  Clock,
  BarChart3,
  ExternalLink,
  MoreVertical,
  Download,
  Printer,
  Store,
} from "lucide-react";

// shadcn UI components from components/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AsientoRow {
  id: string;
  fecha: string;
  numero: string;
  contacto: string;
  contactoItalic?: boolean;
  referencia: string;
  diario: string;
  diarioCategory: string;
  total: string;
  isNegative?: boolean;
  estado: string;
}

const ASIENTOS_DATA: AsientoRow[] = [
  {
    id: "1",
    fecha: "24/06/2025",
    numero: "INV/2025/00010",
    contacto: "Leandro Mauricci Becerra",
    referencia: "Venta mostrador B001-44",
    diario: "Facturas de cliente",
    diarioCategory: "cliente",
    total: "S/ 4,72",
    estado: "Registrado",
  },
  {
    id: "2",
    fecha: "18/06/2025",
    numero: "MISC/2025/06/0002",
    contacto: "Ajuste interno contable",
    contactoItalic: true,
    referencia: "Cierre quincenal existencias",
    diario: "Operaciones varias",
    diarioCategory: "varias",
    total: "S/ 681,68",
    estado: "Registrado",
  },
  {
    id: "3",
    fecha: "18/06/2025",
    numero: "BILL/2025/06/0009",
    contacto: "Alicorp S.A.A.",
    referencia: "F003-88291 insumos",
    diario: "Facturas de proveedores",
    diarioCategory: "proveedores",
    total: "S/ -53,10",
    isNegative: true,
    estado: "Registrado",
  },
  {
    id: "4",
    fecha: "18/06/2025",
    numero: "BILL/2025/06/0008",
    contacto: "San Miguel Industrias Pet S.A.",
    referencia: "Envases y embalajes",
    diario: "Facturas de proveedores",
    diarioCategory: "proveedores",
    total: "S/ -108,56",
    isNegative: true,
    estado: "Registrado",
  },
  {
    id: "5",
    fecha: "18/06/2025",
    numero: "BILL/2025/06/0007",
    contacto: "EMPRESA AGRICOLA MARIO JAVIER DURANT OCHOA S.A.C",
    referencia: "Materia prima lote #92",
    diario: "Facturas de proveedores",
    diarioCategory: "proveedores",
    total: "S/ -37,17",
    isNegative: true,
    estado: "Registrado",
  },
  {
    id: "6",
    fecha: "18/06/2025",
    numero: "BILL/2025/06/0005",
    contacto: "Mario Vargas",
    referencia: "Servicio de mantenimiento",
    diario: "Facturas de proveedores",
    diarioCategory: "proveedores",
    total: "S/ -53,10",
    isNegative: true,
    estado: "Registrado",
  },
  {
    id: "7",
    fecha: "17/06/2025",
    numero: "MISC/2025/06/0001",
    contacto: "Banco Central de Reserva",
    contactoItalic: true,
    referencia: "Diferencia de tipo de cambio",
    diario: "Operaciones varias",
    diarioCategory: "varias",
    total: "S/ 120,40",
    estado: "Registrado",
  },
  {
    id: "8",
    fecha: "16/06/2025",
    numero: "BILL/2025/06/0004",
    contacto: "Linde Gas Perú S.A.",
    referencia: "Recarga balones de nitrógeno",
    diario: "Facturas de proveedores",
    diarioCategory: "proveedores",
    total: "S/ -215,80",
    isNegative: true,
    estado: "Registrado",
  },
];

export default function AsientosPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [selectedView, setSelectedView] = useState<string>("list");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hasFilterTag, setHasFilterTag] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter rows by category and search query
  const filteredRows = ASIENTOS_DATA.filter((row) => {
    if (selectedCategory === "cliente" && row.diarioCategory !== "cliente") return false;
    if (selectedCategory === "proveedores" && row.diarioCategory !== "proveedores") return false;
    if (selectedCategory === "varias" && row.diarioCategory !== "varias") return false;
    if (selectedCategory === "banco") return false;

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        row.numero.toLowerCase().includes(q) ||
        row.contacto.toLowerCase().includes(q) ||
        row.referencia.toLowerCase().includes(q) ||
        row.diario.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const allSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allCurrent = filteredRows.map((r) => r.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...allCurrent])));
    } else {
      const currentIds = new Set(filteredRows.map((r) => r.id));
      setSelectedIds(selectedIds.filter((id) => !currentIds.has(id)));
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    }
  };

  return (
    <div className="flex bg-(--color-background) text-sm text-slate-900 antialiased min-h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="pl-64 min-h-screen flex flex-col bg-(--color-background) w-full">
        {/* Header */}
        <header className="fixed top-0 left-64 right-0 h-16 bg-white/80 backdrop-blur-xl z-40 flex items-center justify-between px-6 shadow-xs ">
          <div className="flex items-center gap-3 w-96">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 rounded-full text-xs text-slate-900 outline-none -none shadow-none focus-visible:ring-2 focus-visible:ring-red-600 h-8"
                placeholder="Buscar cuentas, transacciones o boletas..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all cursor-pointer h-9 w-9"
              type="button"
              title="Notificaciones"
            >
              <Bell className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all cursor-pointer h-9 w-9"
              type="button"
              title="Ayuda"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center cursor-pointer text-white">
              <User className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative pt-20 flex-1 p-6">
          <div className="flex flex-col w-full gap-5">
            {/* KPI SUMMARY ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* KPI 1: Asientos en Período */}
              <Card className="bg-white p-5 rounded-xl shadow-xs  border-0! flex flex-row items-center justify-between transition-all hover:shadow-sm">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Asientos en Período
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-slate-900">21</span>
                    <Badge className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full  -emerald-200 shadow-none">
                      100% Validados
                    </Badge>
                  </div>
                  <span className="text-slate-500 text-xs mt-1">Mes Contable: Junio 2025</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-red-700">
                  <Receipt className="w-6 h-6" />
                </div>
              </Card>

              {/* KPI 2: Facturación Clientes */}
              <Card className="bg-white p-5 rounded-xl shadow-xs   flex flex-row items-center justify-between transition-all hover:shadow-sm">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Facturación Clientes
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-slate-900">
                      S/ 1,420,850.00
                    </span>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs mayo
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700">
                  <Receipt className="w-6 h-6" />
                </div>
              </Card>

              {/* KPI 3: Facturas Proveedor */}
              <Card className="bg-white p-5 rounded-xl shadow-xs   flex flex-row items-center justify-between transition-all hover:shadow-sm">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Facturas Proveedor
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-slate-900">
                      S/ 895,400.00
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <ArrowDown className="w-3.5 h-3.5" /> 16 asientos asociados
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                  <Store className="w-6 h-6" />
                </div>
              </Card>

              {/* KPI 4: Ajustes & Operaciones */}
              <Card className="bg-white p-5 rounded-xl shadow-xs   flex flex-row items-center justify-between transition-all hover:shadow-sm">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Ajustes &amp; Operaciones
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-slate-900">
                      S/ 48,250.00
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> 4 asientos manuales
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
              </Card>
            </div>

            {/* MAIN LEDGER APPLICATION CARD */}
            <Card className="bg-white rounded-xl shadow-xs   p-6 flex flex-col gap-5">
              {/* TOP TOOLBAR & CONTROLS */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
                {/* LEFT: Title, Settings Icon & New Button */}
                <div className="flex items-center gap-3">
                  <Button
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-all cursor-pointer h-9"
                    type="button"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo</span>
                  </Button>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                      Asientos contables
                    </h1>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer h-8 w-8"
                      title="Configurar Diario y Asientos"
                      type="button"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* RIGHT: Odoo Style Search Bar, Filter Tag, Pagination & View Switcher */}
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {/* Search & Filter Composite Pill */}
                  <div className="relative flex items-center bg-slate-100 rounded-full px-3 py-1.5 min-w-70 md:min-w-90">
                    <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    {hasFilterTag && (
                      <span className="inline-flex items-center gap-1 bg-purple-900 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full mr-2 shrink-0 shadow-xs">
                        <Filter className="w-3 h-3" />
                        <span>Registrado</span>
                        <button
                          onClick={() => setHasFilterTag(false)}
                          className="hover:text-purple-200 ml-0.5 text-sm leading-none cursor-pointer"
                          title="Quitar filtro"
                          type="button"
                        >
                          <X className="w-3 h-3 inline" />
                        </button>
                      </span>
                    )}
                    <Input
                      className="bg-transparent -none outline-none text-xs placeholder:text-slate-400 w-full focus-visible:ring-0 shadow-none h-6 py-0 px-0"
                      placeholder="Buscar..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                      className="text-slate-400 hover:text-slate-700 px-1 cursor-pointer shrink-0"
                      type="button"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                    <span className="tabular-nums font-semibold text-slate-900">
                      1-{filteredRows.length} / 21
                    </span>
                    <div className="flex items-center ml-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="p-0.5 text-slate-300 cursor-not-allowed rounded h-6 w-6"
                        disabled
                        title="Página anterior"
                        type="button"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="p-0.5 text-slate-600 hover:text-slate-900 rounded cursor-pointer h-6 w-6"
                        title="Página siguiente"
                        type="button"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* View Switcher Tabs */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5  ">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedView("list")}
                      className={`p-1.5 rounded-md cursor-pointer transition-colors h-7 w-7 ${selectedView === "list"
                        ? "bg-white text-red-700 shadow-xs font-semibold hover:bg-white"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                      title="Vista Lista"
                      type="button"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedView("kanban")}
                      className={`p-1.5 rounded-md cursor-pointer transition-colors h-7 w-7 ${selectedView === "kanban"
                        ? "bg-white text-red-700 shadow-xs font-semibold hover:bg-white"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                      title="Vista Kanban"
                      type="button"
                    >
                      <Kanban className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedView("schedule")}
                      className={`p-1.5 rounded-md cursor-pointer transition-colors h-7 w-7 ${selectedView === "schedule"
                        ? "bg-white text-red-700 shadow-xs font-semibold hover:bg-white"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                      title="Vista Historial / Reloj"
                      type="button"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedView("chart")}
                      className={`p-1.5 rounded-md cursor-pointer transition-colors h-7 w-7 ${selectedView === "chart"
                        ? "bg-white text-red-700 shadow-xs font-semibold hover:bg-white"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                      title="Vista Gráficos"
                      type="button"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* QUICK CATEGORY / DIARIOS TABS */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCategory("todos")}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer h-auto ${selectedCategory === "todos"
                    ? "font-bold bg-slate-900 text-white shadow-xs hover:bg-slate-900 hover:text-white"
                    : "font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  type="button"
                >
                  Todos los diarios (21)
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCategory("cliente")}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer h-auto ${selectedCategory === "cliente"
                    ? "font-bold bg-slate-900 text-white shadow-xs hover:bg-slate-900 hover:text-white"
                    : "font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  type="button"
                >
                  Facturas de cliente (1)
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCategory("proveedores")}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer h-auto ${selectedCategory === "proveedores"
                    ? "font-bold bg-slate-900 text-white shadow-xs hover:bg-slate-900 hover:text-white"
                    : "font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  type="button"
                >
                  Facturas de proveedores (18)
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCategory("varias")}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer h-auto ${selectedCategory === "varias"
                    ? "font-bold bg-slate-900 text-white shadow-xs hover:bg-slate-900 hover:text-white"
                    : "font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  type="button"
                >
                  Operaciones varias (2)
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCategory("banco")}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer h-auto ${selectedCategory === "banco"
                    ? "font-bold bg-slate-900 text-white shadow-xs hover:bg-slate-900 hover:text-white"
                    : "font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  type="button"
                >
                  Banco / Caja (0)
                </Button>
              </div>

              {/* TABLE WRAPPER USING SHADCN TABLE */}
              <div className="w-full overflow-x-auto rounded-lg  ">
                <Table className="w-full text-left -collapse min-w-245">
                  <TableHeader>
                    <TableRow className="text-slate-900 text-xs font-semibold  bg-slate-50/75 hover:bg-slate-50/75">
                      <TableHead className="py-3 px-3 w-10 text-center">
                        <Checkbox
                          id="check-all"
                          checked={allSelected}
                          onCheckedChange={(checked) => handleSelectAll(!!checked)}
                          className="cursor-pointer"
                        />
                      </TableHead>
                      <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                        Fecha
                      </TableHead>
                      <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                        Número
                      </TableHead>
                      <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                        Contacto / Tercero
                      </TableHead>
                      <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                        Referencia
                      </TableHead>
                      <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                        Diario
                      </TableHead>
                      <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] text-right">
                        Total
                      </TableHead>
                      <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] text-center">
                        Estado
                      </TableHead>
                      <TableHead
                        className="py-3 px-3 w-12 text-center text-slate-500"
                        title="Personalizar columnas"
                      >
                        <SlidersHorizontal className="w-4 h-4 inline cursor-pointer hover:text-slate-900" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
                    {filteredRows.map((row) => {
                      const isSelected = selectedIds.includes(row.id);
                      return (
                        <TableRow
                          key={row.id}
                          onClick={() => handleSelectRow(row.id, !isSelected)}
                          className={`hover:bg-(--color-background) transition-colors group cursor-pointer -b -slate-100 ${isSelected ? "bg-slate-100/75" : ""
                            }`}
                        >
                          <TableCell
                            className="py-3 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="py-3 px-3 tabular-nums font-medium text-slate-800">
                            {row.fecha}
                          </TableCell>
                          <TableCell className="py-3 px-3 font-semibold text-red-700 hover:underline">
                            <a
                              className="flex items-center gap-1.5"
                              href="#"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>{row.numero}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                            </a>
                          </TableCell>
                          <TableCell
                            className={`py-3 px-3 font-medium text-slate-900 ${row.contactoItalic ? "text-slate-500 italic text-xs" : ""
                              }`}
                          >
                            {row.contacto}
                          </TableCell>
                          <TableCell className="py-3 px-3 text-slate-500 text-xs">
                            {row.referencia}
                          </TableCell>
                          <TableCell className="py-3 px-3 text-slate-600 font-medium">
                            {row.diario}
                          </TableCell>
                          <TableCell
                            className={`py-3 px-3 text-right tabular-nums font-bold ${row.isNegative ? "text-red-600" : "text-slate-900"
                              }`}
                          >
                            {row.total}
                          </TableCell>
                          <TableCell className="py-3 px-3 text-center">
                            <Badge className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100/80 text-emerald-700 -none shadow-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              {row.estado}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="py-3 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="p-1 rounded text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer h-7 w-7"
                              type="button"
                              title="Opciones"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* TABLE FOOTER & AUDIT SUMMARY */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 -t ">
                <div className="flex items-center gap-3 text-slate-500 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Diarios sincronizados con SUNAT
                  </span>
                  <span className="hidden sm:inline text-slate-300">•</span>
                  <span className="tabular-nums">Moneda base: Soles Peruanos (PEN)</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Quick Action Buttons */}
                  <Button
                    variant="outline"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors -none shadow-none cursor-pointer h-8"
                    type="button"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar XLSX</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors -none shadow-none cursor-pointer h-8"
                    type="button"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir Libro Diario</span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}