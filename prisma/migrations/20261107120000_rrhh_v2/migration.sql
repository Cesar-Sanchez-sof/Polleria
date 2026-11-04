-- Recursos Humanos v2 sobre las tablas de la v1 (contratos y planilla):
--  * Contrato con modalidad, área, régimen, AFP/CUSPP, periodo de prueba, estado y HORARIO PACTADO.
--  * Asistencia con bitácora de marcaciones (inicio/cierre de sesión, autoservicio, RR. HH.).
--  * Vacaciones y permisos, seguros y adelantos de sueldo.
--  * Planilla mensual (payroll_period) con boletas detalladas y asientos de devengo y pago.
-- Los datos de la v1 se conservan: `kind` -> `contract_type`, `regime` None -> General,
-- el estado de cada boleta pasa a su planilla mensual. Cargo, área, tipo y sueldo salen del empleado.

-- CreateEnum
CREATE TYPE "contract_type" AS ENUM ('Indeterminado', 'PlazoFijo', 'TiempoParcial', 'Practicas', 'LocacionServicios');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('Vigente', 'Finalizado', 'Rescindido');

-- CreateEnum
CREATE TYPE "leave_type" AS ENUM ('Vacaciones', 'DescansoMedico', 'LicenciaMaternidad', 'LicenciaPaternidad', 'LicenciaFallecimiento', 'PermisoPersonal', 'LicenciaSinGoce');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('Pendiente', 'Aprobada', 'Rechazada', 'Anulada');

-- CreateEnum
CREATE TYPE "insurance_type" AS ENUM ('EsSalud', 'EPS', 'SCTR', 'VidaLey', 'SeguroPrivado');

-- CreateEnum
CREATE TYPE "advance_status" AS ENUM ('Pendiente', 'Aprobado', 'Rechazado', 'Pagado', 'Liquidado', 'Anulado');

-- AlterEnum
BEGIN;
CREATE TYPE "labor_regime_new" AS ENUM ('General', 'Small', 'Micro');
ALTER TABLE "employment_contract" ALTER COLUMN "regime" DROP DEFAULT;
ALTER TABLE "employment_contract" ALTER COLUMN "regime" TYPE "labor_regime_new" USING ((CASE WHEN "regime"::text = 'None' THEN 'General' ELSE "regime"::text END)::"labor_regime_new");
ALTER TYPE "labor_regime" RENAME TO "labor_regime_old";
ALTER TYPE "labor_regime_new" RENAME TO "labor_regime";
DROP TYPE "labor_regime_old";
ALTER TABLE "employment_contract" ALTER COLUMN "regime" SET DEFAULT 'General';
COMMIT;

-- DropForeignKey
ALTER TABLE "employment_contract" DROP CONSTRAINT "employment_contract_employee_id_fkey";

-- AlterTable
ALTER TABLE "employee" DROP COLUMN "area",
DROP COLUMN "base_salary",
DROP COLUMN "contract_type",
DROP COLUMN "position",
ADD COLUMN     "email" VARCHAR(80),
ADD COLUMN     "emergency_contact" VARCHAR(100),
ADD COLUMN     "emergency_phone" VARCHAR(9);

-- AlterTable
ALTER TABLE "employment_contract" ADD COLUMN     "afp_name" VARCHAR(30),
ADD COLUMN     "area" VARCHAR(30) NOT NULL DEFAULT 'General',
ADD COLUMN     "contract_type" "contract_type",
ADD COLUMN     "created_by_id" INTEGER,
ADD COLUMN     "cuspp" VARCHAR(12),
ADD COLUMN     "status" "contract_status" NOT NULL DEFAULT 'Vigente',
ADD COLUMN     "trial_end_date" DATE,
ALTER COLUMN "position" SET DATA TYPE VARCHAR(40);

-- Datos de la v1: modalidad, cargo y estado.
UPDATE "employment_contract" SET "contract_type" = (CASE "kind"::text
    WHEN 'FixedTerm' THEN 'PlazoFijo'
    WHEN 'Indefinite' THEN 'Indeterminado'
    WHEN 'Private' THEN 'LocacionServicios'
    WHEN 'Internship' THEN 'Practicas'
    ELSE 'Indeterminado' END)::"contract_type";
UPDATE "employment_contract" SET "position" = 'Sin cargo' WHERE "position" IS NULL OR TRIM("position") = '';
UPDATE "employment_contract" SET "status" = 'Finalizado' WHERE "terminated_at" IS NOT NULL;
UPDATE "employment_contract" SET "end_date" = "terminated_at" WHERE "terminated_at" IS NOT NULL AND ("end_date" IS NULL OR "end_date" > "terminated_at");
UPDATE "employment_contract" SET "pension_system" = 'None' WHERE "contract_type" IN ('Practicas', 'LocacionServicios');

ALTER TABLE "employment_contract" ALTER COLUMN "contract_type" SET NOT NULL,
ALTER COLUMN "position" SET NOT NULL,
DROP COLUMN "kind",
DROP COLUMN "weekly_hours";

-- AlterTable
ALTER TABLE "payroll" ADD COLUMN     "basic_pay" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "contract_days" SMALLINT NOT NULL DEFAULT 30,
ADD COLUMN     "detail" JSONB,
ADD COLUMN     "income_tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "late_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notes" VARCHAR(200),
ADD COLUMN     "other_deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paid_days" SMALLINT NOT NULL DEFAULT 30,
ADD COLUMN     "period_id" INTEGER,
ADD COLUMN     "unpaid_days" SMALLINT NOT NULL DEFAULT 0,
ALTER COLUMN "base_salary" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "family_allowance" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "overtime_pay" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "bonus" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "absence_discount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "gross_pay" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "pension_system" DROP DEFAULT,
ALTER COLUMN "pension_system" SET DATA TYPE VARCHAR(20) USING (CASE WHEN "pension_system"::text = 'None' THEN 'Ninguno' ELSE "pension_system"::text END),
ALTER COLUMN "pension_system" DROP NOT NULL,
ALTER COLUMN "pension_amount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "advances" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "deductions" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "net_pay" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "employer_contribution" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "journal_entry" ADD COLUMN     "payroll_period_id" INTEGER;

-- DropTable
DROP TABLE "payroll_parameter";

-- DropEnum
DROP TYPE "contract_kind";

-- CreateTable
CREATE TABLE "shift_template" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shift_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_schedule_day" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "shift_template_id" INTEGER NOT NULL,

    CONSTRAINT "contract_schedule_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "check_in" TIMESTAMPTZ(6),
    "check_out" TIMESTAMPTZ(6),
    "source" VARCHAR(15) NOT NULL DEFAULT 'Manual',
    "check_out_source" VARCHAR(15),
    "check_in_ip" VARCHAR(45),
    "check_out_ip" VARCHAR(45),
    "justified" BOOLEAN NOT NULL DEFAULT false,
    "justification" VARCHAR(200),
    "notes" VARCHAR(200),
    "registered_by_id" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_mark" (
    "id" SERIAL NOT NULL,
    "attendance_id" INTEGER,
    "employee_id" INTEGER NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "marked_at" TIMESTAMPTZ(6),
    "source" VARCHAR(15) NOT NULL,
    "user_id" INTEGER,
    "username" VARCHAR(50),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(200),
    "note" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_mark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "type" "leave_type" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" SMALLINT NOT NULL,
    "is_advance" BOOLEAN NOT NULL DEFAULT false,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "reason" VARCHAR(255),
    "document_ref" VARCHAR(60),
    "status" "request_status" NOT NULL DEFAULT 'Pendiente',
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(6),
    "review_note" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_insurance" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "type" "insurance_type" NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "policy_number" VARCHAR(40),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "monthly_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "covers_dependents" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(200),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_advance" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "installments" SMALLINT NOT NULL DEFAULT 1,
    "deducted_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "request_date" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "status" "advance_status" NOT NULL DEFAULT 'Pendiente',
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(6),
    "review_note" VARCHAR(255),
    "paid_at" TIMESTAMP(6),
    "payment_method" VARCHAR(30),
    "journal_entry_id" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_period" (
    "id" SERIAL NOT NULL,
    "year" SMALLINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "status" "payroll_status" NOT NULL DEFAULT 'Draft',
    "total_gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_employer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMP(6),
    "approved_at" TIMESTAMP(6),
    "approved_by_id" INTEGER,
    "paid_at" TIMESTAMP(6),
    "paid_by_id" INTEGER,
    "payment_method" VARCHAR(30),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_period_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_template_name_key" ON "shift_template"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_contract_schedule_day" ON "contract_schedule_day"("contract_id", "weekday", "shift_template_id");

-- CreateIndex
CREATE INDEX "idx_attendance_date" ON "attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attendance_employee_date" ON "attendance"("employee_id", "date");

-- CreateIndex
CREATE INDEX "idx_attendance_mark_employee" ON "attendance_mark"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_attendance_mark_created" ON "attendance_mark"("created_at");

-- CreateIndex
CREATE INDEX "idx_leave_employee_start" ON "leave_request"("employee_id", "start_date");

-- CreateIndex
CREATE INDEX "idx_leave_status" ON "leave_request"("status");

-- CreateIndex
CREATE INDEX "idx_insurance_employee" ON "employee_insurance"("employee_id");

-- CreateIndex
CREATE INDEX "idx_advance_employee" ON "salary_advance"("employee_id");

-- CreateIndex
CREATE INDEX "idx_advance_status" ON "salary_advance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payroll_period_month" ON "payroll_period"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "uq_employment_contract_renews" ON "employment_contract"("renews_contract_id");

-- CreateIndex
CREATE INDEX "idx_contract_status_end" ON "employment_contract"("status", "end_date");

-- CreateIndex
CREATE INDEX "idx_payroll_period_id" ON "payroll"("period_id");

-- CreateIndex
CREATE INDEX "idx_journal_entry_payroll_period" ON "journal_entry"("payroll_period_id");

-- AddForeignKey
ALTER TABLE "employment_contract" ADD CONSTRAINT "employment_contract_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_contract" ADD CONSTRAINT "employment_contract_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_schedule_day" ADD CONSTRAINT "contract_schedule_day_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "employment_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_schedule_day" ADD CONSTRAINT "contract_schedule_day_shift_template_id_fkey" FOREIGN KEY ("shift_template_id") REFERENCES "shift_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_mark" ADD CONSTRAINT "attendance_mark_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_mark" ADD CONSTRAINT "attendance_mark_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_insurance" ADD CONSTRAINT "employee_insurance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advance" ADD CONSTRAINT "salary_advance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advance" ADD CONSTRAINT "salary_advance_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_period" ADD CONSTRAINT "payroll_period_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_period" ADD CONSTRAINT "payroll_period_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- Datos: planillas mensuales a partir de las boletas de la v1.
-- ---------------------------------------------------------------------
INSERT INTO "payroll_period" ("year", "month", "status", "calculated_at", "approved_at")
SELECT "year", "month",
       (CASE WHEN bool_or("status"::text = 'Draft') THEN 'Draft'
             WHEN bool_or("status"::text = 'Approved') THEN 'Approved'
             ELSE 'Paid' END)::"payroll_status",
       CURRENT_TIMESTAMP,
       max("approved_at")
FROM "payroll"
GROUP BY "year", "month";

UPDATE "payroll" p SET "period_id" = pp."id", "basic_pay" = p."base_salary"
FROM "payroll_period" pp WHERE pp."year" = p."year" AND pp."month" = p."month";

UPDATE "payroll_period" pp SET
    "total_gross" = s.gross, "total_deductions" = s.ded, "total_net" = s.net, "total_employer" = s.emp
FROM (SELECT "period_id", SUM("gross_pay") gross, SUM("deductions") ded, SUM("net_pay") net, SUM("employer_contribution") emp
      FROM "payroll" GROUP BY "period_id") s
WHERE s."period_id" = pp."id";

-- Los asientos de la v1 (enlazados a cada boleta) quedan también enlazados a su planilla mensual.
UPDATE "journal_entry" j SET "payroll_period_id" = p."period_id"
FROM "payroll" p WHERE j."payroll_id" = p."id" AND p."period_id" IS NOT NULL;

ALTER TABLE "payroll" DROP COLUMN "status", DROP COLUMN "approved_at";

-- ---------------------------------------------------------------------
-- Datos: turnos base de la pollería (abre de 6:00 pm a 11:30 pm).
-- ---------------------------------------------------------------------
INSERT INTO "shift_template" ("name", "start_time", "end_time") VALUES
    ('Preparación', '16:00', '18:00'),
    ('Atención', '18:00', '23:30'),
    ('Cierre', '23:30', '00:30')
ON CONFLICT ("name") DO NOTHING;

-- ---------------------------------------------------------------------
-- Datos: cuentas PCGE para la planilla y los adelantos (si no existen).
-- ---------------------------------------------------------------------
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '14', 'Cuentas por Cobrar al Personal', 'Activo', (SELECT "id" FROM "accounting_account" WHERE "code" = '1'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '14');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '141', 'Adelantos de Remuneraciones al Personal', 'Activo', (SELECT "id" FROM "accounting_account" WHERE "code" = '14'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '141');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '4017', 'Impuesto a la Renta de Quinta Categoría por Pagar', 'Pasivo', (SELECT "id" FROM "accounting_account" WHERE "code" = '40'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '4017');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '4031', 'EsSalud por Pagar', 'Pasivo', (SELECT "id" FROM "accounting_account" WHERE "code" = '40'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '4031');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '4032', 'ONP por Pagar', 'Pasivo', (SELECT "id" FROM "accounting_account" WHERE "code" = '40'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '4032');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '407', 'Administradoras de Fondos de Pensiones (AFP) por Pagar', 'Pasivo', (SELECT "id" FROM "accounting_account" WHERE "code" = '40'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '407');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '6211', 'Sueldos y Salarios', 'Gasto', (SELECT "id" FROM "accounting_account" WHERE "code" = '621'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '6211');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '627', 'Seguridad, Previsión Social y Otras Contribuciones', 'Gasto', (SELECT "id" FROM "accounting_account" WHERE "code" = '62'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '627');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '6271', 'Régimen de Prestaciones de Salud (EsSalud)', 'Gasto', (SELECT "id" FROM "accounting_account" WHERE "code" = '627'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '6271');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '6273', 'Seguro Complementario de Trabajo de Riesgo (SCTR)', 'Gasto', (SELECT "id" FROM "accounting_account" WHERE "code" = '627'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '6273');
INSERT INTO "accounting_account" ("code", "name", "type", "parent_id", "active")
SELECT '6274', 'Seguro de Vida Ley y otros Seguros del Personal', 'Gasto', (SELECT "id" FROM "accounting_account" WHERE "code" = '627'), true
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '6274');
