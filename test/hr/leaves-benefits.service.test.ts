import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  contractFindFirst: vi.fn(),
  leaveFindFirst: vi.fn(),
  leaveFindUnique: vi.fn(),
  leaveAggregate: vi.fn(),
  leaveCreate: vi.fn(),
  leaveUpdate: vi.fn(),
  linkDeleteMany: vi.fn(),
  advanceFindFirst: vi.fn(),
  advanceFindUnique: vi.fn(),
  advanceCreate: vi.fn(),
  advanceUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    employee: { findUnique: m.employeeFindUnique },
    employmentContract: { findFirst: m.contractFindFirst },
    leaveRequest: {
      findFirst: m.leaveFindFirst,
      findUnique: m.leaveFindUnique,
      aggregate: m.leaveAggregate,
      create: m.leaveCreate,
      update: m.leaveUpdate,
    },
    employeeShift: { deleteMany: m.linkDeleteMany },
    salaryAdvance: { findFirst: m.advanceFindFirst, findUnique: m.advanceFindUnique, create: m.advanceCreate, update: m.advanceUpdate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import { reviewLeave, requestLeave } from "@/lib/services/hr/leaves.service";
import { requestAdvance, updateAdvance } from "@/lib/services/hr/benefits.service";
import { addDaysIso } from "@/lib/services/hr/labor-rules";
import { todayLimaIso } from "@/lib/services/hr/common";

const today = todayLimaIso();
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const person = { id: 7, dni: "12345678", firstName: "Ana", middleName: null, paternalLastName: "Pérez", maternalLastName: null };

/** Fila de licencia tal como la devuelve Prisma con su include. */
const leaveRow = (over: Record<string, unknown> = {}) => ({
  id: 5,
  employeeId: 7,
  type: "Vacaciones",
  startDate: d(addDaysIso(today, 10)),
  endDate: d(addDaysIso(today, 14)),
  days: 5,
  isAdvance: false,
  paid: true,
  reason: null,
  documentRef: null,
  status: "Pendiente",
  reviewedAt: null,
  reviewNote: null,
  createdAt: new Date(),
  employee: person,
  reviewedBy: null,
  ...over,
});

const advanceRow = (over: Record<string, unknown> = {}) => ({
  id: 3,
  employeeId: 7,
  amount: "500.00",
  installments: 2,
  deductedAmount: "0",
  requestDate: d(today),
  reason: "Emergencia familiar",
  status: "Pendiente",
  reviewedAt: null,
  reviewNote: null,
  paidAt: null,
  paymentMethod: null,
  employee: person,
  reviewedBy: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Ingresó hace 8 meses, régimen general: 0 días ganados, 20 de adelanto proporcional.
  m.employeeFindUnique.mockResolvedValue({ id: 7, active: true, hireDate: d(addDaysIso(today, -8 * 30 - 5)) });
  m.contractFindFirst.mockResolvedValue({ contractType: "Indeterminado", laborRegime: "General", endDate: null, baseSalary: "1500.00" });
  m.leaveFindFirst.mockResolvedValue(null);
  m.leaveAggregate.mockResolvedValue({ _sum: { days: 0 } });
  m.leaveCreate.mockImplementation(({ data }) => Promise.resolve(leaveRow({ ...data, id: 9 })));
  m.leaveUpdate.mockImplementation(({ data }) => Promise.resolve(leaveRow(data)));
  m.linkDeleteMany.mockResolvedValue({ count: 2 });
  m.advanceFindFirst.mockResolvedValue(null);
  m.advanceCreate.mockImplementation(({ data }) => Promise.resolve(advanceRow({ ...data, amount: String(data.amount) })));
  m.advanceUpdate.mockImplementation(({ data }) => Promise.resolve(advanceRow(data)));
});

const vacation = (from: number, to: number, extra: Record<string, unknown> = {}) => ({
  type: "Vacaciones",
  start_date: addDaysIso(today, from),
  end_date: addDaysIso(today, to),
  ...extra,
});

describe("requestLeave", () => {
  it("antes del año, las vacaciones solo se piden como adelanto aceptado", async () => {
    await expect(requestLeave(7, vacation(10, 14), { userId: 1, selfService: true })).rejects.toThrow("adelanto");
    const r = await requestLeave(7, vacation(10, 14, { advance: true }), { userId: 1, selfService: true });
    expect(m.leaveCreate.mock.calls[0][0].data).toMatchObject({ days: 5, isAdvance: true, status: "Pendiente" });
    expect(r.shifts_released).toBe(0);
  });

  it("no permite pedir más que lo ganado más el adelanto proporcional", async () => {
    await expect(requestLeave(7, vacation(10, 40, { advance: true }), { userId: 1, selfService: true })).rejects.toThrow("Solo puede pedir hasta");
  });

  it("rechaza solicitudes que se cruzan con otra pendiente o aprobada", async () => {
    m.leaveFindFirst.mockResolvedValue({ type: "DescansoMedico", startDate: d(today), endDate: d(addDaysIso(today, 12)) });
    await expect(requestLeave(7, vacation(10, 14, { advance: true }), { userId: 1, selfService: true })).rejects.toMatchObject({ status: 409 });
  });

  it("el autoservicio no registra fechas pasadas ni aprueba", async () => {
    await expect(requestLeave(7, vacation(-3, -1, { advance: true }), { userId: 1, selfService: true })).rejects.toThrow("hoy o después");
    await requestLeave(7, { type: "PermisoPersonal", start_date: today, end_date: today, reason: "Trámite", approve: true }, { userId: 1, selfService: true });
    expect(m.leaveCreate.mock.calls[0][0].data.status).toBe("Pendiente");
  });

  it("RR. HH. puede registrar un descanso médico ya aprobado con su sustento y libera los horarios", async () => {
    const data = { type: "DescansoMedico", start_date: addDaysIso(today, -2), end_date: today, approve: true };
    await expect(requestLeave(7, data, { userId: 1, selfService: false })).rejects.toThrow("documento de sustento");
    const r = await requestLeave(7, { ...data, document_ref: "CITT 123" }, { userId: 1, selfService: false });
    expect(m.leaveCreate.mock.calls[0][0].data).toMatchObject({ status: "Aprobada", reviewedById: 1, paid: true });
    expect(r.shifts_released).toBe(2);
  });

  it("no registra licencias más allá del fin del contrato", async () => {
    m.contractFindFirst.mockResolvedValue({ contractType: "PlazoFijo", laborRegime: "General", endDate: d(addDaysIso(today, 11)) });
    await expect(requestLeave(7, vacation(10, 14, { advance: true }), { userId: 1, selfService: false })).rejects.toThrow("fin del contrato");
  });
});

describe("reviewLeave", () => {
  it("al aprobar retira al trabajador de los horarios de esas fechas", async () => {
    m.leaveFindUnique.mockResolvedValue(leaveRow({ type: "PermisoPersonal" }));
    const r = await reviewLeave(5, "approve", null, 1);
    expect(r.leave.status).toBe("Aprobada");
    expect(m.linkDeleteMany).toHaveBeenCalledWith({
      where: { employeeId: 7, shift: { date: { gte: d(addDaysIso(today, 10)), lte: d(addDaysIso(today, 14)) } } },
    });
  });

  it("rechazar exige motivo y una solicitud ya revisada no se vuelve a revisar", async () => {
    m.leaveFindUnique.mockResolvedValue(leaveRow());
    await expect(reviewLeave(5, "reject", "", 1)).rejects.toThrow("motivo");
    m.leaveFindUnique.mockResolvedValue(leaveRow({ status: "Aprobada" }));
    await expect(reviewLeave(5, "approve", null, 1)).rejects.toThrow("ya fue revisada");
  });
});

describe("adelantos de sueldo", () => {
  it("tope del 50 % del sueldo y de 1 a 3 cuotas", async () => {
    await expect(requestAdvance(7, { amount: 800, installments: 1, reason: "x" })).rejects.toThrow("750.00");
    await expect(requestAdvance(7, { amount: 300, installments: 4, reason: "x" })).rejects.toThrow("entre 1 y 3");
    const a = await requestAdvance(7, { amount: 600, installments: 3, reason: "Matrícula" });
    expect(a).toMatchObject({ amount: 600, installments: 3, installment_amount: 200, status: "Pendiente" });
  });

  it("uno a la vez y nunca para locadores", async () => {
    m.advanceFindFirst.mockResolvedValue({ id: 1 });
    await expect(requestAdvance(7, { amount: 100, reason: "x" })).rejects.toMatchObject({ status: 409 });
    m.contractFindFirst.mockResolvedValue({ contractType: "LocacionServicios", baseSalary: "2000", endDate: null });
    await expect(requestAdvance(7, { amount: 100, reason: "x" })).rejects.toThrow("locadores");
  });

  it("flujo: aprobar → entregar → descontar hasta liquidar", async () => {
    m.advanceFindUnique.mockResolvedValue(advanceRow());
    await expect(updateAdvance(3, { action: "pay", payment_method: "Yape" }, 1)).rejects.toThrow("aprobado");
    expect((await updateAdvance(3, { action: "approve" }, 1)).advance.status).toBe("Aprobado");

    m.advanceFindUnique.mockResolvedValue(advanceRow({ status: "Pagado", deductedAmount: "250" }));
    await expect(updateAdvance(3, { action: "deduct", amount: 300 }, 1)).rejects.toThrow("saldo pendiente");
    await updateAdvance(3, { action: "deduct", amount: 250 }, 1);
    expect(m.advanceUpdate.mock.calls.at(-1)?.[0].data).toMatchObject({ deductedAmount: 500, status: "Liquidado" });
  });

  it("nadie aprueba ni se entrega su propio adelanto", async () => {
    m.advanceFindUnique.mockResolvedValue(advanceRow());
    await expect(updateAdvance(3, { action: "approve" }, 1, 7)).rejects.toMatchObject({ status: 403 });
    expect(m.advanceUpdate).not.toHaveBeenCalled();
  });
});
