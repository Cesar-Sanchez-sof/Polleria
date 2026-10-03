BEGIN;
/*
  Warnings:

  - You are about to drop the column `purchase_receipt_item_id` on the `inventory_movement` table. All the data in the column will be lost.
  - You are about to drop the column `receipt_id` on the `purchase_invoice` table. All the data in the column will be lost.
  - You are about to drop the column `estado` on the `purchase_order` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `supplier` table. All the data in the column will be lost.
  - You are about to drop the column `trade_name` on the `supplier` table. All the data in the column will be lost.
  - You are about to drop the column `tipo` on the `supply` table. All the data in the column will be lost.
  - You are about to drop the `purchase_receipt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchase_receipt_item` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "affectation_igv" AS ENUM ('Included', 'Excluded');

-- DropForeignKey
ALTER TABLE "inventory_movement" DROP CONSTRAINT "movimiento_inventario_id_detalle_recepcion_compra_fkey";

-- DropForeignKey
ALTER TABLE "purchase_invoice" DROP CONSTRAINT "comprobante_compra_id_recepcion_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipt" DROP CONSTRAINT "recepcion_compra_id_empleado_recepcion_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipt" DROP CONSTRAINT "recepcion_compra_id_orden_compra_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipt_item" DROP CONSTRAINT "detalle_recepcion_compra_id_detalle_orden_compra_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipt_item" DROP CONSTRAINT "detalle_recepcion_compra_id_recepcion_fkey";

-- DropIndex
DROP INDEX "idx_movinventario_detrecep";

-- DropIndex
DROP INDEX "idx_comprobcompra_recepcion";

-- Rename PK constraints (una por una, sin combinar)
ALTER TABLE "accounting_account" RENAME CONSTRAINT "cuenta_contable_pkey" TO "accounting_account_pkey";
ALTER TABLE "app_user" RENAME CONSTRAINT "usuario_pkey" TO "app_user_pkey";
ALTER TABLE "customer" RENAME CONSTRAINT "cliente_pkey" TO "customer_pkey";
ALTER TABLE "dining_table" RENAME CONSTRAINT "mesa_pkey" TO "dining_table_pkey";
ALTER TABLE "dish" RENAME CONSTRAINT "plato_pkey" TO "dish_pkey";
ALTER TABLE "dish_recipe" RENAME CONSTRAINT "receta_plato_pkey" TO "dish_recipe_pkey";
ALTER TABLE "employee" RENAME CONSTRAINT "empleado_pkey" TO "employee_pkey";
ALTER TABLE "informal_purchase" RENAME CONSTRAINT "compra_sin_comprobante_pkey" TO "informal_purchase_pkey";
ALTER TABLE "inventory_movement" RENAME CONSTRAINT "movimiento_inventario_pkey" TO "inventory_movement_pkey";
ALTER TABLE "journal_entry" RENAME CONSTRAINT "asiento_contable_pkey" TO "journal_entry_pkey";
ALTER TABLE "journal_entry_detail" RENAME CONSTRAINT "detalle_asiento_contable_pkey" TO "journal_entry_detail_pkey";
ALTER TABLE "order_item" RENAME CONSTRAINT "detalle_pedido_pkey" TO "order_item_pkey";
ALTER TABLE "order_table" RENAME CONSTRAINT "pedido_mesa_pkey" TO "order_table_pkey";
ALTER TABLE "payment_type" RENAME CONSTRAINT "tipo_pago_pkey" TO "payment_type_pkey";
ALTER TABLE "payroll" RENAME CONSTRAINT "planilla_pkey" TO "payroll_pkey";
ALTER TABLE "permission" RENAME CONSTRAINT "permisos_pkey" TO "permission_pkey";
ALTER TABLE "purchase_invoice" RENAME CONSTRAINT "comprobante_compra_pkey" TO "purchase_invoice_pkey";
ALTER TABLE "purchase_order" RENAME CONSTRAINT "orden_compra_pkey" TO "purchase_order_pkey";
ALTER TABLE "purchase_order_item" RENAME CONSTRAINT "detalle_orden_compra_pkey" TO "purchase_order_item_pkey";
ALTER TABLE "purchase_payment" RENAME CONSTRAINT "pago_compra_pkey" TO "purchase_payment_pkey";
ALTER TABLE "role" RENAME CONSTRAINT "rol_pkey" TO "role_pkey";
ALTER TABLE "role_permission" RENAME CONSTRAINT "rol_permiso_pkey" TO "role_permission_pkey";
ALTER TABLE "sales_invoice" RENAME CONSTRAINT "comprobante_venta_pkey" TO "sales_invoice_pkey";
ALTER TABLE "sales_order" RENAME CONSTRAINT "pedido_pkey" TO "sales_order_pkey";
ALTER TABLE "sales_payment" RENAME CONSTRAINT "pago_venta_pkey" TO "sales_payment_pkey";
ALTER TABLE "shift" RENAME CONSTRAINT "turno_pkey" TO "shift_pkey";
ALTER TABLE "supplier" RENAME CONSTRAINT "proveedor_pkey" TO "supplier_pkey";
ALTER TABLE "supply" RENAME CONSTRAINT "insumo_pkey" TO "supply_pkey";
ALTER TABLE "transformation" RENAME CONSTRAINT "transformacion_pkey" TO "transformation_pkey";
ALTER TABLE "transformation_item" RENAME CONSTRAINT "detalle_transformacion_pkey" TO "transformation_item_pkey";

-- Add columns (una por una, sin mezclar con RENAME)
ALTER TABLE "inventory_movement" 
    ADD COLUMN "informal_purchase_id" INTEGER,
    ADD COLUMN "order_item_id" INTEGER,
    ADD COLUMN "purchase_order_item_id" INTEGER,
    ADD COLUMN "transformation_item_id" INTEGER;

ALTER TABLE "order_item" ALTER COLUMN "dish_status" SET DEFAULT 'Pending';

ALTER TABLE "purchase_invoice" ADD COLUMN "purchase_order_id" INTEGER;

ALTER TABLE "purchase_order"
    ADD COLUMN "received_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "received_by_id" INTEGER,
    ADD COLUMN "status" "purchase_order_status" NOT NULL DEFAULT 'Pending';

ALTER TABLE "purchase_order_item"
    ADD COLUMN "affectation_igv_applied" "affectation_igv" NOT NULL DEFAULT 'Excluded',
    ADD COLUMN "final_amount_line" DECIMAL(10,2),
    ADD COLUMN "igv_line" DECIMAL(10,2),
    ADD COLUMN "observation" VARCHAR(100),
    ADD COLUMN "quantity_received" DECIMAL(10,2),
    ADD COLUMN "subtotal_line" DECIMAL(10,2);

ALTER TABLE "sales_invoice" ALTER COLUMN "status" SET DEFAULT 'Issued';

ALTER TABLE "sales_order" ALTER COLUMN "status" SET DEFAULT 'Pending';

ALTER TABLE "supply"
    ADD COLUMN "affectation_igv" "affectation_igv" NOT NULL DEFAULT 'Excluded',
    ADD COLUMN "average_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "last_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "type" "supply_type" NOT NULL DEFAULT 'RawMaterial';

-- =====================================================================
-- BACKFILL: Migrate data from old columns/tables BEFORE dropping them
-- =====================================================================

UPDATE "purchase_order" SET "status" = "estado" WHERE "estado" IS NOT NULL;

UPDATE "purchase_order" po
SET "received_by_id" = pr."received_by_id",
    "received_at" = pr."received_at"
FROM "purchase_receipt" pr
WHERE pr."purchase_order_id" = po."id";

UPDATE "purchase_order"
SET "received_by_id" = "employee_id"
WHERE "received_by_id" IS NULL;

UPDATE "purchase_order_item" poi
SET "quantity_received" = pri."quantity_received",
    "observation" = pri."notes"
FROM "purchase_receipt_item" pri
WHERE pri."purchase_order_item_id" = poi."id";

UPDATE "purchase_order_item"
SET "quantity_received" = "quantity_ordered"
WHERE "quantity_received" IS NULL;

UPDATE "purchase_order_item"
SET "subtotal_line" = "quantity_ordered" * "unit_price",
    "igv_line" = ROUND("quantity_ordered" * "unit_price" * 0.18, 2),
    "final_amount_line" = "quantity_ordered" * "unit_price" + ROUND("quantity_ordered" * "unit_price" * 0.18, 2)
WHERE "subtotal_line" IS NULL;

UPDATE "purchase_invoice" pi
SET "purchase_order_id" = pr."purchase_order_id"
FROM "purchase_receipt" pr
WHERE pr."id" = pi."receipt_id";

UPDATE "inventory_movement" im
SET "purchase_order_item_id" = pri."purchase_order_item_id"
FROM "purchase_receipt_item" pri
WHERE pri."id" = im."purchase_receipt_item_id";

UPDATE "supply" SET "type" = "tipo" WHERE "tipo" IS NOT NULL;

-- =====================================================================
-- DROP OLD COLUMNS
-- =====================================================================

ALTER TABLE "inventory_movement" DROP COLUMN "purchase_receipt_item_id";
ALTER TABLE "purchase_invoice" DROP COLUMN "receipt_id";
ALTER TABLE "purchase_order" DROP COLUMN "estado";
ALTER TABLE "supply" DROP COLUMN "tipo";
ALTER TABLE "supplier" DROP COLUMN "name";
ALTER TABLE "supplier" DROP COLUMN "trade_name";

-- Enforce NOT NULL after backfill
ALTER TABLE "purchase_invoice" ALTER COLUMN "purchase_order_id" SET NOT NULL;
ALTER TABLE "purchase_order" ALTER COLUMN "received_by_id" SET NOT NULL;
ALTER TABLE "purchase_order_item" ALTER COLUMN "quantity_received" SET NOT NULL;
ALTER TABLE "purchase_order_item" ALTER COLUMN "subtotal_line" SET NOT NULL;
ALTER TABLE "purchase_order_item" ALTER COLUMN "igv_line" SET NOT NULL;
ALTER TABLE "purchase_order_item" ALTER COLUMN "final_amount_line" SET NOT NULL;

-- DropTable
DROP TABLE "purchase_receipt";
DROP TABLE "purchase_receipt_item";

-- DropEnum
DROP TYPE "purchase_receipt_status";

-- CreateTable
CREATE TABLE "transformation_recipe" (
    "id" SERIAL NOT NULL,
    "produced_supply_id" INTEGER NOT NULL,
    "consumed_supply_id" INTEGER NOT NULL,
    "produced_quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "required_quantity" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "transformation_recipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_transformation_recipe_produced" ON "transformation_recipe"("produced_supply_id");
CREATE INDEX "idx_transformation_recipe_consumed" ON "transformation_recipe"("consumed_supply_id");
CREATE UNIQUE INDEX "uq_transformation_recipe" ON "transformation_recipe"("produced_supply_id", "consumed_supply_id");
CREATE INDEX "idx_inventory_movement_purchase_order_item" ON "inventory_movement"("purchase_order_item_id");
CREATE INDEX "idx_inventory_movement_transformation_item" ON "inventory_movement"("transformation_item_id");
CREATE INDEX "idx_inventory_movement_order_item" ON "inventory_movement"("order_item_id");
CREATE INDEX "idx_inventory_movement_informal_purchase" ON "inventory_movement"("informal_purchase_id");
CREATE INDEX "idx_purchase_invoice_purchase_order" ON "purchase_invoice"("purchase_order_id");
CREATE INDEX "idx_purchase_order_received_by" ON "purchase_order"("received_by_id");

-- RenameForeignKey
ALTER TABLE "accounting_account" RENAME CONSTRAINT "cuenta_contable_id_cuenta_padre_fkey" TO "accounting_account_parent_id_fkey";
ALTER TABLE "app_user" RENAME CONSTRAINT "usuario_id_empleado_fkey" TO "app_user_employee_id_fkey";
ALTER TABLE "app_user" RENAME CONSTRAINT "usuario_id_rol_fkey" TO "app_user_role_id_fkey";
ALTER TABLE "dish_recipe" RENAME CONSTRAINT "receta_plato_id_insumo_fkey" TO "dish_recipe_supply_id_fkey";
ALTER TABLE "dish_recipe" RENAME CONSTRAINT "receta_plato_id_plato_fkey" TO "dish_recipe_dish_id_fkey";
ALTER TABLE "employee" RENAME CONSTRAINT "empleado_id_turno_fkey" TO "employee_shift_id_fkey";
ALTER TABLE "informal_purchase" RENAME CONSTRAINT "compra_sin_comprobante_id_empleado_fkey" TO "informal_purchase_employee_id_fkey";
ALTER TABLE "informal_purchase" RENAME CONSTRAINT "compra_sin_comprobante_id_insumo_fkey" TO "informal_purchase_supply_id_fkey";
ALTER TABLE "inventory_movement" RENAME CONSTRAINT "movimiento_inventario_id_insumo_fkey" TO "inventory_movement_supply_id_fkey";
ALTER TABLE "journal_entry" RENAME CONSTRAINT "asiento_contable_id_comprobante_compra_fkey" TO "journal_entry_purchase_invoice_id_fkey";
ALTER TABLE "journal_entry" RENAME CONSTRAINT "asiento_contable_id_comprobante_venta_fkey" TO "journal_entry_sales_invoice_id_fkey";
ALTER TABLE "journal_entry" RENAME CONSTRAINT "asiento_contable_id_planilla_fkey" TO "journal_entry_payroll_id_fkey";
ALTER TABLE "journal_entry_detail" RENAME CONSTRAINT "detalle_asiento_contable_id_asiento_contable_fkey" TO "journal_entry_detail_entry_id_fkey";
ALTER TABLE "journal_entry_detail" RENAME CONSTRAINT "detalle_asiento_contable_id_cuenta_contable_fkey" TO "journal_entry_detail_account_id_fkey";
ALTER TABLE "order_item" RENAME CONSTRAINT "detalle_pedido_id_pedido_fkey" TO "order_item_order_id_fkey";
ALTER TABLE "order_item" RENAME CONSTRAINT "detalle_pedido_id_plato_fkey" TO "order_item_dish_id_fkey";
ALTER TABLE "order_table" RENAME CONSTRAINT "pedido_mesa_id_mesa_fkey" TO "order_table_table_id_fkey";
ALTER TABLE "order_table" RENAME CONSTRAINT "pedido_mesa_id_pedido_fkey" TO "order_table_order_id_fkey";
ALTER TABLE "payroll" RENAME CONSTRAINT "planilla_id_empleado_fkey" TO "payroll_employee_id_fkey";
ALTER TABLE "purchase_invoice" RENAME CONSTRAINT "comprobante_compra_id_proveedor_fkey" TO "purchase_invoice_supplier_id_fkey";
ALTER TABLE "purchase_order" RENAME CONSTRAINT "orden_compra_id_empleado_fkey" TO "purchase_order_employee_id_fkey";
ALTER TABLE "purchase_order" RENAME CONSTRAINT "orden_compra_id_proveedor_fkey" TO "purchase_order_supplier_id_fkey";
ALTER TABLE "purchase_order_item" RENAME CONSTRAINT "detalle_orden_compra_id_insumo_fkey" TO "purchase_order_item_supply_id_fkey";
ALTER TABLE "purchase_order_item" RENAME CONSTRAINT "detalle_orden_compra_id_orden_compra_fkey" TO "purchase_order_item_purchase_order_id_fkey";
ALTER TABLE "purchase_payment" RENAME CONSTRAINT "pago_compra_id_comprobante_compra_fkey" TO "purchase_payment_purchase_invoice_id_fkey";
ALTER TABLE "purchase_payment" RENAME CONSTRAINT "pago_compra_id_tipo_pago_fkey" TO "purchase_payment_payment_type_id_fkey";
ALTER TABLE "role_permission" RENAME CONSTRAINT "rol_permiso_id_permiso_fkey" TO "role_permission_permission_id_fkey";
ALTER TABLE "role_permission" RENAME CONSTRAINT "rol_permiso_id_rol_fkey" TO "role_permission_role_id_fkey";
ALTER TABLE "sales_invoice" RENAME CONSTRAINT "comprobante_venta_id_cliente_fkey" TO "sales_invoice_customer_id_fkey";
ALTER TABLE "sales_invoice" RENAME CONSTRAINT "comprobante_venta_id_pedido_fkey" TO "sales_invoice_order_id_fkey";
ALTER TABLE "sales_payment" RENAME CONSTRAINT "pago_venta_id_comprobante_venta_fkey" TO "sales_payment_sales_invoice_id_fkey";
ALTER TABLE "sales_payment" RENAME CONSTRAINT "pago_venta_id_tipo_pago_fkey" TO "sales_payment_payment_type_id_fkey";
ALTER TABLE "transformation" RENAME CONSTRAINT "transformacion_id_empleado_fkey" TO "transformation_employee_id_fkey";
ALTER TABLE "transformation_item" RENAME CONSTRAINT "detalle_transformacion_id_insumo_fkey" TO "transformation_item_supply_id_fkey";
ALTER TABLE "transformation_item" RENAME CONSTRAINT "detalle_transformacion_id_transformacion_fkey" TO "transformation_item_transformation_id_fkey";

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_transformation_item_id_fkey" FOREIGN KEY ("transformation_item_id") REFERENCES "transformation_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_informal_purchase_id_fkey" FOREIGN KEY ("informal_purchase_id") REFERENCES "informal_purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice" ADD CONSTRAINT "purchase_invoice_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transformation_recipe" ADD CONSTRAINT "transformation_recipe_produced_supply_id_fkey" FOREIGN KEY ("produced_supply_id") REFERENCES "supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transformation_recipe" ADD CONSTRAINT "transformation_recipe_consumed_supply_id_fkey" FOREIGN KEY ("consumed_supply_id") REFERENCES "supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "cuenta_contable_codigo_key" RENAME TO "accounting_account_code_key";
ALTER INDEX "idx_cuentacontable_padre" RENAME TO "idx_accounting_account_parent";
ALTER INDEX "idx_usuario_empleado" RENAME TO "idx_user_employee";
ALTER INDEX "idx_usuario_rol" RENAME TO "idx_user_role";
ALTER INDEX "usuario_username_key" RENAME TO "app_user_username_key";
ALTER INDEX "uq_cliente_doc" RENAME TO "uq_customer_document";
ALTER INDEX "mesa_numero_key" RENAME TO "dining_table_number_key";
ALTER INDEX "idx_recetaplato_insumo" RENAME TO "idx_dish_recipe_supply";
ALTER INDEX "idx_recetaplato_plato" RENAME TO "idx_dish_recipe_dish";
ALTER INDEX "uq_receta_plato_insumo" RENAME TO "uq_dish_recipe_supply";
ALTER INDEX "empleado_dni_key" RENAME TO "employee_dni_key";
ALTER INDEX "idx_empleado_turno" RENAME TO "idx_employee_shift";
ALTER INDEX "idx_comprasincomp_empleado" RENAME TO "idx_informal_purchase_employee";
ALTER INDEX "idx_comprasincomp_insumo" RENAME TO "idx_informal_purchase_supply";
ALTER INDEX "idx_movinventario_insumo" RENAME TO "idx_inventory_movement_supply";
ALTER INDEX "asiento_contable_codigo_key" RENAME TO "journal_entry_code_key";
ALTER INDEX "idx_asiento_compcompra" RENAME TO "idx_journal_entry_purchase_invoice";
ALTER INDEX "idx_asiento_compventa" RENAME TO "idx_journal_entry_sales_invoice";
ALTER INDEX "idx_asiento_diario" RENAME TO "idx_journal_entry_book";
ALTER INDEX "idx_asiento_estado" RENAME TO "idx_journal_entry_status";
ALTER INDEX "idx_asiento_fecha" RENAME TO "idx_journal_entry_date";
ALTER INDEX "idx_asiento_planilla" RENAME TO "idx_journal_entry_payroll";
ALTER INDEX "idx_detasiento_asiento" RENAME TO "idx_journal_entry_detail_entry";
ALTER INDEX "idx_detasiento_cuenta" RENAME TO "idx_journal_entry_detail_account";
ALTER INDEX "idx_detpedido_pedido" RENAME TO "idx_order_item_order";
ALTER INDEX "idx_detpedido_plato" RENAME TO "idx_order_item_dish";
ALTER INDEX "idx_pedidomesa_mesa" RENAME TO "idx_order_table_table";
ALTER INDEX "idx_pedidomesa_pedido" RENAME TO "idx_order_table_order";
ALTER INDEX "idx_planilla_empleado" RENAME TO "idx_payroll_employee";
ALTER INDEX "uq_planilla_periodo" RENAME TO "uq_payroll_period";
ALTER INDEX "idx_comprobcompra_proveedor" RENAME TO "idx_purchase_invoice_supplier";
ALTER INDEX "uq_comprobante_compra" RENAME TO "uq_purchase_invoice";
ALTER INDEX "idx_ordencompra_empleado" RENAME TO "idx_purchase_order_employee";
ALTER INDEX "idx_ordencompra_proveedor" RENAME TO "idx_purchase_order_supplier";
ALTER INDEX "orden_compra_numero_orden_key" RENAME TO "purchase_order_order_number_key";
ALTER INDEX "idx_detordencompra_insumo" RENAME TO "idx_purchase_order_item_supply";
ALTER INDEX "idx_detordencompra_orden" RENAME TO "idx_purchase_order_item_order";
ALTER INDEX "idx_pagocompra_comprobante" RENAME TO "idx_purchase_payment_invoice";
ALTER INDEX "idx_pagocompra_tipopago" RENAME TO "idx_purchase_payment_type";
ALTER INDEX "idx_rolpermiso_permiso" RENAME TO "idx_role_permission_permission";
ALTER INDEX "idx_rolpermiso_rol" RENAME TO "idx_role_permission_role";
ALTER INDEX "uq_rol_permiso" RENAME TO "uq_role_permission";
ALTER INDEX "idx_comprobventa_cliente" RENAME TO "idx_sales_invoice_customer";
ALTER INDEX "idx_comprobventa_pedido" RENAME TO "idx_sales_invoice_order";
ALTER INDEX "uq_comprobante_venta" RENAME TO "uq_sales_invoice";
ALTER INDEX "pedido_codigo_key" RENAME TO "sales_order_code_key";
ALTER INDEX "idx_pagoventa_comprobante" RENAME TO "idx_sales_payment_invoice";
ALTER INDEX "idx_pagoventa_tipopago" RENAME TO "idx_sales_payment_type";
ALTER INDEX "proveedor_ruc_key" RENAME TO "supplier_ruc_key";
ALTER INDEX "idx_transformacion_empleado" RENAME TO "idx_transformation_employee";
ALTER INDEX "idx_dettransf_insumo" RENAME TO "idx_transformation_item_supply";
ALTER INDEX "idx_dettransf_transformacion" RENAME TO "idx_transformation_item_transformation";

COMMIT;