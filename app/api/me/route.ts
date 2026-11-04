import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/responses";
import { prisma } from "@/lib/prisma";
import { parseUtcDate } from "@/lib/dates";
import { getEmployee } from "@/lib/services/employees.service";
import { listContracts } from "@/lib/services/hr/contracts.service";
import { employeeAttendance } from "@/lib/services/hr/attendance.service";
import { listLeaves, vacationBalanceOf } from "@/lib/services/hr/leaves.service";
import { advanceLimitOf, listAdvances, listInsurances } from "@/lib/services/hr/benefits.service";
import { todayLimaIso } from "@/lib/services/hr/common";
import { addDaysIso, weekdayOf } from "@/lib/services/hr/labor-rules";
import { requireSelf } from "@/lib/services/hr/route-helpers";
import { SCHEDULE_AHEAD_DAYS, syncScheduleFromContracts } from "@/lib/services/schedules.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/me:
 *   get:
 *     tags:
 *       - Autoservicio
 *     summary: Mi ficha laboral — contrato y horario pactado, mi semana (?from lunes YYYY-MM-DD), saldo de vacaciones, solicitudes, adelantos y seguros
 *     responses:
 *       200:
 *         description: Datos del trabajador con sesión
 *       404:
 *         description: El usuario no está vinculado a un empleado
 */
export async function GET(request: NextRequest) {
  try {
    const self = await requireSelf();
    if (!self.ok) return self.response;
    const id = self.employeeId;

    const today = todayLimaIso();
    const requested = new URL(request.url).searchParams.get("from");
    const base = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
    const monday = addDaysIso(base, -weekdayOf(base));

    // La semana se completa desde el horario pactado (días de hoy en adelante, hasta 2 semanas).
    await prisma.$transaction(
      (tx) => syncScheduleFromContracts(tx, { from: monday, to: addDaysIso(monday, 6) < addDaysIso(today, SCHEDULE_AHEAD_DAYS - 1) ? addDaysIso(monday, 6) : addDaysIso(today, SCHEDULE_AHEAD_DAYS - 1), employeeIds: [id] }),
      { timeout: 20_000 },
    ).catch(() => undefined);

    const [employee, contracts, week, balance, leaves, advances, advanceLimit, insurances] = await Promise.all([
      getEmployee(id),
      listContracts({ employee_id: id, status: "Vigente" }),
      employeeAttendance(id, monday, addDaysIso(monday, 6)),
      vacationBalanceOf(prisma, id),
      listLeaves({ employee_id: id }),
      listAdvances({ employee_id: id }),
      advanceLimitOf(id),
      listInsurances({ employee_id: id }),
    ]);
    const contract = contracts.find((c) => c.start_date <= today) ?? contracts[0] ?? null;
    // Entrada sin salida de hoy o de ayer (turno nocturno): habilita «Marcar salida».
    const openMark = await prisma.attendance.findFirst({
      where: {
        employeeId: id,
        checkIn: { not: null },
        checkOut: null,
        date: { in: [parseUtcDate(today), parseUtcDate(addDaysIso(today, -1))] },
      },
      select: { id: true },
    });
    return NextResponse.json({
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
    });
  } catch (e) {
    return errorResponse(e);
  }
}
