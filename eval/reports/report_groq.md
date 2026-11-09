# Reporte de evaluación Text-to-SQL

| Agente | Casos | EM | EX | VES | TS | Ejecutadas | Errores |
|---|---:|---:|---:|---:|---:|---:|---:|
| groq | 19 | 0.00% | 84.21% | 0.8095 | N/D | 16 | 3 |

**groq**: EM compara SQL normalizado. EX compara los resultados gold/generado ignorando el orden de filas y las etiquetas de columnas. VES es la media de `sqrt(tiempo_gold / tiempo_generado)`, limitada a 1; las respuestas incorrectas valen 0.

TS = N/D: no se configuraron bases/estados alternativos para ejecutar una suite de pruebas.

<details><summary>TEST-001 — EM=X, EX=True, VES=0.801628</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-01-01' AND si.issued_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at <= CAST('2026-01-31' AS DATE) LIMIT 50
```

</details>

<details><summary>TEST-002 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-01-01' AND si.issued_at < DATE '2026-02-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-003 — EM=X, EX=True, VES=0.991034</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-01-01' AND sp.paid_at < DATE '2026-02-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

</details>

<details><summary>TEST-004 — EM=X, EX=True, VES=0.976104</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.status ILIKE '%cerrado%' AND so.order_type ILIKE '%para llevar%' AND EXTRACT(YEAR FROM so.ordered_at) = 2026 AND EXTRACT(MONTH FROM so.ordered_at) = 1 LIMIT 50
```

</details>

<details><summary>TEST-005 — EM=X, EX=True, VES=0.991551</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
```

**SQL generada**

```sql
SELECT p.id AS id, p.name AS name, SUM(oi.quantity) AS total_units FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-01-01' AS DATE) AND so.ordered_at < CAST('2026-02-01' AS DATE) GROUP BY p.id, p.name ORDER BY total_units DESC LIMIT 50
```

</details>

<details><summary>TEST-006 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT so.order_type AS canal_pedido, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) GROUP BY so.order_type LIMIT 50
```

</details>

<details><summary>TEST-007 — EM=X, EX=True, VES=0.859417</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
```

**SQL generada**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number ORDER BY mesa LIMIT 50
```

</details>

<details><summary>TEST-008 — EM=X, EX=True, VES=0.983194</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at <= CAST('2026-01-31' AS DATE) LIMIT 50
```

</details>

<details><summary>TEST-009 — EM=X, EX=True, VES=0.964557</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE DATE_TRUNC('MONTH', pi.issued_at) = CAST('2026-01-01' AS DATE) GROUP BY s.business_name LIMIT 50
```

</details>

<details><summary>TEST-010 — EM=X, EX=True, VES=0.958381</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-01-01' AND pp.paid_at < DATE '2026-02-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at < CAST('2026-02-01' AS DATE) GROUP BY pt.name LIMIT 50
```

</details>

<details><summary>TEST-011 — EM=X, EX=True, VES=0.998362</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-01-01' AND ip.date < DATE '2026-02-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT ip.expense_category AS expense_category, SUM(ip.amount_paid) AS total_gasto FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-01-01' AS DATE) AND ip.date <= CAST('2026-01-31' AS DATE) GROUP BY ip.expense_category LIMIT 50
```

</details>

<details><summary>TEST-012 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-01-01' AND po.issued_at < DATE '2026-02-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT po.status AS status, COUNT(*) AS total FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-01-01' AS DATE) AND po.issued_at <= CAST('2026-01-31' AS DATE) GROUP BY po.status LIMIT 50
```

</details>

<details><summary>TEST-013 — EM=X, EX=True, VES=0.986249</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-01-01' AND po.issued_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
```

**SQL generada**

```sql
SELECT p.id AS product_id, p.name AS product_name, COALESCE(SUM(poi.quantity_received), 0) AS total_received FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-01-01' AS DATE) AND po.issued_at < CAST('2026-02-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

</details>

<details><summary>TEST-014 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**SQL generada**

```sql
SELECT pi.id AS id, pi.series AS series, pi.number AS number, pi.total_amount AS total_amount, COALESCE(SUM(pp.amount), 0) AS paid, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS pending FROM public.purchase_invoice AS pi LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at <= CAST('2026-01-31' AS DATE) GROUP BY pi.id, pi.series, pi.number, pi.total_amount HAVING COALESCE(SUM(pp.amount), 0) < pi.total_amount LIMIT 50
```

</details>

<details><summary>TEST-015 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-016 — EM=X, EX=True, VES=0.973041</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.credit), 0) AS total_ingresos FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.book ILIKE '%caja%' AND aa.type = 'Ingreso' AND je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE LIMIT 50
```

</details>

<details><summary>TEST-017 — EM=X, EX=True, VES=0.985207</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
```

**SQL generada**

```sql
SELECT cr.name AS name, COUNT(cs.id) AS closed_sessions FROM public.cash_register AS cr JOIN public.cash_session AS cs ON cs.cash_register_id = cr.id WHERE cs.closed_at IS NOT NULL AND cs.closed_at >= CAST('2026-01-01' AS DATE) AND cs.closed_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name LIMIT 50
```

</details>

<details><summary>TEST-018 — EM=X, EX=True, VES=0.912274</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
```

**SQL generada**

```sql
SELECT cs.cash_register_id AS caja_id, cr.name AS caja_nombre, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.opened_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cs.opened_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY cs.cash_register_id, cr.name LIMIT 50
```

</details>

<details><summary>TEST-019 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>
