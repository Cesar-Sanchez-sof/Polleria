-- CreateEnum
CREATE TYPE "informal_purchase_type" AS ENUM ('InventoryItem', 'OperatingExpense');

-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('CasualStaff', 'EventServices', 'TransportAndDelivery', 'CleaningSupplies', 'OtherMinorExpenses');

-- AlterTable
ALTER TABLE "informal_purchase" ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anulado_at" TIMESTAMP(6),
ADD COLUMN     "anulado_por" INTEGER,
ADD COLUMN     "expense_category" "expense_category",
ADD COLUMN     "item_description" VARCHAR(200),
ADD COLUMN     "motivo_anulacion" VARCHAR(200),
ADD COLUMN     "purchase_type" "informal_purchase_type" NOT NULL DEFAULT 'InventoryItem',
ALTER COLUMN "supply_id" DROP NOT NULL,
ALTER COLUMN "quantity" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "supply" ALTER COLUMN "affectation_igv" DROP NOT NULL,
ALTER COLUMN "affectation_igv" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "idx_informal_purchase_annulled_by" ON "informal_purchase"("anulado_por");

-- AddForeignKey
ALTER TABLE "informal_purchase" ADD CONSTRAINT "informal_purchase_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
