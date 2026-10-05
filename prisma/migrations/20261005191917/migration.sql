/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `role` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `period_id` to the `journal_entry` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "journal_entry" ADD COLUMN     "period_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "purchase_order" ALTER COLUMN "received_by_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "purchase_order_item" ALTER COLUMN "final_amount_line" DROP NOT NULL,
ALTER COLUMN "igv_line" DROP NOT NULL,
ALTER COLUMN "quantity_received" DROP NOT NULL,
ALTER COLUMN "subtotal_line" DROP NOT NULL;

-- CreateTable
CREATE TABLE "accounting_period" (
    "id" SERIAL NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "closed_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "accounting_period_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_journal_entry_period" ON "journal_entry"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- AddForeignKey
ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "accounting_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "usuario_correo_key" RENAME TO "app_user_correo_key";
