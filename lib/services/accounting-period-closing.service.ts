import type { AccountingPeriod, Prisma } from "@prisma/client";
import { findEntryIssues, isYearEndPeriod, PeriodClosingError } from "@/lib/accounting/closing";
import { annulYearEndClosingEntry, postYearEndClosingEntry } from "@/lib/services/accounting-posting.service";

type Tx = Prisma.TransactionClient;

/** Problemas que impiden cerrar el periodo (lista vacía si puede cerrarse). */
export async function collectClosingIssues(tx: Tx, period: Pick<AccountingPeriod, "id" | "endDate">): Promise<string[]> {
  const totals = await tx.journalEntryDetail.groupBy({
    by: ["entryId"],
    where: { entry: { periodId: period.id, status: true } },
    _sum: { debit: true, credit: true },
  });
  const unbalancedIds = totals
    .filter((t) => Math.abs(Number(t._sum.debit ?? 0) - Number(t._sum.credit ?? 0)) > 0.005)
    .map((t) => t.entryId);

  const [unbalanced, empty, openSessions] = await Promise.all([
    unbalancedIds.length > 0
      ? tx.journalEntry.findMany({ where: { id: { in: unbalancedIds } }, select: { id: true, code: true } })
      : Promise.resolve([]),
    tx.journalEntry.findMany({
      where: { periodId: period.id, status: true, entryDetails: { none: {} } },
      select: { code: true },
    }),
    tx.cashSession.count({ where: { status: "OPEN", openedAt: { lte: period.endDate } } }),
  ]);

  const totalsById = new Map(totals.map((t) => [t.entryId, t._sum]));
  const issues = findEntryIssues(
    unbalanced.map((e) => ({
      code: e.code,
      debit: Number(totalsById.get(e.id)?.debit ?? 0),
      credit: Number(totalsById.get(e.id)?.credit ?? 0),
    })),
    empty.map((e) => e.code),
  );
  if (openSessions > 0) {
    issues.push(`Hay ${openSessions} sesión(es) de caja abierta(s) que deben cerrarse antes.`);
  }
  return issues;
}

/**
 * Cierra el periodo: revisa los asientos y, si es el último del año, registra el asiento de cierre del
 * ejercicio. Debe correr dentro de una transacción. Lanza `PeriodClosingError` si hay problemas.
 */
export async function closeAccountingPeriod(
  tx: Tx,
  period: AccountingPeriod,
  actor: { userId: number; username: string },
) {
  const issues = await collectClosingIssues(tx, period);
  if (issues.length > 0) throw new PeriodClosingError(issues);

  const closingEntry = isYearEndPeriod(period.endDate)
    ? await postYearEndClosingEntry(tx, { periodId: period.id, endDate: period.endDate, responsible: actor.username })
    : null;

  const updated = await tx.accountingPeriod.update({
    where: { id: period.id },
    data: { status: "CLOSED", closedAt: new Date(), closedById: actor.userId },
  });
  return { period: updated, closingEntry };
}

/** Reabre el periodo y anula su asiento de cierre del ejercicio, si lo tenía. */
export async function reopenAccountingPeriod(tx: Tx, period: AccountingPeriod) {
  const annulledClosingEntries = await annulYearEndClosingEntry(tx, period.id);
  const updated = await tx.accountingPeriod.update({
    where: { id: period.id },
    data: { status: "OPEN", closedAt: null, closedById: null },
  });
  return { period: updated, annulledClosingEntries };
}
