"""Generate a balanced 350-case SQL benchmark within the agent's supported SQL scope."""

from __future__ import annotations

import json
import sys
from calendar import monthrange
from datetime import date
from pathlib import Path
from typing import Any

OUTPUT_FILE = Path(__file__).resolve().with_name("benchmark_cases_350.json")
MONTH_NAMES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def _last_complete_months(today: date, count: int = 10) -> list[tuple[str, str, str]]:
    months = []
    year, month = today.year, today.month
    for _ in range(count):
        month -= 1
        if month == 0:
            year -= 1
            month = 12
        start = date(year, month, 1)
        next_month = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
        months.append(
            (
                f"{MONTH_NAMES[month - 1]} de {year}",
                start.isoformat(),
                next_month.isoformat(),
            )
        )
    return list(reversed(months))


def _case(
    modulo: str,
    difficulty: str,
    question: str,
    sql: str,
    tables: tuple[str, ...],
) -> dict[str, Any]:
    return {
        "modulo": modulo,
        "dificultad": difficulty,
        "pregunta": question,
        "sql_gold": sql,
        "tablas_esperadas": list(tables),
    }


def _monthly_templates(period: tuple[str, str, str]) -> list[dict[str, Any]]:
    month_name, start, end = period
    date_range = lambda column: f"{column} >= DATE '{start}' AND {column} < DATE '{end}'"
    limit = " LIMIT 50"

    sales = [
        _case(
            "ventas", "facil",
            f"¿Cuál fue el total de comprobantes emitidos en {month_name}?",
            f"SELECT COALESCE(SUM(si.total_amount), 0) AS total FROM sales_invoice si "
            f"WHERE si.status = 'Issued' AND {date_range('si.issued_at')}{limit}",
            ("sales_invoice",),
        ),
        _case(
            "ventas", "medio",
            f"¿Cuánto se facturó por cada tipo de comprobante en {month_name}?",
            f"SELECT si.voucher_type, SUM(si.total_amount) AS total FROM sales_invoice si "
            f"WHERE si.status = 'Issued' AND {date_range('si.issued_at')} "
            f"GROUP BY si.voucher_type ORDER BY total DESC{limit}",
            ("sales_invoice",),
        ),
        _case(
            "ventas", "medio",
            f"¿Cuánto se cobró por cada medio de pago en {month_name}?",
            f"SELECT pt.name AS medio, SUM(sp.amount) AS total FROM sales_payment sp "
            f"JOIN payment_type pt ON pt.id = sp.payment_type_id "
            f"WHERE {date_range('sp.paid_at')} GROUP BY pt.id, pt.name ORDER BY total DESC{limit}",
            ("sales_payment", "payment_type"),
        ),
        _case(
            "ventas", "facil",
            f"¿Cuántos pedidos cerrados para llevar hubo en {month_name}?",
            f"SELECT COUNT(*) AS total FROM sales_order so WHERE so.order_type = 'Llevar' "
            f"AND so.status = 'Closed' AND {date_range('so.ordered_at')}{limit}",
            ("sales_order",),
        ),
        _case(
            "ventas", "dificil",
            f"¿Qué productos vendieron más unidades en pedidos cerrados durante {month_name}?",
            f"SELECT p.name, SUM(oi.quantity) AS unidades FROM sales_order so "
            f"JOIN order_item oi ON oi.order_id = so.id JOIN product p ON p.id = oi.product_id "
            f"WHERE so.status = 'Closed' AND p.sellable = TRUE AND {date_range('so.ordered_at')} "
            f"GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 5",
            ("sales_order", "order_item", "product"),
        ),
        _case(
            "ventas", "medio",
            f"¿Cuál fue el total vendido por canal de pedido en {month_name}?",
            f"SELECT so.order_type, SUM(oi.subtotal) AS total FROM sales_order so "
            f"JOIN order_item oi ON oi.order_id = so.id WHERE so.status = 'Closed' "
            f"AND {date_range('so.ordered_at')} GROUP BY so.order_type ORDER BY total DESC{limit}",
            ("sales_order", "order_item"),
        ),
        _case(
            "ventas", "dificil",
            f"¿Cuántos pedidos cerrados se atendieron en cada mesa durante {month_name}?",
            f"SELECT dt.number AS mesa, COUNT(DISTINCT so.id) AS pedidos FROM sales_order so "
            f"JOIN order_table ot ON ot.order_id = so.id JOIN dining_table dt ON dt.id = ot.table_id "
            f"WHERE so.status = 'Closed' AND so.order_type = 'Mesa' "
            f"AND {date_range('so.ordered_at')} GROUP BY dt.id, dt.number ORDER BY dt.number{limit}",
            ("sales_order", "order_table", "dining_table"),
        ),
    ]

    purchases = [
        _case(
            "compras", "facil",
            f"¿Cuál fue el total de facturas de compra activas en {month_name}?",
            f"SELECT COALESCE(SUM(pi.total_amount), 0) AS total FROM purchase_invoice pi "
            f"WHERE pi.active = TRUE AND {date_range('pi.issued_at')}{limit}",
            ("purchase_invoice",),
        ),
        _case(
            "compras", "medio",
            f"¿Cuánto se compró a cada proveedor en {month_name}?",
            f"SELECT s.business_name AS proveedor, SUM(pi.total_amount) AS total "
            f"FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id "
            f"WHERE pi.active = TRUE AND {date_range('pi.issued_at')} "
            f"GROUP BY s.id, s.business_name ORDER BY total DESC{limit}",
            ("purchase_invoice", "supplier"),
        ),
        _case(
            "compras", "medio",
            f"¿Cuánto se pagó por cada medio de pago a proveedores en {month_name}?",
            f"SELECT pt.name AS medio, SUM(pp.amount) AS total FROM purchase_payment pp "
            f"JOIN payment_type pt ON pt.id = pp.payment_type_id "
            f"WHERE {date_range('pp.paid_at')} GROUP BY pt.id, pt.name ORDER BY total DESC{limit}",
            ("purchase_payment", "payment_type"),
        ),
        _case(
            "compras", "medio",
            f"¿Cuánto se gastó por categoría en compras informales durante {month_name}?",
            f"SELECT ip.expense_category, SUM(ip.amount_paid) AS total FROM informal_purchase ip "
            f"WHERE ip.annulled = FALSE AND {date_range('ip.date')} "
            f"GROUP BY ip.expense_category ORDER BY total DESC{limit}",
            ("informal_purchase",),
        ),
        _case(
            "compras", "facil",
            f"¿Cuántas órdenes de compra hubo por estado en {month_name}?",
            f"SELECT po.status, COUNT(*) AS total FROM purchase_order po "
            f"WHERE {date_range('po.issued_at')} GROUP BY po.status ORDER BY total DESC{limit}",
            ("purchase_order",),
        ),
        _case(
            "compras", "dificil",
            f"¿Cuántas unidades recibidas hubo por producto en órdenes de compra de {month_name}?",
            f"SELECT p.name, SUM(poi.quantity_received) AS unidades FROM purchase_order po "
            f"JOIN purchase_order_item poi ON poi.purchase_order_id = po.id "
            f"JOIN product p ON p.id = poi.product_id WHERE {date_range('po.issued_at')} "
            f"GROUP BY p.id, p.name ORDER BY unidades DESC{limit}",
            ("purchase_order", "purchase_order_item", "product"),
        ),
        _case(
            "compras", "dificil",
            f"¿Qué facturas de compra activas tienen saldo pendiente en {month_name}?",
            f"SELECT s.business_name AS proveedor, pi.series, pi.number, "
            f"pi.total_amount - COALESCE(SUM(pp.amount), 0) AS saldo_pendiente "
            f"FROM purchase_invoice pi JOIN supplier s ON s.id = pi.supplier_id "
            f"LEFT JOIN purchase_payment pp ON pp.purchase_invoice_id = pi.id "
            f"WHERE pi.active = TRUE AND {date_range('pi.issued_at')} "
            f"GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount "
            f"HAVING pi.total_amount - COALESCE(SUM(pp.amount), 0) > 0 "
            f"ORDER BY saldo_pendiente DESC{limit}",
            ("purchase_invoice", "supplier", "purchase_payment"),
        ),
    ]

    cash = [
        _case(
            "caja", "facil",
            f"¿Cuál fue el total de egresos de caja en {month_name}?",
            f"SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm "
            f"WHERE cm.type = 'EXPENSE' AND {date_range('cm.created_at')}{limit}",
            ("cash_movement",),
        ),
        _case(
            "caja", "facil",
            f"¿Cuál fue el total de ingresos registrados en caja en {month_name}?",
            f"SELECT COALESCE(SUM(cm.amount), 0) AS total FROM cash_movement cm "
            f"WHERE cm.type = 'INCOME' AND {date_range('cm.created_at')}{limit}",
            ("cash_movement",),
        ),
        _case(
            "caja", "medio",
            f"¿Cuántas sesiones cerradas tuvo cada caja en {month_name}?",
            f"SELECT cr.name AS caja, COUNT(*) AS sesiones FROM cash_session cs "
            f"JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' "
            f"AND {date_range('cs.closed_at')} GROUP BY cr.id, cr.name ORDER BY sesiones DESC{limit}",
            ("cash_session", "cash_register"),
        ),
        _case(
            "caja", "medio",
            f"¿Cuánto se registró en ventas en efectivo y otros medios por caja en {month_name}?",
            f"SELECT cr.name AS caja, SUM(cs.sales_cash) AS ventas_efectivo, "
            f"SUM(cs.sales_other) AS ventas_otros FROM cash_session cs "
            f"JOIN cash_register cr ON cr.id = cs.cash_register_id WHERE cs.status = 'CLOSED' "
            f"AND {date_range('cs.closed_at')} GROUP BY cr.id, cr.name ORDER BY caja{limit}",
            ("cash_session", "cash_register"),
        ),
        _case(
            "caja", "facil",
            f"¿Cuál fue la diferencia total de las sesiones cerradas de caja en {month_name}?",
            f"SELECT COALESCE(SUM(cs.difference), 0) AS diferencia FROM cash_session cs "
            f"WHERE cs.status = 'CLOSED' AND {date_range('cs.closed_at')}{limit}",
            ("cash_session",),
        ),
        _case(
            "caja", "medio",
            f"¿Cuánto dinero se movió por tipo de movimiento de caja en {month_name}?",
            f"SELECT cm.type, SUM(cm.amount) AS total FROM cash_movement cm "
            f"WHERE {date_range('cm.created_at')} GROUP BY cm.type ORDER BY total DESC{limit}",
            ("cash_movement",),
        ),
        _case(
            "caja", "dificil",
            f"¿Cuánto se egresó por caja registradora en {month_name}?",
            f"SELECT cr.name AS caja, SUM(cm.amount) AS egresos FROM cash_movement cm "
            f"JOIN cash_session cs ON cs.id = cm.session_id "
            f"JOIN cash_register cr ON cr.id = cs.cash_register_id "
            f"WHERE cm.type = 'EXPENSE' AND {date_range('cm.created_at')} "
            f"GROUP BY cr.id, cr.name ORDER BY egresos DESC{limit}",
            ("cash_movement", "cash_session", "cash_register"),
        ),
    ]

    inventory = [
        _case(
            "inventario", "medio",
            f"¿Cuántos movimientos y qué cantidad hubo por tipo de movimiento de inventario en {month_name}?",
            f"SELECT im.movement_type, COUNT(*) AS movimientos, SUM(im.quantity) AS cantidad "
            f"FROM inventory_movement im WHERE {date_range('im.moved_at')} "
            f"GROUP BY im.movement_type ORDER BY movimientos DESC{limit}",
            ("inventory_movement",),
        ),
        _case(
            "inventario", "medio",
            f"¿Qué productos tuvieron salidas por venta y cuántas unidades en {month_name}?",
            f"SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im "
            f"JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Sale' "
            f"AND {date_range('im.moved_at')} GROUP BY p.id, p.name ORDER BY cantidad DESC{limit}",
            ("inventory_movement", "product"),
        ),
        _case(
            "inventario", "medio",
            f"¿Qué productos tuvieron mermas y qué cantidad en {month_name}?",
            f"SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im "
            f"JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Shrinkage' "
            f"AND {date_range('im.moved_at')} GROUP BY p.id, p.name ORDER BY cantidad DESC{limit}",
            ("inventory_movement", "product"),
        ),
        _case(
            "inventario", "medio",
            f"¿Qué insumos ingresaron por compras y en qué cantidad durante {month_name}?",
            f"SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im "
            f"JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Purchase' "
            f"AND {date_range('im.moved_at')} GROUP BY p.id, p.name ORDER BY cantidad DESC{limit}",
            ("inventory_movement", "product"),
        ),
        _case(
            "inventario", "facil",
            f"¿Cuántas transformaciones no anuladas hubo en {month_name}?",
            f"SELECT COUNT(*) AS total FROM transformation t WHERE t.annulled = FALSE "
            f"AND {date_range('t.date')}{limit}",
            ("transformation",),
        ),
        _case(
            "inventario", "medio",
            f"¿Qué cantidades se consumieron y produjeron en transformaciones durante {month_name}?",
            f"SELECT ti.item_type, SUM(ti.quantity) AS cantidad FROM transformation t "
            f"JOIN transformation_item ti ON ti.transformation_id = t.id "
            f"WHERE t.annulled = FALSE AND {date_range('t.date')} "
            f"GROUP BY ti.item_type ORDER BY ti.item_type{limit}",
            ("transformation", "transformation_item"),
        ),
        _case(
            "inventario", "medio",
            f"¿Qué productos tuvieron ajustes de inventario y en qué cantidad en {month_name}?",
            f"SELECT p.name, SUM(im.quantity) AS cantidad FROM inventory_movement im "
            f"JOIN product p ON p.id = im.product_id WHERE im.movement_type = 'Adjustment' "
            f"AND {date_range('im.moved_at')} GROUP BY p.id, p.name ORDER BY cantidad DESC{limit}",
            ("inventory_movement", "product"),
        ),
    ]

    accounting = [
        _case(
            "contabilidad", "medio",
            f"¿Cuánto sumaron el debe y el haber de los asientos registrados en {month_name}?",
            f"SELECT COALESCE(SUM(jed.debit), 0) AS total_debe, "
            f"COALESCE(SUM(jed.credit), 0) AS total_haber FROM journal_entry je "
            f"JOIN journal_entry_detail jed ON jed.entry_id = je.id "
            f"WHERE je.status = TRUE AND {date_range('je.entry_date')}{limit}",
            ("journal_entry", "journal_entry_detail"),
        ),
        _case(
            "contabilidad", "dificil",
            f"¿Cuál fue el saldo neto por cuenta contable en {month_name}?",
            f"SELECT aa.code, aa.name, SUM(jed.debit) - SUM(jed.credit) AS saldo "
            f"FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id "
            f"JOIN accounting_account aa ON aa.id = jed.account_id "
            f"WHERE je.status = TRUE AND {date_range('je.entry_date')} "
            f"GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code{limit}",
            ("journal_entry", "journal_entry_detail", "accounting_account"),
        ),
        _case(
            "contabilidad", "facil",
            f"¿Cuántos asientos registrados hubo por diario en {month_name}?",
            f"SELECT je.book, COUNT(*) AS total FROM journal_entry je "
            f"WHERE je.status = TRUE AND {date_range('je.entry_date')} "
            f"GROUP BY je.book ORDER BY total DESC{limit}",
            ("journal_entry",),
        ),
        _case(
            "contabilidad", "dificil",
            f"¿Qué asientos registrados no cuadraron entre debe y haber en {month_name}?",
            f"SELECT je.id, je.code, je.entry_date, SUM(jed.debit) AS total_debe, "
            f"SUM(jed.credit) AS total_haber FROM journal_entry je "
            f"JOIN journal_entry_detail jed ON jed.entry_id = je.id "
            f"WHERE je.status = TRUE AND {date_range('je.entry_date')} "
            f"GROUP BY je.id, je.code, je.entry_date "
            f"HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 "
            f"ORDER BY je.entry_date DESC{limit}",
            ("journal_entry", "journal_entry_detail"),
        ),
        _case(
            "contabilidad", "medio",
            f"¿Cuál fue el saldo neto del elemento contable {1 + (int(start[5:7]) - 1) % 7} en {month_name}?",
            f"SELECT COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0) AS saldo "
            f"FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id "
            f"JOIN accounting_account aa ON aa.id = jed.account_id "
            f"WHERE je.status = TRUE AND aa.code LIKE '{1 + (int(start[5:7]) - 1) % 7}%' "
            f"AND {date_range('je.entry_date')}{limit}",
            ("journal_entry", "journal_entry_detail", "accounting_account"),
        ),
        _case(
            "contabilidad", "medio",
            f"¿Cuánto sumaron el debe y el haber por tipo de cuenta en {month_name}?",
            f"SELECT aa.type, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber "
            f"FROM journal_entry je JOIN journal_entry_detail jed ON jed.entry_id = je.id "
            f"JOIN accounting_account aa ON aa.id = jed.account_id "
            f"WHERE je.status = TRUE AND {date_range('je.entry_date')} "
            f"GROUP BY aa.type ORDER BY aa.type{limit}",
            ("journal_entry", "journal_entry_detail", "accounting_account"),
        ),
        _case(
            "contabilidad", "medio",
            f"¿Cuántos periodos contables abiertos abarcan {month_name}?",
            f"SELECT COUNT(*) AS total FROM accounting_period ap WHERE ap.status = 'OPEN' "
            f"AND ap.start_date < DATE '{end}' AND ap.end_date >= DATE '{start}'{limit}",
            ("accounting_period",),
        ),
    ]

    return sales + purchases + cash + inventory + accounting


def generate_350_test_suite(today: date | None = None) -> list[dict[str, Any]]:
    """Create 35 supported query shapes across 10 complete historical months."""
    reference_date = today or date.today()
    cases = []
    for period in _last_complete_months(reference_date):
        cases.extend(_monthly_templates(period))

    if len(cases) != 350:
        raise ValueError(f"Se esperaban 350 casos, se generaron {len(cases)}.")

    for index, case in enumerate(cases, start=1):
        case["id"] = f"TEST-{index:03d}"
    return cases


def suite_document(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the JSON envelope and distributions from the generated cases."""
    return {
        "version": "benchmark-v2-supported-sql",
        "total_casos": len(cases),
        "descripcion": (
            "350 casos balanceados sobre 5 módulos, 35 formas de consulta compatibles con el agente "
            "y 10 meses completos. No usa clientes ni sintaxis que el validador rechaza."
        ),
        "distribucion_dificultad": {
            level: sum(case["dificultad"] == level for case in cases)
            for level in ("facil", "medio", "dificil")
        },
        "distribucion_modulo": {
            module: sum(case["modulo"] == module for case in cases)
            for module in ("ventas", "compras", "caja", "inventario", "contabilidad")
        },
        "casos": cases,
    }


def validate_cases(cases: list[dict[str, Any]]) -> None:
    """Reject generated SQL that is outside the actual read-only role/validator scope."""
    project_root = Path(__file__).resolve().parents[2]
    service_src = project_root / "agents-service" / "src"
    if str(service_src) not in sys.path:
        sys.path.insert(0, str(service_src))

    from agents_service.validation.allowlist import load_allowlist
    from agents_service.validation.validator import SqlValidator

    allowlist = load_allowlist(
        project_root / "agents-service" / "knowledge" / "allowlist.readonly_erp.json"
    )
    validator = SqlValidator(allowlist)
    for case in cases:
        verdict = validator.validate(case["sql_gold"], "contador_demo")
        if not verdict.approved:
            reasons = ", ".join(verdict.reasons)
            raise ValueError(f"{case['id']} no pasa SqlValidator: {reasons}")

        used_tables = {table.rsplit(".", 1)[-1] for table in verdict.tables}
        expected_tables = set(case["tablas_esperadas"])
        if used_tables != expected_tables:
            raise ValueError(
                f"{case['id']} declara tablas {sorted(expected_tables)}, "
                f"pero el SQL usa {sorted(used_tables)}."
            )


def main() -> None:
    suite = generate_350_test_suite()
    validate_cases(suite)
    OUTPUT_FILE.write_text(
        json.dumps(suite_document(suite), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Generados {len(suite)} casos en {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
