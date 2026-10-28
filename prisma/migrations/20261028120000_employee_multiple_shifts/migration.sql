-- Un empleado puede trabajar en varios horarios: la relación 1:N `employee.shift_id`
-- se reemplaza por la tabla de asignaciones `employee_shift` (N:M).

-- CreateTable
CREATE TABLE "employee_shift" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,

    CONSTRAINT "employee_shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_employee_shift_shift" ON "employee_shift"("shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_employee_shift" ON "employee_shift"("employee_id", "shift_id");

-- AddForeignKey
ALTER TABLE "employee_shift" ADD CONSTRAINT "employee_shift_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shift" ADD CONSTRAINT "employee_shift_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conserva las asignaciones que ya existian (un horario por empleado).
INSERT INTO "employee_shift" ("employee_id", "shift_id")
SELECT "id", "shift_id" FROM "employee" WHERE "shift_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "employee" DROP CONSTRAINT "employee_shift_id_fkey";

-- DropIndex
DROP INDEX "idx_employee_shift";

-- AlterTable
ALTER TABLE "employee" DROP COLUMN "shift_id";