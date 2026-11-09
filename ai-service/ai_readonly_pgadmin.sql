-- Rol de solo lectura del asistente. Sincronizado con agents-service/knowledge/allowlist.readonly_erp.json
-- (readonly-erp-provisional-2026-10-24b), rol contador_demo.
-- REVISAR antes de aplicar. Contrasena: variable de psql (reemplaza CAMBIAR_CONTRASENA), nunca en este archivo.
BEGIN;

CREATE ROLE ai_readonly LOGIN PASSWORD 'CAMBIAR_CONTRASENA'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 5;

REVOKE ALL ON SCHEMA public FROM ai_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ai_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ai_readonly;
GRANT USAGE ON SCHEMA public TO ai_readonly;

-- Solo SELECT y solo sobre las columnas de la allowlist para contador_demo
-- (nada de INSERT/UPDATE/DELETE/TRUNCATE).
GRANT SELECT (active, code, id, name, parent_id, type) ON public.accounting_account TO ai_readonly;
GRANT SELECT (closed_at, end_date, id, start_date, status) ON public.accounting_period TO ai_readonly;
GRANT SELECT (amount, created_at, id, reason, session_id, type) ON public.cash_movement TO ai_readonly;
GRANT SELECT (active, code, id, name) ON public.cash_register TO ai_readonly;
GRANT SELECT (cash_register_id, closed_at, counted_amount, difference, expected_amount, id, initial_amount, opened_at, sales_cash, sales_other, status, total_sales) ON public.cash_session TO ai_readonly;
GRANT SELECT (active, capacity, id, number) ON public.dining_table TO ai_readonly;
GRANT SELECT (amount_paid, annulled, date, expense_category, id, item_description, product_id, purchase_type, quantity) ON public.informal_purchase TO ai_readonly;
GRANT SELECT (id, informal_purchase_id, moved_at, movement_type, order_item_id, product_id, purchase_order_item_id, quantity, reason, transformation_item_id, unit_cost) ON public.inventory_movement TO ai_readonly;
GRANT SELECT (book, code, description, entry_date, id, period_id, purchase_invoice_id, sales_invoice_id, status, transformation_id) ON public.journal_entry TO ai_readonly;
GRANT SELECT (account_id, credit, debit, description, entry_id, id) ON public.journal_entry_detail TO ai_readonly;
GRANT SELECT (dish_status, id, order_id, product_id, quantity, subtotal, unit_price) ON public.order_item TO ai_readonly;
GRANT SELECT (id, order_id, table_id) ON public.order_table TO ai_readonly;
GRANT SELECT (active, id, name) ON public.payment_type TO ai_readonly;
GRANT SELECT (active, affectation_igv, average_cost, current_stock, id, last_cost, minimum_stock, name, price, sellable, type, unit_of_measure) ON public.product TO ai_readonly;
GRANT SELECT (active, id, ingredient_id, product_id, quantity_required) ON public.product_recipe TO ai_readonly;
GRANT SELECT (active, created_at, id, igv, issued_at, number, purchase_order_id, series, subtotal, supplier_id, total_amount, voucher_type) ON public.purchase_invoice TO ai_readonly;
GRANT SELECT (expected_at, id, igv, issued_at, order_number, received_at, status, subtotal, supplier_id, total) ON public.purchase_order TO ai_readonly;
GRANT SELECT (affectation_igv_applied, final_amount_line, id, igv_line, product_id, purchase_order_id, quantity_ordered, quantity_received, subtotal_line, unit_price) ON public.purchase_order_item TO ai_readonly;
GRANT SELECT (amount, id, paid_at, payment_type_id, purchase_invoice_id) ON public.purchase_payment TO ai_readonly;
GRANT SELECT (cash_session_id, created_at, customer_id, id, igv, issued_at, number, order_id, series, status, subtotal, total_amount, voucher_type) ON public.sales_invoice TO ai_readonly;
GRANT SELECT (code, id, order_type, ordered_at, status) ON public.sales_order TO ai_readonly;
GRANT SELECT (amount, id, paid_at, payment_type_id, sales_invoice_id) ON public.sales_payment TO ai_readonly;
GRANT SELECT (active, business_name, id) ON public.supplier TO ai_readonly;
GRANT SELECT (annulled, annulled_at, date, id) ON public.transformation TO ai_readonly;
GRANT SELECT (id, item_type, product_id, quantity, transformation_id, unit_cost) ON public.transformation_item TO ai_readonly;

-- Valores por defecto de toda sesion del rol (el Executor los vuelve a fijar por transaccion).
ALTER ROLE ai_readonly SET default_transaction_read_only = on;
ALTER ROLE ai_readonly SET statement_timeout = '5s';
ALTER ROLE ai_readonly SET lock_timeout = '2s';
ALTER ROLE ai_readonly SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE ai_readonly SET row_security = on;
ALTER ROLE ai_readonly SET search_path = public, pg_catalog;

COMMIT;
