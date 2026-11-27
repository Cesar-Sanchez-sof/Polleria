# Reporte de evaluación Text-to-SQL

| Agente | Casos | EX | VES | Correctas | Incorrectas | Errores | Ejecutadas |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini flash 3.5 lite | 350 | 97.43% | 0.9606 | 341 | 9 | 0 | 350 |

**gemini flash 3.5 lite**:
- **EX (Execution Accuracy)**: compara el resultado devuelto en base de datos ignorando el orden de filas y los alias de columnas. Fórmula: `Correctas / Casos = 341 / 350 = 97.43%`.
- **Desglose de ejecución**:
  - **Correctas (EX OK)**: 341 (97.43%) — consultas ejecutadas cuyos datos coincidieron exactamente con el SQL gold.
  - **Incorrectas**: 9 (2.57%) — consultas que se ejecutaron en PostgreSQL sin error pero cuyos datos devueltos difieren del gold.
  - **Errores**: 0 (0.00%) — consultas con error de ejecución en base de datos (sintaxis, timeout o permisos).
  - **Ejecutadas en total**: 350 (100.00%) — total de consultas que completaron su ejecución en PostgreSQL (Correctas + Incorrectas).
- **VES (Valid Efficiency Score)**: media de `sqrt(tiempo_gold / tiempo_generado)`, limitada a 1; las respuestas incorrectas o con error valen 0.

<details><summary>TEST-001 — EX=True, VES=0.976799</summary>

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

<details><summary>TEST-002 — EX=True, VES=0.997813</summary>

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

<details><summary>TEST-004 — EX=True, VES=0.991726</summary>

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

<details><summary>TEST-005 — EX=True, VES=0.848817</summary>

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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.product AS p ON oi.product_id = p.id JOIN public.sales_order AS so ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-007 — EX=True, VES=0.978151</summary>

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

<details><summary>TEST-008 — EX=True, VES=0.994788</summary>

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

<details><summary>TEST-009 — EX=True, VES=0.995938</summary>

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

<details><summary>TEST-010 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-011 — EX=True, VES=0.975421</summary>

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

<details><summary>TEST-012 — EX=True, VES=0.995737</summary>

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

<details><summary>TEST-013 — EX=True, VES=0.992835</summary>

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

<details><summary>TEST-014 — EX=True, VES=0.960958</summary>

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
SELECT s.business_name AS proveedor, pi.series AS serie, pi.number AS numero, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-01-01' AS DATE) AND pi.issued_at < CAST('2026-02-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "serie": "F026",
    "numero": "990001",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-015 — EX=True, VES=0.996358</summary>

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

<details><summary>TEST-016 — EX=True, VES=0.981017</summary>

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

<details><summary>TEST-017 — EX=True, VES=0.947009</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-018 — EX=True, VES=0.997711</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-019 — EX=True, VES=0.978319</summary>

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
SELECT SUM(cs.difference) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= '2026-01-01' AND cs.closed_at < '2026-02-01' LIMIT 50
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

<details><summary>TEST-020 — EX=True, VES=0.996545</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_monto FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "INCOME",
    "total_monto": "120.00"
  },
  {
    "tipo_movimiento": "EXPENSE",
    "total_monto": "45.00"
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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-01-01' AS DATE) AND cs.closed_at < CAST('2026-02-01' AS DATE) GROUP BY cr.name LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-023 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS unidades_vendidas FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
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

<details><summary>TEST-024 — EX=True, VES=0.998894</summary>

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
SELECT p.name AS producto, im.quantity AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-025 — EX=True, VES=1.0</summary>

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
SELECT p.name AS insumo, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-02-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-027 — EX=True, VES=0.994137</summary>

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
SELECT ti.item_type AS tipo, SUM(ti.quantity) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-01-01' AS DATE) AND t.date < CAST('2026-02-01' AS DATE) GROUP BY ti.item_type LIMIT 50
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

<details><summary>TEST-028 — EX=True, VES=0.994079</summary>

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
SELECT p.name AS product_name, SUM(im.quantity) AS total_quantity FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-01-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-02-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_quantity DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-030 — EX=True, VES=0.987385</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, (COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)) AS saldo_neto FROM public.accounting_account AS aa JOIN public.journal_entry_detail AS jed ON aa.id = jed.account_id JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "109001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 1",
    "saldo_neto": "200.00"
  },
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "401001",
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
SELECT je.book AS diario, COUNT(DISTINCT je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-032 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-01-01' AND je.entry_date < DATE '2026-02-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-01-02",
    "entry_date": "2026-01-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS debit, SUM(jed.credit) AS credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-01-02",
    "entry_date": "2026-01-23",
    "debit": "100.00",
    "credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-033 — EX=True, VES=0.992693</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '1%' AND je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-034 — EX=True, VES=0.996978</summary>

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
SELECT aa.type AS tipo_cuenta, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-01-01' AS DATE) AND je.entry_date < CAST('2026-02-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-035 — EX=True, VES=0.981071</summary>

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
SELECT SUM(si.total_amount) AS total_importe FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-02-01' AS DATE) AND si.issued_at < CAST('2026-03-01' AS DATE) LIMIT 50
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

<details><summary>TEST-037 — EX=True, VES=0.950866</summary>

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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-02-01' AS DATE) AND si.issued_at < CAST('2026-03-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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
SELECT pt.name AS medio_de_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_de_pago": "Efectivo",
    "total_cobrado": "70.00"
  },
  {
    "medio_de_pago": "Tarjeta",
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
SELECT COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so WHERE so.status = 'Closed' AND so.order_type = 'Llevar' AND so.ordered_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-040 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.sales_order AS so ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-02-01' AS DATE) AND so.ordered_at < CAST('2026-03-01' AS DATE) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-041 — EX=True, VES=0.955246</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-02-01' AS DATE) AND si.issued_at < CAST('2026-03-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-042 — EX=True, VES=1.0</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so JOIN public.order_table AS ot ON so.id = ot.order_id JOIN public.dining_table AS dt ON ot.table_id = dt.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number LIMIT 50
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

<details><summary>TEST-043 — EX=False, VES=0.0</summary>

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
SELECT COUNT(*) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-02-01' AS DATE) AND pi.issued_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas_compra": "1"
  }
]
```

</details>

<details><summary>TEST-044 — EX=True, VES=0.9545</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_compras FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-02-01' AS DATE) AND pi.issued_at < CAST('2026-03-01' AS DATE) GROUP BY s.business_name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total_compras": "236.00"
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
SELECT pt.name AS payment_type, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= '2026-02-01' AND pp.paid_at < '2026-03-01' GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-046 — EX=True, VES=1.0</summary>

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
SELECT ip.expense_category AS categoria, SUM(ip.amount_paid) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-02-01' AS DATE) AND ip.date < CAST('2026-03-01' AS DATE) GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-047 — EX=True, VES=0.999939</summary>

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
SELECT a.status AS status, COUNT(*) AS total_orders FROM public.purchase_order AS a WHERE a.issued_at >= CAST('2026-02-01' AS DATE) AND a.issued_at < CAST('2026-03-01' AS DATE) GROUP BY a.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "status": "Pending",
    "total_orders": "1"
  },
  {
    "status": "FullyReceived",
    "total_orders": "1"
  }
]
```

</details>

<details><summary>TEST-048 — EX=True, VES=0.94546</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-02-01' AS DATE) AND po.issued_at < CAST('2026-03-01' AS DATE) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-049 — EX=True, VES=1.0</summary>

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
SELECT s.business_name AS proveedor, pi.series AS serie, pi.number AS número, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-02-01' AS DATE) AND pi.issued_at < CAST('2026-03-01' AS DATE) GROUP BY pi.id, s.business_name, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "serie": "F026",
    "número": "990002",
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-051 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-052 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-02-01' AS DATE) AND cs.closed_at < CAST('2026-03-01' AS DATE) GROUP BY cr.name LIMIT 50
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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros_medios FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-02-01' AS DATE) AND cs.closed_at < CAST('2026-03-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[]
```

</details>

<details><summary>TEST-054 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cs.difference), 0) AS total_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-02-01' AS DATE) AND cs.closed_at < CAST('2026-03-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_diferencias": "0"
  }
]
```

</details>

<details><summary>TEST-055 — EX=True, VES=0.988889</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-056 — EX=False, VES=0.0</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-02-01' AS DATE) AND cs.closed_at < CAST('2026-03-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[]
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-058 — EX=True, VES=0.988734</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS total_unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "total_unidades": "2.00"
  }
]
```

</details>

<details><summary>TEST-059 — EX=True, VES=0.992375</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-060 — EX=True, VES=1.0</summary>

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
SELECT p.name AS insumo, SUM(poi.quantity_received) AS cantidad FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.received_at >= CAST('2026-02-01' AS DATE) AND po.received_at < CAST('2026-03-01' AS DATE) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-061 — EX=True, VES=1.0</summary>

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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-03-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-062 — EX=True, VES=0.995233</summary>

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
SELECT p.name AS producto, ti.item_type AS tipo, SUM(ti.quantity) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id JOIN public.product AS p ON ti.product_id = p.id WHERE t.date >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY p.name, ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "tipo": "Producido",
    "cantidad": "2.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "tipo": "Consumo",
    "cantidad": "5.00"
  }
]
```

</details>

<details><summary>TEST-063 — EX=True, VES=0.99664</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-02-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-03-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
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
SELECT SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-065 — EX=True, VES=0.996617</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.accounting_account AS aa JOIN public.journal_entry_detail AS jed ON aa.id = jed.account_id JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "209001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 2",
    "saldo_neto": "200.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  }
]
```

</details>

<details><summary>TEST-066 — EX=True, VES=0.973999</summary>

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
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-067 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-02-01' AND je.entry_date < DATE '2026-03-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-02-02",
    "entry_date": "2026-02-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-02-02",
    "entry_date": "2026-02-23",
    "total_debit": "100.00",
    "total_credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-068 — EX=True, VES=0.969175</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '2%' AND je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo": "120.00"
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
SELECT aa.type AS tipo_cuenta, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-02-01' AS DATE) AND je.entry_date < CAST('2026-03-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-070 — EX=True, VES=0.935278</summary>

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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-03-01' AS DATE) AND ap.end_date >= CAST('2026-02-01' AS DATE) LIMIT 50
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

<details><summary>TEST-071 — EX=True, VES=0.989261</summary>

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
SELECT COALESCE(SUM(si.total_amount), 0) AS importe_total FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-03-01' AS DATE) AND si.issued_at < CAST('2026-04-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "importe_total": "165.00"
  }
]
```

</details>

<details><summary>TEST-072 — EX=True, VES=0.985968</summary>

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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-03-01' AS DATE) AND si.issued_at < CAST('2026-04-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-073 — EX=True, VES=0.977008</summary>

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
SELECT pt.name AS payment_type, SUM(sp.amount) AS total_collected FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-074 — EX=True, VES=0.998695</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) LIMIT 50
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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.order_item AS oi JOIN public.sales_order AS so ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
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

<details><summary>TEST-076 — EX=True, VES=0.976091</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-03-01' AS DATE) AND si.issued_at < CAST('2026-04-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-077 — EX=True, VES=0.956066</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so JOIN public.order_table AS ot ON so.id = ot.order_id JOIN public.dining_table AS dt ON ot.table_id = dt.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number LIMIT 50
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

<details><summary>TEST-078 — EX=True, VES=0.966697</summary>

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
SELECT COALESCE(SUM(pi.total_amount), 0) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-03-01' AS DATE) AND pi.issued_at < CAST('2026-04-01' AS DATE) LIMIT 50
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

<details><summary>TEST-079 — EX=True, VES=0.950845</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-03-01' AS DATE) AND pi.issued_at < CAST('2026-04-01' AS DATE) GROUP BY s.business_name LIMIT 50
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

<details><summary>TEST-080 — EX=True, VES=0.998828</summary>

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
SELECT pt.name AS payment_type, COALESCE(SUM(pp.amount), 0) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND pp.paid_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-081 — EX=True, VES=1.0</summary>

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
SELECT ia.expense_category AS categoria, SUM(ia.amount_paid) AS total_gastado FROM public.informal_purchase AS ia WHERE ia.date >= CAST('2026-03-01' AS DATE) AND ia.date < CAST('2026-04-01' AS DATE) GROUP BY ia.expense_category LIMIT 50
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

<details><summary>TEST-083 — EX=True, VES=0.982338</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS total_unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-03-01' AS DATE) AND po.issued_at < CAST('2026-04-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "total_unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-084 — EX=True, VES=1.0</summary>

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
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-03-01' AS DATE) AND pi.issued_at < CAST('2026-04-01' AS DATE) GROUP BY s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 LIMIT 50
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

<details><summary>TEST-085 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-086 — EX=True, VES=0.979668</summary>

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
SELECT SUM(cm.amount) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-087 — EX=True, VES=0.947736</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-03-01' AS DATE) AND cs.closed_at < CAST('2026-04-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-088 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "1700.00",
    "ventas_otros": "840.00"
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
SELECT COALESCE(SUM(cs.difference), 0) AS total_diferencia FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) LIMIT 50
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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-091 — EX=False, VES=0.0</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-03-01' AS DATE) AND cs.closed_at < CAST('2026-04-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja_registradora": "Caja de Prueba",
    "total_egresos": "90.00"
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-093 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades DESC LIMIT 50
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

<details><summary>TEST-094 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-095 — EX=True, VES=1.0</summary>

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
SELECT p.name AS insumo, SUM(poi.quantity_received) AS cantidad FROM public.purchase_order_item AS poi JOIN public.product AS p ON poi.product_id = p.id JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id WHERE po.received_at >= '2026-03-01' AND po.received_at < '2026-04-01' GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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

<details><summary>TEST-096 — EX=True, VES=0.983191</summary>

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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-04-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-097 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, ti.item_type AS tipo, SUM(ti.quantity) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id JOIN public.product AS p ON ti.product_id = p.id WHERE t.date >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY p.name, ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "tipo": "Producido",
    "cantidad": "2.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "tipo": "Consumo",
    "cantidad": "5.00"
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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-03-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-04-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-099 — EX=True, VES=0.996738</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date < CAST('2026-04-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-100 — EX=True, VES=0.998708</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.accounting_account AS aa JOIN public.journal_entry_detail AS jed ON jed.account_id = aa.id JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date < CAST('2026-04-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "309001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 3",
    "saldo_neto": "200.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  }
]
```

</details>

<details><summary>TEST-101 — EX=True, VES=1.0</summary>

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
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date < CAST('2026-04-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-102 — EX=True, VES=0.995707</summary>

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
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date < CAST('2026-04-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-03-02",
    "entry_date": "2026-03-23",
    "total_debit": "100.00",
    "total_credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-103 — EX=True, VES=0.99708</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '3%' AND je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date < CAST('2026-04-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-104 — EX=True, VES=1.0</summary>

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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-03-01' AS DATE) AND je.entry_date < CAST('2026-04-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-105 — EX=True, VES=0.98711</summary>

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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-04-01' AS DATE) AND ap.end_date >= CAST('2026-03-01' AS DATE) LIMIT 50
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

<details><summary>TEST-106 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(si.total_amount), 0) AS importe_total FROM public.sales_invoice AS si WHERE si.issued_at >= '2026-04-01' AND si.issued_at < '2026-05-01' LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "importe_total": "165.00"
  }
]
```

</details>

<details><summary>TEST-107 — EX=True, VES=0.995948</summary>

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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-04-01' AS DATE) AND si.issued_at < CAST('2026-05-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-108 — EX=True, VES=1.0</summary>

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
SELECT pt.name AS medio_de_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_de_pago": "Efectivo",
    "total_cobrado": "70.00"
  },
  {
    "medio_de_pago": "Tarjeta",
    "total_cobrado": "95.00"
  }
]
```

</details>

<details><summary>TEST-109 — EX=True, VES=0.981595</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.status = 'Closed' AND so.order_type = 'Llevar' AND so.ordered_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-110 — EX=True, VES=0.958147</summary>

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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.order_item AS oi JOIN public.sales_order AS so ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-04-01' AS DATE) AND so.ordered_at < CAST('2026-05-01' AS DATE) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
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

<details><summary>TEST-111 — EX=True, VES=1.0</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-04-01' AS DATE) AND si.issued_at < CAST('2026-05-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-112 — EX=True, VES=0.949421</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so JOIN public.order_table AS ot ON so.id = ot.order_id JOIN public.dining_table AS dt ON ot.table_id = dt.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number LIMIT 50
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

<details><summary>TEST-113 — EX=True, VES=1.0</summary>

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
SELECT SUM(pi.total_amount) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-04-01' AS DATE) AND pi.issued_at < CAST('2026-05-01' AS DATE) LIMIT 50
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

<details><summary>TEST-114 — EX=True, VES=0.756703</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_compras FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-04-01' AS DATE) AND pi.issued_at < CAST('2026-05-01' AS DATE) GROUP BY s.business_name ORDER BY total_compras DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total_compras": "236.00"
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
SELECT pt.name AS medio_de_pago, SUM(pp.amount) AS total_pagado FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-04-01' AS DATE) AND pp.paid_at < CAST('2026-05-01' AS DATE) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_de_pago": "Efectivo",
    "total_pagado": "100.00"
  }
]
```

</details>

<details><summary>TEST-116 — EX=True, VES=0.977518</summary>

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
SELECT ip.expense_category AS categoria, SUM(ip.amount_paid) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-04-01' AS DATE) AND ip.date < CAST('2026-05-01' AS DATE) AND ip.annulled = FALSE GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-117 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-04-01' AND po.issued_at < DATE '2026-05-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-04-01' AS DATE) AND po.issued_at < CAST('2026-05-01' AS DATE) GROUP BY po.status LIMIT 50
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

<details><summary>TEST-118 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-04-01' AS DATE) AND po.issued_at < CAST('2026-05-01' AS DATE) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-119 — EX=True, VES=1.0</summary>

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
SELECT s.business_name AS proveedor, pi.series AS serie, pi.number AS número, (pi.total_amount - COALESCE(pagos.total_pagado, 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN (SELECT purchase_payment.purchase_invoice_id AS purchase_invoice_id, SUM(purchase_payment.amount) AS total_pagado FROM public.purchase_payment AS purchase_payment GROUP BY purchase_payment.purchase_invoice_id) AS pagos ON pi.id = pagos.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-04-01' AS DATE) AND pi.issued_at < CAST('2026-05-01' AS DATE) AND (pi.total_amount - COALESCE(pagos.total_pagado, 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "serie": "F026",
    "número": "990004",
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-121 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-122 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-04-01' AS DATE) AND cs.closed_at < CAST('2026-05-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-123 — EX=True, VES=0.977682</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros_medios FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-04-01' AS DATE) AND cs.closed_at < CAST('2026-05-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros_medios": "420.00"
  }
]
```

</details>

<details><summary>TEST-124 — EX=True, VES=0.981045</summary>

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
SELECT COALESCE(SUM(cs.difference), 0) AS total_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-04-01' AS DATE) AND cs.closed_at < CAST('2026-05-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-125 — EX=True, VES=1.0</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_monto FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "INCOME",
    "total_monto": "120.00"
  },
  {
    "tipo_movimiento": "EXPENSE",
    "total_monto": "45.00"
  }
]
```

</details>

<details><summary>TEST-126 — EX=True, VES=0.981907</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-127 — EX=True, VES=0.95988</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-04-01' AND im.moved_at < DATE '2026-05-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-128 — EX=True, VES=0.975812</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= '2026-04-01' AND im.moved_at < '2026-05-01' GROUP BY p.name ORDER BY unidades DESC LIMIT 50
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

<details><summary>TEST-129 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-130 — EX=True, VES=0.963882</summary>

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
SELECT p.name AS insumo, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= '2026-04-01' AND im.moved_at < '2026-05-01' GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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

<details><summary>TEST-131 — EX=True, VES=1.0</summary>

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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-05-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-132 — EX=True, VES=0.994587</summary>

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
SELECT ti.item_type AS item_type, SUM(ti.quantity) AS total_quantity FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-05-01 00:00:00' AS TIMESTAMP) GROUP BY ti.item_type LIMIT 50
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

<details><summary>TEST-133 — EX=True, VES=0.977305</summary>

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
SELECT p.name AS producto, im.quantity AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-04-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-05-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-134 — EX=True, VES=0.998796</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE LIMIT 50
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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "codigo_cuenta": "409001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 4",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-136 — EX=True, VES=0.992103</summary>

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
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-137 — EX=True, VES=1.0</summary>

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
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS debit, SUM(jed.credit) AS credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-04-02",
    "entry_date": "2026-04-23",
    "debit": "100.00",
    "credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-138 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '4%' AND je.entry_date >= CAST('2026-04-01' AS DATE) AND je.entry_date < CAST('2026-05-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo": "100.00"
  }
]
```

</details>

<details><summary>TEST-139 — EX=True, VES=0.967144</summary>

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

<details><summary>TEST-140 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-141 — EX=True, VES=0.978042</summary>

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

<details><summary>TEST-142 — EX=True, VES=1.0</summary>

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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-05-01' AS DATE) AND si.issued_at < CAST('2026-06-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-143 — EX=True, VES=0.990333</summary>

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
SELECT pt.name AS payment_type, SUM(sp.amount) AS total_collected FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-144 — EX=True, VES=1.0</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS a WHERE a.order_type = 'Llevar' AND a.status = 'Closed' AND a.ordered_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND a.ordered_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-145 — EX=True, VES=0.98162</summary>

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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.sales_order AS so ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-146 — EX=True, VES=0.990691</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-05-01' AS DATE) AND si.issued_at < CAST('2026-06-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-147 — EX=True, VES=0.998864</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON ot.table_id = dt.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number ORDER BY total_pedidos DESC LIMIT 50
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

<details><summary>TEST-148 — EX=True, VES=0.9943</summary>

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
SELECT SUM(pi.total_amount) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-05-01' AS DATE) AND pi.issued_at < CAST('2026-06-01' AS DATE) LIMIT 50
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

<details><summary>TEST-149 — EX=True, VES=0.998065</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_comprado FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-05-01' AS DATE) AND pi.issued_at < CAST('2026-06-01' AS DATE) GROUP BY s.business_name LIMIT 50
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

<details><summary>TEST-150 — EX=True, VES=0.996913</summary>

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
SELECT pt.name AS payment_type, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND pp.paid_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-151 — EX=True, VES=1.0</summary>

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
SELECT ip.expense_category AS categoria, SUM(ip.amount_paid) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.date >= CAST('2026-05-01' AS DATE) AND ip.date < CAST('2026-06-01' AS DATE) GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-152 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-05-01' AND po.issued_at < DATE '2026-06-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT a.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS a WHERE a.issued_at >= CAST('2026-05-01' AS DATE) AND a.issued_at < CAST('2026-06-01' AS DATE) GROUP BY a.status LIMIT 50
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

<details><summary>TEST-153 — EX=True, VES=0.996726</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS total_unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-05-01' AS DATE) AND po.issued_at < CAST('2026-06-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "total_unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-154 — EX=True, VES=0.948722</summary>

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
SELECT s.business_name AS proveedor, pi.series AS series, pi.number AS number, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-05-01' AS DATE) AND pi.issued_at < CAST('2026-06-01' AS DATE) GROUP BY s.business_name, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
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

<details><summary>TEST-155 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-156 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-157 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-158 — EX=True, VES=0.963657</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros_medios FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-05-01' AS DATE) AND cs.closed_at < CAST('2026-06-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros_medios": "420.00"
  }
]
```

</details>

<details><summary>TEST-159 — EX=True, VES=0.96267</summary>

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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) LIMIT 50
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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-161 — EX=True, VES=0.993195</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-05-01' AS DATE) AND cs.closed_at < CAST('2026-06-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-162 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-05-01' AND im.moved_at < DATE '2026-06-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-163 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-164 — EX=True, VES=0.985603</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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

<details><summary>TEST-165 — EX=True, VES=1.0</summary>

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
SELECT p.name AS insumo, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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

<details><summary>TEST-166 — EX=True, VES=0.997829</summary>

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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-06-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-167 — EX=True, VES=0.837843</summary>

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
SELECT ti.item_type AS item_type, SUM(ti.quantity) AS total_quantity FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-05-01' AS DATE) AND t.date < CAST('2026-06-01' AS DATE) GROUP BY ti.item_type LIMIT 50
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

<details><summary>TEST-168 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-05-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-06-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-169 — EX=True, VES=0.996447</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-170 — EX=True, VES=1.0</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.accounting_account AS aa JOIN public.journal_entry_detail AS jed ON aa.id = jed.account_id JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "codigo_cuenta": "509001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 5",
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
SELECT je.book AS diario, COUNT(*) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-172 — EX=True, VES=0.941671</summary>

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
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS debit, SUM(jed.credit) AS credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-05-02",
    "entry_date": "2026-05-23",
    "debit": "100.00",
    "credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-173 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '5%' AND je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-174 — EX=True, VES=1.0</summary>

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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-05-01' AS DATE) AND je.entry_date < CAST('2026-06-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-175 — EX=True, VES=0.943476</summary>

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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-06-01' AS DATE) AND ap.end_date >= CAST('2026-05-01' AS DATE) LIMIT 50
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

<details><summary>TEST-176 — EX=False, VES=0.0</summary>

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
SELECT COUNT(*) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-06-01' AS DATE) AND si.issued_at < CAST('2026-07-01' AS DATE) LIMIT 50
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

<details><summary>TEST-177 — EX=True, VES=0.976661</summary>

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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-06-01' AS DATE) AND si.issued_at < CAST('2026-07-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-178 — EX=True, VES=1.0</summary>

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
SELECT pt.name AS payment_type, SUM(sp.amount) AS total_collected FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-179 — EX=True, VES=0.998869</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) LIMIT 50
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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.sales_order AS so ON oi.order_id = so.id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-181 — EX=True, VES=0.998122</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-06-01' AS DATE) AND si.issued_at < CAST('2026-07-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-182 — EX=True, VES=1.0</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON ot.table_id = dt.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number LIMIT 50
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
SELECT COUNT(*) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= '2026-06-01' AND pi.issued_at < '2026-07-01' LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas_compra": "1"
  }
]
```

</details>

<details><summary>TEST-184 — EX=True, VES=0.99326</summary>

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
SELECT s.business_name AS business_name, SUM(pi.total_amount) AS total_compras FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-06-01' AS DATE) AND pi.issued_at < CAST('2026-07-01' AS DATE) AND pi.active = TRUE GROUP BY s.business_name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "business_name": "Avícola Buen Sabor de Prueba",
    "total_compras": "236.00"
  }
]
```

</details>

<details><summary>TEST-185 — EX=True, VES=0.995557</summary>

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
SELECT pt.name AS payment_type_name, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND pp.paid_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "payment_type_name": "Efectivo",
    "total_paid": "100.00"
  }
]
```

</details>

<details><summary>TEST-186 — EX=True, VES=0.997891</summary>

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
SELECT ip.expense_category AS categoria, SUM(ip.amount_paid) AS total_gastado FROM public.informal_purchase AS ip WHERE ip.annulled = FALSE AND ip.date >= CAST('2026-06-01' AS DATE) AND ip.date < CAST('2026-07-01' AS DATE) GROUP BY ip.expense_category LIMIT 50
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

<details><summary>TEST-187 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-06-01' AND po.issued_at < DATE '2026-07-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT poi_alias_status.status AS estado, COUNT(*) AS total FROM public.purchase_order AS poi_alias_status WHERE poi_alias_status.issued_at >= CAST('2026-06-01' AS DATE) AND poi_alias_status.issued_at < CAST('2026-07-01' AS DATE) GROUP BY poi_alias_status.status LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "estado": "Pending",
    "total": "1"
  },
  {
    "estado": "FullyReceived",
    "total": "1"
  }
]
```

</details>

<details><summary>TEST-188 — EX=True, VES=0.996189</summary>

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
SELECT p.name AS product_name, SUM(poi.quantity_received) AS total_quantity_received FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-06-01' AS DATE) AND po.issued_at < CAST('2026-07-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "product_name": "Pollo entero de prueba",
    "total_quantity_received": "20.00"
  }
]
```

</details>

<details><summary>TEST-189 — EX=True, VES=0.979759</summary>

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
SELECT s.business_name AS proveedor, pi.series AS serie, pi.number AS número, (pi.total_amount - COALESCE(pp.pagado, 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN (SELECT purchase_payment.purchase_invoice_id AS purchase_invoice_id, SUM(purchase_payment.amount) AS pagado FROM public.purchase_payment AS purchase_payment GROUP BY purchase_payment.purchase_invoice_id) AS pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-06-01' AS DATE) AND pi.issued_at < CAST('2026-07-01' AS DATE) AND pi.total_amount > COALESCE(pp.pagado, 0) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "serie": "F026",
    "número": "990006",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-190 — EX=True, VES=0.977789</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-191 — EX=True, VES=0.990912</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-192 — EX=True, VES=0.948344</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-193 — EX=True, VES=0.99139</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros_medios FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros_medios": "420.00"
  }
]
```

</details>

<details><summary>TEST-194 — EX=True, VES=0.979168</summary>

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

<details><summary>TEST-195 — EX=True, VES=0.990758</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-196 — EX=True, VES=0.99421</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-06-01' AS DATE) AND cs.closed_at < CAST('2026-07-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-197 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-06-01' AND im.moved_at < DATE '2026-07-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-198 — EX=True, VES=0.983733</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-199 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-200 — EX=True, VES=0.949394</summary>

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
SELECT p.name AS insumo, SUM(poi.quantity_received) AS cantidad FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.received_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND po.received_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-07-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-202 — EX=True, VES=0.990345</summary>

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
SELECT p.name AS producto, ti.item_type AS tipo, SUM(ti.quantity) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id JOIN public.product AS p ON ti.product_id = p.id WHERE t.date >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY p.name, ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "tipo": "Producido",
    "cantidad": "2.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "tipo": "Consumo",
    "cantidad": "5.00"
  }
]
```

</details>

<details><summary>TEST-203 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-06-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-07-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-204 — EX=True, VES=0.996855</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-205 — EX=True, VES=0.966291</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.accounting_account AS aa JOIN public.journal_entry_detail AS jed ON jed.account_id = aa.id JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "codigo_cuenta": "609001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 6",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-206 — EX=True, VES=0.977302</summary>

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
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-207 — EX=True, VES=0.999415</summary>

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
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS debit, SUM(jed.credit) AS credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-06-02",
    "entry_date": "2026-06-23",
    "debit": "100.00",
    "credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-208 — EX=True, VES=0.988598</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '6%' AND je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-209 — EX=True, VES=0.999344</summary>

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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-06-01' AS DATE) AND je.entry_date < CAST('2026-07-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-210 — EX=True, VES=0.922166</summary>

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

<details><summary>TEST-211 — EX=True, VES=0.98425</summary>

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
SELECT SUM(si.total_amount) AS importe_total FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-07-01' AS DATE) AND si.issued_at < CAST('2026-08-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "importe_total": "165.00"
  }
]
```

</details>

<details><summary>TEST-212 — EX=True, VES=0.997708</summary>

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

<details><summary>TEST-213 — EX=True, VES=1.0</summary>

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
SELECT pt.name AS medio_de_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "medio_de_pago": "Efectivo",
    "total_cobrado": "70.00"
  },
  {
    "medio_de_pago": "Tarjeta",
    "total_cobrado": "95.00"
  }
]
```

</details>

<details><summary>TEST-214 — EX=True, VES=1.0</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-215 — EX=True, VES=0.968912</summary>

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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.product AS p ON oi.product_id = p.id JOIN public.sales_order AS so ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-216 — EX=True, VES=0.98999</summary>

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
SELECT a.order_type AS canal, SUM(b.total_amount) AS total_vendido FROM public.sales_order AS a JOIN public.sales_invoice AS b ON b.order_id = a.id WHERE b.issued_at >= CAST('2026-07-01' AS DATE) AND b.issued_at < CAST('2026-08-01' AS DATE) GROUP BY a.order_type LIMIT 50
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

<details><summary>TEST-217 — EX=True, VES=0.984272</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number LIMIT 50
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

<details><summary>TEST-218 — EX=True, VES=0.993052</summary>

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
SELECT SUM(pi.total_amount) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-07-01' AS DATE) AND pi.issued_at < CAST('2026-08-01' AS DATE) LIMIT 50
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

<details><summary>TEST-219 — EX=True, VES=1.0</summary>

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
SELECT s.business_name AS business_name, SUM(pi.total_amount) AS total_compras FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-07-01' AS DATE) AND pi.issued_at < CAST('2026-08-01' AS DATE) AND pi.active = TRUE GROUP BY s.business_name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "business_name": "Avícola Buen Sabor de Prueba",
    "total_compras": "236.00"
  }
]
```

</details>

<details><summary>TEST-220 — EX=True, VES=0.978565</summary>

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
SELECT pt.name AS payment_type, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND pp.paid_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-221 — EX=True, VES=0.840197</summary>

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
SELECT i.expense_category AS categoria, SUM(i.amount_paid) AS total_gastado FROM public.informal_purchase AS i WHERE i.date >= '2026-07-01' AND i.date < '2026-08-01' GROUP BY i.expense_category LIMIT 50
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

<details><summary>TEST-222 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-07-01' AND po.issued_at < DATE '2026-08-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-07-01' AS DATE) AND po.issued_at < CAST('2026-08-01' AS DATE) GROUP BY po.status LIMIT 50
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

<details><summary>TEST-223 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS total_unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-07-01' AS DATE) AND po.issued_at < CAST('2026-08-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "total_unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-224 — EX=True, VES=0.974653</summary>

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
SELECT pi.series AS series, pi.number AS number, pi.issued_at AS issued_at, s.business_name AS business_name, pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-07-01' AS DATE) AND pi.issued_at < CAST('2026-08-01' AS DATE) GROUP BY pi.id, pi.series, pi.number, pi.issued_at, s.business_name, pi.total_amount HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "series": "F026",
    "number": "990007",
    "issued_at": "2026-07-04",
    "business_name": "Avícola Buen Sabor de Prueba",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-225 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-226 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-227 — EX=True, VES=0.972609</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_register AS cr JOIN public.cash_session AS cs ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-228 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja, COALESCE(SUM(cs.sales_cash), 0) AS ventas_efectivo, COALESCE(SUM(cs.sales_other), 0) AS ventas_otros_medios FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros_medios": "420.00"
  }
]
```

</details>

<details><summary>TEST-229 — EX=True, VES=0.990166</summary>

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

<details><summary>TEST-230 — EX=True, VES=0.99562</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-231 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-07-01' AS DATE) AND cs.closed_at < CAST('2026-08-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-232 — EX=True, VES=0.998518</summary>

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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-233 — EX=True, VES=0.990379</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS total_unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "total_unidades": "2.00"
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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-235 — EX=True, VES=0.738952</summary>

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
SELECT p.name AS insumo, SUM(poi.quantity_received) AS cantidad FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.received_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND po.received_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-08-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-237 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, ti.item_type AS tipo, SUM(ti.quantity) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id JOIN public.product AS p ON ti.product_id = p.id WHERE t.date >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY p.name, ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "tipo": "Producido",
    "cantidad": "2.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "tipo": "Consumo",
    "cantidad": "5.00"
  }
]
```

</details>

<details><summary>TEST-238 — EX=True, VES=0.991302</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-07-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-08-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-239 — EX=True, VES=0.981332</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-240 — EX=True, VES=0.999061</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "codigo_cuenta": "709001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 7",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-241 — EX=True, VES=1.0</summary>

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
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-242 — EX=True, VES=0.95402</summary>

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
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-07-02",
    "entry_date": "2026-07-23",
    "total_debit": "100.00",
    "total_credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-243 — EX=True, VES=0.982552</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '7%' AND je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-244 — EX=True, VES=0.999694</summary>

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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-07-01' AS DATE) AND je.entry_date < CAST('2026-08-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-245 — EX=True, VES=0.982084</summary>

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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-08-01' AS DATE) AND ap.end_date >= CAST('2026-07-01' AS DATE) LIMIT 50
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

<details><summary>TEST-246 — EX=False, VES=0.0</summary>

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
SELECT COUNT(*) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= '2026-08-01' AND si.issued_at < '2026-09-01' LIMIT 50
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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= '2026-08-01' AND si.issued_at < '2026-09-01' GROUP BY si.voucher_type LIMIT 50
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
SELECT pt.name AS medio_pago, SUM(sp.amount) AS total_cobrado FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-249 — EX=True, VES=1.0</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS so WHERE so.order_type = 'Llevar' AND so.status = 'Closed' AND so.ordered_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-250 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.product AS p ON oi.product_id = p.id JOIN public.sales_order AS so ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= '2026-08-01' AND so.ordered_at < '2026-09-01' GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-251 — EX=True, VES=0.977877</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-08-01' AS DATE) AND si.issued_at < CAST('2026-09-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-252 — EX=True, VES=1.0</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.sales_order AS so JOIN public.order_table AS ot ON ot.order_id = so.id JOIN public.dining_table AS dt ON dt.id = ot.table_id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY dt.number LIMIT 50
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

<details><summary>TEST-253 — EX=True, VES=0.969632</summary>

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
SELECT SUM(pi.total_amount) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-08-01' AS DATE) AND pi.issued_at < CAST('2026-09-01' AS DATE) LIMIT 50
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

<details><summary>TEST-254 — EX=True, VES=1.0</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_compras FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-08-01' AS DATE) AND pi.issued_at < CAST('2026-09-01' AS DATE) GROUP BY s.business_name ORDER BY total_compras DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total_compras": "236.00"
  }
]
```

</details>

<details><summary>TEST-255 — EX=True, VES=0.979636</summary>

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
SELECT pt.name AS payment_type, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= '2026-08-01' AND pp.paid_at < '2026-09-01' GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-256 — EX=True, VES=0.995249</summary>

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
SELECT i.expense_category AS categoria, SUM(i.amount_paid) AS total_gastado FROM public.informal_purchase AS i WHERE i.date >= '2026-08-01' AND i.date < '2026-09-01' GROUP BY i.expense_category LIMIT 50
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

<details><summary>TEST-257 — EX=True, VES=0.993756</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-08-01' AND po.issued_at < DATE '2026-09-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= '2026-08-01' AND po.issued_at < '2026-09-01' GROUP BY po.status LIMIT 50
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

<details><summary>TEST-258 — EX=True, VES=0.994599</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-08-01' AS DATE) AND po.issued_at < CAST('2026-09-01' AS DATE) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-259 — EX=True, VES=0.966097</summary>

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
SELECT s.business_name AS proveedor, pi.series AS serie, pi.number AS número, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-08-01' AS DATE) AND pi.issued_at < CAST('2026-09-01' AS DATE) GROUP BY s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "serie": "F026",
    "número": "990008",
    "saldo_pendiente": "136.00"
  }
]
```

</details>

<details><summary>TEST-260 — EX=True, VES=0.941814</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-261 — EX=True, VES=0.996849</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-262 — EX=True, VES=0.865126</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-08-01' AS DATE) AND cs.closed_at < CAST('2026-09-01' AS DATE) GROUP BY cr.name LIMIT 50
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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros_medios FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-08-01' AS DATE) AND cs.closed_at < CAST('2026-09-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "ventas_otros_medios": "420.00"
  }
]
```

</details>

<details><summary>TEST-264 — EX=True, VES=0.992182</summary>

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
SELECT COALESCE(SUM(cs.difference), 0) AS total_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-08-01' AS DATE) AND cs.closed_at < CAST('2026-09-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-265 — EX=True, VES=0.985217</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cs.opened_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND cs.opened_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-266 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-267 — EX=True, VES=0.997411</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-08-01' AND im.moved_at < DATE '2026-09-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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
SELECT p.name AS producto, SUM(ABS(im.quantity)) AS unidades_salida FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades_salida DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades_salida": "2.00"
  }
]
```

</details>

<details><summary>TEST-269 — EX=True, VES=0.976331</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= '2026-08-01' AND im.moved_at < '2026-09-01' GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "20.00"
  }
]
```

</details>

<details><summary>TEST-271 — EX=True, VES=0.998185</summary>

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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-09-01 00:00:00' AS TIMESTAMP) LIMIT 50
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
SELECT p.name AS producto, ti.item_type AS tipo_item, SUM(ti.quantity) AS cantidad FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id JOIN public.product AS p ON ti.product_id = p.id WHERE t.date >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY p.name, ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "tipo_item": "Producido",
    "cantidad": "2.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "tipo_item": "Consumo",
    "cantidad": "5.00"
  }
]
```

</details>

<details><summary>TEST-273 — EX=True, VES=0.974838</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-08-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-09-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-274 — EX=True, VES=0.996952</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-275 — EX=True, VES=1.0</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "codigo_cuenta": "809001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 8",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-276 — EX=True, VES=1.0</summary>

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
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-277 — EX=False, VES=0.0</summary>

**SQL gold**

```sql
SELECT je.id, je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-08-01' AND je.entry_date < DATE '2026-09-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "id": 206,
    "code": "BENCH26-08-02",
    "entry_date": "2026-08-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS code, je.entry_date AS entry_date, je.description AS description FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date, je.description HAVING ROUND(COALESCE(SUM(jed.debit), 0), 2) <> ROUND(COALESCE(SUM(jed.credit), 0), 2) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-08-02",
    "entry_date": "2026-08-23",
    "description": "Asiento descuadrado ficticio de prueba"
  }
]
```

</details>

<details><summary>TEST-278 — EX=True, VES=0.999418</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '1%' AND je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo": "0"
  }
]
```

</details>

<details><summary>TEST-279 — EX=True, VES=1.0</summary>

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
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-08-01' AS DATE) AND je.entry_date < CAST('2026-09-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-280 — EX=True, VES=0.973465</summary>

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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-09-01' AS DATE) AND ap.end_date >= CAST('2026-08-01' AS DATE) LIMIT 50
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

<details><summary>TEST-281 — EX=False, VES=0.0</summary>

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
SELECT COUNT(*) AS total_comprobantes FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-09-01' AS DATE) AND si.issued_at < CAST('2026-10-01' AS DATE) LIMIT 50
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

<details><summary>TEST-282 — EX=True, VES=1.0</summary>

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

<details><summary>TEST-283 — EX=True, VES=0.994891</summary>

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
SELECT pt.name AS payment_type, SUM(sp.amount) AS total_collected FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-284 — EX=True, VES=0.983447</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS a WHERE a.order_type = 'Llevar' AND a.status = 'Closed' AND a.ordered_at >= '2026-09-01' AND a.ordered_at < '2026-10-01' LIMIT 50
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
SELECT p.name AS producto, SUM(oi.quantity) AS total_unidades FROM public.order_item AS oi JOIN public.product AS p ON oi.product_id = p.id JOIN public.sales_order AS so ON oi.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY total_unidades DESC LIMIT 50
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

<details><summary>TEST-286 — EX=True, VES=1.0</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= CAST('2026-09-01' AS DATE) AND si.issued_at < CAST('2026-10-01' AS DATE) GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-287 — EX=True, VES=1.0</summary>

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
SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS total_pedidos FROM public.dining_table AS dt JOIN public.order_table AS ot ON dt.id = ot.table_id JOIN public.sales_order AS so ON ot.order_id = so.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-09-01' AS DATE) AND so.ordered_at < CAST('2026-10-01' AS DATE) GROUP BY dt.number LIMIT 50
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

<details><summary>TEST-288 — EX=True, VES=1.0</summary>

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
SELECT SUM(pi.total_amount) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= '2026-09-01' AND pi.issued_at < '2026-10-01' LIMIT 50
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

<details><summary>TEST-289 — EX=True, VES=0.99784</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_compras FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.issued_at >= CAST('2026-09-01' AS DATE) AND pi.issued_at < CAST('2026-10-01' AS DATE) GROUP BY s.business_name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total_compras": "236.00"
  }
]
```

</details>

<details><summary>TEST-290 — EX=True, VES=0.982239</summary>

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
SELECT pt.name AS payment_type, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= '2026-09-01' AND pp.paid_at < '2026-10-01' GROUP BY pt.name LIMIT 50
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

<details><summary>TEST-291 — EX=True, VES=1.0</summary>

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
SELECT i.expense_category AS categoria, SUM(i.amount_paid) AS total_gastado FROM public.informal_purchase AS i WHERE i.date >= CAST('2026-09-01' AS DATE) AND i.date < CAST('2026-10-01' AS DATE) GROUP BY i.expense_category LIMIT 50
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

<details><summary>TEST-292 — EX=True, VES=0.973998</summary>

**SQL gold**

```sql
SELECT po.status, COUNT(*) AS total FROM purchase_order po WHERE po.issued_at >= DATE '2026-09-01' AND po.issued_at < DATE '2026-10-01' GROUP BY po.status ORDER BY total DESC LIMIT 50
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
SELECT po.status AS estado, COUNT(*) AS total_ordenes FROM public.purchase_order AS po WHERE po.issued_at >= CAST('2026-09-01' AS DATE) AND po.issued_at < CAST('2026-10-01' AS DATE) GROUP BY po.status LIMIT 50
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

<details><summary>TEST-293 — EX=True, VES=0.997934</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS total_unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-09-01' AS DATE) AND po.issued_at < CAST('2026-10-01' AS DATE) GROUP BY p.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "total_unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-294 — EX=True, VES=0.997935</summary>

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
SELECT pi.series AS series, pi.number AS number, pi.issued_at AS issued_at, s.business_name AS business_name, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pp.purchase_invoice_id = pi.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-09-01' AS DATE) AND pi.issued_at < CAST('2026-10-01' AS DATE) GROUP BY pi.id, pi.series, pi.number, pi.issued_at, s.business_name, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "series": "F026",
    "number": "990009",
    "issued_at": "2026-09-04",
    "business_name": "Avícola Buen Sabor de Prueba",
    "saldo_pendiente": "136.00"
  }
]
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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-296 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-297 — EX=True, VES=0.971406</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS total_sesiones FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-09-01' AS DATE) AND cs.closed_at < CAST('2026-10-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "total_sesiones": "1"
  }
]
```

</details>

<details><summary>TEST-298 — EX=True, VES=0.971295</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS otros_medios FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "ventas_efectivo": "850.00",
    "otros_medios": "420.00"
  }
]
```

</details>

<details><summary>TEST-299 — EX=True, VES=0.966595</summary>

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
SELECT COALESCE(SUM(cs.difference), 0) AS total_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_diferencias": "-5.00"
  }
]
```

</details>

<details><summary>TEST-300 — EX=True, VES=1.0</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm WHERE cm.created_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY cm.type LIMIT 50
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

<details><summary>TEST-301 — EX=True, VES=0.975832</summary>

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
SELECT cr.name AS caja_registradora, SUM(cm.amount) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-09-01' AS DATE) AND cs.closed_at < CAST('2026-10-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-302 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad FROM inventory_movement im WHERE im.moved_at >= DATE '2026-09-01' AND im.moved_at < DATE '2026-10-01' GROUP BY im.movement_type ORDER BY movimientos DESC LIMIT 50
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
SELECT im.movement_type AS tipo_movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
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

<details><summary>TEST-303 — EX=True, VES=1.0</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades DESC LIMIT 50
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

<details><summary>TEST-304 — EX=True, VES=0.988238</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-305 — EX=True, VES=0.998613</summary>

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
SELECT p.name AS insumo, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Purchase' AND im.moved_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
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
SELECT COUNT(*) AS total_transformations FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-10-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_transformations": "1"
  }
]
```

</details>

<details><summary>TEST-307 — EX=True, VES=0.991951</summary>

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
SELECT p.name AS producto, ti.item_type AS tipo_item, SUM(ti.quantity) AS cantidad_total FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id JOIN public.product AS p ON ti.product_id = p.id WHERE t.date >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-10-01 00:00:00' AS TIMESTAMP) GROUP BY p.name, ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo a la brasa de prueba",
    "tipo_item": "Producido",
    "cantidad_total": "2.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "tipo_item": "Consumo",
    "cantidad_total": "5.00"
  }
]
```

</details>

<details><summary>TEST-308 — EX=True, VES=0.984394</summary>

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
SELECT p.name AS producto, im.quantity AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-09-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-10-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  }
]
```

</details>

<details><summary>TEST-309 — EX=True, VES=0.996989</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE LIMIT 50
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

<details><summary>TEST-310 — EX=True, VES=1.0</summary>

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
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.accounting_account AS aa JOIN public.journal_entry_detail AS jed ON aa.id = jed.account_id JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "codigo_cuenta": "909001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 9",
    "saldo_neto": "200.00"
  }
]
```

</details>

<details><summary>TEST-311 — EX=True, VES=0.993451</summary>

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
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
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

<details><summary>TEST-312 — EX=True, VES=0.963324</summary>

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
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

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

</details>

<details><summary>TEST-313 — EX=True, VES=1.0</summary>

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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '2%' AND je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo_neto": "-80.00"
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
SELECT aa.type AS tipo_cuenta, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-09-01' AS DATE) AND je.entry_date < CAST('2026-10-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
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

<details><summary>TEST-315 — EX=True, VES=0.909942</summary>

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
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-10-01' AS DATE) AND ap.end_date >= CAST('2026-09-01' AS DATE) LIMIT 50
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

<details><summary>TEST-316 — EX=True, VES=0.977873</summary>

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
SELECT COALESCE(SUM(si.total_amount), 0) AS importe_total FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-10-01' AS DATE) AND si.issued_at < CAST('2026-11-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "importe_total": "571.20"
  }
]
```

</details>

<details><summary>TEST-317 — EX=True, VES=0.997133</summary>

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
SELECT si.voucher_type AS tipo_comprobante, SUM(si.total_amount) AS total_facturado FROM public.sales_invoice AS si WHERE si.issued_at >= CAST('2026-10-01' AS DATE) AND si.issued_at < CAST('2026-11-01' AS DATE) GROUP BY si.voucher_type LIMIT 50
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

<details><summary>TEST-318 — EX=True, VES=0.992137</summary>

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
SELECT pt.name AS payment_type, SUM(sp.amount) AS total_collected FROM public.sales_payment AS sp JOIN public.payment_type AS pt ON sp.payment_type_id = pt.id WHERE sp.paid_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND sp.paid_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "payment_type": "Tarjeta / POS",
    "total_collected": "217.10"
  },
  {
    "payment_type": "Yape",
    "total_collected": "9.90"
  },
  {
    "payment_type": "Tarjeta",
    "total_collected": "95.00"
  },
  {
    "payment_type": "Efectivo",
    "total_collected": "249.20"
  }
]
```

</details>

<details><summary>TEST-319 — EX=True, VES=0.983038</summary>

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
SELECT COUNT(*) AS total_pedidos FROM public.sales_order AS a WHERE a.order_type = 'Llevar' AND a.status = 'Closed' AND a.ordered_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND a.ordered_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) LIMIT 50
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
SELECT p.name AS producto, SUM(oi.quantity) AS unidades_vendidas FROM public.sales_order AS so JOIN public.order_item AS oi ON so.id = oi.order_id JOIN public.product AS p ON oi.product_id = p.id WHERE so.status = 'Closed' AND so.ordered_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND so.ordered_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades_vendidas DESC LIMIT 50
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

<details><summary>TEST-321 — EX=True, VES=1.0</summary>

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
SELECT so.order_type AS canal, SUM(si.total_amount) AS total_vendido FROM public.sales_invoice AS si JOIN public.sales_order AS so ON si.order_id = so.id WHERE si.issued_at >= '2026-10-01' AND si.issued_at < '2026-11-01' GROUP BY so.order_type LIMIT 50
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

<details><summary>TEST-322 — EX=True, VES=0.998234</summary>

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
SELECT t.number AS numero_mesa, COUNT(o.id) AS total_pedidos FROM public.dining_table AS t JOIN public.order_table AS ot ON ot.table_id = t.id JOIN public.sales_order AS o ON ot.order_id = o.id WHERE o.status = 'Closed' AND o.ordered_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND o.ordered_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY t.number LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "numero_mesa": "1",
    "total_pedidos": "5"
  },
  {
    "numero_mesa": "99",
    "total_pedidos": "1"
  },
  {
    "numero_mesa": "2",
    "total_pedidos": "3"
  },
  {
    "numero_mesa": "4",
    "total_pedidos": "1"
  },
  {
    "numero_mesa": "3",
    "total_pedidos": "1"
  }
]
```

</details>

<details><summary>TEST-323 — EX=True, VES=0.998513</summary>

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
SELECT SUM(pi.total_amount) AS total_facturas_compra FROM public.purchase_invoice AS pi WHERE pi.active = TRUE AND pi.issued_at >= '2026-10-01' AND pi.issued_at < '2026-11-01' LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_facturas_compra": "2129.01"
  }
]
```

</details>

<details><summary>TEST-324 — EX=True, VES=0.996772</summary>

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
SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total_compras FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-10-01' AS DATE) AND pi.issued_at < CAST('2026-11-01' AS DATE) GROUP BY s.business_name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "AGRICOLA CERRO PRIETO S.A.",
    "total_compras": "225.88"
  },
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "total_compras": "236.00"
  },
  {
    "proveedor": "COMPAÑIA FOOD RETAIL S.A.C.",
    "total_compras": "1356.17"
  },
  {
    "proveedor": "PONCE EVANGELISTA, RENZO DANIEL",
    "total_compras": "285.00"
  },
  {
    "proveedor": "PUESCAS PINGO, MANUEL ARMANDO",
    "total_compras": "25.96"
  }
]
```

</details>

<details><summary>TEST-325 — EX=True, VES=1.0</summary>

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
SELECT pt.name AS payment_type, SUM(pp.amount) AS total_paid FROM public.purchase_payment AS pp JOIN public.payment_type AS pt ON pp.payment_type_id = pt.id WHERE pp.paid_at >= '2026-10-01' AND pp.paid_at < '2026-11-01' GROUP BY pt.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "payment_type": "Efectivo",
    "total_paid": "1759.91"
  },
  {
    "payment_type": "Yape",
    "total_paid": "64.00"
  },
  {
    "payment_type": "Plin",
    "total_paid": "5.00"
  },
  {
    "payment_type": "Transferencia",
    "total_paid": "150.00"
  }
]
```

</details>

<details><summary>TEST-326 — EX=True, VES=0.996631</summary>

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
SELECT i.expense_category AS categoria, SUM(i.amount_paid) AS total_gastado FROM public.informal_purchase AS i WHERE i.annulled = FALSE AND i.date >= '2026-10-01' AND i.date < '2026-11-01' GROUP BY i.expense_category LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "categoria": "EventServices",
    "total_gastado": "300.00"
  },
  {
    "categoria": "CleaningSupplies",
    "total_gastado": "38.00"
  },
  {
    "categoria": null,
    "total_gastado": "5.00"
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

<details><summary>TEST-328 — EX=True, VES=0.979055</summary>

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
SELECT p.name AS producto, SUM(poi.quantity_received) AS unidades_recibidas FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.issued_at >= CAST('2026-10-01' AS DATE) AND po.issued_at < CAST('2026-11-01' AS DATE) GROUP BY p.name LIMIT 50
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
    "producto": "1 Pollo a la Brasa Entero",
    "unidades_recibidas": "1.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "unidades_recibidas": "20.00"
  },
  {
    "producto": "Papa",
    "unidades_recibidas": "20.00"
  }
]
```

</details>

<details><summary>TEST-329 — EX=True, VES=0.973642</summary>

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
SELECT s.business_name AS proveedor, pi.series AS serie, pi.number AS número, (pi.total_amount - COALESCE(SUM(pp.amount), 0)) AS saldo_pendiente FROM public.purchase_invoice AS pi JOIN public.supplier AS s ON pi.supplier_id = s.id LEFT JOIN public.purchase_payment AS pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = TRUE AND pi.issued_at >= CAST('2026-10-01' AS DATE) AND pi.issued_at < CAST('2026-11-01' AS DATE) GROUP BY s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0)) > 0 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "proveedor": "Avícola Buen Sabor de Prueba",
    "serie": "F026",
    "número": "990010",
    "saldo_pendiente": "136.00"
  },
  {
    "proveedor": "PONCE EVANGELISTA, RENZO DANIEL",
    "serie": "F003",
    "número": "42345234",
    "saldo_pendiente": "3.00"
  },
  {
    "proveedor": "COMPAÑIA FOOD RETAIL S.A.C.",
    "serie": "F002",
    "número": "34123423",
    "saldo_pendiente": "11.10"
  }
]
```

</details>

<details><summary>TEST-330 — EX=True, VES=0.99917</summary>

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
SELECT COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm WHERE cm.type = 'EXPENSE' AND cm.created_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-331 — EX=True, VES=1.0</summary>

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
SELECT SUM(cm.amount) AS total_ingresos FROM public.cash_movement AS cm WHERE cm.type = 'INCOME' AND cm.created_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND cm.created_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-332 — EX=True, VES=0.761023</summary>

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
SELECT cr.name AS caja, COUNT(cs.id) AS sesiones_cerradas FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-10-01' AS DATE) AND cs.closed_at < CAST('2026-11-01' AS DATE) GROUP BY cr.name LIMIT 50
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

<details><summary>TEST-333 — EX=True, VES=0.995827</summary>

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
SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, SUM(cs.sales_other) AS ventas_otros FROM public.cash_session AS cs JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

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
SELECT COALESCE(SUM(cs.difference), 0) AS suma_diferencias FROM public.cash_session AS cs WHERE cs.status = 'CLOSED' AND cs.closed_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND cs.closed_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) LIMIT 50
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

<details><summary>TEST-335 — EX=True, VES=1.0</summary>

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
SELECT cm.type AS tipo_movimiento, SUM(cm.amount) AS total_movido FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id WHERE cs.opened_at >= CAST('2026-10-01' AS DATE) AND cs.opened_at < CAST('2026-11-01' AS DATE) GROUP BY cm.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_movimiento": "EXPENSE",
    "total_movido": "45.00"
  },
  {
    "tipo_movimiento": "INCOME",
    "total_movido": "120.00"
  }
]
```

</details>

<details><summary>TEST-336 — EX=True, VES=1.0</summary>

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
SELECT cr.name AS caja, COALESCE(SUM(cm.amount), 0) AS total_egresos FROM public.cash_movement AS cm JOIN public.cash_session AS cs ON cm.session_id = cs.id JOIN public.cash_register AS cr ON cs.cash_register_id = cr.id WHERE cm.type = 'EXPENSE' AND cs.closed_at >= CAST('2026-10-01' AS DATE) AND cs.closed_at < CAST('2026-11-01' AS DATE) GROUP BY cr.name LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "caja": "Caja de Prueba",
    "total_egresos": "45.00"
  }
]
```

</details>

<details><summary>TEST-337 — EX=True, VES=0.996492</summary>

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
SELECT im.movement_type AS movimiento, COUNT(*) AS total_movimientos, SUM(im.quantity) AS cantidad_total FROM public.inventory_movement AS im WHERE im.moved_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY im.movement_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "movimiento": "Sale",
    "total_movimientos": "6",
    "cantidad_total": "7.00"
  },
  {
    "movimiento": "InformalPurchase",
    "total_movimientos": "7",
    "cantidad_total": "1.00"
  },
  {
    "movimiento": "Shrinkage",
    "total_movimientos": "1",
    "cantidad_total": "1.00"
  },
  {
    "movimiento": "TransformationIn",
    "total_movimientos": "4",
    "cantidad_total": "65.00"
  },
  {
    "movimiento": "Adjustment",
    "total_movimientos": "3",
    "cantidad_total": "-42.00"
  },
  {
    "movimiento": "TransformationOut",
    "total_movimientos": "4",
    "cantidad_total": "16.00"
  },
  {
    "movimiento": "Purchase",
    "total_movimientos": "17",
    "cantidad_total": "135.00"
  }
]
```

</details>

<details><summary>TEST-338 — EX=True, VES=0.99382</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS unidades FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Sale' AND im.moved_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY unidades DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Agua Mineral 600ml",
    "unidades": "4.00"
  },
  {
    "producto": "Pollo a la brasa de prueba",
    "unidades": "2.00"
  },
  {
    "producto": "1 Pollo a la Brasa Entero",
    "unidades": "1.00"
  }
]
```

</details>

<details><summary>TEST-339 — EX=True, VES=0.983419</summary>

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
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Shrinkage' AND im.moved_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY p.name LIMIT 50
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

<details><summary>TEST-340 — EX=True, VES=1.0</summary>

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
    "name": "Pollo entero de prueba",
    "cantidad": "20.00"
  },
  {
    "name": "Papa",
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
SELECT p.name AS insumo, SUM(poi.quantity_received) AS cantidad_ingresada FROM public.purchase_order_item AS poi JOIN public.purchase_order AS po ON poi.purchase_order_id = po.id JOIN public.product AS p ON poi.product_id = p.id WHERE po.received_at >= '2026-10-01' AND po.received_at < '2026-11-01' GROUP BY p.name ORDER BY cantidad_ingresada DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "insumo": "Pollo entero",
    "cantidad_ingresada": "72.00"
  },
  {
    "insumo": "Presas de pollo",
    "cantidad_ingresada": "22.00"
  },
  {
    "insumo": "Pollo entero de prueba",
    "cantidad_ingresada": "20.00"
  },
  {
    "insumo": "Papa",
    "cantidad_ingresada": "20.00"
  },
  {
    "insumo": "1 Pollo a la Brasa Entero",
    "cantidad_ingresada": "1.00"
  }
]
```

</details>

<details><summary>TEST-341 — EX=True, VES=0.983237</summary>

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
SELECT COUNT(*) AS total_transformaciones FROM public.transformation AS t WHERE t.annulled = FALSE AND t.date >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-11-01 00:00:00' AS TIMESTAMP) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_transformaciones": "3"
  }
]
```

</details>

<details><summary>TEST-342 — EX=True, VES=0.976127</summary>

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
SELECT ti.item_type AS tipo, SUM(ti.quantity) AS cantidad_total FROM public.transformation_item AS ti JOIN public.transformation AS t ON ti.transformation_id = t.id WHERE t.annulled = FALSE AND t.date >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND t.date < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY ti.item_type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo": "Consumo",
    "cantidad_total": "12.00"
  },
  {
    "tipo": "Producido",
    "cantidad_total": "58.00"
  }
]
```

</details>

<details><summary>TEST-343 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= DATE '2026-10-01' AND im.moved_at < DATE '2026-11-01' GROUP BY p.id, p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "name": "Agua Mineral 600ml",
    "cantidad": "5.00"
  },
  {
    "name": "Pollo entero de prueba",
    "cantidad": "3.00"
  },
  {
    "name": "Presas de pollo",
    "cantidad": "-50.00"
  }
]
```

**SQL generada**

```sql
SELECT p.name AS producto, SUM(im.quantity) AS cantidad FROM public.inventory_movement AS im JOIN public.product AS p ON im.product_id = p.id WHERE im.movement_type = 'Adjustment' AND im.moved_at >= CAST('2026-10-01 00:00:00' AS TIMESTAMP) AND im.moved_at < CAST('2026-11-01 00:00:00' AS TIMESTAMP) GROUP BY p.name ORDER BY cantidad DESC LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "producto": "Agua Mineral 600ml",
    "cantidad": "5.00"
  },
  {
    "producto": "Pollo entero de prueba",
    "cantidad": "3.00"
  },
  {
    "producto": "Presas de pollo",
    "cantidad": "-50.00"
  }
]
```

</details>

<details><summary>TEST-344 — EX=True, VES=0.998946</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-10-01' AND je.entry_date < DATE '2026-11-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total_debe": "5593.45",
    "total_haber": "5573.45"
  }
]
```

**SQL generada**

```sql
SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-10-01' AS DATE) AND je.entry_date < CAST('2026-11-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_debe": "5593.45",
    "total_haber": "5573.45"
  }
]
```

</details>

<details><summary>TEST-345 — EX=True, VES=0.963312</summary>

**SQL gold**

```sql
SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-10-01' AND je.entry_date < DATE '2026-11-01' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "1",
    "name": "Activo",
    "saldo": "20.00"
  },
  {
    "code": "10",
    "name": "Efectivo y equivalentes de efectivo",
    "saldo": "-20.00"
  },
  {
    "code": "1009001",
    "name": "Cuenta de activo de prueba del mes 10",
    "saldo": "200.00"
  },
  {
    "code": "101",
    "name": "Caja",
    "saldo": "-852.69"
  },
  {
    "code": "1011",
    "name": "CajaPrincipal",
    "saldo": "10.00"
  },
  {
    "code": "104",
    "name": "Bancos - Cuentas Corrientes",
    "saldo": "39.90"
  },
  {
    "code": "121",
    "name": "Cuentas por Cobrar Comerciales - Terceros",
    "saldo": "0.00"
  },
  {
    "code": "167",
    "name": "Tributos por Acreditar - IGV",
    "saldo": "66.67"
  },
  {
    "code": "201",
    "name": "Mercaderías",
    "saldo": "232.09"
  },
  {
    "code": "201001",
    "name": "Obligaciones de prueba",
    "saldo": "-80.00"
  },
  {
    "code": "211",
    "name": "Productos Terminados",
    "saldo": "-3.46"
  },
  {
    "code": "241",
    "name": "Materias Primas",
    "saldo": "245.54"
  },
  {
    "code": "401",
    "name": "Tributos por Pagar - IGV",
    "saldo": "-61.97"
  },
  {
    "code": "401001",
    "name": "Ventas de prueba",
    "saldo": "-100.00"
  },
  {
    "code": "40111",
    "name": "IGV - Cuenta Fiscal",
    "saldo": "43.45"
  },
  {
    "code": "421",
    "name": "Cuentas por Pagar Comerciales - Terceros",
    "saldo": "287.00"
  },
  {
    "code": "611",
    "name": "Mercaderías - Variación de inventarios",
    "saldo": "-611.87"
  },
  {
    "code": "659",
    "name": "Otros Gastos de Gestión",
    "saldo": "300.00"
  },
  {
    "code": "691",
    "name": "Costo de Ventas de Mercaderías",
    "saldo": "749.57"
  },
  {
    "code": "701",
    "name": "Ventas de Mercaderías",
    "saldo": "-444.23"
  }
]
```

**SQL generada**

```sql
SELECT aa.code AS codigo_cuenta, aa.name AS nombre_cuenta, COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo_neto FROM public.accounting_account AS aa JOIN public.journal_entry_detail AS jed ON aa.id = jed.account_id JOIN public.journal_entry AS je ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-10-01' AS DATE) AND je.entry_date < CAST('2026-11-01' AS DATE)) AND je.status = TRUE GROUP BY aa.code, aa.name ORDER BY codigo_cuenta LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "codigo_cuenta": "1",
    "nombre_cuenta": "Activo",
    "saldo_neto": "20.00"
  },
  {
    "codigo_cuenta": "10",
    "nombre_cuenta": "Efectivo y equivalentes de efectivo",
    "saldo_neto": "-20.00"
  },
  {
    "codigo_cuenta": "1009001",
    "nombre_cuenta": "Cuenta de activo de prueba del mes 10",
    "saldo_neto": "200.00"
  },
  {
    "codigo_cuenta": "101",
    "nombre_cuenta": "Caja",
    "saldo_neto": "-852.69"
  },
  {
    "codigo_cuenta": "1011",
    "nombre_cuenta": "CajaPrincipal",
    "saldo_neto": "10.00"
  },
  {
    "codigo_cuenta": "104",
    "nombre_cuenta": "Bancos - Cuentas Corrientes",
    "saldo_neto": "39.90"
  },
  {
    "codigo_cuenta": "121",
    "nombre_cuenta": "Cuentas por Cobrar Comerciales - Terceros",
    "saldo_neto": "0.00"
  },
  {
    "codigo_cuenta": "167",
    "nombre_cuenta": "Tributos por Acreditar - IGV",
    "saldo_neto": "66.67"
  },
  {
    "codigo_cuenta": "201",
    "nombre_cuenta": "Mercaderías",
    "saldo_neto": "232.09"
  },
  {
    "codigo_cuenta": "201001",
    "nombre_cuenta": "Obligaciones de prueba",
    "saldo_neto": "-80.00"
  },
  {
    "codigo_cuenta": "211",
    "nombre_cuenta": "Productos Terminados",
    "saldo_neto": "-3.46"
  },
  {
    "codigo_cuenta": "241",
    "nombre_cuenta": "Materias Primas",
    "saldo_neto": "245.54"
  },
  {
    "codigo_cuenta": "401",
    "nombre_cuenta": "Tributos por Pagar - IGV",
    "saldo_neto": "-61.97"
  },
  {
    "codigo_cuenta": "401001",
    "nombre_cuenta": "Ventas de prueba",
    "saldo_neto": "-100.00"
  },
  {
    "codigo_cuenta": "40111",
    "nombre_cuenta": "IGV - Cuenta Fiscal",
    "saldo_neto": "43.45"
  },
  {
    "codigo_cuenta": "421",
    "nombre_cuenta": "Cuentas por Pagar Comerciales - Terceros",
    "saldo_neto": "287.00"
  },
  {
    "codigo_cuenta": "611",
    "nombre_cuenta": "Mercaderías - Variación de inventarios",
    "saldo_neto": "-611.87"
  },
  {
    "codigo_cuenta": "659",
    "nombre_cuenta": "Otros Gastos de Gestión",
    "saldo_neto": "300.00"
  },
  {
    "codigo_cuenta": "691",
    "nombre_cuenta": "Costo de Ventas de Mercaderías",
    "saldo_neto": "749.57"
  },
  {
    "codigo_cuenta": "701",
    "nombre_cuenta": "Ventas de Mercaderías",
    "saldo_neto": "-444.23"
  }
]
```

</details>

<details><summary>TEST-346 — EX=True, VES=0.888597</summary>

**SQL gold**

```sql
SELECT je.book, COUNT(*) AS total FROM journal_entry je WHERE je.status = TRUE AND je.entry_date >= DATE '2026-10-01' AND je.entry_date < DATE '2026-11-01' GROUP BY je.book ORDER BY total DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "book": "Caja y bancos",
    "total": 33
  },
  {
    "book": "Ventas",
    "total": 27
  },
  {
    "book": "Compras",
    "total": 19
  },
  {
    "book": "Operaciones varias",
    "total": 2
  },
  {
    "book": "Diario de prueba",
    "total": 2
  },
  {
    "book": "Verificacion",
    "total": 1
  }
]
```

**SQL generada**

```sql
SELECT je.book AS diario, COUNT(je.id) AS total_asientos FROM public.journal_entry AS je WHERE (je.entry_date >= CAST('2026-10-01' AS DATE) AND je.entry_date < CAST('2026-11-01' AS DATE)) AND je.status = TRUE GROUP BY je.book LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "diario": "Ventas",
    "total_asientos": "27"
  },
  {
    "diario": "Compras",
    "total_asientos": "19"
  },
  {
    "diario": "Operaciones varias",
    "total_asientos": "2"
  },
  {
    "diario": "Diario de prueba",
    "total_asientos": "2"
  },
  {
    "diario": "Caja y bancos",
    "total_asientos": "33"
  },
  {
    "diario": "Verificacion",
    "total_asientos": "1"
  }
]
```

</details>

<details><summary>TEST-347 — EX=True, VES=0.965056</summary>

**SQL gold**

```sql
SELECT je.code, je.entry_date, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-10-01' AND je.entry_date < DATE '2026-11-01' GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY je.entry_date DESC LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "code": "BENCH26-10-02",
    "entry_date": "2026-10-23",
    "total_debe": "100.00",
    "total_haber": "80.00"
  }
]
```

**SQL generada**

```sql
SELECT je.code AS code, je.entry_date AS entry_date, SUM(jed.debit) AS debit, SUM(jed.credit) AS credit FROM public.journal_entry AS je JOIN public.journal_entry_detail AS jed ON jed.entry_id = je.id WHERE (je.entry_date >= CAST('2026-10-01' AS DATE) AND je.entry_date < CAST('2026-11-01' AS DATE)) AND je.status = TRUE GROUP BY je.id, je.code, je.entry_date HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "code": "BENCH26-10-02",
    "entry_date": "2026-10-23",
    "debit": "100.00",
    "credit": "80.00"
  }
]
```

</details>

<details><summary>TEST-348 — EX=True, VES=0.979389</summary>

**SQL gold**

```sql
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND aa.code LIKE '3%' AND je.entry_date >= DATE '2026-10-01' AND je.entry_date < DATE '2026-11-01' LIMIT 50
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
SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (aa.code LIKE '3%' AND je.entry_date >= CAST('2026-10-01' AS DATE) AND je.entry_date < CAST('2026-11-01' AS DATE)) AND je.status = TRUE LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "saldo": "0"
  }
]
```

</details>

<details><summary>TEST-349 — EX=True, VES=1.0</summary>

**SQL gold**

```sql
SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id JOIN accounting_account aa ON aa.id = jed.account_id WHERE je.status = TRUE AND je.entry_date >= DATE '2026-10-01' AND je.entry_date < DATE '2026-11-01' GROUP BY aa.type ORDER BY aa.type LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "type": "Activo",
    "total_debe": "3491.44",
    "total_haber": "3553.39"
  },
  {
    "type": "Costo",
    "total_debe": "749.57",
    "total_haber": "0.00"
  },
  {
    "type": "Gasto",
    "total_debe": "300.00",
    "total_haber": "611.87"
  },
  {
    "type": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "544.23"
  },
  {
    "type": "Pasivo",
    "total_debe": "1052.44",
    "total_haber": "863.96"
  }
]
```

**SQL generada**

```sql
SELECT aa.type AS tipo_cuenta, COALESCE(SUM(jed.debit), 0) AS total_debe, COALESCE(SUM(jed.credit), 0) AS total_haber FROM public.journal_entry_detail AS jed JOIN public.journal_entry AS je ON jed.entry_id = je.id JOIN public.accounting_account AS aa ON jed.account_id = aa.id WHERE (je.entry_date >= CAST('2026-10-01' AS DATE) AND je.entry_date < CAST('2026-11-01' AS DATE)) AND je.status = TRUE GROUP BY aa.type LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "tipo_cuenta": "Ingreso",
    "total_debe": "0.00",
    "total_haber": "544.23"
  },
  {
    "tipo_cuenta": "Activo",
    "total_debe": "3491.44",
    "total_haber": "3553.39"
  },
  {
    "tipo_cuenta": "Costo",
    "total_debe": "749.57",
    "total_haber": "0.00"
  },
  {
    "tipo_cuenta": "Pasivo",
    "total_debe": "1052.44",
    "total_haber": "863.96"
  },
  {
    "tipo_cuenta": "Gasto",
    "total_debe": "300.00",
    "total_haber": "611.87"
  }
]
```

</details>

<details><summary>TEST-350 — EX=True, VES=0.999304</summary>

**SQL gold**

```sql
SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' AND ap.start_date < DATE '2026-11-01' AND ap.end_date >= DATE '2026-10-01' LIMIT 50
```

**Respuesta SQL gold**

```json
[
  {
    "total": 2
  }
]
```

**SQL generada**

```sql
SELECT COUNT(*) AS total_periodos FROM public.accounting_period AS ap WHERE ap.status = 'OPEN' AND ap.start_date < CAST('2026-11-01' AS DATE) AND ap.end_date >= CAST('2026-10-01' AS DATE) LIMIT 50
```

**Respuesta SQL generada**

```json
[
  {
    "total_periodos": "2"
  }
]
```

</details>
