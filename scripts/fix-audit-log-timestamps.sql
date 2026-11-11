-- Corrección OPCIONAL de filas antiguas de audit_log (historia "logs de auditoría con hora incorrecta").
--
-- Contexto: antes del fix, created_at se llenaba con el DEFAULT de la BD. Con la sesión en
-- America/Lima, ese default guardaba la HORA LOCAL de Lima en una columna `timestamp` sin zona,
-- pero Prisma la lee como UTC -> los registros aparecían 5 horas ANTES de la hora real.
--
-- PASO 1: diagnóstico. Compara con una acción que tú recuerdes (p. ej. tu último login).
--   Si la hora mostrada en la pantalla de auditoría es 5 h menor que la real, el registro es afectado.
SELECT id, created_at, username, action, description
FROM audit_log
ORDER BY id DESC
LIMIT 10;

-- PASO 2: corrige SOLO el tramo afectado. Ajusta el id inicial al primer registro afectado
-- (el primero creado desde que la BD usa timezone America/Lima, migración 20261107140000).
-- Ejecuta primero dentro de una transacción y verifica antes de hacer COMMIT.
--
-- BEGIN;
-- UPDATE audit_log
--    SET created_at = created_at + INTERVAL '5 hours'
--  WHERE id >= :primer_id_afectado;
-- SELECT id, created_at FROM audit_log ORDER BY id DESC LIMIT 5;  -- ¿coincide con la hora UTC real?
-- COMMIT;   -- o ROLLBACK;
