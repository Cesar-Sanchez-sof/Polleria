-- AlterTable
ALTER TABLE "transformation" ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anulado_at" TIMESTAMP(6),
ADD COLUMN     "anulado_por" INTEGER,
ADD COLUMN     "motivo_anulacion" VARCHAR(200);

-- CreateIndex
CREATE INDEX "idx_transformation_annulled_by" ON "transformation"("anulado_por");

-- AddForeignKey
ALTER TABLE "transformation" ADD CONSTRAINT "transformation_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
