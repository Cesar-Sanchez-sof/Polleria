# Reporte de evaluación Text-to-SQL

| Agente | Casos | EM | EX | VES | TS | Ejecutadas | Errores |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini | 82 | 0.00% | 18.29% | 0.1817 | N/D | 20 | 62 |

**gemini**: EM compara SQL normalizado. EX compara los resultados gold/generado ignorando el orden de filas y las etiquetas de columnas. VES es la media de `sqrt(tiempo_gold / tiempo_generado)`, limitada a 1; las respuestas incorrectas valen 0.

TS = N/D: no se configuraron bases/estados alternativos para ejecutar una suite de pruebas.

<details><summary>TEST-001 — EM=X, EX=False, VES=0.0</summary>

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
SELECT COUNT(*) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) LIMIT 50
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

<details><summary>TEST-002 — EM=X, EX=True, VES=0.997813</summary>

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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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
SELECT pt.name AS payment_type, SUM(sp.amount) AS total_collected FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "payment_type": "Efectivo",
    "total_collected": "70.00"
  },
  {
    "payment_type": "Tarjeta",
    "total_collected": "95.00"
  }
]
```

</details>

<details><summary>TEST-004 — EM=X, EX=True, VES=0.991726</summary>

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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.sales_order AS so ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "total_unidades": "1"
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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-01-01' AS DATE) AND si.issued_at < CAST('2026-02-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-007 — EM=X, EX=True, VES=0.978151</summary>

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
SELECT dt.number AS mesa, COUNT(so.id) AS total_pedidos FROM public.dining_table AS dt JOIN public.order_table AS ot ON dt.id = ot.table_id JOIN public.sales_order AS so ON ot.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number ORDER BY mesa LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "mesa": "99",
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-008 — EM=X, EX=True, VES=0.994788</summary>

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
SELECT SUM(pi.total_amount) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at < CAST('2026-02-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas_compra": "236.00"
  }
]
```

</details>

<details><summary>TEST-009 — EM=X, EX=True, VES=0.995938</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at < CAST('2026-02-01' AS DATE) GROUP BY s.business_name LIMIT 50
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

<details><summary>TEST-010 — EM=X, EX=True, VES=1.0</summary>

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
SELECT pt.name AS payment_type, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= '2026-01-01' AND pp.paid_at < '2026-02-01' GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "payment_type": "Efectivo",
    "total_paid": "100.00"
  }
]
```

</details>

<details><summary>TEST-011 — EM=X, EX=True, VES=0.975421</summary>

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
SELECT ip.expense_category AS categoria, SUM(ip.amount_paid) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-01-01' AS DATE) AND ip.date < CAST('2026-02-01' AS DATE) AND ip.annulled = FALSE GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-012 — EM=X, EX=True, VES=0.995737</summary>

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
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-01-01' AS DATE) AND po.issued_at < CAST('2026-02-01' AS DATE) GROUP BY po.status LIMIT 50
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

<details><summary>TEST-013 — EM=X, EX=True, VES=0.992835</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-01-01' AS DATE) AND po.issued_at < CAST('2026-02-01' AS DATE) GROUP BY p.name LIMIT 50
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
SELECT pi.id AS id, pi.voucher_type AS voucher_type, pi.series AS series, pi.number AS number, pi.issued_at AS issued_at, pi.total_amount AS total_amount, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at < CAST('2026-02-01' AS DATE) GROUP BY pi.id, pi.voucher_type, pi.series, pi.number, pi.issued_at, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "id": "32",
    "voucher_type": "Factura",
    "series": "F026",
    "number": "990001",
    "issued_at": "2026-01-04",
    "total_amount": "236.00",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-015 — EM=X, EX=True, VES=0.996358</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-016 — EM=X, EX=True, VES=0.981017</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-017 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
SELECT COALESCE(SUM(cs.sales_cash), 0) AS total_ventas_efectivo, COALESCE(SUM(cs.sales_other), 0) AS total_ventas_otros FROM public.cash_session AS cs WHERE cs.opened_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cs.opened_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_ventas_efectivo": "850.00",
    "total_ventas_otros": "420.00"
  }
]
```

</details>

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

<details><summary>TEST-020 — EM=X, EX=True, VES=1.0</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-022 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-024 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-025 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-026 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-027 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-029 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-030 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-031 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-034 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-037 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-038 — EM=X, EX=True, VES=0.99773</summary>

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
SELECT pt.name AS medio_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name ORDER BY total_cobrado DESC LIMIT 50
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-040 — EM=X, EX=False, VES=0.0</summary>

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
SELECT p.id AS id, p.name AS name, SUM(oi.quantity) AS total_unidades FROM public.sales_order AS so JOIN public.order_item AS oi ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'closed' AND so.ordered_at >= CAST('2026-02-01' AS DATE) AND so.ordered_at < CAST('2026-03-01' AS DATE) GROUP BY p.id, p.name ORDER BY total_unidades DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[]
```

</details>

<details><summary>TEST-041 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-042 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-043 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-044 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-045 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-046 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-047 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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

<details><summary>TEST-055 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-057 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-059 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-060 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-061 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-062 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-063 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-064 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-065 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-066 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-067 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-068 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-069 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-070 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-071 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-072 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-073 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-074 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-075 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-076 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-077 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-078 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-079 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-080 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-081 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>

<details><summary>TEST-082 — EM=X, EX=False, VES=0.0</summary>

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
[SIN SQL]
```

**Respuesta SQL generada**

```json
[NO EJECUTADA]
```

</details>
