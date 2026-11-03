import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  contractFindMany: vi.fn(),
  contractFindUnique: vi.fn(),
  contractCreate: vi.fn(),
  contractUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    employee: { findUnique: m.employeeFindUnique, findMany: vi.fn().mockResolvedValue([]) },
    employmentContract: {
      findMany: m.contractFindMany,
      findUnique: m.contractFindUnique,
      create: m.contractCreate,
      update: m.contractUpdate,
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { prisma: db };
});

import {
  createContract,
  normalizeContract,
  terminateContract,
  updateContract,
  type ContractData,
} from "./contracts.service";

const fixedTerm: ContractData = {
  employee_id: 7,
  kind: "FixedTerm",
  regime: "Micro",
  start_date: "2026-11-01",
  end_date: "2027-10-31",
  monthly_salary: "1200.50",
  weekly_hours: 48,
  pension_system: "ONP",
  position: "  Mesera ",
};

const employee = {
  firstName: "Ana",
  middleName: null,
  paternalLastName: "Pérez",
  maternalLastName: null,
  id: 7,
  dni: "12345678",
};

function contractRow(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    employeeId: 7,
    kind: "FixedTerm",
    regime: "Micro",
    startDate: new Date("2026-11-01"),
    endDate: new Date("2027-10-31"),
    monthlySalary: 1200.5,
    weeklyHours: 48,
    position: "Mesera",
    pensionSystem: "ONP",
    familyAllowance: false,
    notes: null,
    renewsContractId: null,
    terminatedAt: null,
    terminationReason: null,
    employee,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.employeeFindUnique.mockResolvedValue({ id: 7, active: true });
  m.contractFindMany.mockResolvedValue([]);
  m.contractFindUnique.mockResolvedValue(null);
  m.contractCreate.mockImplementation(async () => contractRow());
  m.contractUpdate.mockImplementation(async () => contractRow());
});

describe("normalizeContract", () => {
  it("normaliza un contrato a plazo fijo válido", () => {
    expect(normalizeContract(fixedTerm)).toMatchObject({
      employeeId: 7,
      kind: "FixedTerm",
      regime: "Micro",
      startDate: "2026-11-01",
      endDate: "2027-10-31",
      monthlySalary: 1200.5,
      position: "Mesera",
      pensionSystem: "ONP",
    });
  });

  it("el plazo fijo exige fecha de fin posterior al inicio", () => {
    expect(() => normalizeContract({ ...fixedTerm, end_date: null })).toThrow(/fecha de fin/);
    expect(() => normalizeContract({ ...fixedTerm, end_date: "2026-11-01" })).toThrow(/posterior/);
  });

  it("el plazo fijo no puede pasar de cinco años", () => {
    expect(() => normalizeContract({ ...fixedTerm, end_date: "2031-11-02" })).toThrow(/cinco años|5 años/);
    expect(normalizeContract({ ...fixedTerm, end_date: "2031-11-01" }).endDate).toBe("2031-11-01");
  });

  it("el indeterminado no admite fecha de fin", () => {
    expect(() => normalizeContract({ ...fixedTerm, kind: "Indefinite" })).toThrow(/no tiene fecha de fin/);
    expect(normalizeContract({ ...fixedTerm, kind: "Indefinite", end_date: null }).endDate).toBeNull();
  });

  it("el contrato privado no tiene régimen, pensiones ni asignación familiar", () => {
    const n = normalizeContract({
      ...fixedTerm,
      kind: "Private",
      regime: "General",
      pension_system: "AFP",
      family_allowance: true,
    });
    expect(n).toMatchObject({ regime: "None", pensionSystem: "None", familyAllowance: false });
  });

  describe("convenio de prácticas", () => {
    const internship: ContractData = {
      ...fixedTerm,
      kind: "Internship",
      internship_modality: "PreProfessional",
      monthly_salary: 1230,
      weekly_hours: 30,
    };

    it("no tiene régimen, pensiones ni asignación familiar", () => {
      const n = normalizeContract({ ...internship, regime: "General", pension_system: "AFP", family_allowance: true });
      expect(n).toMatchObject({
        kind: "Internship",
        regime: "None",
        pensionSystem: "None",
        familyAllowance: false,
        internshipModality: "PreProfessional",
      });
    });

    it("exige modalidad y fecha de fin", () => {
      expect(() => normalizeContract({ ...internship, internship_modality: "" })).toThrow(/modalidad/);
      expect(() => normalizeContract({ ...internship, internship_modality: "Otra" })).toThrow(/modalidad/);
      expect(() => normalizeContract({ ...internship, end_date: null })).toThrow(/fecha de fin/);
    });

    it("limita la jornada a 30 horas en preprofesional y a 48 en profesional", () => {
      expect(() => normalizeContract({ ...internship, weekly_hours: 31 })).toThrow(/entre 1 y 30/);
      expect(normalizeContract({ ...internship, internship_modality: "Professional", weekly_hours: 48 }).weeklyHours).toBe(48);
      expect(normalizeContract({ ...internship, weekly_hours: "" }).weeklyHours).toBe(30);
    });

    it("habla de subvención y no de remuneración", () => {
      expect(() => normalizeContract({ ...internship, monthly_salary: 0 })).toThrow(/subvención/);
    });

    it("los demás tipos no guardan modalidad", () => {
      expect(normalizeContract({ ...fixedTerm, internship_modality: "Professional" }).internshipModality).toBeNull();
    });
  });

  it("con vínculo laboral exige régimen y sistema de pensiones", () => {
    expect(() => normalizeContract({ ...fixedTerm, regime: "" })).toThrow(/régimen/);
    expect(() => normalizeContract({ ...fixedTerm, regime: "None" })).toThrow(/régimen/);
    expect(() => normalizeContract({ ...fixedTerm, pension_system: null })).toThrow(/pensiones/);
  });

  it("valida remuneración, jornada y fechas", () => {
    expect(() => normalizeContract({ ...fixedTerm, monthly_salary: 0 })).toThrow(/mayor a 0/);
    expect(() => normalizeContract({ ...fixedTerm, monthly_salary: "" })).toThrow(/mayor a 0/);
    expect(() => normalizeContract({ ...fixedTerm, weekly_hours: 49 })).toThrow(/jornada/);
    expect(() => normalizeContract({ ...fixedTerm, start_date: "2026-02-30" })).toThrow(/válida/);
    expect(() => normalizeContract({ ...fixedTerm, start_date: "" })).toThrow(/obligatoria/);
    expect(() => normalizeContract({ ...fixedTerm, kind: "Otro" })).toThrow(/tipo de contrato/);
  });

  it("usa 48 horas si no se indica la jornada", () => {
    expect(normalizeContract({ ...fixedTerm, weekly_hours: "" }).weeklyHours).toBe(48);
  });
});

describe("createContract", () => {
  it("registra el contrato", async () => {
    const dto = await createContract(fixedTerm);
    expect(dto).toMatchObject({ contract_id: 1, employee_name: "Ana Pérez", kind: "FixedTerm", monthly_salary: 1200.5 });
    expect(m.contractCreate).toHaveBeenCalledTimes(1);
  });

  it("rechaza si el empleado no existe o está dado de baja", async () => {
    m.employeeFindUnique.mockResolvedValue(null);
    await expect(createContract(fixedTerm)).rejects.toMatchObject({ status: 404 });
    m.employeeFindUnique.mockResolvedValue({ id: 7, active: false });
    await expect(createContract(fixedTerm)).rejects.toMatchObject({ status: 409 });
    expect(m.contractCreate).not.toHaveBeenCalled();
  });

  it("rechaza un periodo que se cruza con otro contrato del empleado", async () => {
    m.contractFindMany.mockResolvedValue([
      { id: 9, startDate: new Date("2026-06-01"), endDate: null, terminatedAt: null },
    ]);
    await expect(createContract(fixedTerm)).rejects.toMatchObject({ status: 409 });
    expect(m.contractCreate).not.toHaveBeenCalled();
  });

  it("deja registrar uno nuevo si el anterior fue rescindido antes", async () => {
    m.contractFindMany.mockResolvedValue([
      { id: 9, startDate: new Date("2026-01-01"), endDate: null, terminatedAt: new Date("2026-10-31") },
    ]);
    await expect(createContract(fixedTerm)).resolves.toBeDefined();
  });

  it("al renovar valida que el contrato anterior sea del mismo empleado y no esté rescindido", async () => {
    m.contractFindUnique.mockResolvedValue({ employeeId: 99, terminatedAt: null });
    await expect(createContract({ ...fixedTerm, renews_contract_id: 5 })).rejects.toMatchObject({ status: 400 });
    m.contractFindUnique.mockResolvedValue({ employeeId: 7, terminatedAt: new Date("2026-10-01") });
    await expect(createContract({ ...fixedTerm, renews_contract_id: 5 })).rejects.toMatchObject({ status: 409 });
    m.contractFindUnique.mockResolvedValue({ employeeId: 7, terminatedAt: null });
    await expect(createContract({ ...fixedTerm, renews_contract_id: 5 })).resolves.toBeDefined();
    expect(m.contractCreate.mock.calls[0][0].data.renewsContractId).toBe(5);
  });
});

describe("updateContract", () => {
  it("no edita un contrato rescindido ni cambia de empleado", async () => {
    m.contractFindUnique.mockResolvedValue({ employeeId: 7, terminatedAt: new Date("2026-10-01") });
    await expect(updateContract(1, fixedTerm)).rejects.toMatchObject({ status: 409 });
    m.contractFindUnique.mockResolvedValue({ employeeId: 8, terminatedAt: null });
    await expect(updateContract(1, fixedTerm)).rejects.toMatchObject({ status: 400 });
    expect(m.contractUpdate).not.toHaveBeenCalled();
  });

  it("al editar no se cruza consigo mismo", async () => {
    m.contractFindUnique.mockResolvedValue({ employeeId: 7, terminatedAt: null });
    await updateContract(1, fixedTerm);
    expect(m.contractFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: 7, NOT: { id: 1 } } }));
    expect(m.contractUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("terminateContract", () => {
  beforeEach(() => {
    m.contractFindUnique.mockResolvedValue(contractRow());
  });

  it("rescinde con fecha y motivo", async () => {
    m.contractUpdate.mockResolvedValue(
      contractRow({ terminatedAt: new Date("2026-12-15"), terminationReason: "Renuncia" }),
    );
    const dto = await terminateContract(1, { terminated_at: "2026-12-15", reason: " Renuncia " });
    expect(dto.status).toBe("terminated");
    expect(m.contractUpdate.mock.calls[0][0].data.terminationReason).toBe("Renuncia");
  });

  it("exige motivo y una fecha dentro del contrato", async () => {
    await expect(terminateContract(1, { terminated_at: "2026-12-15", reason: "" })).rejects.toThrow(/motivo/);
    await expect(terminateContract(1, { terminated_at: "2026-10-31", reason: "x" })).rejects.toThrow(/anterior/);
    await expect(terminateContract(1, { terminated_at: "2027-11-01", reason: "x" })).rejects.toThrow(/posterior/);
    expect(m.contractUpdate).not.toHaveBeenCalled();
  });

  it("no rescinde dos veces ni uno que no existe", async () => {
    m.contractFindUnique.mockResolvedValue(contractRow({ terminatedAt: new Date("2026-12-01") }));
    await expect(terminateContract(1, { terminated_at: "2026-12-15", reason: "x" })).rejects.toMatchObject({ status: 409 });
    m.contractFindUnique.mockResolvedValue(null);
    await expect(terminateContract(1, { terminated_at: "2026-12-15", reason: "x" })).rejects.toMatchObject({ status: 404 });
  });
});
