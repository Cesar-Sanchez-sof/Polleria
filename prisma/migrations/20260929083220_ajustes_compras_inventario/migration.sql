/*
  Warnings:

  - The `estado` column on the `orden_compra` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `estado` column on the `recepcion_compra` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `tipo_movimiento` on the `movimiento_inventario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "estado_orden_compra_enum" AS ENUM ('Pendiente', 'RecibidaParcial', 'RecibidaTotal', 'Cancelada');

-- CreateEnum
CREATE TYPE "estado_recepcion_compra_enum" AS ENUM ('Confirmada', 'Anulada');

-- CreateEnum
CREATE TYPE "tipo_insumo_enum" AS ENUM ('MateriaPrima', 'ProductoTerminado');

-- CreateEnum
CREATE TYPE "tipo_movimiento_enum" AS ENUM ('Compra', 'TransformacionSalida', 'TransformacionEntrada', 'Venta', 'Merma', 'Ajuste', 'CompraSinComprobante');

-- AlterTable
ALTER TABLE "insumo" ADD COLUMN     "tipo" "tipo_insumo_enum" NOT NULL DEFAULT 'MateriaPrima';

-- AlterTable
ALTER TABLE "movimiento_inventario" ADD COLUMN     "costo_unitario" DECIMAL(10,2),
DROP COLUMN "tipo_movimiento",
ADD COLUMN     "tipo_movimiento" "tipo_movimiento_enum" NOT NULL,
ALTER COLUMN "motivo" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "orden_compra" DROP COLUMN "estado",
ADD COLUMN     "estado" "estado_orden_compra_enum" NOT NULL DEFAULT 'Pendiente';

-- AlterTable
ALTER TABLE "proveedor" ADD COLUMN     "persona_contacto" VARCHAR(100);

-- AlterTable
ALTER TABLE "recepcion_compra" DROP COLUMN "estado",
ADD COLUMN     "estado" "estado_recepcion_compra_enum" NOT NULL DEFAULT 'Confirmada';

-- CreateTable
CREATE TABLE "transformacion" (
    "id_transformacion" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "fecha" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacion" VARCHAR(200),

    CONSTRAINT "transformacion_pkey" PRIMARY KEY ("id_transformacion")
);

-- CreateTable
CREATE TABLE "detalle_transformacion" (
    "id_detalle_transformacion" SERIAL NOT NULL,
    "id_transformacion" INTEGER NOT NULL,
    "id_insumo" INTEGER NOT NULL,
    "tipo_detalle" VARCHAR(10) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "costo_unitario" DECIMAL(10,2),

    CONSTRAINT "detalle_transformacion_pkey" PRIMARY KEY ("id_detalle_transformacion")
);

-- CreateTable
CREATE TABLE "compra_sin_comprobante" (
    "id_compra_menor" SERIAL NOT NULL,
    "id_insumo" INTEGER NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "monto_pagado" DECIMAL(10,2) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lugar_o_proveedor_informal" VARCHAR(150),
    "motivo" VARCHAR(150),

    CONSTRAINT "compra_sin_comprobante_pkey" PRIMARY KEY ("id_compra_menor")
);

-- CreateTable
CREATE TABLE "receta_plato" (
    "id_receta_plato" SERIAL NOT NULL,
    "id_plato" INTEGER NOT NULL,
    "id_insumo" INTEGER NOT NULL,
    "cantidad_requerida" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "receta_plato_pkey" PRIMARY KEY ("id_receta_plato")
);

-- CreateIndex
CREATE INDEX "idx_transformacion_empleado" ON "transformacion"("id_empleado");

-- CreateIndex
CREATE INDEX "idx_dettransf_transformacion" ON "detalle_transformacion"("id_transformacion");

-- CreateIndex
CREATE INDEX "idx_dettransf_insumo" ON "detalle_transformacion"("id_insumo");

-- CreateIndex
CREATE INDEX "idx_comprasincomp_insumo" ON "compra_sin_comprobante"("id_insumo");

-- CreateIndex
CREATE INDEX "idx_comprasincomp_empleado" ON "compra_sin_comprobante"("id_empleado");

-- CreateIndex
CREATE INDEX "idx_recetaplato_plato" ON "receta_plato"("id_plato");

-- CreateIndex
CREATE INDEX "idx_recetaplato_insumo" ON "receta_plato"("id_insumo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_receta_plato_insumo" ON "receta_plato"("id_plato", "id_insumo");

-- AddForeignKey
ALTER TABLE "transformacion" ADD CONSTRAINT "transformacion_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleado"("id_empleado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_transformacion" ADD CONSTRAINT "detalle_transformacion_id_transformacion_fkey" FOREIGN KEY ("id_transformacion") REFERENCES "transformacion"("id_transformacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_transformacion" ADD CONSTRAINT "detalle_transformacion_id_insumo_fkey" FOREIGN KEY ("id_insumo") REFERENCES "insumo"("id_insumo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_sin_comprobante" ADD CONSTRAINT "compra_sin_comprobante_id_insumo_fkey" FOREIGN KEY ("id_insumo") REFERENCES "insumo"("id_insumo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_sin_comprobante" ADD CONSTRAINT "compra_sin_comprobante_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleado"("id_empleado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_plato" ADD CONSTRAINT "receta_plato_id_plato_fkey" FOREIGN KEY ("id_plato") REFERENCES "plato"("id_plato") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_plato" ADD CONSTRAINT "receta_plato_id_insumo_fkey" FOREIGN KEY ("id_insumo") REFERENCES "insumo"("id_insumo") ON DELETE RESTRICT ON UPDATE CASCADE;
