-- CreateEnum
CREATE TYPE "payroll_status" AS ENUM ('Draft', 'Approved', 'Paid');

-- AlterTable
ALTER TABLE "payroll" ADD COLUMN     "absence_discount" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN     "advances" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "contract_id" INTEGER,
ADD COLUMN     "employer_contribution" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN     "family_allowance" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gross_pay" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pension_amount" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pension_system" "pension_system" NOT NULL DEFAULT 'None',
ADD COLUMN     "status" "payroll_status" NOT NULL DEFAULT 'Draft';

-- CreateTable
CREATE TABLE "payroll_parameter" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "notes" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_payroll_parameter" ON "payroll_parameter"("code", "effective_from");

-- CreateIndex
CREATE INDEX "idx_payroll_period" ON "payroll"("year", "month");

-- AddForeignKey
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "employment_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Valores sugeridos (editables desde Recursos humanos > Planilla > Parámetros). Verificar con el contador.
INSERT INTO "payroll_parameter" ("code", "value", "effective_from", "notes") VALUES
  ('RMV', 1130, '2022-05-01', 'Remuneración mínima vital'),
  ('RMV', 1230, '2026-10-01', 'Remuneración mínima vital (verificar en El Peruano)'),
  ('FAMILY_ALLOWANCE_RATE', 0.1, '2020-01-01', 'Asignación familiar: 10% de la RMV'),
  ('ONP_RATE', 0.13, '2020-01-01', 'Aporte del trabajador a la ONP'),
  ('AFP_PENSION_RATE', 0.10, '2020-01-01', 'AFP: aporte obligatorio al fondo'),
  ('AFP_INSURANCE_RATE', 0.0137, '2020-01-01', 'AFP: prima de seguro (verificar)'),
  ('AFP_COMMISSION_RATE', 0.0155, '2020-01-01', 'AFP: comisión por flujo (varía por AFP: 1.47% a 1.69%)'),
  ('ESSALUD_RATE', 0.09, '2020-01-01', 'Aporte del empleador a EsSalud (régimen general, pequeña empresa y convenios de prácticas)'),
  ('MICRO_HEALTH_MONTHLY', 15, '2020-01-01', 'Aporte mensual del empleador al SIS por trabajador de microempresa (verificar)');
