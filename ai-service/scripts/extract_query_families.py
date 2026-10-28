"""Genera ``knowledge/query_families_v1.json`` desde el dataset de entrenamiento QLoRA (solo lectura).

Uso (en WSL, donde está el proyecto de entrenamiento; Python estándar, sin dependencias)::

    python3 -I ai-service/scripts/extract_query_families.py \
        /home/ronaldo/proyectos/modeloQLoRA/data/processed/v1.7_json_v1.0_balanced/train_xiyansql.jsonl \
        ai-service/knowledge/query_families_v1.json ai-service/tests/fixtures/query_family_sql_v1.json

Cada familia del catálogo es un **tipo de consulta que el adaptador vio en el entrenamiento**: la
solicitud JSON 1.0 (con el período como parámetro), el M-Schema y la evidencia ``〖参考信息〗`` se
copian literalmente de un ejemplo anclado. No contiene preguntas ni respuestas: el SQL lo genera
XiYanSQL en cada consulta. La presentación (etiquetas en español, unidades, cifras derivadas) es la
parte escrita a mano de este archivo (:data:`SPEC`).

El SQL de entrenamiento solo se exporta a un *fixture de pruebas* (servicio de inferencia simulado);
nunca forma parte del catálogo que usa el servicio.
"""

from __future__ import annotations

import hashlib
import json
import sys

# Presentación de cada familia. ``anchor``: id del ejemplo de entrenamiento del que se copian
# solicitud, M-Schema y evidencia. ``metrics``: columna del resultado → (unidad, etiqueta[, alias]).
# ``labels``: columnas que identifican cada fila. ``shape``: escalar | agrupada | ranking | serie |
# comparacion | lista (decide qué cifras derivadas calcula el backend). ``concepto``: magnitud
# contable que mide la familia (ver CONCEPTS); el backend exige que coincida con la del intérprete.
SPEC: list[dict] = [
    {"id": "ventas_cobradas_total", "anchor": "LB-GOLD-0007", "shape": "escalar", "concepto": "cobros",
     "titulo": "Ventas cobradas", "descripcion": "dinero efectivamente cobrado a clientes en un periodo (cobros, dinero que entro)",
     "metrics": {"sales_payments_total": ["PEN", "Total cobrado por ventas"]}, "labels": []},
    {"id": "ventas_cobradas_por_dia", "anchor": "LB-GOLD-0063", "shape": "serie", "concepto": "cobros",
     "titulo": "Ventas cobradas por día", "descripcion": "cobros dia por dia; que dia entro mas dinero o tuvo mayores ingresos",
     "metrics": {"sales_payments_total": ["PEN", "Cobrado"]}, "labels": ["payment_day"]},
    {"id": "ventas_cobradas_por_medio_pago", "anchor": "LB-GOLD-0058", "shape": "agrupada", "concepto": "cobros",
     "titulo": "Ventas cobradas por medio de pago", "descripcion": "cobros por medio o tipo de pago (efectivo, tarjeta, yape)",
     "metrics": {"sales_payments_total": ["PEN", "Cobrado"], "sales_payment_count": ["N", "Cobros"]},
     "labels": ["payment_type", "payment_type_name", "name"]},
    {"id": "ventas_facturadas_por_comprobante", "anchor": "LB-GOLD-0013", "shape": "agrupada", "concepto": "ventas_facturadas",
     "titulo": "Ventas facturadas", "descripcion": "ingresos por ventas segun comprobantes emitidos: cuanto vendimos o facturamos, total y por tipo de comprobante",
     "metrics": {"invoiced_sales_total": ["PEN", "Facturado"]}, "labels": ["voucher_type"]},
    {"id": "comprobantes_venta_cantidad", "anchor": "LB-GOLD-0006", "shape": "escalar", "concepto": "ventas_facturadas",
     "titulo": "Comprobantes de venta emitidos", "descripcion": "cantidad de ventas o comprobantes de venta emitidos en un periodo (cuantas ventas hubo)",
     "metrics": {"sales_invoice_count": ["N", "Comprobantes de venta emitidos"]}, "labels": []},
    {"id": "comprobantes_venta_lista", "anchor": "LB-GOLD-0050", "shape": "lista", "concepto": "ventas_facturadas",
     "titulo": "Comprobantes de venta", "descripcion": "listado de comprobantes de venta emitidos en un periodo corto, por ejemplo ayer o hoy",
     "metrics": {"invoiced_sales_total": ["PEN", "Total", ["total_amount"]]}, "labels": ["voucher_type", "series", "number", "issued_at"]},
    {"id": "platos_mayores_ingresos", "anchor": "LB-GOLD-0057", "shape": "ranking", "concepto": "productos",
     "titulo": "Platos con mayores ingresos", "descripcion": "productos o platos que generan mas ingresos o dinero (ranking por importe vendido)",
     "metrics": {"dish_sales_amount": ["PEN", "Vendido"]}, "labels": ["dish_name", "product_name", "name"]},
    {"id": "plato_mas_vendido", "anchor": "LB-GOLD-0016", "shape": "ranking", "concepto": "productos",
     "titulo": "Plato más vendido", "descripcion": "plato o producto mas vendido o con mas ventas, por unidades vendidas",
     "metrics": {"dish_units_sold": ["N", "Unidades vendidas"]}, "labels": ["dish_name", "product_name", "name"]},
    {"id": "ventas_por_plato", "anchor": "LB-GOLD-0055", "shape": "agrupada", "concepto": "productos",
     "titulo": "Ventas por plato", "descripcion": "unidades e importe vendido de cada plato o producto",
     "metrics": {"dish_sales_amount": ["PEN", "Vendido"], "dish_units_sold": ["N", "Unidades"]}, "labels": ["dish_name", "product_name", "name"]},
    {"id": "pedidos_por_tipo", "anchor": "LB-GOLD-0059", "shape": "agrupada", "concepto": "pedidos",
     "titulo": "Pedidos por tipo", "descripcion": "cantidad de pedidos por tipo de pedido (salon, delivery, para llevar)",
     "metrics": {"sales_order_count": ["N", "Pedidos"]}, "labels": ["order_type"]},
    {"id": "pagos_proveedores_total", "anchor": "LB-GOLD-0022", "shape": "escalar", "concepto": "pagos_proveedores",
     "titulo": "Pagos a proveedores", "descripcion": "dinero efectivamente pagado a proveedores en un periodo (cuanto les pagamos)",
     "metrics": {"purchase_payments_total": ["PEN", "Total pagado a proveedores"]}, "labels": []},
    {"id": "compras_por_proveedor", "anchor": "LB-GOLD-0002", "shape": "agrupada", "concepto": "compras_facturadas",
     "titulo": "Compras facturadas por proveedor", "descripcion": "compras facturadas por proveedor, de mayor a menor (a quien le compramos mas, compras mas elevadas o recientes)",
     "metrics": {"purchase_invoiced_total": ["PEN", "Comprado"]}, "labels": ["business_name", "supplier_name", "supplier_business_name"]},
    {"id": "compras_por_comprobante", "anchor": "LB-GOLD-0075", "shape": "agrupada", "concepto": "compras_facturadas",
     "titulo": "Compras facturadas", "descripcion": "compras segun facturas o comprobantes de proveedores: cuanto compramos o gastamos en compras, total y por tipo de comprobante",
     "metrics": {"purchase_invoiced_total": ["PEN", "Comprado"], "purchase_invoice_count": ["N", "Comprobantes"]},
     "labels": ["voucher_type"]},
    {"id": "comprobantes_compra_cantidad", "anchor": "LB-GOLD-0021", "shape": "escalar", "concepto": "compras_facturadas",
     "titulo": "Comprobantes de compra", "descripcion": "cantidad de comprobantes o facturas de compra recibidos en un periodo",
     "metrics": {"purchase_invoice_count": ["N", "Comprobantes de compra"]}, "labels": []},
    {"id": "ventas_vs_compras_facturadas", "anchor": "LB-GOLD-0106", "shape": "comparacion", "concepto": "resultado_facturado",
     "titulo": "Ventas frente a compras facturadas", "descripcion": "comparar ventas facturadas con compras facturadas; si hay ganancia o perdida, situacion financiera",
     "metrics": {"invoiced_sales_total": ["PEN", "Ventas facturadas"], "purchase_invoiced_total": ["PEN", "Compras facturadas"]},
     "labels": [], "diferencia": ["invoiced_sales_total", "purchase_invoiced_total", "Diferencia (ventas menos compras)"]},
    {"id": "cobros_vs_pagos", "anchor": "LB-GOLD-0105", "shape": "comparacion", "concepto": "flujo_caja",
     "titulo": "Cobros frente a pagos", "descripcion": "comparar dinero cobrado a clientes con dinero pagado a proveedores (flujo de caja)",
     "metrics": {"sales_payments_total": ["PEN", "Cobrado por ventas"], "purchase_payments_total": ["PEN", "Pagado a proveedores"]},
     "labels": [], "diferencia": ["sales_payments_total", "purchase_payments_total", "Diferencia (cobros menos pagos)"]},
    {"id": "debe_haber_total", "anchor": "LB-GOLD-0004", "shape": "escalar", "concepto": "contabilidad",
     "titulo": "Total del debe y del haber", "descripcion": "total del debe y del haber de los asientos contables de un periodo",
     "metrics": {"total_debit": ["PEN", "Total del debe"], "total_credit": ["PEN", "Total del haber"]}, "labels": []},
    {"id": "debe_haber_por_cuenta", "anchor": "LB-GOLD-0090", "shape": "agrupada", "concepto": "contabilidad",
     "titulo": "Debe y haber por cuenta", "descripcion": "movimientos del debe y del haber de todas las cuentas contables en un periodo",
     "metrics": {"total_debit": ["PEN", "Debe"], "total_credit": ["PEN", "Haber"]}, "labels": ["code", "account_code", "name", "account_name"]},
    {"id": "debe_haber_por_dia", "anchor": "LB-GOLD-0092", "shape": "serie", "concepto": "contabilidad",
     "titulo": "Debe y haber por día", "descripcion": "movimientos contables del debe y del haber dia por dia",
     "metrics": {"total_debit": ["PEN", "Debe"], "total_credit": ["PEN", "Haber"]}, "labels": ["entry_date"]},
]

# Conceptos contables que distingue el intérprete. ``canonica``: familia que se usa si el intérprete
# elige una familia de otro concepto (``None``: sin familia entrenada, la respuesta lo dice).
CONCEPTS: dict[str, dict] = {
    "ventas_facturadas": {"canonica": "ventas_facturadas_por_comprobante",
                          "definicion": "ingresos por ventas segun comprobantes emitidos (cuanto vendimos, cuanto facturamos)"},
    "cobros": {"canonica": "ventas_cobradas_total",
               "definicion": "dinero efectivamente cobrado a clientes (cuanto cobramos, cuanto dinero entro, medios de pago, ingresos por dia)"},
    "compras_facturadas": {"canonica": "compras_por_comprobante",
                           "definicion": "compras segun facturas o comprobantes de proveedores (cuanto compramos, cuanto gastamos en compras, a quien le compramos)"},
    "pagos_proveedores": {"canonica": "pagos_proveedores_total",
                          "definicion": "dinero efectivamente pagado a proveedores (cuanto les pagamos)"},
    "gastos_operativos": {"canonica": None,
                          "definicion": "gastos de operacion que no son compras a proveedores: alquiler, luz, agua, sueldos, servicios"},
    "productos": {"canonica": "platos_mayores_ingresos", "definicion": "ventas por plato o producto"},
    "pedidos": {"canonica": "pedidos_por_tipo", "definicion": "cantidad de pedidos"},
    "resultado_facturado": {"canonica": "ventas_vs_compras_facturadas",
                            "definicion": "ventas facturadas frente a compras facturadas (ganancia o perdida, situacion financiera)"},
    "flujo_caja": {"canonica": "cobros_vs_pagos", "definicion": "cobros frente a pagos a proveedores (si entro mas dinero del que salio)"},
    "contabilidad": {"canonica": "debe_haber_total", "definicion": "totales del debe y del haber de los asientos contables"},
    "saldo_cuenta": {"canonica": None, "definicion": "saldo o movimiento de una cuenta contable concreta (caja, bancos, una cuenta por su codigo)"},
}


# Esquema del entrenamiento → base desplegada. Verificado en el catálogo de Neon (solo lectura,
# 2026-10-24): ``dish`` no existe y ``order_item.dish_id`` es ``product_id`` desde el commit 2f10622 de
# develop ("unify supply and dish into product"). El modelo sigue viendo el esquema del entrenamiento.
EQUIVALENCES = {
    "tablas": {"dish": "product"},
    "columnas": {"order_item.dish_id": "product_id"},
    "origen": "commit 2f10622 (develop): fix: unify supply and dish into product",
}


def _parts(user: str) -> tuple[dict, str, str]:
    question = json.loads(user.split("〖用户问题〗\n", 1)[1].split("\n", 1)[0])
    schema = user.split("〖数据库schema〗\n", 1)[1].split("\n\n〖参考信息〗", 1)[0]
    evidence = user.split("〖参考信息〗\n", 1)[1].split("\n\n〖用户问题〗", 1)[0]
    return question, schema, evidence


def main(dataset: str, catalog_out: str, sql_out: str) -> None:
    raw = open(dataset, "rb").read()
    rows = {json.loads(line)["id"]: json.loads(line) for line in raw.decode("utf-8").splitlines() if line.strip()}
    families, sql_examples = [], {}
    ids = {spec["id"] for spec in SPEC}
    for name, concept in CONCEPTS.items():
        canonical = concept["canonica"]
        if canonical is not None and (canonical not in ids or next(s for s in SPEC if s["id"] == canonical)["concepto"] != name):
            raise SystemExit(f"concepto {name}: familia canónica incoherente")
    for spec in SPEC:
        if spec["concepto"] not in CONCEPTS:
            raise SystemExit(f"{spec['id']}: concepto desconocido")
        anchor = rows[spec["anchor"]]
        question, schema, evidence = _parts(anchor["messages"][0]["content"])
        if question["time"] is None:
            raise SystemExit(f"{spec['id']}: la familia debe tener período")
        same = [r["id"] for r in rows.values() if _parts(r["messages"][0]["content"])[0] | {"time": None}
                == question | {"time": None}]
        families.append({
            **{k: v for k, v in spec.items() if k != "anchor"},
            "entrenamiento": {"ancla": spec["anchor"], "ejemplos": len(same)},
            "solicitud": question | {"time": {**question["time"], "start": None, "end_exclusive": None}},
            "mschema": schema,
            "evidencia": evidence,
            "contable": "journal_entry" in schema,
        })
        sql_examples[spec["id"]] = {"start": question["time"]["start"], "end_exclusive": question["time"]["end_exclusive"],
                                    "sql": anchor["messages"][1]["content"],
                                    "user_content": anchor["messages"][0]["content"]}
    catalog = {
        "version": "query-families-v1",
        "dataset": "v1.7_json_v1.0_balanced",
        "dataset_sha256": hashlib.sha256(raw).hexdigest(),
        "equivalencias_esquema": EQUIVALENCES,
        "conceptos": CONCEPTS,
        "nota": "Tipos de consulta vistos por el adaptador en el entrenamiento (no preguntas ni respuestas). "
                "Generado por ai-service/scripts/extract_query_families.py.",
        "familias": families,
    }
    json.dump(catalog, open(catalog_out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"version": catalog["version"], "nota": "SQL de entrenamiento SOLO para el servicio de inferencia simulado de las pruebas.",
               "ejemplos": sql_examples}, open(sql_out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(families)} familias; dataset sha256={catalog['dataset_sha256']}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
