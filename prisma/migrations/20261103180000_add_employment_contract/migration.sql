-- CreateEnum
CREATE TYPE "contract_kind" AS ENUM ('FixedTerm', 'Indefinite', 'Private');

-- CreateEnum
CREATE TYPE "labor_regime" AS ENUM ('General', 'Micro', 'Small', 'None');

-- CreateEnum
CREATE TYPE "pension_system" AS ENUM ('ONP', 'AFP', 'None');

-- CreateTable
CREATE TABLE "employment_contract" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "kind" "contract_kind" NOT NULL,
    "regime" "labor_regime" NOT NULL DEFAULT 'General',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "monthly_salary" DECIMAL(10,2) NOT NULL,
    "weekly_hours" SMALLINT NOT NULL DEFAULT 48,
    "position" VARCHAR(30),
    "pension_system" "pension_system" NOT NULL DEFAULT 'ONP',
    "family_allowance" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(300),
    "renews_contract_id" INTEGER,
    "terminated_at" DATE,
    "termination_reason" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_employment_contract_employee" ON "employment_contract"("employee_id");

-- CreateIndex
CREATE INDEX "idx_employment_contract_end" ON "employment_contract"("end_date");

-- AddForeignKey
ALTER TABLE "employment_contract" ADD CONSTRAINT "employment_contract_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_contract" ADD CONSTRAINT "employment_contract_renews_contract_id_fkey" FOREIGN KEY ("renews_contract_id") REFERENCES "employment_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

