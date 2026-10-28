-- Rol de solo lectura del asistente. Generado desde la allowlist readonly-erp-provisional-2026-10-13.
-- REVISAR antes de aplicar. Contrasena: variable de psql (reemplaza CAMBIAR_CONTRASENA), nunca en este archivo.
BEGIN;

CREATE ROLE ai_readonly LOGIN PASSWORD 'CAMBIAR_CONTRASENA'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 5;

REVOKE ALL ON SCHEMA public FROM ai_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ai_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ai_readonly;
GRANT USAGE ON SCHEMA public TO ai_readonly;

-- Solo SELECT y solo sobre las columnas de la allowlist (nada de INSERT/UPDATE/DELETE/TRUNCATE).
GRANT SELECT (active, code, id, name, parent_id, type) ON public.accounting_account TO ai_readonly;
GRANT SELECT (book, code, description, entry_date, id, status) ON public.journal_entry TO ai_readonly;
GRANT SELECT (account_id, credit, debit, description, entry_id, id) ON public.journal_entry_detail TO ai_readonly;

-- Valores por defecto de toda sesion del rol (el Executor los vuelve a fijar por transaccion).
ALTER ROLE ai_readonly SET default_transaction_read_only = on;
ALTER ROLE ai_readonly SET statement_timeout = '5s';
ALTER ROLE ai_readonly SET lock_timeout = '2s';
ALTER ROLE ai_readonly SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE ai_readonly SET row_security = on;
ALTER ROLE ai_readonly SET search_path = public, pg_catalog;

COMMIT;
