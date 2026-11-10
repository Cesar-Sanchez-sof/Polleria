# Reporte de evaluación Text-to-SQL

| Agente | Casos | EM | EX | VES | TS | Ejecutadas | Errores |
|---|---:|---:|---:|---:|---:|---:|---:|
| groq | 60 | 0.00% | 58.33% | 0.5760 | N/D | 56 | 4 |

**groq**: EM compara SQL normalizado. EX compara los resultados gold/generado ignorando el orden de filas y las etiquetas de columnas. VES es la media de `sqrt(tiempo_gold / tiempo_generado)`, limitada a 1; las respuestas incorrectas valen 0.

TS = N/D: no se configuraron bases/estados alternativos para ejecutar una suite de pruebas.

<details><summary>TEST-019 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "diferencia": "-5.00"
  }
]
```

**SQL generada**

```sql
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-020 — EM=X, EX=True, VES=0.987753</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "type": "INCOME",
    "total": "120.00"
  },
  {
    "type": "EXPENSE",
    "total": "45.00"
  }
]
```

**SQL generada**

```sql
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.created_at >= CAST('2026-01-01' AS DATE) AND cm.created_at < CAST('2026-02-01' AS DATE) GROUP BY cm.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "INCOME",
    "total_movido": "120.00"
  },
  {
    "tipo_movimiento": "EXPENSE",
    "total_movido": "45.00"
  }
]
```

</details>

<details><summary>TEST-021 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja de Prueba",
    "egresos": "45.00"
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresado FROM public.cash_movement AS cm JOIN public.cash_register AS cr ON cm.session_id = (SELECT cs.id AS id FROM public.cash_session AS cs WHERE cs.cash_register_id = cr.id LIMIT 1) WHERE cm.amount < 0 AND cm.created_at >= CAST('2026-01-01' AS DATE) AND cm.created_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[]
```

</details>

<details><summary>TEST-022 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "movement_type": "Purchase",
    "movimientos": 1,
    "cantidad": "20.00"
  },
  {
    "movement_type": "Sale",
    "movimientos": 1,
    "cantidad": "2.00"
  },
  {
    "movement_type": "Shrinkage",
    "movimientos": 1,
    "cantidad": "1.00"
  },
  {
    "movement_type": "Adjustment",
    "movimientos": 1,
    "cantidad": "3.00"
  }
]
```

**SQL generada**

```sql
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "Purchase",
    "total_movimientos": "1",
    "cantidad_total": "20.00"
  },
  {
    "tipo_movimiento": "Sale",
    "total_movimientos": "1",
    "cantidad_total": "2.00"
  },
  {
    "tipo_movimiento": "Shrinkage",
    "total_movimientos": "1",
    "cantidad_total": "1.00"
  },
  {
    "tipo_movimiento": "Adjustment",
    "total_movimientos": "1",
    "cantidad_total": "3.00"
  }
]
```

</details>

<details><summary>TEST-023 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo a la brasa de prueba",
    "cantidad": "2.00"
  }
]
```

**SQL generada**

```sql
SELECT p.id AS product_id, p.name AS product_name, COALESCE(SUM(im.quantity), 0) AS total_units FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "product_id": "22",
    "product_name": "Pollo a la brasa de prueba",
    "total_units": "2.00"
  }
]
```

</details>

<details><summary>TEST-001 — EM=X, EX=True, VES=0.966358</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-01-01' AND si.issued_at < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "165.00"
  }
]
```

**SQL generada**

```sql
SELECT SUM(si.total_amount) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at <= CAST('2026-01-31' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_comprobantes": "165.00"
  }
]
```

</details>

<details><summary>TEST-002 — EM=X, EX=True, VES=0.946489</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-01-01' AND si.issued_at < DATE '2026-02-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "voucher_type": "Boleta",
    "total": "110.00"
  },
  {
    "voucher_type": "Factura",
    "total": "55.00"
  }
]
```

**SQL generada**

```sql
SELECT si.voucher_type AS voucher_type, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "voucher_type": "Boleta",
    "total_facturado": "110.00"
  },
  {
    "voucher_type": "Factura",
    "total_facturado": "55.00"
  }
]
```

</details>

<details><summary>TEST-003 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-01-01' AND sp.paid_at < DATE '2026-02-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "medio": "Tarjeta",
    "total": "95.00"
  },
  {
    "medio": "Efectivo",
    "total": "70.00"
  }
]
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  },
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  }
]
```

</details>

<details><summary>TEST-004 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_pedidos_cerrados_para_llevar FROM public.sales_order AS so WHERE so.status ILIKE '%closed%' AND so.order_type ILIKE '%para llevar%' AND EXTRACT(YEAR FROM so.ordered_at) = 2026 AND EXTRACT(MONTH FROM so.ordered_at) = 1 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos_cerrados_para_llevar": "0"
  }
]
```

</details>

<details><summary>TEST-005 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo a la brasa de prueba",
    "unidades": 3
  }
]
```

**SQL generada**

```sql
SELECT p.id AS id, p.name AS name, SUM(oi.quantity) AS total_units FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY p.id, p.name ORDER BY total_units DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "id": "22",
    "name": "Pollo a la brasa de prueba",
    "total_units": "3"
  }
]
```

</details>

<details><summary>TEST-006 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "order_type": "Mesa",
    "total": "110.00"
  },
  {
    "order_type": "Llevar",
    "total": "55.00"
  }
]
```

**SQL generada**

```sql
SELECT so.order_type AS canal_pedido, SUM(si.total_amount) AS total_vendido FROM public.sales_order AS so JOIN public.sales_invoice AS si ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) GROUP BY so.order_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "canal_pedido": "Llevar",
    "total_vendido": "55.00"
  },
  {
    "canal_pedido": "Mesa",
    "total_vendido": "110.00"
  }
]
```

</details>

<details><summary>TEST-007 — EM=X, EX=True, VES=0.978277</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-01-01' AND so.ordered_at < DATE '2026-02-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "mesa": 99,
    "pedidos": 1
  }
]
```

**SQL generada**

```sql
SELECT dt.number AS mesa, COUNT(*) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number ORDER BY mesa LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "mesa": "99",
    "pedidos_cerrados": "1"
  }
]
```

</details>

<details><summary>TEST-008 — EM=X, EX=True, VES=0.971688</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "236.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at <= CAST('2026-01-31' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "236.00"
  }
]
```

</details>

<details><summary>TEST-009 — EM=X, EX=True, VES=0.961193</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total": "236.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at BETWEEN CAST('2026-01-01' AS DATE) AND CAST('2026-01-31' AS DATE) GROUP BY s.business_name ORDER BY total_comprado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total_comprado": "236.00"
  }
]
```

</details>

<details><summary>TEST-010 — EM=X, EX=True, VES=0.981402</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-01-01' AND pp.paid_at < DATE '2026-02-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "medio": "Efectivo",
    "total": "100.00"
  }
]
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE EXTRACT(YEAR FROM pp.paid_at) = 2026 AND EXTRACT(MONTH FROM pp.paid_at) = 1 GROUP BY pt.name ORDER BY total_pagado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Efectivo",
    "total_pagado": "100.00"
  }
]
```

</details>

<details><summary>TEST-011 — EM=X, EX=True, VES=0.958534</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-01-01' AND ip.date < DATE '2026-02-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "expense_category": "CleaningSupplies",
    "total": "38.00"
  }
]
```

**SQL generada**

```sql
SELECT ip.expense_category AS categoria, COALESCE(SUM(ip.amount_paid), 0) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-01-01' AS DATE) AND ip.date <= CAST('2026-01-31' AS DATE) GROUP BY ip.expense_category LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "categoria": "CleaningSupplies",
    "total_gastado": "38.00"
  }
]
```

</details>

<details><summary>TEST-012 — EM=X, EX=True, VES=0.9864</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-01-01' AND po.issued_at < DATE '2026-02-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "Pending",
    "total": 1
  },
  {
    "status": "FullyReceived",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-01-01' AS DATE) AND po.issued_at <= CAST('2026-01-31' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "estado": "Pending",
    "total_ordenes": "1"
  },
  {
    "estado": "FullyReceived",
    "total_ordenes": "1"
  }
]
```

</details>

<details><summary>TEST-013 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-01-01' AND po.issued_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero de prueba",
    "unidades": "20.00"
  }
]
```

**SQL generada**

```sql
SELECT poi.product_id AS producto, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id WHERE po.issued_at >= CAST('2026-01-01' AS DATE) AND po.issued_at <= CAST('2026-01-31' AS DATE) GROUP BY poi.product_id LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "21",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-014 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-01-01' AND pi.issued_at < DATE '2026-02-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990001,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT pi.id AS id, pi.series AS series, pi.number AS number, pi.total_amount AS total_amount, COALESCE(SUM(pp.amount), 0) AS paid, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS pending FROM public.purchase_invoice AS pi LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at <= CAST('2026-01-31' AS DATE) GROUP BY pi.id, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "id": "32",
    "series": "F026",
    "number": "990001",
    "total_amount": "236.00",
    "paid": "100.00",
    "pending": "136.00"
  }
]
```

</details>

<details><summary>TEST-015 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "45.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.amount < 0 AND cm.created_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "0"
  }
]
```

</details>

<details><summary>TEST-016 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-01-01' AND cm.created_at < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "120.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.credit), 0) AS total_ingresos FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.book ILIKE '%caja%' AND aa.type = 'Ingreso' AND je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "0"
  }
]
```

</details>

<details><summary>TEST-017 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja de Prueba",
    "sesiones": 1
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_register AS cr JOIN public.cash_session AS cs ON cs.cash_register_id = cr.id WHERE cs.closed_at >= CAST('2026-01-01' AS DATE) AND cs.closed_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "sesiones_cerradas": "1"
  }
]
```

</details>

<details><summary>TEST-018 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-01-01' AND cs.closed_at < DATE '2026-02-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros": "420.00"
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja, COALESCE(SUM(sp.amount), 0) AS total_registrado FROM public.sales_invoice AS si JOIN public.cash_session AS cs ON si.cash_session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id JOIN public.sales_payment AS sp ON sp.sales_invoice_id = si.id WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "total_registrado": "165.00"
  }
]
```

</details>

<details><summary>TEST-024 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero de prueba",
    "cantidad": "1.00"
  }
]
```

**SQL generada**

```sql
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad_merma FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY p.name ORDER BY cantidad_merma DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_merma": "1.00"
  }
]
```

</details>

<details><summary>TEST-025 — EM=X, EX=True, VES=0.984826</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero de prueba",
    "cantidad": "20.00"
  }
]
```

**SQL generada**

```sql
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "insumo": "Pollo entero de prueba",
    "cantidad": "20.00"
  }
]
```

</details>

<details><summary>TEST-026 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-01-01' AND t.date < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-01-01' AS DATE) AND t.date < CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_transformaciones": "1"
  }
]
```

</details>

<details><summary>TEST-027 — EM=X, EX=True, VES=0.976774</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-01-01' AND t.date < DATE '2026-02-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "item_type": "Consumo",
    "cantidad": "5.00"
  },
  {
    "item_type": "Producido",
    "cantidad": "2.00"
  }
]
```

**SQL generada**

```sql
SELECT ti.item_type AS item_type, SUM(ti.quantity) AS total_quantity FROM public.transformation AS t JOIN public.transformation_item AS ti ON ti.transformation_id = t.id WHERE t.date >= CAST('2026-01-01' AS DATE) AND t.date < CAST('2026-02-01' AS DATE) GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "item_type": "Consumo",
    "total_quantity": "5.00"
  },
  {
    "item_type": "Producido",
    "total_quantity": "2.00"
  }
]
```

</details>

<details><summary>TEST-028 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-01-01' AND im.moved_at < DATE '2026-02-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

**SQL generada**

```sql
SELECT p.id AS product_id, p.name AS product_name, COALESCE(SUM(im.quantity), 0) AS total_quantity FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "product_id": "21",
    "product_name": "Pollo entero de prueba",
    "total_quantity": "3.00"
  }
]
```

</details>

<details><summary>TEST-029 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total_debe": "200.00",
    "total_haber": "180.00"
  }
]
```

**SQL generada**

```sql
SELECT SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debit": "200.00",
    "total_credit": "180.00"
  }
]
```

</details>

<details><summary>TEST-030 — EM=X, EX=True, VES=0.998575</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "109001",
    "name": "Cuenta de activo de prueba del mes 1",
    "saldo": "200.00"
  },
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta": "109001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 1",
    "saldo_neto": "200.00"
  },
  {
    "cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  }
]
```

</details>

<details><summary>TEST-031 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "book": "Diario de prueba",
    "total": 2
  }
]
```

**SQL generada**

```sql
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE GROUP BY je.book ORDER BY total_asientos DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "diario": "Diario de prueba",
    "total_asientos": "2"
  }
]
```

</details>

<details><summary>TEST-032 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT je.id, je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "id": 192,
    "code": "BENCH26-01-02",
    "entry_date": "2026-01-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.id AS id, je.code AS code, je.entry_date AS entry_date, je.book AS book, COALESCE(SUM(jed.debit), 0) AS total_debit, COALESCE(SUM(jed.credit), 0) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date, je.book HAVING COALESCE(SUM(jed.debit), 0) <> COALESCE(SUM(jed.credit), 0) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "id": "192",
    "code": "BENCH26-01-02",
    "entry_date": "2026-01-23",
    "book": "Diario de prueba",
    "total_debit": "100.00",
    "total_credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-033 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '1%' AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "saldo": "200.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.id = 1 AND je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo_neto": "0"
  }
]
```

</details>

<details><summary>TEST-034 — EM=X, EX=True, VES=0.986196</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "type": "Activo",
    "total_debe": "200.00",
    "total_haber": "0.00"
  },
  {
    "type": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "100.00"
  },
  {
    "type": "Pasivo",
    "total_debe": "0.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date <= CAST('2026-01-31' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_cuenta": "Activo",
    "total_debe": "200.00",
    "total_haber": "0.00"
  },
  {
    "tipo_cuenta": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "100.00"
  },
  {
    "tipo_cuenta": "Pasivo",
    "total_debe": "0.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-035 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-02-01' AND ap.end_date >= DATE '2026-01-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": 1
  }
]
```

**SQL generada**

```sql
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-036 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-02-01' AND si.issued_at < DATE '2026-03-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "165.00"
  }
]
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-02-01' AS DATE) AND si.issued_at <= CAST('2026-02-28' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_comprobantes": "2"
  }
]
```

</details>

<details><summary>TEST-037 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-02-01' AND si.issued_at < DATE '2026-03-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "voucher_type": "Boleta",
    "total": "110.00"
  },
  {
    "voucher_type": "Factura",
    "total": "55.00"
  }
]
```

**SQL generada**

```sql
SELECT si.voucher_type AS tipo_comprobante, COALESCE(SUM(si.total_amount), 0) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-02-01' AS DATE) AND si.issued_at < CAST('2026-03-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_comprobante": "Boleta",
    "total_facturado": "110.00"
  },
  {
    "tipo_comprobante": "Factura",
    "total_facturado": "55.00"
  }
]
```

</details>

<details><summary>TEST-038 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-02-01' AND sp.paid_at < DATE '2026-03-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "medio": "Tarjeta",
    "total": "95.00"
  },
  {
    "medio": "Efectivo",
    "total": "70.00"
  }
]
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  },
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  }
]
```

</details>

<details><summary>TEST-039 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-02-01' AND so.ordered_at < DATE '2026-03-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type ILIKE '%para llevar%' AND so.status ILIKE '%cerrado%' AND CAST(DATE_TRUNC('MONTH', so.ordered_at) AS DATE) = CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "0"
  }
]
```

</details>

<details><summary>TEST-040 — EM=X, EX=True, VES=0.942962</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-02-01' AND so.ordered_at < DATE '2026-03-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo a la brasa de prueba",
    "unidades": 3
  }
]
```

**SQL generada**

```sql
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-02-01' AS DATE) AND so.ordered_at < CAST('2026-03-01' AS DATE) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "total_unidades": "3"
  }
]
```

</details>

<details><summary>TEST-041 — EM=X, EX=True, VES=0.985985</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-02-01' AND so.ordered_at < DATE '2026-03-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "order_type": "Mesa",
    "total": "110.00"
  },
  {
    "order_type": "Llevar",
    "total": "55.00"
  }
]
```

**SQL generada**

```sql
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE EXTRACT(YEAR FROM si.issued_at) = 2026 AND EXTRACT(MONTH FROM si.issued_at) = 2 GROUP BY so.order_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "canal": "Llevar",
    "total_vendido": "55.00"
  },
  {
    "canal": "Mesa",
    "total_vendido": "110.00"
  }
]
```

</details>

<details><summary>TEST-042 — EM=X, EX=True, VES=0.987696</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-02-01' AND so.ordered_at < DATE '2026-03-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "mesa": 99,
    "pedidos": 1
  }
]
```

**SQL generada**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-02-01' AS DATE) AND so.ordered_at < CAST('2026-03-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "mesa": "99",
    "pedidos_cerrados": "1"
  }
]
```

</details>

<details><summary>TEST-043 — EM=X, EX=True, VES=0.991888</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-02-01' AND pi.issued_at < DATE '2026-03-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "236.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-02-01' AS DATE) AND pi.issued_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total": "236.00"
  }
]
```

</details>

<details><summary>TEST-044 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-02-01' AND pi.issued_at < DATE '2026-03-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total": "236.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS business_name, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-02-01' AS DATE) AND pi.issued_at <= CAST('2026-02-28' AS DATE) GROUP BY s.business_name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "business_name": "Avícola Buen Sabor de Prueba",
    "total_comprado": "236.00"
  }
]
```

</details>

<details><summary>TEST-045 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-02-01' AND pp.paid_at < DATE '2026-03-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "medio": "Efectivo",
    "total": "100.00"
  }
]
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE EXTRACT(YEAR FROM pp.paid_at) = 2026 AND EXTRACT(MONTH FROM pp.paid_at) = 2 GROUP BY pt.name ORDER BY total_pagado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Efectivo",
    "total_pagado": "100.00"
  }
]
```

</details>

<details><summary>TEST-046 — EM=X, EX=True, VES=0.994911</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-02-01' AND ip.date < DATE '2026-03-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "expense_category": "CleaningSupplies",
    "total": "38.00"
  }
]
```

**SQL generada**

```sql
SELECT ip.expense_category AS expense_category, SUM(ip.amount_paid) AS total_gasto FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-02-01' AS DATE) AND ip.date <= CAST('2026-02-28' AS DATE) AND ip.annulled = FALSE GROUP BY ip.expense_category LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "expense_category": "CleaningSupplies",
    "total_gasto": "38.00"
  }
]
```

</details>

<details><summary>TEST-047 — EM=X, EX=True, VES=0.983016</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-02-01' AND po.issued_at < DATE '2026-03-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "Pending",
    "total": 1
  },
  {
    "status": "FullyReceived",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS status, COUNT(*) AS total FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-02-01' AS DATE) AND po.issued_at < CAST('2026-03-01' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "status": "Pending",
    "total": "1"
  },
  {
    "status": "FullyReceived",
    "total": "1"
  }
]
```

</details>

<details><summary>TEST-048 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-02-01' AND po.issued_at < DATE '2026-03-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero de prueba",
    "unidades": "20.00"
  }
]
```

**SQL generada**

```sql
SELECT p.id AS producto_id, p.name AS producto, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE EXTRACT(YEAR FROM po.issued_at) = 2026 AND EXTRACT(MONTH FROM po.issued_at) = 2 GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto_id": "21",
    "producto": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-049 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-02-01' AND pi.issued_at < DATE '2026-03-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990002,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT pi.id AS id, pi.series AS series, pi.number AS number, pi.total_amount AS total_amount, COALESCE(SUM(pp.amount), 0) AS paid_amount, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS pending_balance FROM public.purchase_invoice AS pi LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id JOIN public.accounting_period AS ap ON pi.id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-02-01' AS DATE) AND pi.issued_at <= CAST('2026-02-28' AS DATE) GROUP BY pi.id, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[]
```

</details>

<details><summary>TEST-050 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-02-01' AND cm.created_at < DATE '2026-03-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "45.00"
  }
]
```

**SQL generada**

```sql
SELECT SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm WHERE EXTRACT(YEAR FROM cm.created_at) = 2026 AND EXTRACT(MONTH FROM cm.created_at) = 2 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "165.00"
  }
]
```

</details>

<details><summary>TEST-051 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-02-01' AND cm.created_at < DATE '2026-03-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "120.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.credit), 0) AS total_ingresos FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.book ILIKE '%caja%' AND je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date <= CAST('2026-02-28' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "0"
  }
]
```

</details>

<details><summary>TEST-052 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-02-01' AND cs.closed_at < DATE '2026-03-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[]
```

**SQL generada**

```sql
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-053 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-02-01' AND cs.closed_at < DATE '2026-03-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL gold**

```json
[]
```

**SQL generada**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS total_efectivo, SUM(cs.sales_other) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE EXTRACT(YEAR FROM cs.opened_at) = 2026 AND EXTRACT(MONTH FROM cs.opened_at) = 2 GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "total_efectivo": "850.00",
    "total_otros": "420.00"
  }
]
```

</details>

<details><summary>TEST-054 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-02-01' AND cs.closed_at < DATE '2026-03-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "diferencia": "0"
  }
]
```

**SQL generada**

```sql
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-055 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-02-01' AND cm.created_at < DATE '2026-03-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "type": "INCOME",
    "total": "120.00"
  },
  {
    "type": "EXPENSE",
    "total": "45.00"
  }
]
```

**SQL generada**

```sql
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm WHERE EXTRACT(YEAR FROM cm.created_at) = 2026 AND EXTRACT(MONTH FROM cm.created_at) = 2 GROUP BY cm.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "INCOME",
    "total_movido": "120.00"
  },
  {
    "tipo_movimiento": "EXPENSE",
    "total_movido": "45.00"
  }
]
```

</details>

<details><summary>TEST-056 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-02-01' AND cm.created_at < DATE '2026-03-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja de Prueba",
    "egresos": "45.00"
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresado FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE EXTRACT(YEAR FROM cm.created_at) = 2026 AND EXTRACT(MONTH FROM cm.created_at) = 2 GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresado": "165.00"
  }
]
```

</details>

<details><summary>TEST-057 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-02-01' AND im.moved_at < DATE '2026-03-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "movement_type": "Sale",
    "movimientos": 1,
    "cantidad": "2.00"
  },
  {
    "movement_type": "Shrinkage",
    "movimientos": 1,
    "cantidad": "1.00"
  },
  {
    "movement_type": "Adjustment",
    "movimientos": 1,
    "cantidad": "3.00"
  },
  {
    "movement_type": "Purchase",
    "movimientos": 1,
    "cantidad": "20.00"
  }
]
```

**SQL generada**

```sql
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS cantidad_movimientos, SUM(im.quantity) AS total_cantidad FROM public.inventory_movement AS im WHERE EXTRACT(YEAR FROM im.moved_at) = 2026 AND EXTRACT(MONTH FROM im.moved_at) = 2 GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "Purchase",
    "cantidad_movimientos": "1",
    "total_cantidad": "20.00"
  },
  {
    "tipo_movimiento": "Sale",
    "cantidad_movimientos": "1",
    "total_cantidad": "2.00"
  },
  {
    "tipo_movimiento": "Shrinkage",
    "cantidad_movimientos": "1",
    "total_cantidad": "1.00"
  },
  {
    "tipo_movimiento": "Adjustment",
    "cantidad_movimientos": "1",
    "total_cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-058 — EM=X, EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-02-01' AND im.moved_at < DATE '2026-03-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo a la brasa de prueba",
    "cantidad": "2.00"
  }
]
```

**SQL generada**

```sql
SELECT p.id AS product_id, p.name AS product_name, COALESCE(SUM(im.quantity), 0) AS units_sold FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-02-01' AS DATE) AND im.moved_at < CAST('2026-03-01' AS DATE) GROUP BY p.id, p.name ORDER BY units_sold DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "product_id": "22",
    "product_name": "Pollo a la brasa de prueba",
    "units_sold": "2.00"
  }
]
```

</details>

<details><summary>TEST-059 — EM=X, EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-02-01' AND im.moved_at < DATE '2026-03-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero de prueba",
    "cantidad": "1.00"
  }
]
```

**SQL generada**

```sql
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad_merma FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-02-01' AS DATE) AND im.moved_at < CAST('2026-03-01' AS DATE) GROUP BY p.name ORDER BY cantidad_merma DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_merma": "1.00"
  }
]
```

</details>

<details><summary>TEST-060 — EM=X, EX=True, VES=0.989811</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-02-01' AND im.moved_at < DATE '2026-03-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero de prueba",
    "cantidad": "20.00"
  }
]
```

**SQL generada**

```sql
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-02-01' AS DATE) AND im.moved_at < CAST('2026-03-01' AS DATE) GROUP BY p.name ORDER BY insumo LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "insumo": "Pollo entero de prueba",
    "cantidad": "20.00"
  }
]
```

</details>
