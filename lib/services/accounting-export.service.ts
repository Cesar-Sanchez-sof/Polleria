/**
 * Servicio de exportación a XLSX para el Módulo Contable.
 * Genera reportes oficiales de Libro Diario, Contabilidad Caja y Asientos Contables.
 */

import * as XLSX from "xlsx";
import {
  listJournalEntries,
  type JournalEntriesFilter,
  type JournalEntrySummary,
} from "./journal-entries.service";
import { toast } from "sonner";

export interface ExportAccountingOptions {
  filters: JournalEntriesFilter;
  /** Título o Diario específico, p.ej. "Caja y bancos" o "Libro Diario" */
  journalTitle?: string;
  /** Nombre del archivo sugerido */
  fileNamePrefix?: string;
}

export async function exportJournalEntriesToExcel(
  options: ExportAccountingOptions
): Promise<void> {
  const { filters, journalTitle, fileNamePrefix } = options;

  try {
    toast.info("Generando archivo Excel XLSX...", { duration: 2000 });

    // Consultar todos los asientos que coinciden con los filtros actuales (hasta 1000)
    const result = await listJournalEntries({
      ...filters,
      page: 1,
      pageSize: 1000,
    });

    const entries: JournalEntrySummary[] = result.data || [];

    if (entries.length === 0) {
      toast.warning("No hay asientos contables para exportar con los filtros seleccionados.");
      return;
    }

    const isCaja =
      (filters.diario || "").toLowerCase().includes("caja") ||
      (journalTitle || "").toLowerCase().includes("caja");
    const sheetName = isCaja ? "Contabilidad Caja" : "Libro Diario";

    // Formatear filas para Excel
    const rows: Array<Record<string, string | number>> = entries.map((entry, index) => ({
      "N°": index + 1,
      "Código Asiento": entry.numero,
      "Fecha": entry.fecha,
      "Libro / Subdiario": entry.diario,
      "Glosa / Concepto": entry.concepto,
      "Responsable": entry.responsable || "Sistema",
      "Estado": entry.estado,
      "Total (S/)": Number(entry.total.toFixed(2)),
    }));

    // Calcular suma total
    const totalSuma = entries.reduce((acc, curr) => acc + curr.total, 0);

    // Fila resumen al final
    rows.push({
      "N°": "",
      "Código Asiento": "",
      "Fecha": "",
      "Libro / Subdiario": "",
      "Glosa / Concepto": "TOTAL GENERAL (S/)",
      "Responsable": "",
      "Estado": "",
      "Total (S/)": Number(totalSuma.toFixed(2)),
    });

    // Crear libro y hoja con SheetJS
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Ancho de columnas
    worksheet["!cols"] = [
      { wch: 5 },   // N°
      { wch: 18 },  // Código Asiento
      { wch: 12 },  // Fecha
      { wch: 18 },  // Libro / Subdiario
      { wch: 50 },  // Glosa / Concepto
      { wch: 18 },  // Responsable
      { wch: 12 },  // Estado
      { wch: 15 },  // Total (S/)
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Nombre dinámico del archivo
    const todayStr = new Date().toISOString().slice(0, 10);
    const prefix =
      fileNamePrefix ||
      (isCaja ? "Reporte_Contabilidad_Caja" : "Reporte_Libro_Diario_Asientos");
    const finalFileName = `${prefix}_${todayStr}.xlsx`;

    // Descargar en navegador
    XLSX.writeFile(workbook, finalFileName);

    toast.success(`Archivo "${finalFileName}" exportado exitosamente.`);
  } catch (error: any) {
    console.error("[accounting-export] Error al exportar XLSX:", error);
    toast.error(error.message || "Error al generar el archivo Excel.");
  }
}
