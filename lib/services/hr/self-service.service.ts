import { prisma } from "@/lib/prisma";
import { parseUtcDate } from "@/lib/dates";
import { getEmployee } from "@/lib/services/hr/employees.service";
import { listContracts } from "@/lib/services/hr/contracts.service";
import { employeeAttendance } from "@/lib/services/hr/attendance.service";
import { listLeaves, vacationBalanceOf } from "@/lib/services/hr/leaves.service";
import { advanceLimitOf, listAdvances, listInsurances } from "@/lib/services/hr/benefits.service";
import { todayLimaIso } from "@/lib/services/hr/common";
import { addDaysIso, weekdayOf } from "@/lib/services/hr/labor-rules";
import { SCHEDULE_AHEAD_DAYS, syncScheduleFromContracts } from "@/lib/services/hr/schedules.service";

/**
 * Obtiene el perfil de autoservicio de un trabajador (contrato, horario semanal, saldo vacaciones, etc.)
 */
export async function getEmployeeSelfServiceProfile(employeeId: number, requestedFrom?: string | null) {
  const today = todayLimaIso();
  const base = requestedFrom && /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom) ? requestedFrom : today;
  const monday = addDaysIso(base, -weekdayOf(base));

  // La semana se completa desde el horario pactado (días de hoy en adelante, hasta 2 semanas).
  await prisma.$transaction(
    (tx) =>
      syncScheduleFromContracts(tx, {
        from: monday,
        to:
          addDaysIso(monday, 6) < addDaysIso(today, SCHEDULE_AHEAD_DAYS - 1)
            ? addDaysIso(monday, 6)
            : addDaysIso(today, SCHEDULE_AHEAD_DAYS - 1),
        employeeIds: [employeeId],
      }),
    { timeout: 20_000 }
  ).catch(() => undefined);

  const [employee, contracts, week, balance, leaves, advances, advanceLimit, insurances] =
    await Promise.all([
      getEmployee(employeeId),
      listContracts({ employee_id: employeeId, status: "Vigente" }),
      employeeAttendance(employeeId, monday, addDaysIso(monday, 6)),
      vacationBalanceOf(employeeId),
      listLeaves({ employee_id: employeeId }),
      listAdvances({ employee_id: employeeId }),
      advanceLimitOf(employeeId),
      listInsurances({ employee_id: employeeId }),
    ]);

  const contract = contracts.find((c) => c.start_date <= today) ?? contracts[0] ?? null;

  // Entrada sin salida de hoy o de ayer (turno nocturno): habilita «Marcar salida».
  const openMark = await prisma.attendance.findFirst({
    where: {
      employeeId,
      checkIn: { not: null },
      checkOut: null,
      date: { in: [parseUtcDate(today), parseUtcDate(addDaysIso(today, -1))] },
    },
    select: { id: true },
  });

  return {
    today,
    pending_check_out: openMark != null,
    employee,
    contract,
    week,
    vacation_balance: balance,
    leaves,
    advances,
    advance_limit: advanceLimit,
    insurances: insurances.filter((i) => i.active),
  };
}
