import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/services/audit.service";
import { PeriodClosingError } from "@/lib/accounting/closing";
import { closeAccountingPeriod, reopenAccountingPeriod } from "@/lib/services/accounting-period-closing.service";
import { ValidationError, NotFoundError } from "@/lib/http/errors";

export interface CreatePeriodValidationException extends ValidationError {
  rawErrors: string[];
}

export async function listAccountingPeriodsService(params: {
  status?: string | null;
  month?: string | null;
  year?: string | null;
}) {
  const where: Prisma.AccountingPeriodWhereInput = {};
  if (params.status) {
    if (params.status === "open") where.status = "OPEN";
    else if (params.status === "closed") where.status = "CLOSED";
  }
  const month = params.month ? Number(params.month) : NaN;
  const year = params.year ? Number(params.year) : new Date().getFullYear();
  if (!isNaN(month) && month >= 1 && month <= 12) {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    where.startDate = { gte: startOfMonth, lte: endOfMonth };
  }

  return prisma.accountingPeriod.findMany({ where });
}

export async function createAccountingPeriodService(
  body: { month?: number; year?: number },
  actor: { userId: number; username: string },
  ipAddress?: string
) {
  const { month, year } = body;
  const errors: string[] = [];
  if (typeof month !== "number" || month < 1 || month > 12) {
    errors.push("El mes debe ser un número entero entre 1 y 12");
  }
  if (typeof year !== "number" || year < 1970) {
    errors.push("year must be a valid integer");
  }
  if (errors.length) {
    const err = new ValidationError(errors[0]) as CreatePeriodValidationException;
    err.rawErrors = errors;
    throw err;
  }

  if (month === undefined || year === undefined) {
    throw new ValidationError("month and year are required");
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const existing = await prisma.accountingPeriod.findFirst({
    where: {
      startDate: { gte: start, lte: end },
      endDate: { gte: start, lte: end },
    },
  });
  if (existing) {
    errors.push("Ya existe un período para el mes y año seleccionados");
    const err = new ValidationError(errors[0]) as CreatePeriodValidationException;
    err.rawErrors = errors;
    throw err;
  }

  const period = await prisma.accountingPeriod.create({
    data: {
      startDate: start,
      endDate: end,
      status: "OPEN",
      userId: actor.userId,
    },
  });

  await logAudit({
    actor: { userId: actor.userId, username: actor.username },
    action: "CREATE",
    module: "Contabilidad",
    entity: "Período contable",
    entityId: period.id,
    description: `Creó el período contable ${month}/${year}`,
    details: { after: { start, end, status: "OPEN" } },
    ipAddress,
  });

  return period;
}

export async function patchAccountingPeriodService(
  body: { periodId?: number; reopen?: boolean },
  actor: { userId: number; username: string },
  ipAddress?: string
) {
  const { periodId, reopen } = body;
  if (!periodId) {
    throw new ValidationError("periodId is required");
  }

  const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    throw new NotFoundError("Period not found");
  }
  if (period.status === "CLOSED" && !reopen) {
    throw new ValidationError("Period already closed");
  }

  const result = await prisma.$transaction(async (tx) =>
    reopen
      ? reopenAccountingPeriod(tx, period)
      : closeAccountingPeriod(tx, period, { userId: actor.userId, username: actor.username })
  );

  const updated = result.period;
  const closingEntry = "closingEntry" in result ? result.closingEntry : null;

  await logAudit({
    actor: { userId: actor.userId, username: actor.username },
    action: "STATUS_CHANGE",
    module: "Contabilidad",
    entity: "Período contable",
    entityId: periodId,
    description: `${reopen ? "Reabrió" : "Cerró"} el período contable #${periodId}${
      closingEntry ? ` y registró el asiento de cierre ${closingEntry.code}` : ""
    }`,
    details: { before: { status: period.status }, after: { status: updated.status } },
    ipAddress,
  });

  return closingEntry ? { ...updated, closingEntry } : updated;
}
