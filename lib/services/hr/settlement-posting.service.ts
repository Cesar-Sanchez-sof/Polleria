import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/services/security/users.service";
import { parseUtcDate } from "@/lib/dates";
import {
  BOOK_PAYROLL,
  PAYROLL_ACCOUNTS,
  paymentAccountCode,
  postJournalEntryLines,
  type JournalLineInput,
} from "@/lib/services/accounting/accounting-posting.service";
import { todayLimaIso } from "./common";
import { PAYROLL_PAYMENT_METHODS } from "./payroll.service";
import { contractSettlement, type SettlementDto, type SettlementOptions } from "./social-benefits.service";

const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Asiento de devengo de la liquidación de beneficios sociales (al cese):
 *   DEBE 6215 vacaciones · 6214 gratificación + bonif. 9 % · 6251 CTS · 659 indemnización
 *   HABER 4032 ONP / 407 AFP · 141 adelantos · 461 otros descuentos · 411 neto a pagar
 */
export function settlementAccrualLines(s: SettlementDto): JournalLineInput[] {
  const onp = s.pension_system === "ONP" ? s.pension_deduction : 0;
  const afp = s.pension_system === "AFP" ? s.pension_deduction : 0;
  const net = r2(s.total_income - s.total_deductions);
  return [
    { accountCode: PAYROLL_ACCOUNTS.vacations, debit: s.vacations.total, description: "Vacaciones truncas y no gozadas" },
    { accountCode: PAYROLL_ACCOUNTS.gratifications, debit: s.gratification.total, description: "Gratificación trunca y bonificación extraordinaria 9 %" },
    { accountCode: PAYROLL_ACCOUNTS.cts, debit: s.cts.amount, description: "CTS trunca" },
    { accountCode: PAYROLL_ACCOUNTS.severance, debit: s.indemnity.amount, description: "Indemnización por despido arbitrario" },
    { accountCode: PAYROLL_ACCOUNTS.onp, credit: onp, description: "ONP retenida sobre vacaciones" },
    { accountCode: PAYROLL_ACCOUNTS.afp, credit: afp, description: "AFP retenida sobre vacaciones" },
    { accountCode: PAYROLL_ACCOUNTS.advances, credit: s.advance_deduction, description: "Descuento de adelantos pendientes" },
    { accountCode: PAYROLL_ACCOUNTS.insurersPayable, credit: s.other_deductions, description: "Otros descuentos de la liquidación" },
    { accountCode: PAYROLL_ACCOUNTS.salariesPayable, credit: net, description: "Liquidación neta por pagar" },
  ];
}

export interface PostedSettlement {
  settlement: SettlementDto;
  journal_entries: Array<{ id: number; code: string; description: string; total: number }>;
}

const tag = (contractId: number) => `LIQ-${contractId}`;

/** Asientos ya registrados (y vigentes) de la liquidación de un contrato. */
export async function settlementEntries(contractId: number) {
  const rows = await prisma.journalEntry.findMany({
    where: { observation: { startsWith: tag(contractId) }, status: true },
    orderBy: { id: "asc" },
    include: { entryDetails: { select: { debit: true } } },
  });
  return rows.map((j) => ({
    id: j.id,
    code: j.code,
    description: j.description,
    total: r2(j.entryDetails.reduce((s, d) => s + Number(d.debit), 0)),
  }));
}

/**
 * Liquidación definitiva: exige contrato cesado, registra el asiento de devengo y, si se indica
 * medio de pago, el asiento de pago. Descuenta del saldo los adelantos pendientes. Es idempotente:
 * no permite liquidar dos veces el mismo contrato.
 */
export async function postContractSettlement(
  contractId: number,
  opts: SettlementOptions & { payment_method?: unknown; payment_date?: unknown },
  actor: { userId: number; username: string },
): Promise<PostedSettlement> {
  const method =
    opts.payment_method === undefined || opts.payment_method === ""
      ? null
      : (PAYROLL_PAYMENT_METHODS as readonly string[]).includes(String(opts.payment_method))
        ? String(opts.payment_method)
        : (() => {
            throw new UserError("Medio de pago no válido");
          })();
  const today = todayLimaIso();
  const payDate = typeof opts.payment_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.payment_date) ? opts.payment_date : today;
  if (payDate > today) throw new UserError("La fecha de pago no puede ser futura");

  const s = await contractSettlement(contractId, opts);
  if (s.contract_status === "Vigente") throw new UserError("Primero registra el cese del contrato: la liquidación definitiva se genera al cese");
  if ((await settlementEntries(contractId)).length > 0) throw new UserError("Este contrato ya tiene su liquidación registrada");
  if (s.total_income <= 0) throw new UserError("La liquidación no tiene importes que registrar");
  if (s.total_deductions > s.total_income) throw new UserError("Los descuentos superan los ingresos de la liquidación");
  if (payDate < s.cutoff) throw new UserError("El pago no puede ser anterior a la fecha de cese");

  const net = r2(s.total_income - s.total_deductions);
  const who = `${s.employee_name} (DNI ${s.employee_dni})`;

  await prisma.$transaction(async (tx) => {
    try {
      await postJournalEntryLines(tx, {
        date: parseUtcDate(s.cutoff),
        description: `Liquidación de beneficios sociales ${who}`,
        book: BOOK_PAYROLL,
        responsible: actor.username,
        observation: `${tag(contractId)} devengo · cese ${s.cutoff}`,
        lines: settlementAccrualLines(s),
      });
      if (method && net > 0) {
        await postJournalEntryLines(tx, {
          date: parseUtcDate(payDate),
          description: `Pago de liquidación ${who}`,
          book: "Caja y bancos",
          responsible: actor.username,
          observation: `${tag(contractId)} pago (${method})`,
          lines: [
            { accountCode: PAYROLL_ACCOUNTS.salariesPayable, debit: net, description: "Cancelación de liquidación" },
            { accountCode: paymentAccountCode(method), credit: net, description: `Pago por ${method}` },
          ],
        });
      }
    } catch (e) {
      throw new UserError(e instanceof Error ? e.message : "No se pudo registrar el asiento de la liquidación");
    }
    // Los adelantos pendientes quedan cancelados con la liquidación.
    if (s.advance_deduction > 0) {
      let left = s.advance_deduction;
      const advances = await tx.salaryAdvance.findMany({ where: { employeeId: s.employee_id, status: "Pagado" }, orderBy: { id: "asc" } });
      for (const a of advances) {
        if (left <= 0) break;
        const pending = r2(Number(a.amount) - Number(a.deductedAmount));
        if (pending <= 0) continue;
        const take = Math.min(pending, left);
        const deducted = r2(Number(a.deductedAmount) + take);
        await tx.salaryAdvance.update({
          where: { id: a.id },
          data: { deductedAmount: deducted, ...(deducted >= Number(a.amount) ? { status: "Liquidado" } : {}) },
        });
        left = r2(left - take);
      }
    }
  });

  return { settlement: s, journal_entries: await settlementEntries(contractId) };
}
