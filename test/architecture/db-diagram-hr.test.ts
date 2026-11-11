import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * El diagrama de BD (`app/docs/db-diagram`) es un arreglo escrito a mano. Esta prueba evita que las
 * tablas de Recursos Humanos queden desactualizadas respecto a `prisma/schema.prisma`.
 */
const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const diagram = readFileSync(join(process.cwd(), "app/docs/db-diagram/db-diagram.tsx"), "utf8");

const HR_MODELS = [
  "Employee",
  "Shift",
  "EmployeeShift",
  "ShiftTemplate",
  "EmploymentContract",
  "ContractScheduleDay",
  "Attendance",
  "AttendanceMark",
  "LeaveRequest",
  "EmployeeInsurance",
  "SalaryAdvance",
  "PayrollPeriod",
  "Payroll",
];

const SCALARS = new Set(["Int", "String", "Boolean", "DateTime", "Decimal", "Json", "BigInt", "Float"]);
const enums = new Set([...schema.matchAll(/^enum (\w+)/gm)].map((m) => m[1]));

function modelBody(name: string): string {
  const m = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"));
  if (!m) throw new Error(`Modelo ${name} no existe en el schema`);
  return m[1];
}

function scalarFields(name: string): string[] {
  const out: string[] = [];
  for (const raw of modelBody(name).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
    const [field, type] = line.split(/\s+/);
    const base = type?.replace("?", "");
    if (!field || !base || type.includes("[]")) continue;
    if (SCALARS.has(base) || enums.has(base)) out.push(field);
  }
  return out;
}

function diagramFields(name: string): string[] {
  const block = diagram.match(new RegExp(`id: '${name}', label:[\\s\\S]*?\\n\\t\\t\\],\\n\\t\\},\\n`));
  if (!block) throw new Error(`Falta la entidad ${name} en el diagrama`);
  return [...block[0].matchAll(/name: '(\w+)'/g)].map((m) => m[1]);
}

describe("diagrama de BD: tablas de Recursos Humanos", () => {
  it.each(HR_MODELS)("%s tiene los mismos campos que el schema de Prisma", (model) => {
    expect(diagramFields(model).sort()).toEqual(scalarFields(model).sort());
  });

  it("cada llave foránea de RR. HH. tiene su relación dibujada", () => {
    const drawn = new Set([...diagram.matchAll(/child: '(\w+)', fk: '(\w+)'/g)].map((m) => `${m[1]}.${m[2]}`));
    const missing: string[] = [];
    for (const model of HR_MODELS) {
      for (const m of modelBody(model).matchAll(/@relation\([^)]*fields: \[(\w+)\]/g)) {
        if (!drawn.has(`${model}.${m[1]}`)) missing.push(`${model}.${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("los asientos de planilla (JournalEntry.payrollPeriodId) y adelantos están conectados", () => {
    expect(diagram).toMatch(/child: 'JournalEntry', fk: 'payrollPeriodId', parent: 'PayrollPeriod'/);
    expect(diagram).toMatch(/child: 'SalaryAdvance', fk: 'journalEntryId', parent: 'JournalEntry'/);
  });

  it("ninguna entidad aparece dos veces en el diseño de columnas", () => {
    const layout = diagram.match(/const MODULE_LAYOUT[\s\S]*?\n\};/)![0];
    const names = [...layout.matchAll(/'(\w+)'/g)].map((m) => m[1]).filter((n) => !n.startsWith("_"));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });
});
