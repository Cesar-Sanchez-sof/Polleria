-- La tabla permission no se usaba en ninguna parte del sistema: se vacía
-- para poder añadir columnas obligatorias. El seed la repuebla desde el catálogo.
DELETE FROM "permission";

ALTER TABLE "permission"
  ADD COLUMN "code"   VARCHAR(60) NOT NULL,
  ADD COLUMN "module" VARCHAR(40) NOT NULL,
  ADD COLUMN "action" VARCHAR(20) NOT NULL;

CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- Rol de sistema: no se puede renombrar, desactivar ni eliminar.
ALTER TABLE "role" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;
UPDATE "role" SET "is_system" = true WHERE "name" = 'ADMIN';