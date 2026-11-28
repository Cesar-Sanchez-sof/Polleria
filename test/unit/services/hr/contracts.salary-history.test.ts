import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  employmentContractFindUnique: vi.fn(),
  employmentContractFindFirst: vi.fn(),
  employmentContractUpdate: vi.fn(),
  salaryHistoryCreate: vi.fn(),
  scheduleDeleteMany: vi.fn(),
  employeeUpdate: vi.fn(),
  shiftTemplateFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    employmentContract: {
      findUnique: m.employmentContractFindUnique,
      findFirst: m.employmentContractFindFirst,
      update: m.employmentContractUpdate,
    },
    contractSalaryHistory: { create: m.salaryHistoryCreate },
    contractScheduleDay: { deleteMany: m.scheduleDeleteMany },
    employee: { update: m.employeeUpdate },
    shiftTemplate: { findMany: m.shiftTemplateFindMany },
  };
  return { prisma: { ...tx, $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx) } };
});

const scheduleAhead = vi.hoisted(() => vi.fn().mockResolvedValue({ assignments: 12 }));
vi.mock("@/lib/services/hr/schedules.service", () => ({ scheduleEmployeeAhead: scheduleAhead }));

import { updateContract, type ContractData } from "@/lib/services/hr/contracts.service";

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const shift = { id: 2, name: "Atención", startTime: time("18:00"), endTime: time("23:30"), active: true };
const contract: ContractData = {
  contract_type: "Indeterminado",
  labor_regime: "Micro",
  position: "Mesera",
  area: "Salón",
  start_date: "2026-11-02",
  base_salary: 1300,
  pension_system: "ONP",
  schedule: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, template_ids: [2] })),
};

const contractRow = (baseSalary: string, salaryHistory: Array<Record<string, unknown>>) => ({
  id: 11,
  employeeId: 7,
  contractType: "Indeterminado",
  laborRegime: "Micro",
  position: "Mesera",
  area: "Salón",
  startDate: new Date("2026-11-02T00:00:00Z"),
  endDate: null,
  trialEndDate: new Date("2027-02-01T00:00:00Z"),
  baseSalary,
  familyAllowance: false,
  pensionSystem: "ONP",
  afpName: null,
  cuspp: null,
  status: "Vigente",
  terminationDate: null,
  terminationReason: null,
  notes: null,
  renewedFromId: null,
  createdAt: new Date("2026-11-01T15:00:00Z"),
  employee: { id: 7, dni: "12345678", firstName: "Ana", middleName: null, paternalLastName: "Pérez", maternalLastName: null },
  renewedBy: null,
  salaryHistory,
  schedule: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, shiftTemplateId: 2, shiftTemplate: shift })),
});

beforeEach(() => {
  vi.clearAllMocks();
  m.employmentContractFindUnique.mockResolvedValue(contractRow("1200.00", []));
  m.employmentContractFindFirst.mockResolvedValue(null);
  m.employmentContractUpdate.mockResolvedValue(contractRow("1300.00", [{
    previousSalary: "1200.00",
    newSalary: "1300.00",
    changedAt: new Date("2026-11-05T12:00:00Z"),
  }]));
  m.shiftTemplateFindMany.mockResolvedValue([shift]);
});

describe("updateContract salary history", () => {
  it("records the old and new salary with the acting user when an addendum changes salary", async () => {
    const updated = await updateContract(11, contract, 42);

    expect(m.salaryHistoryCreate).toHaveBeenCalledWith({
      data: {
        contractId: 11,
        previousSalary: "1200.00",
        newSalary: 1300,
        changedById: 42,
      },
    });
    expect(updated.salary_history).toEqual([{
      previous_salary: 1200,
      new_salary: 1300,
      changed_at: "2026-11-05T12:00:00.000Z",
    }]);
  });
});
