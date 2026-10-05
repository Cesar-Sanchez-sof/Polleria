-- Rename Spanish schema to English while preserving all data.
-- All identifiers are quoted to match Prisma's PostgreSQL naming.

-- =============================================================================
-- 1. ENUM VALUES + TYPES
-- =============================================================================

ALTER TYPE "tipo_persona_enum" RENAME VALUE 'Juridico' TO 'Legal';
ALTER TYPE "tipo_persona_enum" RENAME TO "person_type";

ALTER TYPE "estado_orden_compra_enum" RENAME VALUE 'Pendiente' TO 'Pending';
ALTER TYPE "estado_orden_compra_enum" RENAME VALUE 'RecibidaParcial' TO 'PartiallyReceived';
ALTER TYPE "estado_orden_compra_enum" RENAME VALUE 'RecibidaTotal' TO 'FullyReceived';
ALTER TYPE "estado_orden_compra_enum" RENAME VALUE 'Cancelada' TO 'Cancelled';
ALTER TYPE "estado_orden_compra_enum" RENAME TO "purchase_order_status";

ALTER TYPE "estado_recepcion_compra_enum" RENAME VALUE 'Confirmada' TO 'Confirmed';
ALTER TYPE "estado_recepcion_compra_enum" RENAME VALUE 'Anulada' TO 'Voided';
ALTER TYPE "estado_recepcion_compra_enum" RENAME TO "purchase_receipt_status";

ALTER TYPE "tipo_insumo_enum" RENAME VALUE 'MateriaPrima' TO 'RawMaterial';
ALTER TYPE "tipo_insumo_enum" RENAME VALUE 'ProductoTerminado' TO 'FinishedProduct';
ALTER TYPE "tipo_insumo_enum" RENAME TO "supply_type";

ALTER TYPE "tipo_movimiento_enum" RENAME VALUE 'Compra' TO 'Purchase';
ALTER TYPE "tipo_movimiento_enum" RENAME VALUE 'TransformacionSalida' TO 'TransformationOut';
ALTER TYPE "tipo_movimiento_enum" RENAME VALUE 'TransformacionEntrada' TO 'TransformationIn';
ALTER TYPE "tipo_movimiento_enum" RENAME VALUE 'Venta' TO 'Sale';
ALTER TYPE "tipo_movimiento_enum" RENAME VALUE 'Merma' TO 'Shrinkage';
ALTER TYPE "tipo_movimiento_enum" RENAME VALUE 'Ajuste' TO 'Adjustment';
ALTER TYPE "tipo_movimiento_enum" RENAME VALUE 'CompraSinComprobante' TO 'InformalPurchase';
ALTER TYPE "tipo_movimiento_enum" RENAME TO "inventory_movement_type";

-- =============================================================================
-- 2. RENAME TABLES
-- =============================================================================

ALTER TABLE "rol" RENAME TO "role";
ALTER TABLE "permisos" RENAME TO "permission";
ALTER TABLE "rol_permiso" RENAME TO "role_permission";
ALTER TABLE "turno" RENAME TO "shift";
ALTER TABLE "empleado" RENAME TO "employee";
ALTER TABLE "usuario" RENAME TO "app_user";
ALTER TABLE "planilla" RENAME TO "payroll";
ALTER TABLE "proveedor" RENAME TO "supplier";
ALTER TABLE "tipo_pago" RENAME TO "payment_type";
ALTER TABLE "orden_compra" RENAME TO "purchase_order";
ALTER TABLE "insumo" RENAME TO "supply";
ALTER TABLE "detalle_orden_compra" RENAME TO "purchase_order_item";
ALTER TABLE "recepcion_compra" RENAME TO "purchase_receipt";
ALTER TABLE "detalle_recepcion_compra" RENAME TO "purchase_receipt_item";
ALTER TABLE "movimiento_inventario" RENAME TO "inventory_movement";
ALTER TABLE "comprobante_compra" RENAME TO "purchase_invoice";
ALTER TABLE "pago_compra" RENAME TO "purchase_payment";
ALTER TABLE "transformacion" RENAME TO "transformation";
ALTER TABLE "detalle_transformacion" RENAME TO "transformation_item";
ALTER TABLE "compra_sin_comprobante" RENAME TO "informal_purchase";
ALTER TABLE "cliente" RENAME TO "customer";
ALTER TABLE "mesa" RENAME TO "dining_table";
ALTER TABLE "plato" RENAME TO "dish";
ALTER TABLE "receta_plato" RENAME TO "dish_recipe";
ALTER TABLE "pedido" RENAME TO "sales_order";
ALTER TABLE "pedido_mesa" RENAME TO "order_table";
ALTER TABLE "detalle_pedido" RENAME TO "order_item";
ALTER TABLE "comprobante_venta" RENAME TO "sales_invoice";
ALTER TABLE "pago_venta" RENAME TO "sales_payment";
ALTER TABLE "cuenta_contable" RENAME TO "accounting_account";
ALTER TABLE "asiento_contable" RENAME TO "journal_entry";
ALTER TABLE "detalle_asiento_contable" RENAME TO "journal_entry_detail";

-- =============================================================================
-- 3. RENAME COLUMNS
-- =============================================================================

-- role
ALTER TABLE "role" RENAME COLUMN "id_rol" TO "id";
ALTER TABLE "role" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "role" RENAME COLUMN "descripcion" TO "description";
ALTER TABLE "role" RENAME COLUMN "estado" TO "active";

-- permission
ALTER TABLE "permission" RENAME COLUMN "id_permiso" TO "id";
ALTER TABLE "permission" RENAME COLUMN "nombre" TO "name";

-- role_permission
ALTER TABLE "role_permission" RENAME COLUMN "id_rolPermiso" TO "id";
ALTER TABLE "role_permission" RENAME COLUMN "id_permiso" TO "permission_id";
ALTER TABLE "role_permission" RENAME COLUMN "id_rol" TO "role_id";

-- shift
ALTER TABLE "shift" RENAME COLUMN "id_turno" TO "id";
ALTER TABLE "shift" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "shift" RENAME COLUMN "fecha" TO "date";
ALTER TABLE "shift" RENAME COLUMN "hora_inicio" TO "start_time";
ALTER TABLE "shift" RENAME COLUMN "hora_fin" TO "end_time";

-- employee
ALTER TABLE "employee" RENAME COLUMN "id_empleado" TO "id";
ALTER TABLE "employee" RENAME COLUMN "id_turno" TO "shift_id";
ALTER TABLE "employee" RENAME COLUMN "primer_nombre" TO "first_name";
ALTER TABLE "employee" RENAME COLUMN "segundo_nombre" TO "middle_name";
ALTER TABLE "employee" RENAME COLUMN "apellido_paterno" TO "paternal_last_name";
ALTER TABLE "employee" RENAME COLUMN "apellido_materno" TO "maternal_last_name";
ALTER TABLE "employee" RENAME COLUMN "telefono" TO "phone";
ALTER TABLE "employee" RENAME COLUMN "direccion" TO "address";
ALTER TABLE "employee" RENAME COLUMN "fecha_nacimiento" TO "birth_date";
ALTER TABLE "employee" RENAME COLUMN "fecha_ingreso" TO "hire_date";
ALTER TABLE "employee" RENAME COLUMN "cargo" TO "position";
ALTER TABLE "employee" RENAME COLUMN "tipo_contrato" TO "contract_type";
ALTER TABLE "employee" RENAME COLUMN "sueldo_base" TO "base_salary";
ALTER TABLE "employee" RENAME COLUMN "estado" TO "active";

-- app_user
ALTER TABLE "app_user" RENAME COLUMN "id_usuario" TO "id";
ALTER TABLE "app_user" RENAME COLUMN "id_empleado" TO "employee_id";
ALTER TABLE "app_user" RENAME COLUMN "id_rol" TO "role_id";
ALTER TABLE "app_user" RENAME COLUMN "intentos_fallidos" TO "failed_attempts";
ALTER TABLE "app_user" RENAME COLUMN "bloqueado" TO "locked";
ALTER TABLE "app_user" RENAME COLUMN "fecha_bloqueo" TO "locked_at";
ALTER TABLE "app_user" RENAME COLUMN "ultimo_acceso" TO "last_access_at";

-- payroll
ALTER TABLE "payroll" RENAME COLUMN "id_planilla" TO "id";
ALTER TABLE "payroll" RENAME COLUMN "id_empleado" TO "employee_id";
ALTER TABLE "payroll" RENAME COLUMN "mes" TO "month";
ALTER TABLE "payroll" RENAME COLUMN "anio" TO "year";
ALTER TABLE "payroll" RENAME COLUMN "sueldo_base" TO "base_salary";
ALTER TABLE "payroll" RENAME COLUMN "hora_extra" TO "overtime_pay";
ALTER TABLE "payroll" RENAME COLUMN "bonificacion" TO "bonus";
ALTER TABLE "payroll" RENAME COLUMN "descuentos" TO "deductions";
ALTER TABLE "payroll" RENAME COLUMN "neto_pagar" TO "net_pay";
ALTER TABLE "payroll" RENAME COLUMN "fecha_pago" TO "payment_date";
ALTER TABLE "payroll" RENAME COLUMN "estado" TO "active";

-- supplier
ALTER TABLE "supplier" RENAME COLUMN "id_proveedor" TO "id";
ALTER TABLE "supplier" RENAME COLUMN "nombre_comercial" TO "trade_name";
ALTER TABLE "supplier" RENAME COLUMN "razon_social" TO "business_name";
ALTER TABLE "supplier" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "supplier" RENAME COLUMN "persona_contacto" TO "contact_person";
ALTER TABLE "supplier" RENAME COLUMN "direccion" TO "address";
ALTER TABLE "supplier" RENAME COLUMN "telefono" TO "phone";
ALTER TABLE "supplier" RENAME COLUMN "correo" TO "email";
ALTER TABLE "supplier" RENAME COLUMN "estado" TO "active";

-- payment_type
ALTER TABLE "payment_type" RENAME COLUMN "id_tipo_pago" TO "id";
ALTER TABLE "payment_type" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "payment_type" RENAME COLUMN "estado" TO "active";

-- purchase_order
ALTER TABLE "purchase_order" RENAME COLUMN "id_orden_compra" TO "id";
ALTER TABLE "purchase_order" RENAME COLUMN "id_proveedor" TO "supplier_id";
ALTER TABLE "purchase_order" RENAME COLUMN "id_empleado" TO "employee_id";
ALTER TABLE "purchase_order" RENAME COLUMN "numero_orden" TO "order_number";
ALTER TABLE "purchase_order" RENAME COLUMN "fecha_emision" TO "issued_at";
ALTER TABLE "purchase_order" RENAME COLUMN "fecha_esperada" TO "expected_at";
ALTER TABLE "purchase_order" RENAME COLUMN "observaciones" TO "notes";

-- supply
ALTER TABLE "supply" RENAME COLUMN "id_insumo" TO "id";
ALTER TABLE "supply" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "supply" RENAME COLUMN "unidad_medida" TO "unit_of_measure";
ALTER TABLE "supply" RENAME COLUMN "stock_actual" TO "current_stock";
ALTER TABLE "supply" RENAME COLUMN "stock_minimo" TO "minimum_stock";
ALTER TABLE "supply" RENAME COLUMN "estado" TO "active";

-- purchase_order_item
ALTER TABLE "purchase_order_item" RENAME COLUMN "id_detalle_orden_compra" TO "id";
ALTER TABLE "purchase_order_item" RENAME COLUMN "id_orden_compra" TO "purchase_order_id";
ALTER TABLE "purchase_order_item" RENAME COLUMN "id_insumo" TO "supply_id";
ALTER TABLE "purchase_order_item" RENAME COLUMN "cantidad_pedida" TO "quantity_ordered";
ALTER TABLE "purchase_order_item" RENAME COLUMN "precio_unitario" TO "unit_price";

-- purchase_receipt
ALTER TABLE "purchase_receipt" RENAME COLUMN "id_recepcion" TO "id";
ALTER TABLE "purchase_receipt" RENAME COLUMN "id_orden_compra" TO "purchase_order_id";
ALTER TABLE "purchase_receipt" RENAME COLUMN "id_empleado_recepcion" TO "received_by_id";
ALTER TABLE "purchase_receipt" RENAME COLUMN "fecha_recepcion" TO "received_at";
ALTER TABLE "purchase_receipt" RENAME COLUMN "observacion" TO "notes";

-- purchase_receipt_item
ALTER TABLE "purchase_receipt_item" RENAME COLUMN "id_detalle_recepcion_compra" TO "id";
ALTER TABLE "purchase_receipt_item" RENAME COLUMN "id_recepcion" TO "receipt_id";
ALTER TABLE "purchase_receipt_item" RENAME COLUMN "id_detalle_orden_compra" TO "purchase_order_item_id";
ALTER TABLE "purchase_receipt_item" RENAME COLUMN "cantidad_recibida" TO "quantity_received";
ALTER TABLE "purchase_receipt_item" RENAME COLUMN "obsevacion" TO "notes";

-- inventory_movement
ALTER TABLE "inventory_movement" RENAME COLUMN "id_movimiento_inventario" TO "id";
ALTER TABLE "inventory_movement" RENAME COLUMN "id_insumo" TO "supply_id";
ALTER TABLE "inventory_movement" RENAME COLUMN "id_detalle_recepcion_compra" TO "purchase_receipt_item_id";
ALTER TABLE "inventory_movement" RENAME COLUMN "tipo_movimiento" TO "movement_type";
ALTER TABLE "inventory_movement" RENAME COLUMN "cantidad" TO "quantity";
ALTER TABLE "inventory_movement" RENAME COLUMN "costo_unitario" TO "unit_cost";
ALTER TABLE "inventory_movement" RENAME COLUMN "motivo" TO "reason";
ALTER TABLE "inventory_movement" RENAME COLUMN "fecha_movimiento" TO "moved_at";

-- purchase_invoice
ALTER TABLE "purchase_invoice" RENAME COLUMN "id_comprobante_compra" TO "id";
ALTER TABLE "purchase_invoice" RENAME COLUMN "id_proveedor" TO "supplier_id";
ALTER TABLE "purchase_invoice" RENAME COLUMN "id_recepcion" TO "receipt_id";
ALTER TABLE "purchase_invoice" RENAME COLUMN "tipo_comprobante" TO "voucher_type";
ALTER TABLE "purchase_invoice" RENAME COLUMN "serie" TO "series";
ALTER TABLE "purchase_invoice" RENAME COLUMN "numero" TO "number";
ALTER TABLE "purchase_invoice" RENAME COLUMN "fecha_emision" TO "issued_at";
ALTER TABLE "purchase_invoice" RENAME COLUMN "monto_total" TO "total_amount";
ALTER TABLE "purchase_invoice" RENAME COLUMN "estado" TO "active";

-- purchase_payment
ALTER TABLE "purchase_payment" RENAME COLUMN "id_pago_compra" TO "id";
ALTER TABLE "purchase_payment" RENAME COLUMN "id_comprobante_compra" TO "purchase_invoice_id";
ALTER TABLE "purchase_payment" RENAME COLUMN "id_tipo_pago" TO "payment_type_id";
ALTER TABLE "purchase_payment" RENAME COLUMN "monto" TO "amount";
ALTER TABLE "purchase_payment" RENAME COLUMN "fecha_pago" TO "paid_at";

-- transformation
ALTER TABLE "transformation" RENAME COLUMN "id_transformacion" TO "id";
ALTER TABLE "transformation" RENAME COLUMN "id_empleado" TO "employee_id";
ALTER TABLE "transformation" RENAME COLUMN "fecha" TO "date";
ALTER TABLE "transformation" RENAME COLUMN "observacion" TO "notes";

-- transformation_item
ALTER TABLE "transformation_item" RENAME COLUMN "id_detalle_transformacion" TO "id";
ALTER TABLE "transformation_item" RENAME COLUMN "id_transformacion" TO "transformation_id";
ALTER TABLE "transformation_item" RENAME COLUMN "id_insumo" TO "supply_id";
ALTER TABLE "transformation_item" RENAME COLUMN "tipo_detalle" TO "item_type";
ALTER TABLE "transformation_item" RENAME COLUMN "cantidad" TO "quantity";
ALTER TABLE "transformation_item" RENAME COLUMN "costo_unitario" TO "unit_cost";

-- informal_purchase
ALTER TABLE "informal_purchase" RENAME COLUMN "id_compra_menor" TO "id";
ALTER TABLE "informal_purchase" RENAME COLUMN "id_insumo" TO "supply_id";
ALTER TABLE "informal_purchase" RENAME COLUMN "id_empleado" TO "employee_id";
ALTER TABLE "informal_purchase" RENAME COLUMN "cantidad" TO "quantity";
ALTER TABLE "informal_purchase" RENAME COLUMN "monto_pagado" TO "amount_paid";
ALTER TABLE "informal_purchase" RENAME COLUMN "fecha" TO "date";
ALTER TABLE "informal_purchase" RENAME COLUMN "lugar_o_proveedor_informal" TO "informal_place_or_vendor";
ALTER TABLE "informal_purchase" RENAME COLUMN "motivo" TO "reason";

-- customer
ALTER TABLE "customer" RENAME COLUMN "id_cliente" TO "id";
ALTER TABLE "customer" RENAME COLUMN "nro_doc" TO "document_number";
ALTER TABLE "customer" RENAME COLUMN "nombre" TO "first_name";
ALTER TABLE "customer" RENAME COLUMN "apellido" TO "last_name";
ALTER TABLE "customer" RENAME COLUMN "telefono" TO "phone";
ALTER TABLE "customer" RENAME COLUMN "tipo_persona" TO "person_type";
ALTER TABLE "customer" RENAME COLUMN "estado" TO "active";

-- dining_table
ALTER TABLE "dining_table" RENAME COLUMN "id_mesa" TO "id";
ALTER TABLE "dining_table" RENAME COLUMN "numero" TO "number";
ALTER TABLE "dining_table" RENAME COLUMN "aforo" TO "capacity";
ALTER TABLE "dining_table" RENAME COLUMN "estado" TO "active";

-- dish
ALTER TABLE "dish" RENAME COLUMN "id_plato" TO "id";
ALTER TABLE "dish" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "dish" RENAME COLUMN "descripcion" TO "description";
ALTER TABLE "dish" RENAME COLUMN "precio" TO "price";
ALTER TABLE "dish" RENAME COLUMN "estado" TO "active";

-- dish_recipe
ALTER TABLE "dish_recipe" RENAME COLUMN "id_receta_plato" TO "id";
ALTER TABLE "dish_recipe" RENAME COLUMN "id_plato" TO "dish_id";
ALTER TABLE "dish_recipe" RENAME COLUMN "id_insumo" TO "supply_id";
ALTER TABLE "dish_recipe" RENAME COLUMN "cantidad_requerida" TO "quantity_required";

-- sales_order
ALTER TABLE "sales_order" RENAME COLUMN "id_pedido" TO "id";
ALTER TABLE "sales_order" RENAME COLUMN "codigo" TO "code";
ALTER TABLE "sales_order" RENAME COLUMN "tipo_pedido" TO "order_type";
ALTER TABLE "sales_order" RENAME COLUMN "fecha_pedido" TO "ordered_at";
ALTER TABLE "sales_order" RENAME COLUMN "estado" TO "status";

-- order_table
ALTER TABLE "order_table" RENAME COLUMN "id_pedido_mesa" TO "id";
ALTER TABLE "order_table" RENAME COLUMN "id_mesa" TO "table_id";
ALTER TABLE "order_table" RENAME COLUMN "id_pedido" TO "order_id";
ALTER TABLE "order_table" RENAME COLUMN "observacion" TO "notes";

-- order_item
ALTER TABLE "order_item" RENAME COLUMN "id_detalle_pedido" TO "id";
ALTER TABLE "order_item" RENAME COLUMN "id_pedido" TO "order_id";
ALTER TABLE "order_item" RENAME COLUMN "id_plato" TO "dish_id";
ALTER TABLE "order_item" RENAME COLUMN "cantidad" TO "quantity";
ALTER TABLE "order_item" RENAME COLUMN "precio_unitario" TO "unit_price";
ALTER TABLE "order_item" RENAME COLUMN "sub_total" TO "subtotal";
ALTER TABLE "order_item" RENAME COLUMN "estado_plato" TO "dish_status";
ALTER TABLE "order_item" RENAME COLUMN "observaciones" TO "notes";

-- sales_invoice
ALTER TABLE "sales_invoice" RENAME COLUMN "id_comprobante_venta" TO "id";
ALTER TABLE "sales_invoice" RENAME COLUMN "id_pedido" TO "order_id";
ALTER TABLE "sales_invoice" RENAME COLUMN "id_cliente" TO "customer_id";
ALTER TABLE "sales_invoice" RENAME COLUMN "tipo_comprobante" TO "voucher_type";
ALTER TABLE "sales_invoice" RENAME COLUMN "serie" TO "series";
ALTER TABLE "sales_invoice" RENAME COLUMN "numero" TO "number";
ALTER TABLE "sales_invoice" RENAME COLUMN "fecha_emision" TO "issued_at";
ALTER TABLE "sales_invoice" RENAME COLUMN "monto_total" TO "total_amount";
ALTER TABLE "sales_invoice" RENAME COLUMN "estado" TO "status";

-- sales_payment
ALTER TABLE "sales_payment" RENAME COLUMN "id_pago_venta" TO "id";
ALTER TABLE "sales_payment" RENAME COLUMN "id_comprobante_venta" TO "sales_invoice_id";
ALTER TABLE "sales_payment" RENAME COLUMN "id_tipo_pago" TO "payment_type_id";
ALTER TABLE "sales_payment" RENAME COLUMN "monto" TO "amount";
ALTER TABLE "sales_payment" RENAME COLUMN "fecha_pago" TO "paid_at";

-- accounting_account
ALTER TABLE "accounting_account" RENAME COLUMN "id_cuenta_contable" TO "id";
ALTER TABLE "accounting_account" RENAME COLUMN "id_cuenta_padre" TO "parent_id";
ALTER TABLE "accounting_account" RENAME COLUMN "codigo" TO "code";
ALTER TABLE "accounting_account" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "accounting_account" RENAME COLUMN "tipo" TO "type";
ALTER TABLE "accounting_account" RENAME COLUMN "activo" TO "active";
ALTER TABLE "accounting_account" RENAME COLUMN "fecha_creacion" TO "created_at";
ALTER TABLE "accounting_account" RENAME COLUMN "fecha_actualizacion" TO "updated_at";

-- journal_entry
ALTER TABLE "journal_entry" RENAME COLUMN "id_asiento_contable" TO "id";
ALTER TABLE "journal_entry" RENAME COLUMN "id_comprobante_venta" TO "sales_invoice_id";
ALTER TABLE "journal_entry" RENAME COLUMN "id_comprobante_compra" TO "purchase_invoice_id";
ALTER TABLE "journal_entry" RENAME COLUMN "id_planilla" TO "payroll_id";
ALTER TABLE "journal_entry" RENAME COLUMN "fecha_contable" TO "entry_date";
ALTER TABLE "journal_entry" RENAME COLUMN "glosa" TO "description";
ALTER TABLE "journal_entry" RENAME COLUMN "diario" TO "book";
ALTER TABLE "journal_entry" RENAME COLUMN "responsable" TO "responsible";
ALTER TABLE "journal_entry" RENAME COLUMN "fecha_creacion" TO "created_at";
ALTER TABLE "journal_entry" RENAME COLUMN "fecha_actualizacion" TO "updated_at";
ALTER TABLE "journal_entry" RENAME COLUMN "estado" TO "status";
ALTER TABLE "journal_entry" RENAME COLUMN "codigo" TO "code";
ALTER TABLE "journal_entry" RENAME COLUMN "observacion" TO "observation";

-- journal_entry_detail
ALTER TABLE "journal_entry_detail" RENAME COLUMN "id_detalle_asiento_contable" TO "id";
ALTER TABLE "journal_entry_detail" RENAME COLUMN "id_asiento_contable" TO "entry_id";
ALTER TABLE "journal_entry_detail" RENAME COLUMN "id_cuenta_contable" TO "account_id";
ALTER TABLE "journal_entry_detail" RENAME COLUMN "descripcion" TO "description";
ALTER TABLE "journal_entry_detail" RENAME COLUMN "debito" TO "debit";
ALTER TABLE "journal_entry_detail" RENAME COLUMN "credito" TO "credit";

-- =============================================================================
-- 4. UPDATE VARCHAR STATUS DATA (non-enum)
-- =============================================================================

UPDATE "sales_order" SET "status" = 'Pending' WHERE "status" = 'Pendiente';
UPDATE "sales_order" SET "status" = 'Received' WHERE "status" = 'Recibido';
UPDATE "sales_order" SET "status" = 'Preparing' WHERE "status" IN ('EnPreparacion', 'En preparación');
UPDATE "sales_order" SET "status" = 'Served' WHERE "status" = 'Servido';
UPDATE "sales_order" SET "status" = 'Closed' WHERE "status" = 'Cerrado';
UPDATE "sales_order" SET "status" = 'Cancelled' WHERE "status" IN ('Cancelado', 'Anulado');

UPDATE "order_item" SET "dish_status" = 'Pending' WHERE "dish_status" = 'Pendiente';
UPDATE "order_item" SET "dish_status" = 'Preparing' WHERE "dish_status" IN ('EnPreparacion', 'En preparación');
UPDATE "order_item" SET "dish_status" = 'Served' WHERE "dish_status" = 'Servido';
UPDATE "order_item" SET "dish_status" = 'Cancelled' WHERE "dish_status" = 'Cancelado';

UPDATE "sales_invoice" SET "status" = 'Issued' WHERE "status" = 'Emitido';
UPDATE "sales_invoice" SET "status" = 'Cancelled' WHERE "status" IN ('Anulado', 'Cancelado');
