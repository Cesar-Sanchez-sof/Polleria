"""Genera ``knowledge/erp_modules_v1.json``: módulos del ERP consultables por la ruta ampliada.

Uso (desde la raíz del repositorio; solo LECTURA del catálogo de Neon, sin filas de negocio)::

    ai-service/.venv/Scripts/python.exe ai-service/scripts/extract_erp_modules.py ai-service/knowledge/erp_modules_v1.json

Combina :data:`MODULES` (escrito a mano: qué tablas y columnas puede ver el asistente, qué permiso del
ERP habilita cada módulo y el significado de estados y campos) con la introspección de ``pg_catalog``
de la base desplegada (tipos, claves primarias y foráneas). Falla si una columna de :data:`MODULES` no
existe en Neon. Las columnas personales o sensibles (RUC, teléfonos, correos, nombres de personas,
contraseñas, sueldos) y las tablas de personas y seguridad no aparecen.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from ai_service.config.settings import READONLY_DSN_VAR, read_dotenv_keys  # noqa: E402
from ai_service.execution.postgres_readonly import (  # noqa: E402
    READ_ONLY_CHECK,
    SESSION_STATEMENTS,
    psycopg_connection_factory,
)

# Excluidas siempre (personas, seguridad, auditoría, sistema).
EXCLUDED_TABLES = (
    "app_user", "role", "permission", "role_permission", "audit_log", "employee", "payroll", "customer", "shift",
    "_prisma_migrations",
)

# ``permisos``: basta uno (lista de ``lib/auth/permissions-catalog.ts``; el rol de sistema los tiene todos).
# ``tablas``: tabla → (descripción en español para el RAG, nota en inglés para el modelo, columnas, notas).
MODULES: dict[str, dict] = {
    "ventas": {
        "nombre": "Ventas, pedidos y mesas",
        "permisos": ["pedidos.ver", "ventas.ver", "facturas.ver", "caja.ver", "mesas.ver"],
        "tablas": {
            "sales_order": ("Pedidos del restaurante (salón, delivery o para llevar) con su estado.",
                            "A sales_order is a customer order. sales_order has no amount columns: order amounts are SUM(order_item.subtotal) per order_id.",
                            ["id", "code", "order_type", "ordered_at", "status"],
                            {"status": "Order status values: Received, Preparing, Served (still open), Closed (paid) and "
                                       "Cancelled. Pending or open orders are those not Closed and not Cancelled.",
                             "ordered_at": "Order timestamp.",
                             "order_type": "order_type Mesa is dine-in and Llevar is takeaway or delivery."}),
            "order_item": ("Platos o productos de cada pedido: cantidad, precio y subtotal.",
                           "order_item lines belong to a sales_order and reference a product.",
                           ["id", "order_id", "product_id", "quantity", "unit_price", "subtotal", "dish_status"],
                           {"subtotal": "Line amount sold in soles.", "dish_status": "Kitchen status of the item."}),
            "order_table": ("Mesas asignadas a cada pedido.", "order_table links a sales_order to a dining_table.",
                            ["id", "table_id", "order_id"], {}),
            "dining_table": ("Mesas del salón: número, capacidad y si están activas.", "dining_table is a restaurant table; the tables of the restaurant are the rows of dining_table (count them there, not in order_table).",
                             ["id", "number", "capacity", "active"], {}),
            "sales_invoice": ("Comprobantes de venta emitidos (boletas y facturas): fecha, subtotal, IGV y total.",
                              "A sales_invoice is an issued sales voucher; issued_at is its date.",
                              ["id", "order_id", "voucher_type", "series", "number", "issued_at", "subtotal", "igv",
                               "total_amount", "created_at", "status", "cash_session_id"],
                              {"total_amount": "Invoiced sales amount in soles.", "status": "Issued vouchers have status Issued.",
                               "voucher_type": "voucher_type Factura or Boleta: 'facturas' means voucher_type Factura only; "
                                               "'comprobantes' or 'ventas' include both."}),
            "sales_payment": ("Cobros de ventas: importe cobrado, fecha y medio de pago.",
                              "sales_payment.amount is money received from customers; paid_at is the payment timestamp.",
                              ["id", "sales_invoice_id", "payment_type_id", "amount", "paid_at"], {}),
            "payment_type": ("Medios de pago (efectivo, tarjeta, Yape, transferencia).", "payment_type.name is the payment method; filter a method by payment_type.name.",
                             ["id", "name", "active"],
                             {"name": "payment_type.name values: Efectivo (cash), Plin, Tarjeta / POS (card), Transferencia, Yape."}),
        },
    },
    "productos": {
        "nombre": "Productos, carta y stock",
        "permisos": ["platos.ver", "inventario.ver"],
        "tablas": {
            "product": ("Productos e insumos: nombre, unidad, stock actual y mínimo, costos, precio de venta y si se vende.",
                        "product holds both raw materials (type RawMaterial) and sellable finished products (type "
                        "FinishedProduct, sellable true).",
                        ["id", "name", "unit_of_measure", "current_stock", "minimum_stock", "active", "affectation_igv",
                         "average_cost", "last_cost", "type", "price", "sellable"],
                        {"current_stock": "Current stock is product.current_stock; never compute stock from inventory_movement.",
                         "type": "Raw materials (insumos) are type RawMaterial; finished products are type FinishedProduct.",
                         "minimum_stock": "Products running out are active products with current_stock <= minimum_stock.",
                         "price": "Sale price in soles; the menu (carta) are products with sellable true; price can be NULL.",
                         "active": "Registered products are all rows of product; filter active only when active products are asked.",
                         "sellable": "Products that are sold (menu items) have sellable true; questions about product sales "
                                     "consider only sellable products.",
                         "name": "Product names are matched partially with ILIKE and the words the user wrote; names "
                                 "include portions such as 1/4 or Entero."}),
            "product_recipe": ("Recetas: insumos (ingredientes) y cantidades que requiere cada producto.",
                               "product_recipe links a product to an ingredient product with quantity_required.",
                               ["id", "product_id", "ingredient_id", "quantity_required", "active"], {}),
        },
    },
    "inventario": {
        "nombre": "Inventario y transformaciones",
        "permisos": ["inventario.ver", "transformacion.ver"],
        "tablas": {
            "inventory_movement": ("Movimientos de inventario: entradas y salidas de stock por compra, venta, merma, ajuste o transformación.",
                                   "inventory_movement records stock changes; moved_at is its timestamp.",
                                   ["id", "product_id", "quantity", "reason", "moved_at", "unit_cost", "movement_type",
                                    "informal_purchase_id", "order_item_id", "purchase_order_item_id", "transformation_item_id"],
                                   {"movement_type": "movement_type values: Purchase, TransformationOut, TransformationIn, "
                                                     "Sale, Shrinkage (waste or loss, merma), Adjustment, InformalPurchase."}),
            "transformation": ("Transformaciones de insumos en productos (producción interna).",
                               "A transformation turns input products into output products.",
                               ["id", "date", "annulled", "annulled_at"], {"annulled": "Valid transformations have annulled false."}),
            "transformation_item": ("Insumos consumidos y productos obtenidos en cada transformación.",
                                    "transformation_item lines of a transformation; item_type tells input or output.",
                                    ["id", "transformation_id", "product_id", "item_type", "quantity", "unit_cost"], {}),
        },
    },
    "compras": {
        "nombre": "Compras, órdenes y gastos",
        "permisos": ["compras.ver", "dashcompras.ver"],
        "tablas": {
            "purchase_order": ("Órdenes de compra a proveedores: número, fechas, totales y estado.",
                               "A purchase_order is an order to a supplier.",
                               ["id", "supplier_id", "order_number", "issued_at", "expected_at", "subtotal", "igv", "total",
                                "received_at", "status"],
                               {"status": "Purchase order status values: Pending, PartiallyReceived, FullyReceived, Cancelled."}),
            "purchase_order_item": ("Productos e insumos de cada orden de compra: cantidad pedida y recibida, precio e importe.",
                                    "purchase_order_item lines of a purchase_order.",
                                    ["id", "purchase_order_id", "product_id", "quantity_ordered", "quantity_received", "unit_price",
                                     "subtotal_line", "igv_line", "final_amount_line", "affectation_igv_applied"], {}),
            "purchase_invoice": ("Facturas o comprobantes de compra de proveedores: fecha, subtotal, IGV y total.",
                                 "purchase_invoice.total_amount is the invoiced purchase amount; issued_at is its date.",
                                 ["id", "purchase_order_id", "supplier_id", "voucher_type", "series", "number", "issued_at",
                                  "subtotal", "igv", "total_amount", "created_at", "active"],
                                 {"issued_at": "The last purchase is the purchase_invoice with the latest issued_at; use "
                                               "informal_purchase only when purchases without voucher are asked."}),
            "purchase_payment": ("Pagos realizados a proveedores por sus facturas.",
                                 "purchase_payment.amount is money paid to suppliers; paid_at is the payment timestamp.",
                                 ["id", "purchase_invoice_id", "payment_type_id", "amount", "paid_at"], {}),
            "informal_purchase": ("Compras sin comprobante y gastos operativos menores (personal eventual, movilidad, limpieza, servicios).",
                                  "informal_purchase records purchases without voucher; purchase_type OperatingExpense are "
                                  "the operating expenses of the restaurant (amount_paid, date) and InventoryItem are stock purchases.",
                                  ["id", "product_id", "quantity", "amount_paid", "date", "annulled", "expense_category",
                                   "item_description", "purchase_type"],
                                  {"annulled": "Valid records have annulled false.",
                                   "expense_category": "expense_category values: CasualStaff, EventServices, "
                                                       "TransportAndDelivery, CleaningSupplies, OtherMinorExpenses."}),
        },
    },
    "proveedores": {
        "nombre": "Proveedores",
        "permisos": ["proveedores.ver", "compras.ver"],
        "tablas": {
            "supplier": ("Proveedores: razón social y si están activos.", "supplier.business_name is the supplier name.",
                         ["id", "business_name", "active"],
                         {"business_name": "Supplier names are matched partially with ILIKE and the words the user wrote."}),
        },
    },
    "caja": {
        "nombre": "Caja",
        "permisos": ["caja.ver"],
        "tablas": {
            "cash_register": ("Cajas registradoras.", "cash_register is a cash desk.", ["id", "name", "code", "active"], {}),
            "cash_session": ("Aperturas y cierres de caja: monto inicial, ventas en efectivo y otras, esperado, contado y diferencia.",
                             "cash_session is a cash desk shift between opened_at and closed_at.",
                             ["id", "cash_register_id", "opened_at", "closed_at", "initial_amount", "sales_cash", "sales_other",
                              "total_sales", "expected_amount", "counted_amount", "difference", "status"],
                             {"status": "cash_session status values: OPEN, CLOSED. The last closing is the CLOSED "
                                        "session with the latest closed_at; open sessions have closed_at NULL.",
                              "difference": "difference is counted_amount minus expected_amount at closing.",
                              "sales_cash": "Cash sales of a session are cash_session.sales_cash; card and other sales are "
                                            "sales_other."}),
            "cash_movement": ("Ingresos y egresos manuales de caja con su motivo.",
                              "cash_movement type INCOME or EXPENSE; amount in soles.",
                              ["id", "session_id", "type", "amount", "reason", "created_at"],
                              {"type": "type INCOME is cash income (ingreso) and EXPENSE is cash outflow (egreso, salida). "
                                       "cash_movement holds only manual movements, never sales."}),
        },
    },
    "contabilidad": {
        "nombre": "Contabilidad",
        "permisos": ["asientos.ver", "cuentas.ver", "periodos.ver", "pagar.ver", "reportes.ver"],
        "tablas": {
            "accounting_account": ("Plan de cuentas contables: código, nombre y tipo.", "accounting_account is the chart of accounts.",
                                   ["id", "parent_id", "code", "name", "type", "active"], {}),
            "accounting_period": ("Periodos contables con fechas de inicio y fin y estado abierto o cerrado.",
                                  "accounting_period status OPEN or CLOSED.",
                                  ["id", "start_date", "end_date", "status", "closed_at"], {}),
            "journal_entry": ("Asientos contables: fecha, libro, glosa y estado (registrado o anulado).",
                              "journal_entry status true is registered and false is voided; entry_date is the accounting date.",
                              ["id", "sales_invoice_id", "purchase_invoice_id", "entry_date", "description", "book", "code",
                               "status", "period_id", "transformation_id"], {}),
            "journal_entry_detail": ("Líneas de los asientos: cuenta, debe y haber.",
                                     "journal_entry_detail.debit and credit are amounts of each entry line.",
                                     ["id", "entry_id", "account_id", "description", "debit", "credit"], {}),
        },
    },
}

# Valores válidos de estados y tipos: los enums los lee de Neon (pg_enum); los VARCHAR, del código del ERP
# (app/api/orders: Received, Preparing, Served, Closed, Cancelled; app/api/sales: Issued).
VARCHAR_VALUES = {
    ("sales_order", "status"): ["Received", "Preparing", "Served", "Closed", "Cancelled"],
    ("sales_order", "order_type"): ["Mesa", "Llevar"],  # app/sales/page.tsx
    ("sales_invoice", "status"): ["Issued"],
    ("sales_invoice", "voucher_type"): ["Boleta", "Factura"],
    ("purchase_invoice", "voucher_type"): ["Boleta", "Factura"],
    ("accounting_account", "type"): ["Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto", "Costo"],  # = motor B1
    ("transformation_item", "item_type"): ["Consumo", "Producido"],
    # Configuración (filas de payment_type), no código: solo sirve para normalizar mayúsculas.
    ("payment_type", "name"): ["Efectivo", "Plin", "Tarjeta / POS", "Transferencia", "Yape"],
}
# Listas COMPLETAS (además de los enums): un literal fuera de ellas es un error del modelo.
CLOSED_VARCHAR_VALUES = {
    ("sales_order", "status"), ("sales_order", "order_type"), ("sales_invoice", "voucher_type"),
    ("purchase_invoice", "voucher_type"), ("accounting_account", "type"), ("transformation_item", "item_type"),
}
ENUMS = "SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname"
ENUM_COLUMNS = """
SELECT c.relname, a.attname, t.typname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped JOIN pg_type t ON t.oid = a.atttypid
WHERE n.nspname = 'public' AND t.typtype = 'e'"""

TYPE_MAP = {"integer": "INTEGER", "smallint": "SMALLINT", "bigint": "BIGINT", "boolean": "BOOLEAN", "date": "DATE",
            "text": "TEXT", "jsonb": "JSONB"}
COLUMNS = """
SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, t.typtype = 'e'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
JOIN pg_type t ON t.oid = a.atttypid WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname, a.attnum"""
KEYS = """
SELECT c.relname, con.contype, a.attname, ref.relname, ra.attname
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
LEFT JOIN pg_class ref ON ref.oid = con.confrelid
LEFT JOIN pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = con.confkey[1]
WHERE n.nspname = 'public' AND con.contype IN ('p', 'f') AND cardinality(con.conkey) = 1"""


def mschema_type(pg_type: str, is_enum: bool) -> str:
    if is_enum:
        return "VARCHAR"
    if pg_type in TYPE_MAP:
        return TYPE_MAP[pg_type]
    if pg_type.startswith("character varying"):
        return pg_type.replace("character varying", "VARCHAR")
    if pg_type.startswith("numeric"):
        return pg_type.replace("numeric", "DECIMAL").replace(" ", "")
    if pg_type.startswith("timestamp"):
        return "TIMESTAMP"
    raise SystemExit(f"tipo sin traducción: {pg_type}")


def main(out: str) -> None:
    dsn = os.environ.get(READONLY_DSN_VAR, "").strip() or read_dotenv_keys(Path("ai-service/.env")).get(READONLY_DSN_VAR, "")
    with psycopg_connection_factory(dsn)() as conn:
        with conn.transaction():
            for statement in SESSION_STATEMENTS:
                conn.execute(statement)
            if conn.execute(READ_ONLY_CHECK).fetchone()[0] != "on":
                raise SystemExit("la sesión no es de solo lectura")
            columns = conn.execute(COLUMNS).fetchall()
            keys = conn.execute(KEYS).fetchall()
            enum_labels = {name: list(labels) for name, labels in conn.execute(ENUMS).fetchall()}
            enum_columns = {(t, c): enum_labels[typ] for t, c, typ in conn.execute(ENUM_COLUMNS).fetchall()}
    del dsn
    real: dict[str, dict[str, tuple[str, bool, bool]]] = {}
    for table, column, typ, notnull, is_enum in columns:
        real.setdefault(table, {})[column] = (typ, not notnull, is_enum)
    pks = {(t, c) for t, kind, c, _, _ in keys if kind == "p"}
    fks = [(t, c, rt, rc) for t, kind, c, rt, rc in keys if kind == "f"]

    allowed = {table: spec[2] for module in MODULES.values() for table, spec in module["tablas"].items()}
    tables = {}
    for module_id, module in MODULES.items():
        for table, (es, en, cols, notes) in module["tablas"].items():
            if table in EXCLUDED_TABLES or table not in real:
                raise SystemExit(f"tabla no válida: {table}")
            missing = [c for c in cols if c not in real[table]]
            if missing:
                raise SystemExit(f"{table}: columnas inexistentes en Neon {missing}")
            tables[table] = {
                "modulo": module_id, "descripcion": es, "evidencia": en,
                "columnas": [{"nombre": c, "tipo": mschema_type(real[table][c][0], real[table][c][2]),
                              "nullable": real[table][c][1], "pk": (table, c) in pks} for c in real[table] if c in cols],
                "relaciones": [{"columna": c, "tabla": rt, "columna_destino": rc} for t, c, rt, rc in fks
                               if t == table and c in cols and rt in allowed and rc in allowed[rt]],
                "notas": notes,
                "valores": {c: ({**enum_columns, **VARCHAR_VALUES}).get((table, c)) for c in cols
                            if (table, c) in enum_columns or (table, c) in VARCHAR_VALUES},
                "valores_cerrados": [c for c in cols if (table, c) in enum_columns or (table, c) in CLOSED_VARCHAR_VALUES],
            }
    structure = json.dumps({t: [(c["nombre"], c["tipo"]) for c in v["columnas"]] for t, v in sorted(tables.items())})
    data = {
        "version": "erp-modules-v1",
        "generado": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "fuente": "pg_catalog de Neon (solo lectura) + especificación de scripts/extract_erp_modules.py",
        "estructura_sha256": hashlib.sha256(structure.encode()).hexdigest(),
        "excluidas": list(EXCLUDED_TABLES),
        "modulos": {m: {"nombre": v["nombre"], "permisos": v["permisos"], "tablas": list(v["tablas"])} for m, v in MODULES.items()},
        "tablas": tables,
    }
    Path(out).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(MODULES)} módulos, {len(tables)} tablas; estructura sha256={data['estructura_sha256']}")


if __name__ == "__main__":
    main(sys.argv[1])
