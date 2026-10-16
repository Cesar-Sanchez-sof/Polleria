"use client";

import React, { useState, useMemo } from "react";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  TransformationDetailDialog,
  TransformationDetailRecord,
} from "./TransformationDetailDialog";
import { AnnulTransformationDialog } from "./AnnulTransformationDialog";
import {
  Search,
  FileText,
  Repeat,
  Ban,
} from "lucide-react";

interface TransformationsTableProps {
  transformations: TransformationDetailRecord[];
}

export function TransformationsTable({ transformations }: TransformationsTableProps) {
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");

  // Diálogos
  const [selectedRecordForDetail, setSelectedRecordForDetail] =
    useState<TransformationDetailRecord | null>(null);
  const [selectedRecordForAnnul, setSelectedRecordForAnnul] =
    useState<TransformationDetailRecord | null>(null);

  // Filtrado
  const filteredTransformations = useMemo(() => {
    return transformations.filter((t) => {
      // Filtro por estado
      if (statusFilter === "ACTIVE" && t.annulled) return false;
      if (statusFilter === "ANNULLED" && !t.annulled) return false;

      // Filtro por fecha
      if (dateFilter) {
        const itemDateStr = new Date(t.date).toISOString().split("T")[0];
        if (itemDateStr !== dateFilter) return false;
      }

      // Buscador (incluye insumos, lote, responsable, notas)
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase().trim();
        const lotNumber = `tr-${t.id.toString().padStart(4, "0")}`.toLowerCase();
        const lotNumberSimple = `tr-${t.id}`.toLowerCase();
        const employeeName = `${t.employee.firstName} ${t.employee.paternalLastName || ""}`.toLowerCase();
        const notes = (t.notes || "").toLowerCase();
        const productNames = t.items.map((i) => i.product.name.toLowerCase()).join(" ");

        const matches =
          lotNumber.includes(query) ||
          lotNumberSimple.includes(query) ||
          employeeName.includes(query) ||
          notes.includes(query) ||
          productNames.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [transformations, statusFilter, dateFilter, searchTerm]);

  const columns: DataTableColumn<TransformationDetailRecord>[] = [
    {
      key: "lot",
      header: "N° Lote",
      width: "w-28",
      sortable: true,
      sortValue: (t) => t.id,
      cellClassName: "font-mono text-xs font-semibold",
      cell: (t) => `TR-${t.id.toString().padStart(4, "0")}`,
    },
    {
      key: "date",
      header: "Fecha / Hora",
      width: "w-44",
      sortable: true,
      sortValue: (t) => new Date(t.date).getTime(),
      cellClassName: "whitespace-nowrap text-xs",
      cell: (t) => new Date(t.date).toLocaleString("es-PE"),
    },
    {
      key: "employee",
      header: "Responsable",
      width: "min-w-[150px]",
      cellClassName: "text-xs",
      cell: (t) => `${t.employee.firstName} ${t.employee.paternalLastName || ""}`,
    },
    {
      key: "consumption",
      header: "Consumo (Salida)",
      width: "min-w-[220px]",
      cellClassName: "text-xs",
      cell: (t) => (
        <div className="space-y-0.5">
          {t.items
            .filter((i) => i.itemType === "Consumo")
            .map((c) => (
              <div key={c.id} className={t.annulled ? "text-muted-foreground line-through" : "font-medium text-rose-700"}>
                - {Number(c.quantity).toFixed(2)} {c.product.unitOfMeasure} {c.product.name}
              </div>
            ))}
        </div>
      ),
    },
    {
      key: "production",
      header: "Producción (Entrada)",
      width: "min-w-[220px]",
      cellClassName: "text-xs",
      cell: (t) => (
        <div className="space-y-0.5">
          {t.items
            .filter((i) => i.itemType === "Producido")
            .map((p) => (
              <div key={p.id} className={t.annulled ? "text-muted-foreground line-through" : "font-medium text-emerald-700"}>
                + {Number(p.quantity).toFixed(2)} {p.product.unitOfMeasure} {p.product.name}
              </div>
            ))}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "w-32",
      sortable: true,
      sortValue: (t) => (t.annulled ? 1 : 0),
      cell: (t) => (
        <StatusBadge tone={t.annulled ? "neutral" : "success"} size="sm">
          {t.annulled ? "Anulada" : "Activa"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-40",
      cell: (t) => (
        <RowActions
          mode="both"
          size="sm"
          actions={[
            { key: "detail", label: "Detalle", icon: <FileText />, tone: "blue", onClick: () => setSelectedRecordForDetail(t) },
            { key: "annul", label: "Anular", icon: <Ban />, tone: "rose", hidden: t.annulled, onClick: () => setSelectedRecordForAnnul(t) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border rounded-lg p-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por lote (TR-0001), insumo, responsable..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Control de Estados */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white dark:bg-slate-800 text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ACTIVE");
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activas
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ANNULLED");
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ANNULLED"
                  ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anuladas
            </button>
          </div>


          {/* Filtro por Fecha */}
          <div className="w-[140px]">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
              }}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Historial */}
      <DataTable
        columns={columns}
        rows={filteredTransformations}
        rowKey={(t) => t.id}
        defaultSort={{ key: "date", direction: "desc" }}
        pageResetKey={`${searchTerm}|${statusFilter}|${dateFilter}`}
        pagination={{ defaultPageSize: 15, itemLabel: "transformaciones" }}
        rowClassName={(t) => (t.annulled ? "opacity-60" : undefined)}
        emptyState={{
          icon: <Repeat className="h-7 w-7" />,
          title:
            transformations.length === 0
              ? "No hay transformaciones registradas en el sistema."
              : "No se encontraron transformaciones con los filtros seleccionados.",
        }}
      />

      <TransformationDetailDialog
        transformation={selectedRecordForDetail}
        open={!!selectedRecordForDetail}
        onOpenChange={(open) => !open && setSelectedRecordForDetail(null)}
      />

      <AnnulTransformationDialog
        transformation={selectedRecordForAnnul}
        open={!!selectedRecordForAnnul}
        onOpenChange={(open) => !open && setSelectedRecordForAnnul(null)}
      />
    </div>
  );
}

