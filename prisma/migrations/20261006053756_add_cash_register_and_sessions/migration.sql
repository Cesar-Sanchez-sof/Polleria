-- CreateEnum
CREATE TYPE "cash_session_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "cash_movement_type" AS ENUM ('INCOME', 'EXPENSE');

-- AlterTable
ALTER TABLE "sales_invoice" ADD COLUMN     "cash_session_id" INTEGER;

-- CreateTable
CREATE TABLE "cash_register" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(150),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cash_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_session" (
    "id" SERIAL NOT NULL,
    "cash_register_id" INTEGER NOT NULL,
    "opened_by_id" INTEGER NOT NULL,
    "closed_by_id" INTEGER,
    "opened_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(6),
    "initial_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sales_cash" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sales_other" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_sales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expected_amount" DECIMAL(10,2),
    "counted_amount" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "status" "cash_session_status" NOT NULL DEFAULT 'OPEN',
    "notes_opening" VARCHAR(255),
    "notes_closing" VARCHAR(255),

    CONSTRAINT "cash_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movement" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "type" "cash_movement_type" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_register_code_key" ON "cash_register"("code");

-- CreateIndex
CREATE INDEX "idx_cash_session_register" ON "cash_session"("cash_register_id");

-- CreateIndex
CREATE INDEX "idx_cash_session_opened_by" ON "cash_session"("opened_by_id");

-- CreateIndex
CREATE INDEX "idx_cash_session_status" ON "cash_session"("status");

-- CreateIndex
CREATE INDEX "idx_cash_movement_session" ON "cash_movement"("session_id");

-- CreateIndex
CREATE INDEX "idx_sales_invoice_cash_session" ON "sales_invoice"("cash_session_id");

-- AddForeignKey
ALTER TABLE "sales_invoice" ADD CONSTRAINT "sales_invoice_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
