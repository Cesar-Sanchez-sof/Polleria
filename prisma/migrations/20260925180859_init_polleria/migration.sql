-- CreateEnum
CREATE TYPE "tipo_persona_enum" AS ENUM ('Natural', 'Juridico');

-- CreateTable
CREATE TABLE "rol" (
    "id_rol" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(150),
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id_permiso" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id_permiso")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "id_rolPermiso" SERIAL NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "id_rol" INTEGER NOT NULL,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("id_rolPermiso")
);

-- CreateTable
CREATE TABLE "turno" (
    "id_turno" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id_turno")
);

-- CreateTable
CREATE TABLE "empleado" (
    "id_empleado" SERIAL NOT NULL,
    "id_turno" INTEGER,
    "dni" VARCHAR(8) NOT NULL,
    "primer_nombre" VARCHAR(50) NOT NULL,
    "segundo_nombre" VARCHAR(50),
    "apellido_paterno" VARCHAR(50) NOT NULL,
    "apellido_materno" VARCHAR(50),
    "telefono" VARCHAR(9),
    "direccion" VARCHAR(200),
    "fecha_nacimiento" DATE,
    "fecha_ingreso" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cargo" VARCHAR(30),
    "area" VARCHAR(30),
    "tipo_contrato" VARCHAR(30),
    "sueldo_base" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id_empleado")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_bloqueo" TIMESTAMP(6),
    "ultimo_acceso" TIMESTAMP(6),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "planilla" (
    "id_planilla" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "mes" SMALLINT NOT NULL,
    "anio" SMALLINT NOT NULL,
    "sueldo_base" DECIMAL(7,2) NOT NULL,
    "hora_extra" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "bonificacion" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "descuentos" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "neto_pagar" DECIMAL(7,2) NOT NULL,
    "fecha_pago" DATE,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "planilla_pkey" PRIMARY KEY ("id_planilla")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id_proveedor" SERIAL NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "nombre_comercial" VARCHAR(150),
    "razon_social" VARCHAR(150) NOT NULL,
    "nombre" VARCHAR(100),
    "direccion" VARCHAR(150),
    "telefono" VARCHAR(9),
    "correo" VARCHAR(80),
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "tipo_pago" (
    "id_tipo_pago" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_pago_pkey" PRIMARY KEY ("id_tipo_pago")
);

-- CreateTable
CREATE TABLE "orden_compra" (
    "id_orden_compra" SERIAL NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "numero_orden" VARCHAR(20) NOT NULL,
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_esperada" DATE,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "subtotal" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "igv" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(200),

    CONSTRAINT "orden_compra_pkey" PRIMARY KEY ("id_orden_compra")
);

-- CreateTable
CREATE TABLE "insumo" (
    "id_insumo" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "unidad_medida" VARCHAR(10) NOT NULL,
    "stock_actual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "insumo_pkey" PRIMARY KEY ("id_insumo")
);

-- CreateTable
CREATE TABLE "detalle_orden_compra" (
    "id_detalle_orden_compra" SERIAL NOT NULL,
    "id_orden_compra" INTEGER NOT NULL,
    "id_insumo" INTEGER NOT NULL,
    "cantidad_pedida" DECIMAL(10,2) NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "detalle_orden_compra_pkey" PRIMARY KEY ("id_detalle_orden_compra")
);

-- CreateTable
CREATE TABLE "recepcion_compra" (
    "id_recepcion" SERIAL NOT NULL,
    "id_orden_compra" INTEGER NOT NULL,
    "id_empleado_recepcion" INTEGER NOT NULL,
    "fecha_recepcion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacion" VARCHAR(200),
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recepcion_compra_pkey" PRIMARY KEY ("id_recepcion")
);

-- CreateTable
CREATE TABLE "detalle_recepcion_compra" (
    "id_detalle_recepcion_compra" SERIAL NOT NULL,
    "id_recepcion" INTEGER NOT NULL,
    "id_detalle_orden_compra" INTEGER NOT NULL,
    "cantidad_recibida" DECIMAL(10,2) NOT NULL,
    "obsevacion" VARCHAR(100),

    CONSTRAINT "detalle_recepcion_compra_pkey" PRIMARY KEY ("id_detalle_recepcion_compra")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id_movimiento_inventario" SERIAL NOT NULL,
    "id_insumo" INTEGER NOT NULL,
    "id_detalle_recepcion_compra" INTEGER,
    "tipo_movimiento" VARCHAR(10) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "motivo" VARCHAR(15),
    "fecha_movimiento" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id_movimiento_inventario")
);

-- CreateTable
CREATE TABLE "comprobante_compra" (
    "id_comprobante_compra" SERIAL NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "id_recepcion" INTEGER NOT NULL,
    "tipo_comprobante" VARCHAR(10) NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "igv" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "monto_total" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "comprobante_compra_pkey" PRIMARY KEY ("id_comprobante_compra")
);

-- CreateTable
CREATE TABLE "pago_compra" (
    "id_pago_compra" SERIAL NOT NULL,
    "id_comprobante_compra" INTEGER NOT NULL,
    "id_tipo_pago" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_pago" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_compra_pkey" PRIMARY KEY ("id_pago_compra")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id_cliente" SERIAL NOT NULL,
    "nro_doc" VARCHAR(11) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100),
    "telefono" VARCHAR(20),
    "tipo_persona" "tipo_persona_enum" NOT NULL DEFAULT 'Natural',
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "mesa" (
    "id_mesa" SERIAL NOT NULL,
    "numero" SMALLINT NOT NULL,
    "aforo" SMALLINT NOT NULL DEFAULT 4,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mesa_pkey" PRIMARY KEY ("id_mesa")
);

-- CreateTable
CREATE TABLE "plato" (
    "id_plato" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(7,2) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plato_pkey" PRIMARY KEY ("id_plato")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id_pedido" SERIAL NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "tipo_pedido" VARCHAR(10) NOT NULL,
    "fecha_pedido" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Pendiente',

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id_pedido")
);

-- CreateTable
CREATE TABLE "pedido_mesa" (
    "id_pedido_mesa" SERIAL NOT NULL,
    "id_mesa" INTEGER NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "observacion" VARCHAR(100),

    CONSTRAINT "pedido_mesa_pkey" PRIMARY KEY ("id_pedido_mesa")
);

-- CreateTable
CREATE TABLE "detalle_pedido" (
    "id_detalle_pedido" SERIAL NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "id_plato" INTEGER NOT NULL,
    "cantidad" SMALLINT NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "sub_total" DECIMAL(10,2) NOT NULL,
    "estado_plato" VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    "observaciones" VARCHAR(100),

    CONSTRAINT "detalle_pedido_pkey" PRIMARY KEY ("id_detalle_pedido")
);

-- CreateTable
CREATE TABLE "comprobante_venta" (
    "id_comprobante_venta" SERIAL NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "tipo_comprobante" VARCHAR(10) NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "igv" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monto_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Emitido',

    CONSTRAINT "comprobante_venta_pkey" PRIMARY KEY ("id_comprobante_venta")
);

-- CreateTable
CREATE TABLE "pago_venta" (
    "id_pago_venta" SERIAL NOT NULL,
    "id_comprobante_venta" INTEGER NOT NULL,
    "id_tipo_pago" INTEGER NOT NULL,
    "monto" DECIMAL(7,2) NOT NULL,
    "fecha_pago" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_venta_pkey" PRIMARY KEY ("id_pago_venta")
);

-- CreateTable
CREATE TABLE "cuenta_contable" (
    "id_cuenta_contable" SERIAL NOT NULL,
    "id_cuenta_padre" INTEGER,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_contable_pkey" PRIMARY KEY ("id_cuenta_contable")
);

-- CreateTable
CREATE TABLE "asiento_contable" (
    "id_asiento_contable" SERIAL NOT NULL,
    "id_comprobante_venta" INTEGER,
    "id_comprobante_compra" INTEGER,
    "id_planilla" INTEGER,
    "fecha_contable" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "glosa" VARCHAR(200) NOT NULL,
    "responsable" VARCHAR(100),
    "fecha_creacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "codigo" VARCHAR(20) NOT NULL,
    "observacion" VARCHAR(200),

    CONSTRAINT "asiento_contable_pkey" PRIMARY KEY ("id_asiento_contable")
);

-- CreateTable
CREATE TABLE "detalle_asiento_contable" (
    "id_detalle_asiento_contable" SERIAL NOT NULL,
    "id_asiento_contable" INTEGER NOT NULL,
    "id_cuenta_contable" INTEGER NOT NULL,
    "debito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credito" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "detalle_asiento_contable_pkey" PRIMARY KEY ("id_detalle_asiento_contable")
);

-- CreateIndex
CREATE INDEX "idx_rolpermiso_rol" ON "rol_permiso"("id_rol");

-- CreateIndex
CREATE INDEX "idx_rolpermiso_permiso" ON "rol_permiso"("id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rol_permiso" ON "rol_permiso"("id_rol", "id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "empleado_dni_key" ON "empleado"("dni");

-- CreateIndex
CREATE INDEX "idx_empleado_turno" ON "empleado"("id_turno");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_username_key" ON "usuario"("username");

-- CreateIndex
CREATE INDEX "idx_usuario_empleado" ON "usuario"("id_empleado");

-- CreateIndex
CREATE INDEX "idx_usuario_rol" ON "usuario"("id_rol");

-- CreateIndex
CREATE INDEX "idx_planilla_empleado" ON "planilla"("id_empleado");

-- CreateIndex
CREATE UNIQUE INDEX "uq_planilla_periodo" ON "planilla"("id_empleado", "mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_ruc_key" ON "proveedor"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_numero_orden_key" ON "orden_compra"("numero_orden");

-- CreateIndex
CREATE INDEX "idx_ordencompra_proveedor" ON "orden_compra"("id_proveedor");

-- CreateIndex
CREATE INDEX "idx_ordencompra_empleado" ON "orden_compra"("id_empleado");

-- CreateIndex
CREATE INDEX "idx_detordencompra_orden" ON "detalle_orden_compra"("id_orden_compra");

-- CreateIndex
CREATE INDEX "idx_detordencompra_insumo" ON "detalle_orden_compra"("id_insumo");

-- CreateIndex
CREATE INDEX "idx_recepcioncompra_orden" ON "recepcion_compra"("id_orden_compra");

-- CreateIndex
CREATE INDEX "idx_recepcioncompra_empleado" ON "recepcion_compra"("id_empleado_recepcion");

-- CreateIndex
CREATE INDEX "idx_detrecepcion_recepcion" ON "detalle_recepcion_compra"("id_recepcion");

-- CreateIndex
CREATE INDEX "idx_detrecepcion_detorden" ON "detalle_recepcion_compra"("id_detalle_orden_compra");

-- CreateIndex
CREATE INDEX "idx_movinventario_insumo" ON "movimiento_inventario"("id_insumo");

-- CreateIndex
CREATE INDEX "idx_movinventario_detrecep" ON "movimiento_inventario"("id_detalle_recepcion_compra");

-- CreateIndex
CREATE INDEX "idx_comprobcompra_proveedor" ON "comprobante_compra"("id_proveedor");

-- CreateIndex
CREATE INDEX "idx_comprobcompra_recepcion" ON "comprobante_compra"("id_recepcion");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comprobante_compra" ON "comprobante_compra"("id_proveedor", "tipo_comprobante", "serie", "numero");

-- CreateIndex
CREATE INDEX "idx_pagocompra_comprobante" ON "pago_compra"("id_comprobante_compra");

-- CreateIndex
CREATE INDEX "idx_pagocompra_tipopago" ON "pago_compra"("id_tipo_pago");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cliente_doc" ON "cliente"("tipo_persona", "nro_doc");

-- CreateIndex
CREATE UNIQUE INDEX "mesa_numero_key" ON "mesa"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_codigo_key" ON "pedido"("codigo");

-- CreateIndex
CREATE INDEX "idx_pedidomesa_mesa" ON "pedido_mesa"("id_mesa");

-- CreateIndex
CREATE INDEX "idx_pedidomesa_pedido" ON "pedido_mesa"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_detpedido_pedido" ON "detalle_pedido"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_detpedido_plato" ON "detalle_pedido"("id_plato");

-- CreateIndex
CREATE INDEX "idx_comprobventa_pedido" ON "comprobante_venta"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_comprobventa_cliente" ON "comprobante_venta"("id_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comprobante_venta" ON "comprobante_venta"("tipo_comprobante", "serie", "numero");

-- CreateIndex
CREATE INDEX "idx_pagoventa_comprobante" ON "pago_venta"("id_comprobante_venta");

-- CreateIndex
CREATE INDEX "idx_pagoventa_tipopago" ON "pago_venta"("id_tipo_pago");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_contable_codigo_key" ON "cuenta_contable"("codigo");

-- CreateIndex
CREATE INDEX "idx_cuentacontable_padre" ON "cuenta_contable"("id_cuenta_padre");

-- CreateIndex
CREATE UNIQUE INDEX "asiento_contable_codigo_key" ON "asiento_contable"("codigo");

-- CreateIndex
CREATE INDEX "idx_asiento_compventa" ON "asiento_contable"("id_comprobante_venta");

-- CreateIndex
CREATE INDEX "idx_asiento_compcompra" ON "asiento_contable"("id_comprobante_compra");

-- CreateIndex
CREATE INDEX "idx_asiento_planilla" ON "asiento_contable"("id_planilla");

-- CreateIndex
CREATE INDEX "idx_detasiento_asiento" ON "detalle_asiento_contable"("id_asiento_contable");

-- CreateIndex
CREATE INDEX "idx_detasiento_cuenta" ON "detalle_asiento_contable"("id_cuenta_contable");

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_id_turno_fkey" FOREIGN KEY ("id_turno") REFERENCES "turno"("id_turno") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleado"("id_empleado") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planilla" ADD CONSTRAINT "planilla_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleado"("id_empleado") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleado"("id_empleado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_orden_compra" ADD CONSTRAINT "detalle_orden_compra_id_orden_compra_fkey" FOREIGN KEY ("id_orden_compra") REFERENCES "orden_compra"("id_orden_compra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_orden_compra" ADD CONSTRAINT "detalle_orden_compra_id_insumo_fkey" FOREIGN KEY ("id_insumo") REFERENCES "insumo"("id_insumo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_compra" ADD CONSTRAINT "recepcion_compra_id_orden_compra_fkey" FOREIGN KEY ("id_orden_compra") REFERENCES "orden_compra"("id_orden_compra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_compra" ADD CONSTRAINT "recepcion_compra_id_empleado_recepcion_fkey" FOREIGN KEY ("id_empleado_recepcion") REFERENCES "empleado"("id_empleado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_recepcion_compra" ADD CONSTRAINT "detalle_recepcion_compra_id_recepcion_fkey" FOREIGN KEY ("id_recepcion") REFERENCES "recepcion_compra"("id_recepcion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_recepcion_compra" ADD CONSTRAINT "detalle_recepcion_compra_id_detalle_orden_compra_fkey" FOREIGN KEY ("id_detalle_orden_compra") REFERENCES "detalle_orden_compra"("id_detalle_orden_compra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_insumo_fkey" FOREIGN KEY ("id_insumo") REFERENCES "insumo"("id_insumo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_detalle_recepcion_compra_fkey" FOREIGN KEY ("id_detalle_recepcion_compra") REFERENCES "detalle_recepcion_compra"("id_detalle_recepcion_compra") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_compra" ADD CONSTRAINT "comprobante_compra_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_compra" ADD CONSTRAINT "comprobante_compra_id_recepcion_fkey" FOREIGN KEY ("id_recepcion") REFERENCES "recepcion_compra"("id_recepcion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_compra" ADD CONSTRAINT "pago_compra_id_comprobante_compra_fkey" FOREIGN KEY ("id_comprobante_compra") REFERENCES "comprobante_compra"("id_comprobante_compra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_compra" ADD CONSTRAINT "pago_compra_id_tipo_pago_fkey" FOREIGN KEY ("id_tipo_pago") REFERENCES "tipo_pago"("id_tipo_pago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_mesa" ADD CONSTRAINT "pedido_mesa_id_mesa_fkey" FOREIGN KEY ("id_mesa") REFERENCES "mesa"("id_mesa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_mesa" ADD CONSTRAINT "pedido_mesa_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedido" ADD CONSTRAINT "detalle_pedido_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedido" ADD CONSTRAINT "detalle_pedido_id_plato_fkey" FOREIGN KEY ("id_plato") REFERENCES "plato"("id_plato") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_venta" ADD CONSTRAINT "comprobante_venta_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_venta" ADD CONSTRAINT "comprobante_venta_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_venta" ADD CONSTRAINT "pago_venta_id_comprobante_venta_fkey" FOREIGN KEY ("id_comprobante_venta") REFERENCES "comprobante_venta"("id_comprobante_venta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_venta" ADD CONSTRAINT "pago_venta_id_tipo_pago_fkey" FOREIGN KEY ("id_tipo_pago") REFERENCES "tipo_pago"("id_tipo_pago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_contable" ADD CONSTRAINT "cuenta_contable_id_cuenta_padre_fkey" FOREIGN KEY ("id_cuenta_padre") REFERENCES "cuenta_contable"("id_cuenta_contable") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_contable" ADD CONSTRAINT "asiento_contable_id_comprobante_venta_fkey" FOREIGN KEY ("id_comprobante_venta") REFERENCES "comprobante_venta"("id_comprobante_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_contable" ADD CONSTRAINT "asiento_contable_id_comprobante_compra_fkey" FOREIGN KEY ("id_comprobante_compra") REFERENCES "comprobante_compra"("id_comprobante_compra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_contable" ADD CONSTRAINT "asiento_contable_id_planilla_fkey" FOREIGN KEY ("id_planilla") REFERENCES "planilla"("id_planilla") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_asiento_contable" ADD CONSTRAINT "detalle_asiento_contable_id_asiento_contable_fkey" FOREIGN KEY ("id_asiento_contable") REFERENCES "asiento_contable"("id_asiento_contable") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_asiento_contable" ADD CONSTRAINT "detalle_asiento_contable_id_cuenta_contable_fkey" FOREIGN KEY ("id_cuenta_contable") REFERENCES "cuenta_contable"("id_cuenta_contable") ON DELETE RESTRICT ON UPDATE CASCADE;
