# Reporte de evaluación Text-to-SQL

| Agente | Casos | EX | VES | Correctas | Incorrectas | Errores | Ejecutadas |
|---|---:|---:|---:|---:|---:|---:|---:|
| chatgpt oss 120 b | 342 | 92.11% | 0.9018 | 315 | 17 | 10 | 332 |

**chatgpt oss 120 b**:
- **EX (Execution Accuracy)**: compara el resultado devuelto en base de datos ignorando el orden de filas y los alias de columnas. Fórmula: `Correctas / Casos = 315 / 342 = 92.11%`.
- **Desglose de ejecución**:
  - **Correctas (EX OK)**: 315 (92.11%) — consultas ejecutadas cuyos datos coincidieron exactamente con el SQL gold.
  - **Incorrectas**: 17 (4.97%) — consultas que se ejecutaron en PostgreSQL sin error pero cuyos datos devueltos difieren del gold.
  - **Errores**: 10 (2.92%) — consultas con error de ejecución en base de datos (sintaxis, timeout o permisos).
  - **Ejecutadas en total**: 332 (97.08%) — total de consultas que completaron su ejecución en PostgreSQL (Correctas + Incorrectas).
- **VES (Valid Efficiency Score)**: media de `sqrt(tiempo_gold / tiempo_generado)`, limitada a 1; las respuestas incorrectas o con error valen 0.

<details><summary>TEST-001 — EX=True, VES=0.945282</summary>

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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-002 — EX=True, VES=0.9464889493772728</summary>

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

<details><summary>TEST-003 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-004 — EX=True, VES=0.95645</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-005 — EX=True, VES=0.9789281354281629</summary>

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

<details><summary>TEST-006 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-007 — EX=True, VES=0.9782773635827203</summary>

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

<details><summary>TEST-008 — EX=True, VES=0.9716883011159251</summary>

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

<details><summary>TEST-009 — EX=True, VES=0.9611932286073797</summary>

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

<details><summary>TEST-010 — EX=True, VES=0.9814015705464143</summary>

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

<details><summary>TEST-011 — EX=True, VES=0.9585340296961279</summary>

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

<details><summary>TEST-012 — EX=True, VES=0.9863999304600979</summary>

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

<details><summary>TEST-013 — EX=True, VES=0.973911</summary>

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
SELECT p.id AS producto_id, p.name AS producto_nombre, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-01-01' AS DATE) AND po.issued_at < CAST('2026-02-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto_id": "21",
    "producto_nombre": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-014 — EX=True, VES=0.847965</summary>

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
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at < CAST('2026-02-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990001",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-015 — EX=True, VES=0.991551</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-01-01' AS DATE) AND cm.created_at < CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-016 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-01-01' AS DATE) AND cm.created_at < CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "120.00"
  }
]
```

</details>

<details><summary>TEST-017 — EX=True, VES=0.995144</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_register AS cr JOIN public.cash_session AS cs ON cs.cash_register_id = cr.id WHERE cs.closed_at >= CAST('2026-01-01' AS DATE) AND cs.closed_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-018 — EX=True, VES=0.969371</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS total_efectivo, SUM(cs.sales_other) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.opened_at >= CAST('2026-01-01' AS DATE) AND cs.opened_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-019 — EX=True, VES=0.953648</summary>

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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-01-01' AS DATE) AND cs.closed_at < CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "suma_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-020 — EX=True, VES=1.0</summary>

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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-01-01' AS DATE) AND cm.created_at < CAST('2026-02-01' AS DATE) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-021 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresado FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-01-01' AS DATE) AND cm.created_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresado": "45.00"
  }
]
```

</details>

<details><summary>TEST-022 — EX=True, VES=1.0</summary>

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
SELECT im.movement_type AS movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS total_cantidad FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "movement_type": "Purchase",
    "movimientos": "1",
    "total_cantidad": "20.00"
  },
  {
    "movement_type": "Sale",
    "movimientos": "1",
    "total_cantidad": "2.00"
  },
  {
    "movement_type": "Shrinkage",
    "movimientos": "1",
    "total_cantidad": "1.00"
  },
  {
    "movement_type": "Adjustment",
    "movimientos": "1",
    "total_cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-023 — EX=True, VES=0.869559</summary>

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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY p.name ORDER BY unidades DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades": "2.00"
  }
]
```

</details>

<details><summary>TEST-024 — EX=True, VES=0.991191</summary>

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
SELECT p.id AS product_id, p.name AS product_name, COALESCE(SUM(im.quantity), 0) AS total_shrinkage FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "product_id": "21",
    "product_name": "Pollo entero de prueba",
    "total_shrinkage": "1.00"
  }
]
```

</details>

<details><summary>TEST-025 — EX=True, VES=0.984352</summary>

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
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-01-01' AS DATE) AND im.moved_at < CAST('2026-02-01' AS DATE) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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

<details><summary>TEST-026 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-027 — EX=True, VES=0.9767737204338384</summary>

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

<details><summary>TEST-028 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-029 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-030 — EX=True, VES=0.9985744960192631</summary>

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

<details><summary>TEST-031 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-032 — EX=True, VES=0.9837068977056611</summary>

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

<details><summary>TEST-033 — EX=False, VES=0.0</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.id = 1 AND je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-034 — EX=True, VES=1.0</summary>

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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-035 — EX=True, VES=0.802125</summary>

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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-02-01' AS DATE) AND ap.end_date >= CAST('2026-01-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_periodos": "1"
  }
]
```

</details>

<details><summary>TEST-036 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-02-01' AS DATE) AND si.issued_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-037 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-038 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-039 — EX=True, VES=1.0</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-02-01' AS DATE) AND so.ordered_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-040 — EX=True, VES=0.9429616920747755</summary>

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

<details><summary>TEST-041 — EX=True, VES=0.9859852536327932</summary>

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

<details><summary>TEST-042 — EX=True, VES=0.9876958550848521</summary>

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

<details><summary>TEST-043 — EX=True, VES=0.9918877203824416</summary>

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

<details><summary>TEST-044 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-045 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-046 — EX=True, VES=0.9949114814229197</summary>

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

<details><summary>TEST-047 — EX=True, VES=0.9830156844315097</summary>

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

<details><summary>TEST-048 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-049 — EX=True, VES=0.979718</summary>

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
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-02-01' AS DATE) AND pi.issued_at < CAST('2026-03-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990002",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-050 — EX=True, VES=1.0</summary>

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
SELECT SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-02-01' AS DATE) AND cm.created_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-051 — EX=True, VES=0.990553</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-02-01' AS DATE) AND cm.created_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "120.00"
  }
]
```

</details>

<details><summary>TEST-052 — EX=True, VES=0.962083</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-02-01' AS DATE) AND cs.closed_at < CAST('2026-03-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL generada**

```json
[]
```

</details>

<details><summary>TEST-053 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-02-01' AS DATE) AND cs.closed_at < CAST('2026-03-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL generada**

```json
[]
```

</details>

<details><summary>TEST-054 — EX=True, VES=0.985667</summary>

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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-02-01' AS DATE) AND cs.closed_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "suma_diferencias": "0"
  }
]
```

</details>

<details><summary>TEST-055 — EX=True, VES=1.0</summary>

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
SELECT cm.type AS type, SUM(cm.amount) AS total_amount FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-02-01' AS DATE) AND cm.created_at < CAST('2026-03-01' AS DATE) GROUP BY cm.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "type": "INCOME",
    "total_amount": "120.00"
  },
  {
    "type": "EXPENSE",
    "total_amount": "45.00"
  }
]
```

</details>

<details><summary>TEST-056 — EX=True, VES=0.971723</summary>

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
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-02-01' AS DATE) AND cm.created_at < CAST('2026-03-01' AS DATE) GROUP BY cr.name ORDER BY caja_registradora LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-057 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-058 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-059 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-060 — EX=True, VES=0.9898105018857976</summary>

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

<details><summary>TEST-061 — EX=True, VES=0.809474</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-02-01' AND t.date < DATE '2026-03-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND EXTRACT(YEAR FROM t.date) = 2026 AND EXTRACT(MONTH FROM t.date) = 2 LIMIT 50
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

<details><summary>TEST-062 — EX=True, VES=0.995441</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-02-01' AND t.date < DATE '2026-03-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS tipo, COALESCE(SUM(ti.quantity), 0) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.date >= CAST('2026-02-01' AS DATE) AND t.date < CAST('2026-03-01' AS DATE) GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "cantidad": "5.00"
  },
  {
    "tipo": "Producido",
    "cantidad": "2.00"
  }
]
```

</details>

<details><summary>TEST-063 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-02-01' AND im.moved_at < DATE '2026-03-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS name, SUM(im.quantity) AS total_adjusted FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-02-01' AS DATE) AND im.moved_at < CAST('2026-03-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "name": "Pollo entero de prueba",
    "total_adjusted": "3.00"
  }
]
```

</details>

<details><summary>TEST-064 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-02-01' AND je.entry_date < DATE '2026-03-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debit, COALESCE(SUM(jed.credit), 0) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-065 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-02-01' AND je.entry_date < DATE '2026-03-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "209001",
    "name": "Cuenta de activo de prueba del mes 2",
    "saldo": "200.00"
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
SELECT aa.code AS code, aa.name AS name, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date <= CAST('2026-02-28' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY code LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "code": "209001",
    "name": "Cuenta de activo de prueba del mes 2",
    "saldo_neto": "200.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo_neto": "-100.00"
  }
]
```

</details>

<details><summary>TEST-066 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-02-01' AND je.entry_date < DATE '2026-03-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date <= CAST('2026-02-28' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-067 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT je.id, je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-02-01' AND je.entry_date < DATE '2026-03-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "id": 194,
    "code": "BENCH26-02-02",
    "entry_date": "2026-02-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS code, je.entry_date AS entry_date, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS diferencia FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING COALESCE(SUM(jed.debit), 0) <> COALESCE(SUM(jed.credit), 0) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-02-02",
    "entry_date": "2026-02-23",
    "diferencia": "20.00"
  }
]
```

</details>

<details><summary>TEST-068 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '2%' AND je.entry_date >= DATE '2026-02-01' AND je.entry_date < DATE '2026-03-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "saldo": "120.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '2%' AND je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date <= CAST('2026-02-28' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo_neto": "120.00"
  }
]
```

</details>

<details><summary>TEST-069 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-02-01' AND je.entry_date < DATE '2026-03-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date <= CAST('2026-02-28' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-070 — EX=True, VES=0.949554</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-03-01' AND ap.end_date >= DATE '2026-02-01' LIMIT 50
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
SELECT COUNT(*) AS periodos_abiertos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-03-01' AS DATE) AND ap.end_date >= CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "periodos_abiertos": "1"
  }
]
```

</details>

<details><summary>TEST-071 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-03-01' AND si.issued_at < DATE '2026-04-01' LIMIT 50
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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-03-01' AS DATE) AND si.issued_at <= CAST('2026-03-31' AS DATE) LIMIT 50
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

<details><summary>TEST-072 — EX=True, VES=0.994304</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-03-01' AND si.issued_at < DATE '2026-04-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, COALESCE(SUM(si.total_amount), 0) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-03-01' AS DATE) AND si.issued_at <= CAST('2026-03-31' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-073 — EX=True, VES=0.979996</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-03-01' AND sp.paid_at < DATE '2026-04-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  },
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  }
]
```

</details>

<details><summary>TEST-074 — EX=True, VES=0.996192</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-03-01' AND so.ordered_at < DATE '2026-04-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so JOIN public.sales_order AS so2 ON so.id = so2.id WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-03-01' AS DATE) AND so.ordered_at < CAST('2026-04-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-075 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-03-01' AND so.ordered_at < DATE '2026-04-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-03-01' AS DATE) AND so.ordered_at < CAST('2026-04-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "3"
  }
]
```

</details>

<details><summary>TEST-076 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-03-01' AND so.ordered_at < DATE '2026-04-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_order AS so JOIN public.sales_invoice AS si ON si.order_id = so.id WHERE EXTRACT(YEAR FROM si.issued_at) = 2026 AND EXTRACT(MONTH FROM si.issued_at) = 3 GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-077 — EX=True, VES=0.802473</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-03-01' AND so.ordered_at < DATE '2026-04-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-03-01' AS DATE) AND so.ordered_at < CAST('2026-04-01' AS DATE) GROUP BY dt.number LIMIT 50
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

<details><summary>TEST-078 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-03-01' AND pi.issued_at < DATE '2026-04-01' LIMIT 50
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
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-03-01' AS DATE) AND pi.issued_at < CAST('2026-04-01' AS DATE) LIMIT 50
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

<details><summary>TEST-079 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-03-01' AND pi.issued_at < DATE '2026-04-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
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
SELECT s.business_name AS business_name, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-03-01' AS DATE) AND pi.issued_at <= CAST('2026-03-31' AS DATE) GROUP BY s.business_name LIMIT 50
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

<details><summary>TEST-080 — EX=True, VES=0.982646</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-03-01' AND pp.paid_at < DATE '2026-04-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS name, SUM(pp.amount) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-03-01' AS DATE) AND pp.paid_at < CAST('2026-04-01' AS DATE) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "name": "Efectivo",
    "total_pagado": "100.00"
  }
]
```

</details>

<details><summary>TEST-081 — EX=True, VES=0.982004</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-03-01' AND ip.date < DATE '2026-04-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
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
SELECT ip.expense_category AS categoria, COALESCE(SUM(ip.amount_paid), 0) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.annulled = FALSE AND ip.date >= CAST('2026-03-01' AS DATE) AND ip.date <= CAST('2026-03-31' AS DATE) GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-082 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-03-01' AND po.issued_at < DATE '2026-04-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-03-01' AS DATE) AND po.issued_at < CAST('2026-04-01' AS DATE) GROUP BY po.status LIMIT 50
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

<details><summary>TEST-083 — EX=True, VES=0.947764</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-03-01' AND po.issued_at < DATE '2026-04-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-03-01' AS DATE) AND po.issued_at < CAST('2026-04-01' AS DATE) GROUP BY p.name ORDER BY unidades_recibidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-084 — EX=True, VES=0.967956</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-03-01' AND pi.issued_at < DATE '2026-04-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990003,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-03-01' AS DATE) AND pi.issued_at < CAST('2026-04-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990003",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-085 — EX=True, VES=0.996602</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-03-01' AND cm.created_at < DATE '2026-04-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-03-01' AS TIMESTAMP) AND cm.created_at < CAST('2026-04-01' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-086 — EX=True, VES=0.993083</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-03-01' AND cm.created_at < DATE '2026-04-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-03-01' AS DATE) AND cm.created_at < CAST('2026-04-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "120.00"
  }
]
```

</details>

<details><summary>TEST-087 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-03-01' AND cs.closed_at < DATE '2026-04-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja de Prueba",
    "sesiones": 2
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_register AS cr JOIN public.cash_session AS cs ON cs.cash_register_id = cr.id WHERE cs.closed_at IS NOT NULL AND CAST(cs.closed_at AS DATE) >= CAST('2026-03-01' AS DATE) AND CAST(cs.closed_at AS DATE) <= CAST('2026-03-31' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "sesiones_cerradas": "2"
  }
]
```

</details>

<details><summary>TEST-088 — EX=True, VES=0.986378</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-03-01' AND cs.closed_at < DATE '2026-04-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "1700.00",
    "ventas_otros": "840.00"
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-03-01' AS DATE) AND cs.closed_at < CAST('2026-04-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "total_efectivo": "1700.00",
    "total_otros": "840.00"
  }
]
```

</details>

<details><summary>TEST-089 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-03-01' AND cs.closed_at < DATE '2026-04-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "diferencia": "-10.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS total_diferencia FROM public.cash_session AS cs WHERE CAST(cs.closed_at AS DATE) BETWEEN CAST('2026-03-01' AS DATE) AND CAST('2026-03-31' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_diferencia": "-10.00"
  }
]
```

</details>

<details><summary>TEST-090 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-03-01' AND cm.created_at < DATE '2026-04-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE DATE_TRUNC('MONTH', cm.created_at) = CAST('2026-03-01' AS DATE) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-091 — EX=True, VES=0.994129</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-03-01' AND cm.created_at < DATE '2026-04-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresado FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-03-01' AS DATE) AND cm.created_at < CAST('2026-04-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresado": "45.00"
  }
]
```

</details>

<details><summary>TEST-092 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-03-01' AND im.moved_at < DATE '2026-04-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-03-01' AS DATE) AND im.moved_at < CAST('2026-04-01' AS DATE) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "Sale",
    "movimientos": "1",
    "cantidad_total": "2.00"
  },
  {
    "tipo_movimiento": "Shrinkage",
    "movimientos": "1",
    "cantidad_total": "1.00"
  },
  {
    "tipo_movimiento": "Adjustment",
    "movimientos": "1",
    "cantidad_total": "3.00"
  },
  {
    "tipo_movimiento": "Purchase",
    "movimientos": "1",
    "cantidad_total": "20.00"
  }
]
```

</details>

<details><summary>TEST-093 — EX=True, VES=0.990967</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-03-01' AND im.moved_at < DATE '2026-04-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS unidades_vendidas FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-03-01' AS DATE) AND im.moved_at < CAST('2026-04-01' AS DATE) GROUP BY p.id, p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "2.00"
  }
]
```

</details>

<details><summary>TEST-094 — EX=True, VES=0.999083</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-03-01' AND im.moved_at < DATE '2026-04-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS name, COALESCE(SUM(im.quantity), 0) AS total_merma FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-03-01' AS DATE) AND im.moved_at < CAST('2026-04-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "name": "Pollo entero de prueba",
    "total_merma": "1.00"
  }
]
```

</details>

<details><summary>TEST-095 — EX=True, VES=0.996716</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-03-01' AND im.moved_at < DATE '2026-04-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY insumo LIMIT 50
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

<details><summary>TEST-096 — EX=True, VES=0.998211</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-03-01' AND t.date < DATE '2026-04-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-03-01' AS DATE) AND t.date < CAST('2026-04-01' AS DATE) LIMIT 50
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

<details><summary>TEST-097 — EX=True, VES=0.994207</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-03-01' AND t.date < DATE '2026-04-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS item_type, SUM(ti.quantity) AS total_quantity FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.date >= CAST('2026-03-01' AS DATE) AND t.date < CAST('2026-04-01' AS DATE) GROUP BY ti.item_type LIMIT 50
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

<details><summary>TEST-098 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-03-01' AND im.moved_at < DATE '2026-04-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS name, SUM(im.quantity) AS total_adjusted FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-03-01' AS DATE) AND im.moved_at < CAST('2026-04-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "name": "Pollo entero de prueba",
    "total_adjusted": "3.00"
  }
]
```

</details>

<details><summary>TEST-099 — EX=True, VES=0.988588</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-03-01' AND je.entry_date < DATE '2026-04-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debit, COALESCE(SUM(jed.credit), 0) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date <= CAST('2026-03-31' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-100 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-03-01' AND je.entry_date < DATE '2026-04-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "309001",
    "name": "Cuenta de activo de prueba del mes 3",
    "saldo": "200.00"
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
SELECT aa.code AS cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date <= CAST('2026-03-31' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta": "309001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 3",
    "saldo_neto": "200.00"
  },
  {
    "cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  }
]
```

</details>

<details><summary>TEST-101 — EX=True, VES=0.9983</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-03-01' AND je.entry_date < DATE '2026-04-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS book, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date <= CAST('2026-03-31' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "book": "Diario de prueba",
    "total_asientos": "2"
  }
]
```

</details>

<details><summary>TEST-102 — EX=True, VES=0.932368</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-03-01' AND je.entry_date < DATE '2026-04-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-03-02",
    "entry_date": "2026-03-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS codigo, je.entry_date AS fecha, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date < CAST('2026-04-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo": "BENCH26-03-02",
    "fecha": "2026-03-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-103 — EX=True, VES=0.999573</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '3%' AND je.entry_date >= DATE '2026-03-01' AND je.entry_date < DATE '2026-04-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '3%' AND je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date <= CAST('2026-03-31' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo": "200.00"
  }
]
```

</details>

<details><summary>TEST-104 — EX=True, VES=0.994504</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-03-01' AND je.entry_date < DATE '2026-04-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS type, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date <= CAST('2026-03-31' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

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

</details>

<details><summary>TEST-105 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-04-01' AND ap.end_date >= DATE '2026-03-01' LIMIT 50
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
SELECT COUNT(*) AS periodos_abiertos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-04-01' AS DATE) AND ap.end_date >= CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "periodos_abiertos": "1"
  }
]
```

</details>

<details><summary>TEST-106 — EX=True, VES=0.978485</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-04-01' AND si.issued_at < DATE '2026-05-01' LIMIT 50
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
SELECT SUM(si.total_amount) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-04-01' AS DATE) AND si.issued_at < CAST('2026-05-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-107 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-04-01' AND si.issued_at < DATE '2026-05-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, COALESCE(SUM(si.total_amount), 0) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-04-01' AS DATE) AND si.issued_at < CAST('2026-05-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-108 — EX=True, VES=0.989567</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-04-01' AND sp.paid_at < DATE '2026-05-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  },
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  }
]
```

</details>

<details><summary>TEST-109 — EX=True, VES=0.978574</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-04-01' AND so.ordered_at < DATE '2026-05-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-04-01' AS TIMESTAMP) AND so.ordered_at < CAST('2026-05-01' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-110 — EX=True, VES=0.998345</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-04-01' AND so.ordered_at < DATE '2026-05-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
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
SELECT p.id AS id, p.name AS name, SUM(oi.quantity) AS total_units FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status ILIKE '%closed%' AND EXTRACT(MONTH FROM so.ordered_at) = 4 AND EXTRACT(YEAR FROM so.ordered_at) = 2026 GROUP BY p.id, p.name ORDER BY total_units DESC LIMIT 50
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

<details><summary>TEST-111 — EX=True, VES=0.980482</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-04-01' AND so.ordered_at < DATE '2026-05-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
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
SELECT so.order_type AS canal_pedido, SUM(si.total_amount) AS total_vendido FROM public.sales_order AS so JOIN public.sales_invoice AS si ON si.order_id = so.id WHERE DATE_TRUNC('MONTH', si.issued_at) = CAST('2026-04-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-112 — EX=True, VES=0.909487</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-04-01' AND so.ordered_at < DATE '2026-05-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status ILIKE '%closed%' AND so.ordered_at >= CAST('2026-04-01' AS DATE) AND so.ordered_at < CAST('2026-05-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
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

<details><summary>TEST-113 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-04-01' AND pi.issued_at < DATE '2026-05-01' LIMIT 50
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
SELECT COUNT(*) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-04-01' AS DATE) AND pi.issued_at < CAST('2026-05-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "1"
  }
]
```

</details>

<details><summary>TEST-114 — EX=True, VES=0.982454</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-04-01' AND pi.issued_at < DATE '2026-05-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
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
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-04-01' AS DATE) AND pi.issued_at <= CAST('2026-04-30' AS DATE) GROUP BY s.business_name LIMIT 50
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

<details><summary>TEST-115 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-04-01' AND pp.paid_at < DATE '2026-05-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-04-01' AS DATE) AND pp.paid_at < CAST('2026-05-01' AS DATE) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-116 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-04-01' AND ip.date < DATE '2026-05-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
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
SELECT ip.expense_category AS expense_category, COALESCE(SUM(ip.amount_paid), 0) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-04-01' AS DATE) AND ip.date <= CAST('2026-04-30' AS DATE) GROUP BY ip.expense_category LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "expense_category": "CleaningSupplies",
    "total_gastado": "38.00"
  }
]
```

</details>

<details><summary>TEST-117 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-04-01' AND po.issued_at < DATE '2026-05-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT po.status AS status, COUNT(*) AS total FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-04-01' AS DATE) AND po.issued_at <= CAST('2026-04-30' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "status": "FullyReceived",
    "total": "1"
  },
  {
    "status": "Pending",
    "total": "1"
  }
]
```

</details>

<details><summary>TEST-118 — EX=True, VES=0.978476</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-04-01' AND po.issued_at < DATE '2026-05-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-04-01' AS DATE) AND po.issued_at < CAST('2026-05-01' AS DATE) GROUP BY p.name ORDER BY unidades_recibidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-119 — EX=True, VES=0.948147</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-04-01' AND pi.issued_at < DATE '2026-05-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990004,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-04-01' AS DATE) AND pi.issued_at < CAST('2026-05-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990004",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-120 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-04-01' AND cm.created_at < DATE '2026-05-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-04-01' AS TIMESTAMP) AND cm.created_at < CAST('2026-05-01' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-121 — EX=True, VES=0.949994</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-04-01' AND cm.created_at < DATE '2026-05-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-04-01' AS DATE) AND cm.created_at < CAST('2026-05-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "120.00"
  }
]
```

</details>

<details><summary>TEST-122 — EX=True, VES=0.969949</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-04-01' AND cs.closed_at < DATE '2026-05-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-04-01' AS DATE) AND cs.closed_at < CAST('2026-05-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-123 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-04-01' AND cs.closed_at < DATE '2026-05-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros_medios FROM public.cash_register AS cr JOIN public.cash_session AS cs ON cs.cash_register_id = cr.id WHERE DATE_TRUNC('MONTH', cs.opened_at) = CAST('2026-04-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "total_efectivo": "850.00",
    "total_otros_medios": "420.00"
  }
]
```

</details>

<details><summary>TEST-124 — EX=True, VES=0.995727</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-04-01' AND cs.closed_at < DATE '2026-05-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.difference), 0) AS total_diferencia FROM public.cash_session AS cs WHERE cs.closed_at IS NOT NULL AND CAST(cs.closed_at AS DATE) >= CAST('2026-04-01' AS DATE) AND CAST(cs.closed_at AS DATE) <= CAST('2026-04-30' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_diferencia": "-5.00"
  }
]
```

</details>

<details><summary>TEST-125 — EX=True, VES=0.999733</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-04-01' AND cm.created_at < DATE '2026-05-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm WHERE EXTRACT(YEAR FROM cm.created_at) = 2026 AND EXTRACT(MONTH FROM cm.created_at) = 4 GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-126 — EX=True, VES=0.963839</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-04-01' AND cm.created_at < DATE '2026-05-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresado FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-04-01' AS DATE) AND cm.created_at < CAST('2026-05-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresado": "45.00"
  }
]
```

</details>

<details><summary>TEST-127 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-04-01' AND im.moved_at < DATE '2026-05-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, COALESCE(SUM(im.quantity), 0) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-04-01' AS DATE) AND im.moved_at < CAST('2026-05-01' AS DATE) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
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
  },
  {
    "tipo_movimiento": "Purchase",
    "total_movimientos": "1",
    "cantidad_total": "20.00"
  }
]
```

</details>

<details><summary>TEST-128 — EX=True, VES=0.983786</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-04-01' AND im.moved_at < DATE '2026-05-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS unidades_vendidas FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-04-01' AS DATE) AND im.moved_at < CAST('2026-05-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "2.00"
  }
]
```

</details>

<details><summary>TEST-129 — EX=True, VES=0.96048</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-04-01' AND im.moved_at < DATE '2026-05-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-04-01' AS DATE) AND im.moved_at < CAST('2026-05-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "1.00"
  }
]
```

</details>

<details><summary>TEST-130 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-04-01' AND im.moved_at < DATE '2026-05-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-04-01' AS DATE) AND im.moved_at < CAST('2026-05-01' AS DATE) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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

<details><summary>TEST-131 — EX=True, VES=0.993823</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-04-01' AND t.date < DATE '2026-05-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-04-01' AS DATE) AND t.date < CAST('2026-05-01' AS DATE) LIMIT 50
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

<details><summary>TEST-132 — EX=True, VES=0.961463</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-04-01' AND t.date < DATE '2026-05-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS tipo, COALESCE(SUM(ti.quantity), 0) AS total_cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-04-01' AS DATE) AND t.date < CAST('2026-05-01' AS DATE) GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "total_cantidad": "5.00"
  },
  {
    "tipo": "Producido",
    "total_cantidad": "2.00"
  }
]
```

</details>

<details><summary>TEST-133 — EX=True, VES=0.995291</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-04-01' AND im.moved_at < DATE '2026-05-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad_ajustada FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-04-01' AS DATE) AND im.moved_at < CAST('2026-05-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_ajustada": "3.00"
  }
]
```

</details>

<details><summary>TEST-134 — EX=True, VES=0.982391</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-04-01' AND je.entry_date < DATE '2026-05-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debe": "200.00",
    "total_haber": "180.00"
  }
]
```

</details>

<details><summary>TEST-135 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-04-01' AND je.entry_date < DATE '2026-05-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  },
  {
    "code": "409001",
    "name": "Cuenta de activo de prueba del mes 4",
    "saldo": "200.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS cuenta_codigo, aa.name AS cuenta_nombre, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta_codigo LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta_codigo": "201001",
    "cuenta_nombre": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta_codigo": "401001",
    "cuenta_nombre": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "cuenta_codigo": "409001",
    "cuenta_nombre": "Cuenta de activo de prueba del mes 4",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-136 — EX=True, VES=0.962255</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-04-01' AND je.entry_date < DATE '2026-05-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-137 — EX=True, VES=0.752797</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-04-01' AND je.entry_date < DATE '2026-05-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-04-02",
    "entry_date": "2026-04-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS codigo, je.entry_date AS fecha, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo": "BENCH26-04-02",
    "fecha": "2026-04-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-138 — EX=True, VES=0.976444</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '4%' AND je.entry_date >= DATE '2026-04-01' AND je.entry_date < DATE '2026-05-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "saldo": "100.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '4%' AND je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo_neto": "100.00"
  }
]
```

</details>

<details><summary>TEST-139 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-04-01' AND je.entry_date < DATE '2026-05-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-140 — EX=True, VES=0.895498</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-05-01' AND ap.end_date >= DATE '2026-04-01' LIMIT 50
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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-05-01' AS DATE) AND ap.end_date >= CAST('2026-04-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_periodos": "1"
  }
]
```

</details>

<details><summary>TEST-141 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-05-01' AND si.issued_at < DATE '2026-06-01' LIMIT 50
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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-05-01' AS DATE) AND si.issued_at < CAST('2026-06-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-142 — EX=True, VES=0.813088</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-05-01' AND si.issued_at < DATE '2026-06-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, COALESCE(SUM(si.total_amount), 0) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-05-01' AS DATE) AND si.issued_at < CAST('2026-06-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-143 — EX=True, VES=0.908719</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-05-01' AND sp.paid_at < DATE '2026-06-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-05-01' AS DATE) AND sp.paid_at < CAST('2026-06-01' AS DATE) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-144 — EX=True, VES=0.736217</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-05-01' AND so.ordered_at < DATE '2026-06-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-05-01' AS DATE) AND so.ordered_at < CAST('2026-06-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-145 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-05-01' AND so.ordered_at < DATE '2026-06-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "3"
  }
]
```

</details>

<details><summary>TEST-146 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-05-01' AND so.ordered_at < DATE '2026-06-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
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
SELECT so.order_type AS canal, COALESCE(SUM(si.total_amount), 0) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-05-01' AS DATE) AND si.issued_at < CAST('2026-06-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-147 — EX=True, VES=0.991564</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-05-01' AND so.ordered_at < DATE '2026-06-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
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
SELECT dt.number AS mesa, COUNT(*) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-05-01' AS DATE) AND so.ordered_at < CAST('2026-06-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
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

<details><summary>TEST-148 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-05-01' AND pi.issued_at < DATE '2026-06-01' LIMIT 50
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
SELECT COUNT(*) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-05-01' AS DATE) AND pi.issued_at < CAST('2026-06-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "1"
  }
]
```

</details>

<details><summary>TEST-149 — EX=True, VES=0.998108</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-05-01' AND pi.issued_at < DATE '2026-06-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
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
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-05-01' AS DATE) AND pi.issued_at < CAST('2026-06-01' AS DATE) GROUP BY s.business_name ORDER BY total_comprado DESC LIMIT 50
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

<details><summary>TEST-150 — EX=True, VES=0.995815</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-05-01' AND pp.paid_at < DATE '2026-06-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pi.issued_at >= CAST('2026-05-01' AS DATE) AND pi.issued_at < CAST('2026-06-01' AS DATE) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-151 — EX=True, VES=0.99256</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-05-01' AND ip.date < DATE '2026-06-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
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
SELECT ip.expense_category AS expense_category, COALESCE(SUM(ip.amount_paid), 0) AS total_gasto FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-05-01' AS DATE) AND ip.date < CAST('2026-06-01' AS DATE) AND ip.annulled = FALSE GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-152 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-05-01' AND po.issued_at < DATE '2026-06-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "FullyReceived",
    "total": 1
  },
  {
    "status": "Pending",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-05-01' AS DATE) AND po.issued_at < CAST('2026-06-01' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "estado": "FullyReceived",
    "total_ordenes": "1"
  },
  {
    "estado": "Pending",
    "total_ordenes": "1"
  }
]
```

</details>

<details><summary>TEST-153 — EX=True, VES=0.997978</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-05-01' AND po.issued_at < DATE '2026-06-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-05-01' AS DATE) AND po.issued_at < CAST('2026-06-01' AS DATE) GROUP BY p.name ORDER BY unidades_recibidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-154 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-05-01' AND pi.issued_at < DATE '2026-06-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990005,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-05-01' AS DATE) AND pi.issued_at < CAST('2026-06-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990005",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-155 — EX=True, VES=0.998173</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-05-01' AND cm.created_at < DATE '2026-06-01' LIMIT 50
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
SELECT SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-05-01' AS DATE) AND cm.created_at < CAST('2026-06-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-156 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-05-01' AND cm.created_at < DATE '2026-06-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.sales_cash), 0) AS total_ingresos_caja FROM public.cash_session AS cs WHERE cs.closed_at >= CAST('2026-05-01' AS DATE) AND cs.closed_at < CAST('2026-06-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos_caja": "850.00"
  }
]
```

</details>

<details><summary>TEST-157 — EX=True, VES=0.990598</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-05-01' AND cs.closed_at < DATE '2026-06-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-05-01' AS DATE) AND cs.closed_at < CAST('2026-06-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-158 — EX=True, VES=0.989152</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-05-01' AND cs.closed_at < DATE '2026-06-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-05-01' AS DATE) AND cs.closed_at < CAST('2026-06-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-159 — EX=True, VES=0.983444</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-05-01' AND cs.closed_at < DATE '2026-06-01' LIMIT 50
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
SELECT SUM(cs.difference) AS total_diferencia FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-05-01' AS DATE) AND cs.closed_at < CAST('2026-06-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_diferencia": "-5.00"
  }
]
```

</details>

<details><summary>TEST-160 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-05-01' AND cm.created_at < DATE '2026-06-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.created_at >= CAST('2026-05-01' AS DATE) AND cm.created_at < CAST('2026-06-01' AS DATE) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-161 — EX=True, VES=0.998959</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-05-01' AND cm.created_at < DATE '2026-06-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cm.amount), 0) AS total_egreso FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-05-01' AS DATE) AND cm.created_at < CAST('2026-06-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "total_egreso": "45.00"
  }
]
```

</details>

<details><summary>TEST-162 — EX=True, VES=0.990305</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-05-01' AND im.moved_at < DATE '2026-06-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS cantidad_movimientos, COALESCE(SUM(im.quantity), 0) AS total_cantidad FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-05-01' AS DATE) AND im.moved_at < CAST('2026-06-01' AS DATE) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
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
  },
  {
    "tipo_movimiento": "Purchase",
    "cantidad_movimientos": "1",
    "total_cantidad": "20.00"
  }
]
```

</details>

<details><summary>TEST-163 — EX=True, VES=0.998174</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-05-01' AND im.moved_at < DATE '2026-06-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS unidades_vendidas FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-05-01' AS DATE) AND im.moved_at < CAST('2026-06-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "2.00"
  }
]
```

</details>

<details><summary>TEST-164 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-05-01' AND im.moved_at < DATE '2026-06-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, SUM(a.quantity) AS cantidad FROM public.inventory_movement AS a JOIN public.product AS p ON a.product_id = p.id WHERE a.movement_type = 'Shrinkage' AND a.moved_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND a.moved_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "1.00"
  }
]
```

</details>

<details><summary>TEST-165 — EX=True, VES=0.885012</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-05-01' AND im.moved_at < DATE '2026-06-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-05-01' AS DATE) AND im.moved_at < CAST('2026-06-01' AS DATE) GROUP BY p.name ORDER BY insumo LIMIT 50
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

<details><summary>TEST-166 — EX=True, VES=0.988014</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-05-01' AND t.date < DATE '2026-06-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-05-01' AS DATE) AND t.date < CAST('2026-06-01' AS DATE) LIMIT 50
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

<details><summary>TEST-167 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-05-01' AND t.date < DATE '2026-06-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS tipo, COALESCE(SUM(ti.quantity), 0) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-05-01' AS DATE) AND t.date < CAST('2026-06-01' AS DATE) AND ti.item_type IN ('Consumo', 'Producido') GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "cantidad": "5.00"
  },
  {
    "tipo": "Producido",
    "cantidad": "2.00"
  }
]
```

</details>

<details><summary>TEST-168 — EX=True, VES=0.992204</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-05-01' AND im.moved_at < DATE '2026-06-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad_ajustada FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-05-01' AS DATE) AND im.moved_at < CAST('2026-06-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_ajustada": "3.00"
  }
]
```

</details>

<details><summary>TEST-169 — EX=True, VES=0.980503</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-05-01' AND je.entry_date < DATE '2026-06-01' LIMIT 50
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
SELECT SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debe": "200.00",
    "total_haber": "180.00"
  }
]
```

</details>

<details><summary>TEST-170 — EX=True, VES=0.994899</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-05-01' AND je.entry_date < DATE '2026-06-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  },
  {
    "code": "509001",
    "name": "Cuenta de activo de prueba del mes 5",
    "saldo": "200.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS cuenta_codigo, aa.name AS cuenta_nombre, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta_codigo LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta_codigo": "201001",
    "cuenta_nombre": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta_codigo": "401001",
    "cuenta_nombre": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "cuenta_codigo": "509001",
    "cuenta_nombre": "Cuenta de activo de prueba del mes 5",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-171 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-05-01' AND je.entry_date < DATE '2026-06-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY je.book ORDER BY total_asientos DESC LIMIT 50
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

<details><summary>TEST-172 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-05-01' AND je.entry_date < DATE '2026-06-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-05-02",
    "entry_date": "2026-05-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS codigo, je.entry_date AS fecha, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo": "BENCH26-05-02",
    "fecha": "2026-05-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-173 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '5%' AND je.entry_date >= DATE '2026-05-01' AND je.entry_date < DATE '2026-06-01' LIMIT 50
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-174 — EX=True, VES=0.972971</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-05-01' AND je.entry_date < DATE '2026-06-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS tipo, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Activo",
    "total_debe": "200.00",
    "total_haber": "0.00"
  },
  {
    "tipo": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "100.00"
  },
  {
    "tipo": "Pasivo",
    "total_debe": "0.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-175 — EX=True, VES=0.993246</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-06-01' AND ap.end_date >= DATE '2026-05-01' LIMIT 50
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
SELECT COUNT(*) AS periodos_abiertos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-06-01' AS DATE) AND ap.end_date >= CAST('2026-05-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "periodos_abiertos": "1"
  }
]
```

</details>

<details><summary>TEST-176 — EX=True, VES=0.99932</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-06-01' AND si.issued_at < DATE '2026-07-01' LIMIT 50
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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-06-01' AS DATE) AND si.issued_at < CAST('2026-07-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-177 — EX=True, VES=0.999194</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-06-01' AND si.issued_at < DATE '2026-07-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, COALESCE(SUM(si.total_amount), 0) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-06-01' AS DATE) AND si.issued_at < CAST('2026-07-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-178 — EX=True, VES=0.994638</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-06-01' AND sp.paid_at < DATE '2026-07-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-06-01' AS DATE) AND sp.paid_at < CAST('2026-07-01' AS DATE) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  },
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  }
]
```

</details>

<details><summary>TEST-179 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-06-01' AND so.ordered_at < DATE '2026-07-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos_cerrados_para_llevar FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos_cerrados_para_llevar": "1"
  }
]
```

</details>

<details><summary>TEST-180 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-06-01' AND so.ordered_at < DATE '2026-07-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-06-01' AS DATE) AND so.ordered_at < CAST('2026-07-01' AS DATE) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-181 — EX=True, VES=0.995193</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-06-01' AND so.ordered_at < DATE '2026-07-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
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
SELECT so.order_type AS canal_pedido, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-06-01' AS DATE) AND si.issued_at < CAST('2026-07-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-182 — EX=True, VES=0.874225</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-06-01' AND so.ordered_at < DATE '2026-07-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
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
SELECT dt.number AS mesa, COUNT(*) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-06-01' AS DATE) AND so.ordered_at < CAST('2026-07-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
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

<details><summary>TEST-183 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-06-01' AND pi.issued_at < DATE '2026-07-01' LIMIT 50
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
SELECT COUNT(*) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-06-01' AS DATE) AND pi.issued_at < CAST('2026-07-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "1"
  }
]
```

</details>

<details><summary>TEST-184 — EX=True, VES=0.995361</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-06-01' AND pi.issued_at < DATE '2026-07-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
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
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-06-01' AS DATE) AND pi.issued_at < CAST('2026-07-01' AS DATE) GROUP BY s.business_name ORDER BY total_comprado DESC LIMIT 50
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

<details><summary>TEST-185 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-06-01' AND pp.paid_at < DATE '2026-07-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, SUM(pp.amount) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pi.issued_at >= CAST('2026-06-01' AS DATE) AND pi.issued_at < CAST('2026-07-01' AS DATE) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-186 — EX=True, VES=0.992974</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-06-01' AND ip.date < DATE '2026-07-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
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
SELECT ip.expense_category AS categoria, COALESCE(SUM(ip.amount_paid), 0) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.annulled = FALSE AND ip.date >= CAST('2026-06-01' AS DATE) AND ip.date < CAST('2026-07-01' AS DATE) GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-187 — EX=True, VES=0.996906</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-06-01' AND po.issued_at < DATE '2026-07-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "FullyReceived",
    "total": 1
  },
  {
    "status": "Pending",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-06-01' AS DATE) AND po.issued_at < CAST('2026-07-01' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "estado": "FullyReceived",
    "total_ordenes": "1"
  },
  {
    "estado": "Pending",
    "total_ordenes": "1"
  }
]
```

</details>

<details><summary>TEST-188 — EX=True, VES=0.997135</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-06-01' AND po.issued_at < DATE '2026-07-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
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
SELECT p.id AS product_id, p.name AS product_name, COALESCE(SUM(poi.quantity_received), 0) AS total_units_received FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON po.id = poi.purchase_order_id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-06-01' AS DATE) AND po.issued_at < CAST('2026-07-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "product_id": "21",
    "product_name": "Pollo entero de prueba",
    "total_units_received": "20.00"
  }
]
```

</details>

<details><summary>TEST-189 — EX=True, VES=0.995496</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-06-01' AND pi.issued_at < DATE '2026-07-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990006,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-06-01' AS DATE) AND pi.issued_at < CAST('2026-07-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990006",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-190 — EX=True, VES=0.993763</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-06-01' AND cm.created_at < DATE '2026-07-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-06-01' AS DATE) AND cm.created_at < CAST('2026-07-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-191 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-06-01' AND cm.created_at < DATE '2026-07-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.total_sales), 0) AS total_ingresos FROM public.cash_session AS cs WHERE cs.closed_at >= CAST('2026-06-01' AS DATE) AND cs.closed_at < CAST('2026-07-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "1270.00"
  }
]
```

</details>

<details><summary>TEST-192 — EX=True, VES=0.99953</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-06-01' AND cs.closed_at < DATE '2026-07-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-06-01' AS DATE) AND cs.closed_at < CAST('2026-07-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-193 — EX=True, VES=0.980735</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-06-01' AND cs.closed_at < DATE '2026-07-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-06-01' AS DATE) AND cs.closed_at < CAST('2026-07-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-194 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-06-01' AND cs.closed_at < DATE '2026-07-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-06-01' AS DATE) AND cs.closed_at < CAST('2026-07-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "suma_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-195 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-06-01' AND cm.created_at < DATE '2026-07-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS type, SUM(cm.amount) AS total_amount FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-06-01' AS DATE) AND cm.created_at < CAST('2026-07-01' AS DATE) GROUP BY cm.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "type": "INCOME",
    "total_amount": "120.00"
  },
  {
    "type": "EXPENSE",
    "total_amount": "45.00"
  }
]
```

</details>

<details><summary>TEST-196 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-06-01' AND cm.created_at < DATE '2026-07-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-06-01' AS DATE) AND cm.created_at < CAST('2026-07-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-197 — EX=True, VES=0.999671</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-06-01' AND im.moved_at < DATE '2026-07-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS movimientos, SUM(im.quantity) AS total_cantidad FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-06-01' AS DATE) AND im.moved_at < CAST('2026-07-01' AS DATE) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "Purchase",
    "movimientos": "1",
    "total_cantidad": "20.00"
  },
  {
    "tipo_movimiento": "Sale",
    "movimientos": "1",
    "total_cantidad": "2.00"
  },
  {
    "tipo_movimiento": "Shrinkage",
    "movimientos": "1",
    "total_cantidad": "1.00"
  },
  {
    "tipo_movimiento": "Adjustment",
    "movimientos": "1",
    "total_cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-198 — EX=True, VES=0.998956</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-06-01' AND im.moved_at < DATE '2026-07-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS unidades_vendidas FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-06-01' AS DATE) AND im.moved_at < CAST('2026-07-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "2.00"
  }
]
```

</details>

<details><summary>TEST-199 — EX=True, VES=0.998217</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-06-01' AND im.moved_at < DATE '2026-07-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad_merma FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-06-01' AS DATE) AND im.moved_at < CAST('2026-07-01' AS DATE) GROUP BY p.name ORDER BY cantidad_merma DESC LIMIT 50
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

<details><summary>TEST-200 — EX=True, VES=0.998671</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-06-01' AND im.moved_at < DATE '2026-07-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-06-01' AS DATE) AND im.moved_at < CAST('2026-07-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_total": "20.00"
  }
]
```

</details>

<details><summary>TEST-201 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-06-01' AND t.date < DATE '2026-07-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-06-01' AS DATE) AND t.date < CAST('2026-07-01' AS DATE) LIMIT 50
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

<details><summary>TEST-202 — EX=True, VES=0.995929</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-06-01' AND t.date < DATE '2026-07-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS tipo, COALESCE(SUM(ti.quantity), 0) AS total_cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-06-01' AS DATE) AND t.date < CAST('2026-07-01' AS DATE) AND ti.item_type IN ('Consumo', 'Producido') GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "total_cantidad": "5.00"
  },
  {
    "tipo": "Producido",
    "total_cantidad": "2.00"
  }
]
```

</details>

<details><summary>TEST-203 — EX=True, VES=0.702418</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-06-01' AND im.moved_at < DATE '2026-07-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-06-01' AS DATE) AND im.moved_at < CAST('2026-07-01' AS DATE) GROUP BY p.name ORDER BY cantidad_total DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_total": "3.00"
  }
]
```

</details>

<details><summary>TEST-204 — EX=True, VES=0.981158</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-06-01' AND je.entry_date < DATE '2026-07-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debe": "200.00",
    "total_haber": "180.00"
  }
]
```

</details>

<details><summary>TEST-205 — EX=True, VES=0.985062</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-06-01' AND je.entry_date < DATE '2026-07-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  },
  {
    "code": "609001",
    "name": "Cuenta de activo de prueba del mes 6",
    "saldo": "200.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS cuenta_codigo, aa.name AS cuenta_nombre, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta_codigo LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta_codigo": "201001",
    "cuenta_nombre": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta_codigo": "401001",
    "cuenta_nombre": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "cuenta_codigo": "609001",
    "cuenta_nombre": "Cuenta de activo de prueba del mes 6",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-206 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-06-01' AND je.entry_date < DATE '2026-07-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-207 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-06-01' AND je.entry_date < DATE '2026-07-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-06-02",
    "entry_date": "2026-06-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS codigo, je.entry_date AS fecha, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo": "BENCH26-06-02",
    "fecha": "2026-06-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-208 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '6%' AND je.entry_date >= DATE '2026-06-01' AND je.entry_date < DATE '2026-07-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '6%' AND je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo": "200.00"
  }
]
```

</details>

<details><summary>TEST-209 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-06-01' AND je.entry_date < DATE '2026-07-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS tipo, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Activo",
    "total_debe": "200.00",
    "total_haber": "0.00"
  },
  {
    "tipo": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "100.00"
  },
  {
    "tipo": "Pasivo",
    "total_debe": "0.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-210 — EX=True, VES=0.982701</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-07-01' AND ap.end_date >= DATE '2026-06-01' LIMIT 50
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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-07-01' AS DATE) AND ap.end_date >= CAST('2026-06-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_periodos": "1"
  }
]
```

</details>

<details><summary>TEST-211 — EX=True, VES=0.99234</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-07-01' AND si.issued_at < DATE '2026-08-01' LIMIT 50
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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-07-01' AS DATE) AND si.issued_at < CAST('2026-08-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-212 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-07-01' AND si.issued_at < DATE '2026-08-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-07-01' AS DATE) AND si.issued_at < CAST('2026-08-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-213 — EX=True, VES=0.954893</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-07-01' AND sp.paid_at < DATE '2026-08-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-07-01' AS DATE) AND sp.paid_at < CAST('2026-08-01' AS DATE) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  },
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  }
]
```

</details>

<details><summary>TEST-214 — EX=True, VES=0.979666</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-07-01' AND so.ordered_at < DATE '2026-08-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos_cerrados_para_llevar FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos_cerrados_para_llevar": "1"
  }
]
```

</details>

<details><summary>TEST-215 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-07-01' AND so.ordered_at < DATE '2026-08-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-07-01' AS DATE) AND so.ordered_at < CAST('2026-08-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "3"
  }
]
```

</details>

<details><summary>TEST-216 — EX=True, VES=0.997988</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-07-01' AND so.ordered_at < DATE '2026-08-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
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
SELECT so.order_type AS canal_pedido, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-07-01' AS DATE) AND si.issued_at < CAST('2026-08-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-217 — EX=True, VES=0.980057</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-07-01' AND so.ordered_at < DATE '2026-08-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
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
SELECT dt.number AS mesa, COUNT(*) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-07-01' AS DATE) AND so.ordered_at < CAST('2026-08-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
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

<details><summary>TEST-218 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-07-01' AND pi.issued_at < DATE '2026-08-01' LIMIT 50
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
SELECT COUNT(*) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-07-01' AS DATE) AND pi.issued_at < CAST('2026-08-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "1"
  }
]
```

</details>

<details><summary>TEST-219 — EX=True, VES=0.971086</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-07-01' AND pi.issued_at < DATE '2026-08-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
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
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-07-01' AS DATE) AND pi.issued_at < CAST('2026-08-01' AS DATE) GROUP BY s.business_name ORDER BY total_comprado DESC LIMIT 50
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

<details><summary>TEST-220 — EX=True, VES=0.995628</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-07-01' AND pp.paid_at < DATE '2026-08-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.supplier AS s ON pi.supplier_id = s.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-07-01' AS DATE) AND pp.paid_at < CAST('2026-08-01' AS DATE) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-221 — EX=True, VES=0.982026</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-07-01' AND ip.date < DATE '2026-08-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
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
SELECT ip.expense_category AS expense_category, SUM(ip.amount_paid) AS total_gasto FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-07-01' AS DATE) AND ip.date < CAST('2026-08-01' AS DATE) GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-222 — EX=True, VES=0.984582</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-07-01' AND po.issued_at < DATE '2026-08-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "FullyReceived",
    "total": 1
  },
  {
    "status": "Pending",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-07-01' AS DATE) AND po.issued_at < CAST('2026-08-01' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "estado": "FullyReceived",
    "total_ordenes": "1"
  },
  {
    "estado": "Pending",
    "total_ordenes": "1"
  }
]
```

</details>

<details><summary>TEST-223 — EX=True, VES=0.973763</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-07-01' AND po.issued_at < DATE '2026-08-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
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
SELECT p.id AS producto_id, p.name AS producto_nombre, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-07-01' AS DATE) AND po.issued_at < CAST('2026-08-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto_id": "21",
    "producto_nombre": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-224 — EX=True, VES=0.947525</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-07-01' AND pi.issued_at < DATE '2026-08-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990007,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-07-01' AS DATE) AND pi.issued_at < CAST('2026-08-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990007",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-225 — EX=True, VES=0.984411</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-07-01' AND cm.created_at < DATE '2026-08-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-07-01' AS DATE) AND cm.created_at < CAST('2026-08-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-226 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-07-01' AND cm.created_at < DATE '2026-08-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.sales_cash), 0) + COALESCE(SUM(cs.sales_other), 0) AS total_ingresos FROM public.cash_session AS cs WHERE cs.opened_at >= CAST('2026-07-01' AS DATE) AND cs.opened_at < CAST('2026-08-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "1270.00"
  }
]
```

</details>

<details><summary>TEST-227 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-07-01' AND cs.closed_at < DATE '2026-08-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-228 — EX=True, VES=0.982164</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-07-01' AND cs.closed_at < DATE '2026-08-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-229 — EX=True, VES=0.949329</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-07-01' AND cs.closed_at < DATE '2026-08-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "suma_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-230 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-07-01' AND cm.created_at < DATE '2026-08-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-231 — EX=True, VES=0.979339</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-07-01' AND cm.created_at < DATE '2026-08-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) GROUP BY cr.name ORDER BY caja_registradora LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-232 — EX=True, VES=0.983195</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-07-01' AND im.moved_at < DATE '2026-08-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS cantidad_movimientos, COALESCE(SUM(im.quantity), 0) AS total_cantidad FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-07-01' AS DATE) AND im.moved_at < CAST('2026-08-01' AS DATE) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-233 — EX=True, VES=0.748881</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-07-01' AND im.moved_at < DATE '2026-08-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, SUM(im.quantity) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-07-01' AS DATE) AND im.moved_at < CAST('2026-08-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades": "2.00"
  }
]
```

</details>

<details><summary>TEST-234 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-07-01' AND im.moved_at < DATE '2026-08-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-07-01' AS DATE) AND im.moved_at < CAST('2026-08-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "1.00"
  }
]
```

</details>

<details><summary>TEST-235 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-07-01' AND im.moved_at < DATE '2026-08-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-07-01' AS DATE) AND im.moved_at < CAST('2026-08-01' AS DATE) GROUP BY p.name ORDER BY insumo LIMIT 50
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

<details><summary>TEST-236 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-07-01' AND t.date < DATE '2026-08-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-07-01' AS DATE) AND t.date < CAST('2026-08-01' AS DATE) LIMIT 50
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

<details><summary>TEST-237 — EX=True, VES=0.974997</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-07-01' AND t.date < DATE '2026-08-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS tipo, COALESCE(SUM(ti.quantity), 0) AS total_cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-07-01' AS DATE) AND t.date < CAST('2026-08-01' AS DATE) AND ti.item_type IN ('Consumo', 'Producido') GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "total_cantidad": "5.00"
  },
  {
    "tipo": "Producido",
    "total_cantidad": "2.00"
  }
]
```

</details>

<details><summary>TEST-238 — EX=True, VES=0.99391</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-07-01' AND im.moved_at < DATE '2026-08-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad_ajustada FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-07-01' AS DATE) AND im.moved_at < CAST('2026-08-01' AS DATE) GROUP BY p.name ORDER BY cantidad_ajustada DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_ajustada": "3.00"
  }
]
```

</details>

<details><summary>TEST-239 — EX=True, VES=0.823787</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-07-01' AND je.entry_date < DATE '2026-08-01' LIMIT 50
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
SELECT SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debe": "200.00",
    "total_haber": "180.00"
  }
]
```

</details>

<details><summary>TEST-240 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-07-01' AND je.entry_date < DATE '2026-08-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  },
  {
    "code": "709001",
    "name": "Cuenta de activo de prueba del mes 7",
    "saldo": "200.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS cuenta_codigo, aa.name AS cuenta_nombre, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta_codigo LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta_codigo": "201001",
    "cuenta_nombre": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta_codigo": "401001",
    "cuenta_nombre": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "cuenta_codigo": "709001",
    "cuenta_nombre": "Cuenta de activo de prueba del mes 7",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-241 — EX=True, VES=0.997946</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-07-01' AND je.entry_date < DATE '2026-08-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS diario, COUNT(DISTINCT je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-242 — EX=True, VES=0.98575</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-07-01' AND je.entry_date < DATE '2026-08-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-07-02",
    "entry_date": "2026-07-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS codigo, je.entry_date AS fecha, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo": "BENCH26-07-02",
    "fecha": "2026-07-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-243 — EX=True, VES=0.991554</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '7%' AND je.entry_date >= DATE '2026-07-01' AND je.entry_date < DATE '2026-08-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '7%' AND je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-244 — EX=True, VES=0.950546</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-07-01' AND je.entry_date < DATE '2026-08-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS tipo, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Activo",
    "total_debe": "200.00",
    "total_haber": "0.00"
  },
  {
    "tipo": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "100.00"
  },
  {
    "tipo": "Pasivo",
    "total_debe": "0.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-245 — EX=True, VES=0.974661</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-08-01' AND ap.end_date >= DATE '2026-07-01' LIMIT 50
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
SELECT COUNT(*) AS periodos_abiertos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-08-01' AS DATE) AND ap.end_date >= CAST('2026-07-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "periodos_abiertos": "1"
  }
]
```

</details>

<details><summary>TEST-246 — EX=True, VES=0.987459</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-08-01' AND si.issued_at < DATE '2026-09-01' LIMIT 50
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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-08-01' AS DATE) AND si.issued_at < CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-247 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-08-01' AND si.issued_at < DATE '2026-09-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-08-01' AS DATE) AND si.issued_at < CAST('2026-09-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-248 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-08-01' AND sp.paid_at < DATE '2026-09-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  },
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  }
]
```

</details>

<details><summary>TEST-249 — EX=True, VES=0.986203</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-08-01' AND so.ordered_at < DATE '2026-09-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-08-01' AS DATE) AND so.ordered_at < CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-250 — EX=True, VES=0.98163</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-08-01' AND so.ordered_at < DATE '2026-09-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-08-01' AS DATE) AND so.ordered_at < CAST('2026-09-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "3"
  }
]
```

</details>

<details><summary>TEST-251 — EX=True, VES=0.920877</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-08-01' AND so.ordered_at < DATE '2026-09-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
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
SELECT so.order_type AS canal_pedido, COALESCE(SUM(si.total_amount), 0) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-08-01' AS DATE) AND si.issued_at < CAST('2026-09-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-252 — EX=True, VES=0.99721</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-08-01' AND so.ordered_at < DATE '2026-09-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
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
SELECT dt.number AS mesa, COUNT(*) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-08-01' AS DATE) AND so.ordered_at < CAST('2026-09-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
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

<details><summary>TEST-253 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-08-01' AND pi.issued_at < DATE '2026-09-01' LIMIT 50
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
SELECT COUNT(*) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-08-01' AS DATE) AND pi.issued_at < CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "1"
  }
]
```

</details>

<details><summary>TEST-254 — EX=True, VES=0.975578</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-08-01' AND pi.issued_at < DATE '2026-09-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
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
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-08-01' AS DATE) AND pi.issued_at < CAST('2026-09-01' AS DATE) GROUP BY s.business_name ORDER BY total_comprado DESC LIMIT 50
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

<details><summary>TEST-255 — EX=True, VES=0.988351</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-08-01' AND pp.paid_at < DATE '2026-09-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id WHERE pp.paid_at >= CAST('2026-08-01' AS DATE) AND pp.paid_at < CAST('2026-09-01' AS DATE) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-256 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-08-01' AND ip.date < DATE '2026-09-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
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
SELECT ip.expense_category AS categoria, COALESCE(SUM(ip.amount_paid), 0) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.annulled = FALSE AND ip.date >= CAST('2026-08-01' AS DATE) AND ip.date < CAST('2026-09-01' AS DATE) GROUP BY ip.expense_category ORDER BY total_gastado DESC LIMIT 50
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

<details><summary>TEST-257 — EX=True, VES=0.994306</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-08-01' AND po.issued_at < DATE '2026-09-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "FullyReceived",
    "total": 1
  },
  {
    "status": "Pending",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-08-01' AS DATE) AND po.issued_at < CAST('2026-09-01' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "estado": "FullyReceived",
    "total_ordenes": "1"
  },
  {
    "estado": "Pending",
    "total_ordenes": "1"
  }
]
```

</details>

<details><summary>TEST-258 — EX=True, VES=0.957711</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-08-01' AND po.issued_at < DATE '2026-09-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
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
SELECT p.id AS producto_id, p.name AS producto, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-08-01' AS DATE) AND po.issued_at < CAST('2026-09-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
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

<details><summary>TEST-259 — EX=True, VES=0.978026</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-08-01' AND pi.issued_at < DATE '2026-09-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990008,
    "saldo_pendiente": "136.00"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-08-01' AS DATE) AND pi.issued_at < CAST('2026-09-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": "990008",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-260 — EX=True, VES=0.996209</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-08-01' AND cm.created_at < DATE '2026-09-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-08-01' AS DATE) AND cm.created_at < CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-261 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-08-01' AND cm.created_at < DATE '2026-09-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.total_sales), 0) AS total_ingresos FROM public.cash_session AS cs WHERE cs.closed_at >= CAST('2026-08-01' AS DATE) AND cs.closed_at < CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos": "1270.00"
  }
]
```

</details>

<details><summary>TEST-262 — EX=True, VES=0.816436</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-08-01' AND cs.closed_at < DATE '2026-09-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-08-01' AS DATE) AND cs.closed_at < CAST('2026-09-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-263 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-08-01' AND cs.closed_at < DATE '2026-09-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS ventas_efectivo, COALESCE(SUM(cs.sales_other), 0) AS ventas_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-08-01' AS DATE) AND cs.closed_at < CAST('2026-09-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros": "420.00"
  }
]
```

</details>

<details><summary>TEST-264 — EX=True, VES=0.98979</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-08-01' AND cs.closed_at < DATE '2026-09-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-08-01' AS DATE) AND cs.closed_at < CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "suma_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-265 — EX=True, VES=0.98429</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-08-01' AND cm.created_at < DATE '2026-09-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.created_at >= CAST('2026-08-01' AS DATE) AND cm.created_at < CAST('2026-09-01' AS DATE) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-266 — EX=True, VES=0.983694</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-08-01' AND cm.created_at < DATE '2026-09-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
SELECT cr.name AS caja_registradora, COALESCE(SUM(cm.amount), 0) AS total_egresos_manual FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name ORDER BY caja_registradora LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresos_manual": "45.00"
  }
]
```

</details>

<details><summary>TEST-267 — EX=True, VES=0.922886</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-08-01' AND im.moved_at < DATE '2026-09-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS cantidad_movimientos, COALESCE(SUM(im.quantity), 0) AS total_cantidad FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-08-01' AS DATE) AND im.moved_at < CAST('2026-09-01' AS DATE) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-268 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-08-01' AND im.moved_at < DATE '2026-09-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS unidades_vendidas FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-08-01' AS DATE) AND im.moved_at < CAST('2026-09-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "2.00"
  }
]
```

</details>

<details><summary>TEST-269 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-08-01' AND im.moved_at < DATE '2026-09-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad_merma FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-08-01' AS DATE) AND im.moved_at < CAST('2026-09-01' AS DATE) GROUP BY p.name ORDER BY cantidad_merma DESC LIMIT 50
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

<details><summary>TEST-270 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-08-01' AND im.moved_at < DATE '2026-09-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-08-01' AS DATE) AND im.moved_at < CAST('2026-09-01' AS DATE) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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

<details><summary>TEST-271 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-08-01' AND t.date < DATE '2026-09-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-08-01' AS DATE) AND t.date < CAST('2026-09-01' AS DATE) LIMIT 50
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

<details><summary>TEST-272 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-08-01' AND t.date < DATE '2026-09-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS tipo, SUM(ti.quantity) AS total_cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-08-01' AS DATE) AND t.date < CAST('2026-09-01' AS DATE) AND ti.item_type IN ('Consumo', 'Producido') GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "total_cantidad": "5.00"
  },
  {
    "tipo": "Producido",
    "total_cantidad": "2.00"
  }
]
```

</details>

<details><summary>TEST-273 — EX=True, VES=0.998493</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-08-01' AND im.moved_at < DATE '2026-09-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad_ajustada FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-08-01' AS DATE) AND im.moved_at < CAST('2026-09-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_ajustada": "3.00"
  }
]
```

</details>

<details><summary>TEST-274 — EX=True, VES=0.972159</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-08-01' AND je.entry_date < DATE '2026-09-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debe": "200.00",
    "total_haber": "180.00"
  }
]
```

</details>

<details><summary>TEST-275 — EX=True, VES=0.977286</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-08-01' AND je.entry_date < DATE '2026-09-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  },
  {
    "code": "809001",
    "name": "Cuenta de activo de prueba del mes 8",
    "saldo": "200.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS cuenta_codigo, aa.name AS cuenta_nombre, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta_codigo LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta_codigo": "201001",
    "cuenta_nombre": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta_codigo": "401001",
    "cuenta_nombre": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "cuenta_codigo": "809001",
    "cuenta_nombre": "Cuenta de activo de prueba del mes 8",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-276 — EX=True, VES=0.986286</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-08-01' AND je.entry_date < DATE '2026-09-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-277 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-08-01' AND je.entry_date < DATE '2026-09-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-08-02",
    "entry_date": "2026-08-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-08-02",
    "entry_date": "2026-08-23",
    "total_debit": "100.00",
    "total_credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-278 — EX=True, VES=0.979946</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '1%' AND je.entry_date >= DATE '2026-08-01' AND je.entry_date < DATE '2026-09-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "saldo": "0"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code = '1' AND je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-279 — EX=True, VES=0.997575</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-08-01' AND je.entry_date < DATE '2026-09-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS tipo, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Activo",
    "total_debe": "200.00",
    "total_haber": "0.00"
  },
  {
    "tipo": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "100.00"
  },
  {
    "tipo": "Pasivo",
    "total_debe": "0.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-280 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-09-01' AND ap.end_date >= DATE '2026-08-01' LIMIT 50
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
SELECT COUNT(*) AS periodos_abiertos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-09-01' AS DATE) AND ap.end_date >= CAST('2026-08-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "periodos_abiertos": "1"
  }
]
```

</details>

<details><summary>TEST-281 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-09-01' AND si.issued_at < DATE '2026-10-01' LIMIT 50
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
SELECT COALESCE(SUM(si.total_amount), 0) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-09-01' AS DATE) AND si.issued_at < CAST('2026-10-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "165.00"
  }
]
```

</details>

<details><summary>TEST-282 — EX=True, VES=0.980971</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-09-01' AND si.issued_at < DATE '2026-10-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-09-01' AS DATE) AND si.issued_at < CAST('2026-10-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-283 — EX=True, VES=0.874626</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-09-01' AND sp.paid_at < DATE '2026-10-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  },
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "70.00"
  }
]
```

</details>

<details><summary>TEST-284 — EX=True, VES=0.997554</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-09-01' AND so.ordered_at < DATE '2026-10-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-09-01' AS DATE) AND so.ordered_at < CAST('2026-10-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-285 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-09-01' AND so.ordered_at < DATE '2026-10-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-09-01' AS DATE) AND so.ordered_at < CAST('2026-10-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "3"
  }
]
```

</details>

<details><summary>TEST-286 — EX=True, VES=0.969275</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-09-01' AND so.ordered_at < DATE '2026-10-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
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
SELECT so.order_type AS canal, COALESCE(SUM(si.total_amount), 0) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-09-01' AS DATE) AND si.issued_at < CAST('2026-10-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-287 — EX=True, VES=0.986195</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-09-01' AND so.ordered_at < DATE '2026-10-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
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
SELECT dt.number AS mesa, COUNT(*) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-09-01' AS DATE) AND so.ordered_at < CAST('2026-10-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
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

<details><summary>TEST-288 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-09-01' AND pi.issued_at < DATE '2026-10-01' LIMIT 50
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
SELECT COUNT(*) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-09-01' AS DATE) AND pi.issued_at < CAST('2026-10-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "1"
  }
]
```

</details>

<details><summary>TEST-289 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-09-01' AND pi.issued_at < DATE '2026-10-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
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
SELECT s.business_name AS business_name, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-09-01' AS DATE) AND pi.issued_at < CAST('2026-10-01' AS DATE) GROUP BY s.business_name LIMIT 50
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

<details><summary>TEST-290 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-09-01' AND pp.paid_at < DATE '2026-10-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
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
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pi.issued_at >= CAST('2026-09-01' AS DATE) AND pi.issued_at < CAST('2026-10-01' AS DATE) GROUP BY pt.name ORDER BY total_pagado DESC LIMIT 50
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

<details><summary>TEST-291 — EX=True, VES=0.990803</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-09-01' AND ip.date < DATE '2026-10-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
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
SELECT ip.expense_category AS categoria, COALESCE(SUM(ip.amount_paid), 0) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.annulled = FALSE AND ip.date >= CAST('2026-09-01' AS DATE) AND ip.date < CAST('2026-10-01' AS DATE) GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-292 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-09-01' AND po.issued_at < DATE '2026-10-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "FullyReceived",
    "total": 1
  },
  {
    "status": "Pending",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS status, COUNT(*) AS total FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-09-01' AS DATE) AND po.issued_at < CAST('2026-10-01' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "status": "FullyReceived",
    "total": "1"
  },
  {
    "status": "Pending",
    "total": "1"
  }
]
```

</details>

<details><summary>TEST-293 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-09-01' AND po.issued_at < DATE '2026-10-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
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
SELECT p.id AS product_id, p.name AS product_name, COALESCE(SUM(poi.quantity_received), 0) AS total_received FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-09-01' AS DATE) AND po.issued_at < CAST('2026-10-01' AS DATE) GROUP BY p.id, p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "product_id": "21",
    "product_name": "Pollo entero de prueba",
    "total_received": "20.00"
  }
]
```

</details>

<details><summary>TEST-294 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-09-01' AND pi.issued_at < DATE '2026-10-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990009,
    "saldo_pendiente": "136.00"
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

<details><summary>TEST-295 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-09-01' AND cm.created_at < DATE '2026-10-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-09-01' AS DATE) AND cm.created_at < CAST('2026-10-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-296 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-09-01' AND cm.created_at < DATE '2026-10-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.sales_cash), 0) AS total_ingresos_caja FROM public.cash_session AS cs WHERE EXTRACT(YEAR FROM cs.closed_at) = 2026 AND EXTRACT(MONTH FROM cs.closed_at) = 9 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos_caja": "850.00"
  }
]
```

</details>

<details><summary>TEST-297 — EX=True, VES=0.999586</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-09-01' AND cs.closed_at < DATE '2026-10-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-09-01' AS DATE) AND cs.closed_at < CAST('2026-10-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
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

<details><summary>TEST-298 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-09-01' AND cs.closed_at < DATE '2026-10-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS ventas_efectivo, COALESCE(SUM(cs.sales_other), 0) AS ventas_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-09-01' AS DATE) AND cs.closed_at < CAST('2026-10-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros": "420.00"
  }
]
```

</details>

<details><summary>TEST-299 — EX=True, VES=0.983664</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-09-01' AND cs.closed_at < DATE '2026-10-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-09-01' AS DATE) AND cs.closed_at < CAST('2026-10-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "suma_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-300 — EX=True, VES=0.984049</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-09-01' AND cm.created_at < DATE '2026-10-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.created_at >= CAST('2026-09-01' AS DATE) AND cm.created_at < CAST('2026-10-01' AS DATE) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-301 — EX=True, VES=0.998645</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-09-01' AND cm.created_at < DATE '2026-10-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
SELECT cr.name AS caja, COALESCE(SUM(cm.amount), 0) AS importe_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name ORDER BY importe_egresos DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "importe_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-302 — EX=True, VES=0.99944</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-09-01' AND im.moved_at < DATE '2026-10-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS total_cantidad FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-09-01' AS DATE) AND im.moved_at < CAST('2026-10-01' AS DATE) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "movement_type": "Sale",
    "movimientos": "1",
    "total_cantidad": "2.00"
  },
  {
    "movement_type": "Shrinkage",
    "movimientos": "1",
    "total_cantidad": "1.00"
  },
  {
    "movement_type": "Adjustment",
    "movimientos": "1",
    "total_cantidad": "3.00"
  },
  {
    "movement_type": "Purchase",
    "movimientos": "1",
    "total_cantidad": "20.00"
  }
]
```

</details>

<details><summary>TEST-303 — EX=True, VES=0.788236</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-09-01' AND im.moved_at < DATE '2026-10-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS unidades_vendidas FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-09-01' AS DATE) AND im.moved_at < CAST('2026-10-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "2.00"
  }
]
```

</details>

<details><summary>TEST-304 — EX=True, VES=0.981013</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-09-01' AND im.moved_at < DATE '2026-10-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-09-01' AS DATE) AND im.moved_at < CAST('2026-10-01' AS DATE) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "1.00"
  }
]
```

</details>

<details><summary>TEST-305 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-09-01' AND im.moved_at < DATE '2026-10-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS insumo, COALESCE(SUM(im.quantity), 0) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-09-01' AS DATE) AND im.moved_at < CAST('2026-10-01' AS DATE) GROUP BY p.name ORDER BY insumo LIMIT 50
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

<details><summary>TEST-306 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-09-01' AND t.date < DATE '2026-10-01' LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-09-01' AS DATE) AND t.date < CAST('2026-10-01' AS DATE) LIMIT 50
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

<details><summary>TEST-307 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-09-01' AND t.date < DATE '2026-10-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
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
SELECT ti.item_type AS tipo, SUM(ti.quantity) AS total_cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-09-01' AS DATE) AND t.date < CAST('2026-10-01' AS DATE) AND ti.item_type IN ('Consumo', 'Producido') GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "total_cantidad": "5.00"
  },
  {
    "tipo": "Producido",
    "total_cantidad": "2.00"
  }
]
```

</details>

<details><summary>TEST-308 — EX=True, VES=0.997301</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-09-01' AND im.moved_at < DATE '2026-10-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT p.name AS producto, COALESCE(SUM(im.quantity), 0) AS cantidad_ajustada FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-09-01' AS DATE) AND im.moved_at < CAST('2026-10-01' AS DATE) GROUP BY p.name ORDER BY cantidad_ajustada DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad_ajustada": "3.00"
  }
]
```

</details>

<details><summary>TEST-309 — EX=True, VES=0.980528</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debe": "200.00",
    "total_haber": "180.00"
  }
]
```

</details>

<details><summary>TEST-310 — EX=True, VES=0.971114</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  },
  {
    "code": "909001",
    "name": "Cuenta de activo de prueba del mes 9",
    "saldo": "200.00"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS cuenta_codigo, aa.name AS cuenta_nombre, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY cuenta_codigo LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "cuenta_codigo": "201001",
    "cuenta_nombre": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "cuenta_codigo": "401001",
    "cuenta_nombre": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "cuenta_codigo": "909001",
    "cuenta_nombre": "Cuenta de activo de prueba del mes 9",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-311 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
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
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY je.book ORDER BY total_asientos DESC LIMIT 50
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

<details><summary>TEST-312 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-09-02",
    "entry_date": "2026-09-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS codigo, je.entry_date AS fecha, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo": "BENCH26-09-02",
    "fecha": "2026-09-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-313 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '2%' AND je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "saldo": "-80.00"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code = '2' AND je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-314 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
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
SELECT aa.type AS tipo, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Activo",
    "total_debe": "200.00",
    "total_haber": "0.00"
  },
  {
    "tipo": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "100.00"
  },
  {
    "tipo": "Pasivo",
    "total_debe": "0.00",
    "total_haber": "80.00"
  }
]
```

</details>

<details><summary>TEST-315 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-10-01' AND ap.end_date >= DATE '2026-09-01' LIMIT 50
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
SELECT COUNT(*) AS periodos_abiertos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-10-01' AS DATE) AND ap.end_date >= CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "periodos_abiertos": "1"
  }
]
```

</details>

<details><summary>TEST-316 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-10-01' AND si.issued_at < DATE '2026-11-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "571.20"
  }
]
```

**SQL generada**

```sql
SELECT SUM(si.total_amount) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-10-01' AS DATE) AND si.issued_at < CAST('2026-11-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_importe": "571.20"
  }
]
```

</details>

<details><summary>TEST-317 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si WHERE si.status = 'Issued' AND si.issued_at >= DATE '2026-10-01' AND si.issued_at < DATE '2026-11-01' GROUP BY si.voucher_type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "voucher_type": "Boleta",
    "total": "486.30"
  },
  {
    "voucher_type": "Factura",
    "total": "84.90"
  }
]
```

**SQL generada**

```sql
SELECT si.voucher_type AS tipo_comprobante, COALESCE(SUM(si.total_amount), 0) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-10-01' AS DATE) AND si.issued_at < CAST('2026-11-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_comprobante": "Factura",
    "total_facturado": "84.90"
  },
  {
    "tipo_comprobante": "Boleta",
    "total_facturado": "486.30"
  }
]
```

</details>

<details><summary>TEST-318 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp JOIN payment_type pt ON pt.id = sp.payment_type_id WHERE sp.paid_at >= DATE '2026-10-01' AND sp.paid_at < DATE '2026-11-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "medio": "Efectivo",
    "total": "249.20"
  },
  {
    "medio": "Tarjeta / POS",
    "total": "217.10"
  },
  {
    "medio": "Tarjeta",
    "total": "95.00"
  },
  {
    "medio": "Yape",
    "total": "9.90"
  }
]
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, COALESCE(SUM(sp.amount), 0) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-10-01' AS DATE) AND sp.paid_at < CAST('2026-11-01' AS DATE) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Efectivo",
    "total_cobrado": "249.20"
  },
  {
    "medio_pago": "Tarjeta / POS",
    "total_cobrado": "217.10"
  },
  {
    "medio_pago": "Tarjeta",
    "total_cobrado": "95.00"
  },
  {
    "medio_pago": "Yape",
    "total_cobrado": "9.90"
  }
]
```

</details>

<details><summary>TEST-319 — EX=True, VES=0.949338</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= DATE '2026-10-01' AND so.ordered_at < DATE '2026-11-01' LIMIT 50
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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-320 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id WHERE so.status = 'Closed' AND p.sellable = TRUE AND so.ordered_at >= DATE '2026-10-01' AND so.ordered_at < DATE '2026-11-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5
```

**Respuesta SQL gold**

```json
[
  {
    "name": "1/4 Pollo a la Brasa",
    "unidades": 11
  },
  {
    "name": "Agua Mineral 600ml",
    "unidades": 4
  },
  {
    "name": "Pollo a la brasa de prueba",
    "unidades": 3
  },
  {
    "name": "Coca Cola 1.5L",
    "unidades": 2
  },
  {
    "name": "1/2 Pollo a la Brasa",
    "unidades": 2
  }
]
```

**SQL generada**

```sql
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON p.id = oi.product_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-10-01' AS DATE) AND so.ordered_at < CAST('2026-11-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "1/4 Pollo a la Brasa",
    "unidades_vendidas": "11"
  },
  {
    "producto": "Agua Mineral 600ml",
    "unidades_vendidas": "4"
  },
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_vendidas": "3"
  },
  {
    "producto": "1/2 Pollo a la Brasa",
    "unidades_vendidas": "2"
  },
  {
    "producto": "Coca Cola 1.5L",
    "unidades_vendidas": "2"
  },
  {
    "producto": "Jarra de Maracuyá 1L",
    "unidades_vendidas": "1"
  },
  {
    "producto": "Inca Kola 1.5L",
    "unidades_vendidas": "1"
  },
  {
    "producto": "Mostrito Especial",
    "unidades_vendidas": "1"
  }
]
```

</details>

<details><summary>TEST-321 — EX=True, VES=0.984354</summary>

**SQL gold**

```sql
SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= DATE '2026-10-01' AND so.ordered_at < DATE '2026-11-01' GROUP BY so.order_type ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "order_type": "Mesa",
    "total": "516.20"
  },
  {
    "order_type": "Llevar",
    "total": "55.00"
  }
]
```

**SQL generada**

```sql
SELECT so.order_type AS canal, COALESCE(SUM(si.total_amount), 0) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-10-01' AS DATE) AND si.issued_at < CAST('2026-11-01' AS DATE) GROUP BY so.order_type LIMIT 50
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
    "total_vendido": "516.20"
  }
]
```

</details>

<details><summary>TEST-322 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' AND so.ordered_at >= DATE '2026-10-01' AND so.ordered_at < DATE '2026-11-01' GROUP BY dt.id, dt.number ORDER BY dt.number LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "mesa": 1,
    "pedidos": 5
  },
  {
    "mesa": 2,
    "pedidos": 3
  },
  {
    "mesa": 3,
    "pedidos": 1
  },
  {
    "mesa": 4,
    "pedidos": 1
  },
  {
    "mesa": 99,
    "pedidos": 1
  }
]
```

**SQL generada**

```sql
SELECT dt.number AS mesa, COUNT(*) AS pedidos_cerrados FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-10-01' AS DATE) AND so.ordered_at < CAST('2026-11-01' AS DATE) GROUP BY dt.number ORDER BY mesa LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "mesa": "1",
    "pedidos_cerrados": "5"
  },
  {
    "mesa": "2",
    "pedidos_cerrados": "3"
  },
  {
    "mesa": "3",
    "pedidos_cerrados": "1"
  },
  {
    "mesa": "4",
    "pedidos_cerrados": "1"
  },
  {
    "mesa": "99",
    "pedidos_cerrados": "1"
  }
]
```

</details>

<details><summary>TEST-323 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-10-01' AND pi.issued_at < DATE '2026-11-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": "2129.01"
  }
]
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_facturas FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-10-01' AS DATE) AND pi.issued_at < CAST('2026-11-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas": "15"
  }
]
```

</details>

<details><summary>TEST-324 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-10-01' AND pi.issued_at < DATE '2026-11-01' GROUP BY s.id, s.business_name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "COMPAÑIA FOOD RETAIL S.A.C.",
    "total": "1356.17"
  },
  {
    "proveedor": "PONCE EVANGELISTA, RENZO DANIEL",
    "total": "285.00"
  },
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total": "236.00"
  },
  {
    "proveedor": "AGRICOLA CERRO PRIETO S.A.",
    "total": "225.88"
  },
  {
    "proveedor": "PUESCAS PINGO, MANUEL ARMANDO",
    "total": "25.96"
  }
]
```

**SQL generada**

```sql
SELECT s.business_name AS proveedor, COALESCE(SUM(pi.total_amount), 0) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-10-01' AS DATE) AND pi.issued_at < CAST('2026-11-01' AS DATE) AND pi.active = TRUE GROUP BY s.business_name ORDER BY total_comprado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "COMPAÑIA FOOD RETAIL S.A.C.",
    "total_comprado": "1356.17"
  },
  {
    "proveedor": "PONCE EVANGELISTA, RENZO DANIEL",
    "total_comprado": "285.00"
  },
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total_comprado": "236.00"
  },
  {
    "proveedor": "AGRICOLA CERRO PRIETO S.A.",
    "total_comprado": "225.88"
  },
  {
    "proveedor": "PUESCAS PINGO, MANUEL ARMANDO",
    "total_comprado": "25.96"
  }
]
```

</details>

<details><summary>TEST-325 — EX=True, VES=0.996339</summary>

**SQL gold**

```sql
SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp JOIN payment_type pt ON pt.id = pp.payment_type_id WHERE pp.paid_at >= DATE '2026-10-01' AND pp.paid_at < DATE '2026-11-01' GROUP BY pt.id, pt.name ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "medio": "Efectivo",
    "total": "1759.91"
  },
  {
    "medio": "Transferencia",
    "total": "150.00"
  },
  {
    "medio": "Yape",
    "total": "64.00"
  },
  {
    "medio": "Plin",
    "total": "5.00"
  }
]
```

**SQL generada**

```sql
SELECT pt.name AS medio_pago, COALESCE(SUM(pp.amount), 0) AS total_pagado FROM public.purchase_payment AS pp JOIN public.purchase_invoice AS pi ON pp.purchase_invoice_id = pi.id JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pi.issued_at >= CAST('2026-10-01' AS DATE) AND pi.issued_at < CAST('2026-11-01' AS DATE) GROUP BY pt.name ORDER BY total_pagado DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_pago": "Efectivo",
    "total_pagado": "1759.91"
  },
  {
    "medio_pago": "Transferencia",
    "total_pagado": "150.00"
  },
  {
    "medio_pago": "Yape",
    "total_pagado": "64.00"
  },
  {
    "medio_pago": "Plin",
    "total_pagado": "5.00"
  }
]
```

</details>

<details><summary>TEST-326 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip WHERE ip.annulled = FALSE AND ip.date >= DATE '2026-10-01' AND ip.date < DATE '2026-11-01' GROUP BY ip.expense_category ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "expense_category": "EventServices",
    "total": "300.00"
  },
  {
    "expense_category": "CleaningSupplies",
    "total": "38.00"
  },
  {
    "expense_category": null,
    "total": "5.00"
  }
]
```

**SQL generada**

```sql
SELECT ip.expense_category AS expense_category, COALESCE(SUM(ip.amount_paid), 0) AS total_gasto FROM public.informal_purchase AS ip WHERE ip.annulled = FALSE AND ip.date >= CAST('2026-10-01' AS DATE) AND ip.date < CAST('2026-11-01' AS DATE) GROUP BY ip.expense_category LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "expense_category": "EventServices",
    "total_gasto": "300.00"
  },
  {
    "expense_category": "CleaningSupplies",
    "total_gasto": "38.00"
  },
  {
    "expense_category": null,
    "total_gasto": "5.00"
  }
]
```

</details>

<details><summary>TEST-327 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-10-01' AND po.issued_at < DATE '2026-11-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "status": "FullyReceived",
    "total": 15
  },
  {
    "status": "Pending",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-10-01' AS DATE) AND po.issued_at < CAST('2026-11-01' AS DATE) GROUP BY po.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "estado": "FullyReceived",
    "total_ordenes": "15"
  },
  {
    "estado": "Pending",
    "total_ordenes": "1"
  }
]
```

</details>

<details><summary>TEST-328 — EX=True, VES=0.987052</summary>

**SQL gold**

```sql
SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po JOIN purchase_order_item poi ON poi.purchase_order_id = po.id JOIN product p ON p.id = poi.product_id WHERE po.issued_at >= DATE '2026-10-01' AND po.issued_at < DATE '2026-11-01' GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero",
    "unidades": "72.00"
  },
  {
    "name": "Presas de pollo",
    "unidades": "22.00"
  },
  {
    "name": "Pollo entero de prueba",
    "unidades": "20.00"
  },
  {
    "name": "Papa",
    "unidades": "20.00"
  },
  {
    "name": "1 Pollo a la Brasa Entero",
    "unidades": "1.00"
  }
]
```

**SQL generada**

```sql
SELECT p.name AS producto, COALESCE(SUM(poi.quantity_received), 0) AS unidades_recibidas FROM public.purchase_order AS po JOIN public.purchase_order_item AS poi ON poi.purchase_order_id = po.id JOIN public.product AS p ON p.id = poi.product_id WHERE po.issued_at >= CAST('2026-10-01' AS DATE) AND po.issued_at < CAST('2026-11-01' AS DATE) GROUP BY p.name ORDER BY unidades_recibidas DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero",
    "unidades_recibidas": "72.00"
  },
  {
    "producto": "Presas de pollo",
    "unidades_recibidas": "22.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  },
  {
    "producto": "Papa",
    "unidades_recibidas": "20.00"
  },
  {
    "producto": "1 Pollo a la Brasa Entero",
    "unidades_recibidas": "1.00"
  }
]
```

</details>

<details><summary>TEST-329 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT s.business_name AS proveedor, pi.series, pi.number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= DATE '2026-10-01' AND pi.issued_at < DATE '2026-11-01' GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 ORDER BY saldo_pendiente DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "series": "F026",
    "number": 990010,
    "saldo_pendiente": "136.00"
  },
  {
    "proveedor": "COMPAÑIA FOOD RETAIL S.A.C.",
    "series": "F002",
    "number": 34123423,
    "saldo_pendiente": "11.10"
  },
  {
    "proveedor": "PONCE EVANGELISTA, RENZO DANIEL",
    "series": "F003",
    "number": 42345234,
    "saldo_pendiente": "3.00"
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

<details><summary>TEST-330 — EX=True, VES=0.999034</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-10-01' AND cm.created_at < DATE '2026-11-01' LIMIT 50
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos_octubre_2026 FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-10-01' AS DATE) AND cm.created_at < CAST('2026-11-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_egresos_octubre_2026": "45.00"
  }
]
```

</details>

<details><summary>TEST-331 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm WHERE cm.type = 'INCOME' AND cm.created_at >= DATE '2026-10-01' AND cm.created_at < DATE '2026-11-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.sales_cash), 0) AS total_ingresos_caja FROM public.cash_session AS cs WHERE cs.closed_at >= CAST('2026-10-01' AS DATE) AND cs.closed_at < CAST('2026-11-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ingresos_caja": "900.00"
  }
]
```

</details>

<details><summary>TEST-332 — EX=True, VES=0.977655</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-10-01' AND cs.closed_at < DATE '2026-11-01' GROUP BY cr.id, cr.name ORDER BY sesiones DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja Principal - Salón",
    "sesiones": 1
  },
  {
    "caja": "Caja de Prueba",
    "sesiones": 1
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-10-01' AS DATE) AND cs.closed_at < CAST('2026-11-01' AS DATE) GROUP BY cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja Principal - Salón",
    "sesiones_cerradas": "1"
  },
  {
    "caja": "Caja de Prueba",
    "sesiones_cerradas": "1"
  }
]
```

</details>

<details><summary>TEST-333 — EX=True, VES=0.974825</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM cash_session cs JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-10-01' AND cs.closed_at < DATE '2026-11-01' GROUP BY cr.id, cr.name ORDER BY caja LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "caja": "Caja Principal - Salón",
    "ventas_efectivo": "50.00",
    "ventas_otros": "9.90"
  },
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros": "420.00"
  }
]
```

**SQL generada**

```sql
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS total_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-10-01' AS DATE) AND cs.closed_at < CAST('2026-11-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja Principal - Salón",
    "total_efectivo": "50.00",
    "total_otros": "9.90"
  },
  {
    "caja": "Caja de Prueba",
    "total_efectivo": "850.00",
    "total_otros": "420.00"
  }
]
```

</details>

<details><summary>TEST-334 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= DATE '2026-10-01' AND cs.closed_at < DATE '2026-11-01' LIMIT 50
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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-10-01' AS DATE) AND cs.closed_at < CAST('2026-11-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "suma_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-335 — EX=True, VES=0.828025</summary>

**SQL gold**

```sql
SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm WHERE cm.created_at >= DATE '2026-10-01' AND cm.created_at < DATE '2026-11-01' GROUP BY cm.type ORDER BY total DESC LIMIT 50
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
SELECT cm.type AS tipo_movimiento, COALESCE(SUM(cm.amount), 0) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-336 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm JOIN cash_session cs ON cs.id = cm.session_id JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cm.type = 'EXPENSE' AND cm.created_at >= DATE '2026-10-01' AND cm.created_at < DATE '2026-11-01' GROUP BY cr.id, cr.name ORDER BY egresos DESC LIMIT 50
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-337 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-10-01' AND im.moved_at < DATE '2026-11-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "movement_type": "Purchase",
    "movimientos": 17,
    "cantidad": "135.00"
  },
  {
    "movement_type": "InformalPurchase",
    "movimientos": 7,
    "cantidad": "1.00"
  },
  {
    "movement_type": "Sale",
    "movimientos": 6,
    "cantidad": "7.00"
  },
  {
    "movement_type": "TransformationIn",
    "movimientos": 4,
    "cantidad": "65.00"
  },
  {
    "movement_type": "TransformationOut",
    "movimientos": 4,
    "cantidad": "16.00"
  },
  {
    "movement_type": "Adjustment",
    "movimientos": 3,
    "cantidad": "-42.00"
  },
  {
    "movement_type": "Shrinkage",
    "movimientos": 1,
    "cantidad": "1.00"
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

<details><summary>TEST-338 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' AND im.moved_at >= DATE '2026-10-01' AND im.moved_at < DATE '2026-11-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Agua Mineral 600ml",
    "cantidad": "4.00"
  },
  {
    "name": "Pollo a la brasa de prueba",
    "cantidad": "2.00"
  },
  {
    "name": "1 Pollo a la Brasa Entero",
    "cantidad": "1.00"
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

<details><summary>TEST-339 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= DATE '2026-10-01' AND im.moved_at < DATE '2026-11-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-340 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' AND im.moved_at >= DATE '2026-10-01' AND im.moved_at < DATE '2026-11-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Pollo entero",
    "cantidad": "72.00"
  },
  {
    "name": "Presas de pollo",
    "cantidad": "22.00"
  },
  {
    "name": "Papa",
    "cantidad": "20.00"
  },
  {
    "name": "Pollo entero de prueba",
    "cantidad": "20.00"
  },
  {
    "name": "1 Pollo a la Brasa Entero",
    "cantidad": "1.00"
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

<details><summary>TEST-341 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE AND t.date >= DATE '2026-10-01' AND t.date < DATE '2026-11-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": 3
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

<details><summary>TEST-342 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t JOIN transformation_item ti ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= DATE '2026-10-01' AND t.date < DATE '2026-11-01' GROUP BY ti.item_type ORDER BY ti.item_type LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "item_type": "Consumo",
    "cantidad": "12.00"
  },
  {
    "item_type": "Producido",
    "cantidad": "58.00"
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
