/**
 * Estado de Resultados por Función (Income Statement) — PCGE 2019.
 *
 * Orquestador: valida el periodo (§3 del contrato), consulta los saldos
 * agregados de `journal_entry_detail` (o usa los movimientos precargados) y
 * delega el cálculo puro en `lib/accounting/income-statement.ts`.
 *
 * Ver `specs/021-generar-estado-resultados/contracts/income-statement.md`.
 */

import { parseUtcDate } from "@/lib/dates";
import {
  computeIncomeStatement,
  isValidIsoDate,
  type AccountBalance,
  type IncomeStatementInput,
  type IncomeStatementResult,
} from "@/lib/accounting/income-statement";
import { prisma } from "@/lib/prisma";

/** Error del reporte: expone `status` HTTP y `message` (contrato §3). */
export class ErrorIncomeStatement extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ErrorIncomeStatement";
    this.status = status;
  }
}

const MSG_FECHA_INICIAL =
  "La fecha inicial es obligatoria y debe tener el formato AAAA-MM-DD.";
const MSG_FECHA_FINAL = "La fecha final es obligatoria y debe tener el formato AAAA-MM-DD.";
const MSG_RANGO = "El periodo es inválido: la fecha inicial no puede ser posterior a la final.";
const MSG_INESPERADO = "No se pudo generar el Estado de Resultados.";

/** Valida el periodo (FR-003 a FR-005) lanzando `ErrorIncomeStatement` con 400. */
export function validarPeriodo(startDate: string, endDate: string): void {
  if (!startDate || !isValidIsoDate(startDate)) {
    throw new ErrorIncomeStatement(MSG_FECHA_INICIAL, 400);
  }
  if (!endDate || !isValidIsoDate(endDate)) {
    throw new ErrorIncomeStatement(MSG_FECHA_FINAL, 400);
  }
  if (startDate > endDate) {
    throw new ErrorIncomeStatement(MSG_RANGO, 400);
  }
}

/**
 * Genera el Estado de Resultados para `startDate`…`endDate` (inclusive).
 *
 * - Si se reciben `movements`, no consulta la base de datos y los agrega aquí
 *   (FR-023): los anulados y los fuera del rango se descartan (FR-024/FR-025).
 * - Si no, agrupa los detalles de los asientos contables (`entry.status = true`)
 *   por cuenta y calcula los saldos por prefijo de código.
 * - Sin movimientos en el periodo devuelve ceros, nunca un error (FR-020).
 *
 * @throws {ErrorIncomeStatement} 400 si el periodo es inválido, 500 si falla la consulta.
 */
export async function getIncomeStatement(
  input: IncomeStatementInput
): Promise<IncomeStatementResult> {
  const { startDate, endDate } = input;
  validarPeriodo(startDate, endDate);

  if (input.movements) {
    return computeIncomeStatement({ startDate, endDate, movements: input.movements });
  }

  try {
    const accounts = await prisma.accountingAccount.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, active: true },
      orderBy: { code: "asc" },
    });

    if (accounts.length === 0) {
      return computeIncomeStatement({ startDate, endDate, balances: [] });
    }

    const aggregates = await prisma.journalEntryDetail.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accounts.map((account) => account.id) },
        entry: {
          status: true,
          entryDate: { gte: parseUtcDate(startDate), lte: parseUtcDate(endDate) },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const balances: AccountBalance[] = aggregates.map((aggregate) => {
      const account = accountById.get(aggregate.accountId);
      return {
        code: account?.code ?? "",
        name: account?.name,
        debit: Number(aggregate._sum.debit ?? 0),
        credit: Number(aggregate._sum.credit ?? 0),
      };
    });

    return computeIncomeStatement({ startDate, endDate, balances });
  } catch (error) {
    if (error instanceof ErrorIncomeStatement) throw error;
    throw new ErrorIncomeStatement(MSG_INESPERADO, 500);
  }
}
