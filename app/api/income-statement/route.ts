import type { NextRequest } from "next/server";
import {
  ErrorIncomeStatement,
  getIncomeStatement,
} from "@/lib/services/income-statement.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/income-statement?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Estado de Resultados por Función (PCGE 2019) para un periodo de fechas inclusivo.
 * El cálculo y sus reglas de clasificación viven en `lib/accounting/income-statement.ts`.
 */
/**
 * @openapi
 * /api/income-statement:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Obtener el Estado de Resultados por Función
 *     description: >
 *       Genera el Estado de Resultados (PCGE 2019 / NIIF) para un periodo de fechas inclusivo.
 *       Sólo se consideran asientos vigentes (`status = true`); las cuentas sin movimientos
 *       resuelven `0.00`. Importes en PEN con dos decimales.
 *     parameters:
 *       - in: query
 *         name: desde
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial del periodo (YYYY-MM-DD, inclusive).
 *         example: '2026-01-01'
 *       - in: query
 *         name: hasta
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final del periodo (YYYY-MM-DD, inclusive).
 *         example: '2026-01-31'
 *     responses:
 *       200:
 *         description: Estado de Resultados generado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IncomeStatement'
 *       400:
 *         description: Periodo inválido (fechas vacías, con formato incorrecto o invertidas).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno al generar el reporte.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const desde = (params.get("desde") ?? "").trim();
  const hasta = (params.get("hasta") ?? "").trim();

  try {
    const result = await getIncomeStatement({ startDate: desde, endDate: hasta });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ErrorIncomeStatement) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/income-statement] error:", error);
    return Response.json(
      { error: "No se pudo generar el Estado de Resultados." },
      { status: 500 }
    );
  }
}
