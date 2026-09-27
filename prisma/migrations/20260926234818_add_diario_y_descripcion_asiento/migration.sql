-- AlterTable
ALTER TABLE "asiento_contable" ADD COLUMN     "diario" VARCHAR(60) NOT NULL DEFAULT 'Operaciones varias';

-- AlterTable
ALTER TABLE "detalle_asiento_contable" ADD COLUMN     "descripcion" VARCHAR(200);

-- CreateIndex
CREATE INDEX "idx_asiento_fecha" ON "asiento_contable"("fecha_contable");

-- CreateIndex
CREATE INDEX "idx_asiento_diario" ON "asiento_contable"("diario");

-- CreateIndex
CREATE INDEX "idx_asiento_estado" ON "asiento_contable"("estado");
