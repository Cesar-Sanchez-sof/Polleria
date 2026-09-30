-- Módulo de usuarios: correo único y estado activo/inactivo.
-- `correo` es opcional a nivel de BD para no romper usuarios ya existentes
-- (Postgres permite varios NULL en un índice único).
ALTER TABLE "usuario" ADD COLUMN "correo" VARCHAR(80);
ALTER TABLE "usuario" ADD COLUMN "estado" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- Roles base, solo si la tabla está vacía, para poder registrar usuarios.
INSERT INTO "rol" ("nombre", "descripcion", "estado")
SELECT v.nombre, v.descripcion, true
FROM (VALUES
  ('Administrador', 'Acceso total al sistema'),
  ('Cajero', 'Caja y ventas'),
  ('Mesero', 'Atención de mesas y pedidos'),
  ('Cocina', 'Preparación de pedidos')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM "rol");