/**
 * Datos de ejemplo de Recursos Humanos para probar todo el módulo de punta a punta:
 * contratos de todas las modalidades, usuarios con rol, turnos base, horarios de las últimas
 * semanas y las dos próximas, asistencia con puntuales/tardanzas/faltas/horas extra (con su
 * bitácora de marcaciones), vacaciones y licencias, seguros, adelantos, y la planilla del mes
 * anterior aprobada y pagada (con sus asientos contables) más la del mes en curso en borrador.
 *
 * Uso (después de `npx prisma migrate deploy` y `npm run db:seed`):
 *   npx tsx prisma/seed-hr-demo.ts            → crea los datos (se niega si ya existen)
 *   npx tsx prisma/seed-hr-demo.ts --reset    → borra los datos de ejemplo y los vuelve a crear
 *   npx tsx prisma/seed-hr-demo.ts --remove   → solo borra los datos de ejemplo
 *   … --with-payroll                          → calcula las planillas aunque haya contratos reales
 *                                               (la planilla es de toda la empresa: solo en bases de prueba)
 *
 * Todos los trabajadores de ejemplo tienen DNI 7000000X y la contraseña de sus usuarios es
 * «Demo2026!». Las fechas se calculan a partir de hoy, así que el script sirve cualquier día.
 */
import { PrismaClient } from "@prisma/client";

// Cliente sin el log de cada consulta (los servicios reutilizan este mismo cliente).
const g = globalThis as unknown as { prisma?: PrismaClient };
g.prisma = new PrismaClient({ log: ["warn", "error"] });
const prisma = g.prisma;

const DEMO_PASSWORD = "Demo2026!";
const DNI = (n: number) => `7000000${n}`;
const DEMO_DNIS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(DNI);

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayIso = () => iso(new Date(Date.now() - 5 * 3600_000));
const addDays = (s: string, n: number) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY));
const addMonths = (s: string, n: number) => {
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return iso(t);
};
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const weekday = (s: string) => (utc(s).getUTCDay() + 6) % 7; // lunes = 0
/** Instante (UTC) de una hora de Lima en un día. */
const limaInstant = (s: string, minutes: number) => new Date(utc(s).getTime() + (minutes + 300) * 60_000);
const toMin = (t: Date) => t.getUTCHours() * 60 + t.getUTCMinutes();

/** Pseudoaleatorio determinista: el mismo día y trabajador siempre dan el mismo resultado. */
function rand(seed: string): number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

function log(msg: string) {
  console.log(msg);
}

async function removeDemo() {
  const employees = await prisma.employee.findMany({ where: { dni: { in: DEMO_DNIS } }, select: { id: true } });
  const ids = employees.map((e) => e.id);
  if (ids.length === 0) return log("ℹ No hay datos de ejemplo de RR. HH. para borrar.");

  // Planillas que solo contienen trabajadores de ejemplo (con sus asientos).
  const periods = await prisma.payrollPeriod.findMany({ include: { lines: { select: { employeeId: true } } } });
  const demoPeriods = periods.filter((p) => p.lines.length > 0 && p.lines.every((l) => ids.includes(l.employeeId))).map((p) => p.id);
  const mixed = periods.filter((p) => p.lines.some((l) => ids.includes(l.employeeId)) && !demoPeriods.includes(p.id));
  if (mixed.length > 0) {
    throw new Error(
      `Hay planillas que mezclan trabajadores reales y de ejemplo (${mixed.map((p) => `${p.month}/${p.year}`).join(", ")}). Bórralas o recalcúlalas antes de quitar los datos de ejemplo.`,
    );
  }
  const advanceEntries = (await prisma.salaryAdvance.findMany({ where: { employeeId: { in: ids }, journalEntryId: { not: null } }, select: { journalEntryId: true } }))
    .map((a) => a.journalEntryId!)
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.deleteMany({ where: { OR: [{ payrollPeriodId: { in: demoPeriods } }, { id: { in: advanceEntries } }] } });
    await tx.payrollPeriod.deleteMany({ where: { id: { in: demoPeriods } } });
    await tx.employeeInsurance.deleteMany({ where: { employeeId: { in: ids } } });
    await tx.employee.deleteMany({ where: { id: { in: ids } } }); // cascada: contratos, asistencia, marcas, licencias, adelantos, usuarios, boletas
    // Horarios que quedaron vacíos dentro de la ventana de la demo.
    await tx.shift.deleteMany({ where: { employees: { none: {} }, date: { gte: utc(addMonths(todayIso(), -2)) } } });
  });
  log(`🧹 Datos de ejemplo eliminados (${ids.length} trabajadores, ${demoPeriods.length} planilla(s), ${advanceEntries.length} asiento(s) de adelantos).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--remove") || args.includes("--reset")) await removeDemo();
  if (args.includes("--remove")) return;

  const exists = await prisma.employee.count({ where: { dni: { in: DEMO_DNIS } } });
  if (exists > 0) throw new Error("Los datos de ejemplo ya existen. Usa --reset para recrearlos o --remove para quitarlos.");

  const { hireEmployee } = await import("../lib/services/employees.service");
  const { terminateContract } = await import("../lib/services/hr/contracts.service");
  const { requestLeave, reviewLeave } = await import("../lib/services/hr/leaves.service");
  const { createInsurance, requestAdvance, updateAdvance } = await import("../lib/services/hr/benefits.service");
  const { calculatePayrollPeriod, approvePayrollPeriod, payPayrollPeriod } = await import("../lib/services/hr/payroll.service");
  const { postSalaryAdvanceJournalEntry } = await import("../lib/services/accounting-posting.service");
  const { hashPassword } = await import("../lib/auth/password");

  const admin = await prisma.user.findFirst({ where: { role: { isSystem: true }, active: true }, orderBy: { id: "asc" } });
  if (!admin) throw new Error("No hay un usuario ADMIN: ejecuta primero `npm run db:seed`.");
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));
  for (const r of ["CAJERO", "MESERO", "COCINERO", "RRHH"]) {
    if (!roles[r]) throw new Error(`Falta el rol ${r}: ejecuta primero \`npm run db:seed\`.`);
  }
  const actor = { userId: admin.id, username: admin.username };

  const T = todayIso();
  const CM1 = `${T.slice(0, 8)}01`; // inicio del mes en curso
  const PM1 = addMonths(CM1, -1); // inicio del mes anterior
  const PMe = addDays(CM1, -1);
  log(`🌱 Datos de ejemplo de RR. HH. (hoy ${T}; mes anterior ${PM1} → ${PMe})`);

  // ------------------------------------------------------------------ turnos base
  const tpl = async (name: string, start: string, end: string) =>
    prisma.shiftTemplate.upsert({
      where: { name },
      update: { active: true },
      create: { name, startTime: new Date(`1970-01-01T${start}:00Z`), endTime: new Date(`1970-01-01T${end}:00Z`) },
    });
  const T_PREP = await tpl("Preparación", "16:00", "18:00");
  const T_ATT = await tpl("Atención", "18:00", "23:30");
  const T_CLOSE = await tpl("Cierre", "23:30", "00:30");
  const T_OFFICE = await tpl("Oficina", "09:00", "17:00");
  const T_ADMIN = await tpl("Administración", "09:00", "14:00");
  const T_BOOST = await tpl("Refuerzo", "19:00", "22:30");
  log("✔ Turnos base: Preparación, Atención, Cierre, Oficina, Administración, Refuerzo");

  const days = (wd: number[], ids: number[]) => wd.map((weekday) => ({ weekday, template_ids: ids }));

  // ------------------------------------------------------------------ contrataciones
  type Hire = {
    n: number;
    personal: Record<string, string>;
    contract: Record<string, unknown>;
    user?: { username: string; role: string };
  };
  const hires: Hire[] = [
    {
      n: 1,
      personal: { first_name: "Rosa", paternal_last_name: "Quispe", maternal_last_name: "Mamani", phone: "987111001", email: "rosa.quispe@demo.pe", birth_date: "1992-05-14", emergency_contact: "Juan Quispe (esposo)", emergency_phone: "987111901" },
      contract: { contract_type: "Indeterminado", labor_regime: "General", position: "Cajera", area: "Caja", start_date: "2023-03-01", base_salary: 1500, family_allowance: true, pension_system: "AFP", afp_name: "Integra", cuspp: "584921RQMAA3", schedule: days([1, 2, 3, 4, 5, 6], [T_ATT.id, T_CLOSE.id]) },
      user: { username: "rquispe", role: "CAJERO" },
    },
    {
      n: 2,
      personal: { first_name: "Luis", middle_name: "Alberto", paternal_last_name: "Ramírez", maternal_last_name: "Soto", phone: "987111002", birth_date: "1999-11-02" },
      contract: { contract_type: "PlazoFijo", labor_regime: "General", position: "Mozo", area: "Salón", start_date: addMonths(T, -5), end_date: addDays(T, 20), base_salary: 1200, pension_system: "ONP", notes: "Incremento de actividad por temporada (art. 57 D. Leg. 728)", schedule: days([0, 1, 2, 3, 4, 5], [T_ATT.id]) },
      user: { username: "lramirez", role: "MESERO" },
    },
    {
      n: 3,
      personal: { first_name: "Carmen", paternal_last_name: "Torres", maternal_last_name: "Vega", phone: "987111003", birth_date: "1988-02-20", emergency_contact: "Lucía Vega (madre)", emergency_phone: "987111903" },
      contract: { contract_type: "Indeterminado", labor_regime: "General", position: "Cocinera", area: "Cocina", start_date: "2022-08-15", base_salary: 1800, family_allowance: true, pension_system: "AFP", afp_name: "Prima", schedule: days([1, 2, 3, 4, 5, 6], [T_PREP.id, T_ATT.id]) },
      user: { username: "ctorres", role: "COCINERO" },
    },
    {
      n: 4,
      personal: { first_name: "Jorge", paternal_last_name: "Huamán", maternal_last_name: "Ccori", phone: "987111004", birth_date: "1995-07-30" },
      contract: { contract_type: "PlazoFijo", labor_regime: "General", position: "Parrillero", area: "Cocina", start_date: addDays(PM1, 14), end_date: addMonths(addDays(PM1, 14), 6), base_salary: 1600, pension_system: "ONP", notes: "Inicio de actividad: nueva parrilla", schedule: days([0, 2, 3, 4, 5, 6], [T_PREP.id, T_ATT.id]) },
      user: { username: "jhuaman", role: "COCINERO" },
    },
    {
      n: 5,
      personal: { first_name: "Diana", paternal_last_name: "Flores", maternal_last_name: "Ríos", phone: "987111005", birth_date: "2001-09-09" },
      contract: { contract_type: "TiempoParcial", labor_regime: "General", position: "Moza (refuerzo)", area: "Salón", start_date: "2025-06-01", base_salary: 650, pension_system: "ONP", schedule: days([4, 5, 6], [T_BOOST.id]) },
    },
    {
      n: 6,
      personal: { first_name: "Kevin", paternal_last_name: "Salazar", maternal_last_name: "Paz", phone: "987111006", birth_date: "2003-01-25" },
      contract: { contract_type: "Practicas", labor_regime: "General", position: "Practicante de administración", area: "Administración", start_date: addMonths(T, -4), end_date: addMonths(T, 8), base_salary: 1000, pension_system: "Ninguno", schedule: days([0, 1, 2, 3, 4], [T_ADMIN.id]) },
    },
    {
      n: 7,
      personal: { first_name: "Mariela", paternal_last_name: "Vega", maternal_last_name: "Ruiz", phone: "987111007", email: "mariela.vega@demo.pe", birth_date: "1985-12-03" },
      contract: { contract_type: "Indeterminado", labor_regime: "General", position: "Jefa de Recursos Humanos", area: "Administración", start_date: "2021-01-11", base_salary: 6000, pension_system: "AFP", afp_name: "Habitat", schedule: days([0, 1, 2, 3, 4], [T_OFFICE.id]) },
      user: { username: "mvega", role: "RRHH" },
    },
    {
      n: 8,
      personal: { first_name: "Pedro", paternal_last_name: "Castillo", maternal_last_name: "León", phone: "987111008", birth_date: "1997-04-17" },
      contract: { contract_type: "Indeterminado", labor_regime: "General", position: "Mozo", area: "Salón", start_date: "2024-02-01", base_salary: 1200, pension_system: "ONP", schedule: days([0, 1, 2, 3, 4, 5], [T_ATT.id]) },
    },
    {
      n: 9,
      personal: { first_name: "Jhon", paternal_last_name: "Paredes", maternal_last_name: "Lazo", phone: "987111009", birth_date: "1998-08-08" },
      contract: { contract_type: "LocacionServicios", labor_regime: "General", position: "Repartidor (delivery)", area: "Delivery", start_date: addMonths(T, -3), end_date: addMonths(T, 3), base_salary: 1000, pension_system: "Ninguno", schedule: days([4, 5, 6], [T_ATT.id]) },
    },
  ];

  const emp: Record<number, { id: number; contractId: number; name: string; userId?: number }> = {};
  for (const h of hires) {
    const r = await hireEmployee({ dni: DNI(h.n), ...h.personal } as never, h.contract as never, admin.id);
    emp[h.n] = { id: r.employee.employee_id, contractId: r.contract.contract_id, name: r.employee.full_name };
    if (h.user) {
      const u = await prisma.user.create({
        data: {
          employeeId: r.employee.employee_id,
          roleId: roles[h.user.role],
          username: h.user.username,
          email: h.personal.email ?? `${h.user.username}@demo.pe`,
          password: await hashPassword(DEMO_PASSWORD),
          active: true,
        },
      });
      emp[h.n].userId = u.id;
    }
  }
  log(`✔ ${hires.length} contrataciones (todas las modalidades) y 5 usuarios: rquispe, lramirez, ctorres, jhuaman, mvega · clave ${DEMO_PASSWORD}`);

  // ------------------------------------------------------------------ seguros
  const ins = (n: number, data: Record<string, unknown>) => createInsurance(emp[n].id, data as never);
  for (const n of [1, 2, 3, 5, 7, 8]) {
    await ins(n, { type: "VidaLey", provider: "Rímac Seguros", policy_number: `VL-2026-00${n}4`, start_date: n === 2 ? addMonths(T, -5) : "2025-01-01", monthly_cost: 9.5, covers_dependents: false });
  }
  await ins(3, { type: "SCTR", provider: "Pacífico Seguros", policy_number: "SCTR-77812", start_date: "2025-01-01", monthly_cost: 27.5 });
  await ins(4, { type: "SCTR", provider: "Pacífico Seguros", policy_number: "SCTR-77813", start_date: addDays(PM1, 14), monthly_cost: 24.5 });
  await ins(7, { type: "EPS", provider: "Pacífico EPS", policy_number: "EPS-30021", start_date: "2024-01-01", monthly_cost: 95, covers_dependents: true });
  await ins(6, { type: "SeguroPrivado", provider: "La Positiva (seguro de practicantes)", policy_number: "PR-1206", start_date: addMonths(T, -4), end_date: addDays(T, 15), monthly_cost: 15 });
  log("✔ Seguros: Vida Ley, SCTR, EPS y seguro de practicante (Jorge queda sin Vida Ley → alerta; el de Kevin vence pronto)");

  // ------------------------------------------------------------------ cese de Pedro (renuncia a mitad del mes anterior)
  await terminateContract(emp[8].contractId, { termination_date: addDays(PM1, 9), reason: "Renuncia voluntaria: carta del " + addDays(PM1, -20), kind: "Finalizado" });
  log(`✔ Cese de Pedro Castillo al ${addDays(PM1, 9)} (renuncia); queda en el historial y en la planilla del mes anterior por 10 días`);

  // ------------------------------------------------------------------ vacaciones y licencias (antes de programar)
  const hr = { userId: admin.id, selfService: false };
  await requestLeave(emp[1].id, { type: "Vacaciones", start_date: addDays(PM1, 9), end_date: addDays(PM1, 15), reason: "Vacaciones programadas", approve: true }, hr);
  await requestLeave(emp[3].id, { type: "DescansoMedico", start_date: addDays(T, -6), end_date: addDays(T, -5), document_ref: "CITT 2026-0045871", reason: "Faringitis aguda", approve: true }, hr);
  await requestLeave(emp[5].id, { type: "LicenciaSinGoce", start_date: addDays(PM1, 17), end_date: addDays(PM1, 18), reason: "Viaje familiar", approve: true }, hr);
  await requestLeave(emp[2].id, { type: "Vacaciones", start_date: addDays(T, 5), end_date: addDays(T, 7), reason: "Matrimonio de un familiar", advance: true }, { userId: emp[2].userId ?? null, selfService: true });
  await requestLeave(emp[4].id, { type: "PermisoPersonal", start_date: addDays(T, 3), end_date: addDays(T, 3), reason: "Trámite de DNI en RENIEC" }, { userId: emp[4].userId ?? null, selfService: true });
  const rejected = await requestLeave(emp[6].id, { type: "PermisoPersonal", start_date: addDays(T, 2), end_date: addDays(T, 2), reason: "Evento universitario" }, hr);
  await reviewLeave(rejected.leave.leave_id, "reject", "Coincide con el cierre de inventario; reprogramar", admin.id);
  log("✔ Licencias: vacaciones aprobadas (Rosa), descanso médico (Carmen), licencia sin goce (Diana), adelanto de vacaciones pendiente (Luis), permiso pendiente (Jorge), permiso rechazado (Kevin)");

  // ------------------------------------------------------------------ horarios: mes anterior → dos semanas adelante
  const contracts = await prisma.employmentContract.findMany({
    where: { employeeId: { in: Object.values(emp).map((e) => e.id) } },
    include: { schedule: { include: { shiftTemplate: true } }, employee: { select: { leaveRequests: { where: { status: "Aprobada" } } } } },
  });
  const shiftCache = new Map<string, number>();
  let assignments = 0;
  for (let d = PM1; d <= addDays(T, 13); d = addDays(d, 1)) {
    for (const c of contracts) {
      const start = iso(c.startDate);
      const end = c.endDate ? iso(c.endDate) : null;
      if (d < start || (end && d > end)) continue;
      if (c.employee.leaveRequests.some((l) => iso(l.startDate) <= d && d <= iso(l.endDate))) continue;
      for (const s of c.schedule.filter((x) => x.weekday === weekday(d))) {
        const key = `${s.shiftTemplate.name}|${d}`;
        let shiftId = shiftCache.get(key);
        if (!shiftId) {
          const found = await prisma.shift.findFirst({ where: { name: s.shiftTemplate.name, date: utc(d) } });
          shiftId = found?.id ?? (await prisma.shift.create({ data: { name: s.shiftTemplate.name, date: utc(d), startTime: s.shiftTemplate.startTime, endTime: s.shiftTemplate.endTime } })).id;
          shiftCache.set(key, shiftId);
        }
        await prisma.employeeShift.upsert({
          where: { employeeId_shiftId: { employeeId: c.employeeId, shiftId } },
          update: {},
          create: { employeeId: c.employeeId, shiftId },
        });
        assignments++;
      }
    }
  }
  log(`✔ Horarios programados del ${PM1} al ${addDays(T, 13)} (${assignments} asignaciones)`);

  // ------------------------------------------------------------------ asistencia histórica (hasta ayer) + bitácora
  const userByEmployee = new Map(Object.values(emp).map((e) => [e.id, e]));
  const assigned = await prisma.employeeShift.findMany({
    where: { employeeId: { in: [...userByEmployee.keys()] }, shift: { date: { gte: utc(PM1), lt: utc(T) } } },
    include: { shift: true },
  });
  const byDay = new Map<string, { employeeId: number; start: number; end: number }>();
  for (const a of assigned) {
    const d = iso(a.shift.date);
    const s = toMin(a.shift.startTime);
    let e = toMin(a.shift.endTime);
    if (e <= s) e += 1440;
    const key = `${a.employeeId}|${d}`;
    const cur = byDay.get(key);
    byDay.set(key, cur ? { employeeId: a.employeeId, start: Math.min(cur.start, s), end: Math.max(cur.end, e) } : { employeeId: a.employeeId, start: s, end: e });
  }
  let marks = 0;
  const stats = { onTime: 0, late: 0, absent: 0, overtime: 0 };
  let justifiedDone = false;
  for (const [key, w] of byDay) {
    const d = key.split("|")[1];
    const e = userByEmployee.get(w.employeeId)!;
    const r = rand(key);
    const ip = `192.168.1.${20 + (w.employeeId % 30)}`;
    if (r < 0.05) {
      stats.absent++;
      // Una de las faltas de Luis se justifica (cita médica con constancia).
      if (!justifiedDone && w.employeeId === emp[2].id) {
        justifiedDone = true;
        const att = await prisma.attendance.create({
          data: { employeeId: w.employeeId, date: utc(d), justified: true, justification: "Cita médica en EsSalud con constancia", source: "Correccion", registeredById: admin.id },
        });
        await prisma.attendanceMark.create({
          data: { attendanceId: att.id, employeeId: w.employeeId, kind: "Entrada", markedAt: null, source: "Correccion", userId: admin.id, username: admin.username, note: "Falta justificada: cita médica con constancia", createdAt: limaInstant(addDays(d, 1), 10 * 60) },
        });
        marks++;
      }
      continue;
    }
    const late = r < 0.17;
    const inMin = late ? w.start + 12 + Math.floor(rand(`${key}l`) * 28) : w.start - 12 + Math.floor(rand(`${key}p`) * 20);
    const extra = rand(`${key}x`) < 0.12;
    const outMin = extra ? w.end + 45 + Math.floor(rand(`${key}o`) * 55) : w.end + Math.floor(rand(`${key}o`) * 12);
    if (late) stats.late++;
    else stats.onTime++;
    if (extra) stats.overtime++;
    const hasUser = Boolean(e.userId);
    const inSource = hasUser ? (rand(`${key}s`) < 0.85 ? "InicioSesion" : "Autoservicio") : "Manual";
    const outSource = hasUser ? (rand(`${key}t`) < 0.6 ? "CierreSesion" : "Autoservicio") : "Manual";
    const checkIn = limaInstant(d, inMin);
    const checkOut = limaInstant(d, outMin);
    const att = await prisma.attendance.create({
      data: {
        employeeId: w.employeeId,
        date: utc(d),
        checkIn,
        checkOut,
        source: inSource,
        checkOutSource: outSource,
        checkInIp: hasUser ? ip : null,
        checkOutIp: hasUser ? ip : null,
        registeredById: hasUser ? e.userId! : admin.id,
      },
    });
    const who = hasUser ? { userId: e.userId!, username: hires.find((h) => emp[h.n].id === w.employeeId)!.user!.username } : { userId: admin.id, username: admin.username };
    const ua = hasUser ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36" : null;
    await prisma.attendanceMark.createMany({
      data: [
        { attendanceId: att.id, employeeId: w.employeeId, kind: "Entrada", markedAt: checkIn, source: inSource, ...who, ipAddress: hasUser ? ip : null, userAgent: ua, createdAt: checkIn },
        { attendanceId: att.id, employeeId: w.employeeId, kind: "Salida", markedAt: checkOut, source: outSource, ...who, ipAddress: hasUser ? ip : null, userAgent: ua, createdAt: checkOut },
      ],
    });
    marks += 2;
  }
  log(`✔ Asistencia hasta ayer: ${stats.onTime} puntuales, ${stats.late} tardanzas, ${stats.absent} faltas (1 justificada), ${stats.overtime} días con horas extra · ${marks} marcaciones en la bitácora`);

  // ------------------------------------------------------------------ adelantos
  // Rosa: adelanto entregado el mes anterior (asiento 141 / Caja) que se descuenta en 2 cuotas.
  const rosaAdv = await prisma.salaryAdvance.create({
    data: {
      employeeId: emp[1].id,
      amount: 400,
      installments: 2,
      requestDate: utc(addDays(PM1, 3)),
      reason: "Útiles escolares",
      status: "Pagado",
      reviewedById: admin.id,
      reviewedAt: limaInstant(addDays(PM1, 3), 11 * 60),
      paidAt: limaInstant(addDays(PM1, 4), 10 * 60),
      paymentMethod: "Yape",
    },
  });
  const entryId = await prisma.$transaction((tx) =>
    postSalaryAdvanceJournalEntry(tx, { advanceId: rosaAdv.id, employeeName: emp[1].name, amount: 400, paymentMethodName: "Yape", date: utc(addDays(PM1, 4)), responsible: admin.username }),
  );
  await prisma.salaryAdvance.update({ where: { id: rosaAdv.id }, data: { journalEntryId: entryId } });
  // Luis: pendiente de aprobar. Jorge: aprobado, listo para entregar (y ver el asiento al hacerlo).
  await requestAdvance(emp[2].id, { amount: 300, installments: 1, reason: "Pago de alquiler" });
  const jorge = await requestAdvance(emp[4].id, { amount: 500, installments: 2, reason: "Reparación de moto" });
  await updateAdvance(jorge.advance_id, { action: "approve", note: "Aprobado por jefatura" }, admin.id);
  log("✔ Adelantos: Rosa entregado (S/ 400 en 2 cuotas, con asiento), Luis pendiente, Jorge aprobado por entregar");

  // ------------------------------------------------------------------ planillas
  // La planilla es de toda la empresa: si hay trabajadores reales con sueldo, no se toca.
  const realContracts = await prisma.employmentContract.count({
    where: {
      employee: { dni: { notIn: DEMO_DNIS } },
      baseSalary: { gt: 0 },
      contractType: { not: "LocacionServicios" },
      startDate: { lte: utc(PMe) },
      OR: [{ endDate: null }, { endDate: { gte: utc(PM1) } }],
    },
  });
  if (realContracts > 0 && !args.includes("--with-payroll")) {
    log(`⚠ Hay ${realContracts} contrato(s) reales con sueldo en el mes anterior: no se calculan planillas de ejemplo para no mezclarlas.`);
    log("  Si es una base de pruebas, vuelve a ejecutar con --reset --with-payroll para incluirlas.");
    log("✅ Listo. Inicia sesión con rquispe / lramirez / ctorres / jhuaman / mvega (clave Demo2026!) o con tu ADMIN.");
    return;
  }
  const [py, pm] = PM1.split("-").map(Number);
  const prev = await calculatePayrollPeriod(py, pm);
  try {
    await approvePayrollPeriod(prev.period_id, actor);
    await payPayrollPeriod(prev.period_id, { payment_method: "Transferencia", payment_date: CM1 }, actor);
    log(`✔ Planilla de ${prev.label}: ${prev.workers} trabajadores, neto S/ ${prev.total_net.toFixed(2)} — aprobada y pagada (asientos de devengo y pago; cuota del adelanto de Rosa descontada)`);
  } catch (e) {
    log(`⚠ Planilla de ${prev.label} calculada pero no se pudo aprobar/pagar: ${e instanceof Error ? e.message : e}`);
  }
  const [cy, cm] = CM1.split("-").map(Number);
  try {
    const cur = await calculatePayrollPeriod(cy, cm);
    log(`✔ Planilla de ${cur.label} en borrador (${cur.workers} trabajadores, con la asistencia hasta hoy)`);
  } catch (e) {
    log(`⚠ No se recalculó la planilla del mes en curso: ${e instanceof Error ? e.message : e}`);
  }

  log("\n✅ Listo. Inicia sesión con rquispe / lramirez / ctorres / jhuaman / mvega (clave Demo2026!) o con tu ADMIN.");
}

main()
  .catch((e) => {
    console.error("✘", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
