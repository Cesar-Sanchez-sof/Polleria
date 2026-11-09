# Reporte de evaluación Text-to-SQL

| Agente | Casos | EM | EX | VES | TS | Ejecutadas | Errores |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini | 40 | 0.00% | 15.00% | 0.1481 | N/D | 6 | 34 |

**gemini**: EM compara SQL normalizado. EX compara los resultados gold/generado ignorando el orden de filas y las etiquetas de columnas. VES es la media de `sqrt(tiempo_gold / tiempo_generado)`, limitada a 1; las respuestas incorrectas valen 0.

TS = N/D: no se configuraron bases/estados alternativos para ejecutar una suite de pruebas.

<details><summary>TEST-001 — EM=X, EX=True, VES=0.949873</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-01-01' AND si.issued_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total_emitido FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at <= CAST('2026-01-31' AS DATE) LIMIT 50
```

</details>

<details><summary>TEST-002 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-01-01' AND si.issued_at < DATE '2026-02-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at <= CAST('2026-01-31' AS DATE) GROUP BY si.voucher_type LIMIT 50
```

</details>

<details><summary>TEST-003 — EM=X, EX=True, VES=0.991581</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-01-01' AND sp.paid_at < DATE '2026-02-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= '2026-01-01 00:00:00' AND sp.paid_at <= '2026-01-31 23:59:59' GROUP BY pt.name LIMIT 50
```

</details>

<details><summary>TEST-004 — EM=X, EX=True, VES=0.990311</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type ILIKE '%llevar%' AND so.status ILIKE '%cerrado%' AND so.ordered_at >= CAST('2026-01-01' AS DATE) AND so.ordered_at < CAST('2026-02-01' AS DATE) LIMIT 50
```

</details>

<details><summary>TEST-005 — EM=X, EX=True, VES=0.99313</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
```

**SQL generada**

```sql
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.sales_order AS so ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'closed' AND so.ordered_at >= CAST('2026-01-01' AS DATE) AND so.ordered_at < CAST('2026-02-01' AS DATE) GROUP BY p.id, p.name ORDER BY total_unidades DESC LIMIT 50
```

</details>

<details><summary>TEST-006 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-007 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-008 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-009 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-010 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-01-01' AND pp.paid_at < DATE '2026-02-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-011 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-01-01' AND ip.date < DATE '2026-02-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
SELECT ip.expense_category AS categoria, SUM(ip.amount_paid) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-01-01' AS DATE) AND ip.date <= CAST('2026-01-31' AS DATE) GROUP BY ip.expense_category LIMIT 50
```

</details>

<details><summary>TEST-012 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-01-01' AND po.issued_at < DATE '2026-02-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-013 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-01-01' AND po.issued_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-014 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
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

<details><summary>TEST-016 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-017 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-018 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
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

<details><summary>TEST-020 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-021 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-022 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-023 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-024 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-025 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-026 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-01-01' AND t.date < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-027 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-01-01' AND t.date < DATE '2026-02-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-028 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-029 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-030 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-031 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-032 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT je.id, je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-033 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '1%' AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-034 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-035 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-02-01' AND ap.end_date >= DATE '2026-01-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-036 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-02-01' AND si.issued_at < DATE '2026-03-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-037 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-02-01' AND si.issued_at < DATE '2026-03-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-038 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-02-01' AND sp.paid_at < DATE '2026-03-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-039 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-02-01' AND so.ordered_at < DATE '2026-03-01' LIMIT 50
```

**SQL generada**

```sql
[SIN SQL]
```

</details>

<details><summary>TEST-040 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-02-01' AND so.ordered_at < DATE '2026-03-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
```

**SQL generada**

```sql
[SIN SQL]
```

</details>
