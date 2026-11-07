const fs = require('fs');

const baseTemplates = [
  { id: 'VEN-001', modulo: 'ventas', dificultad: 'facil', pregunta: '¿Cuántas mesas registradas están activas en el salón?', sql: 'SELECT COUNT(*) FROM dining_table WHERE is_active = true;', tablas: ['dining_table'] },
  { id: 'VEN-002', modulo: 'ventas', dificultad: 'facil', pregunta: 'Listar todos los pedidos de tipo Llevar.', sql: "SELECT * FROM sales_order WHERE order_type = 'Llevar';", tablas: ['sales_order'] },
  { id: 'VEN-003', modulo: 'ventas', dificultad: 'facil', pregunta: 'Total facturado de boletas emitidas con estado Issued.', sql: "SELECT COALESCE(SUM(total_amount), 0.00) FROM sales_invoice WHERE voucher_type = 'Boleta' AND status = 'Issued';", tablas: ['sales_invoice'] },
  { id: 'VEN-004', modulo: 'ventas', dificultad: 'facil', pregunta: '¿Cuántos comprobantes de venta de tipo Factura se han emitido?', sql: "SELECT COUNT(*) FROM sales_invoice WHERE voucher_type = 'Factura' AND status = 'Issued';", tablas: ['sales_invoice'] },
  { id: 'VEN-005', modulo: 'ventas', dificultad: 'medio', pregunta: 'Total vendido agrupado por tipo de comprobante en facturas emitidas.', sql: "SELECT voucher_type, SUM(total_amount) AS total FROM sales_invoice WHERE status = 'Issued' GROUP BY voucher_type;", tablas: ['sales_invoice'] },
  { id: 'VEN-006', modulo: 'ventas', dificultad: 'medio', pregunta: 'Monto total vendido por cada método de pago registrado en ventas.', sql: "SELECT pt.name AS metodo, SUM(sp.amount) AS total_cobrado FROM sales_payment sp JOIN payment_type pt ON sp.payment_type_id = pt.id GROUP BY pt.id, pt.name ORDER BY total_cobrado DESC;", tablas: ['sales_payment', 'payment_type'] },
  { id: 'VEN-007', modulo: 'ventas', dificultad: 'medio', pregunta: 'Top 5 productos con mayor cantidad vendida en ítems de pedidos.', sql: "SELECT p.name, SUM(oi.quantity) AS unidades_vendidas FROM order_item oi JOIN product p ON oi.product_id = p.id GROUP BY p.id, p.name ORDER BY unidades_vendidas DESC LIMIT 5;", tablas: ['order_item', 'product'] },
  { id: 'VEN-008', modulo: 'ventas', dificultad: 'dificil', pregunta: 'Total de ventas por cliente que superen los 1000 soles acumulados.', sql: "SELECT c.id, c.business_name, SUM(si.total_amount) AS total_cliente FROM sales_invoice si JOIN customer c ON si.customer_id = c.id WHERE si.status = 'Issued' GROUP BY c.id, c.business_name HAVING SUM(si.total_amount) > 1000.00 ORDER BY total_cliente DESC;", tablas: ['sales_invoice', 'customer'] },
  { id: 'VEN-009', modulo: 'ventas', dificultad: 'dificil', pregunta: 'Pedidos de mesa cerrados con tiempo de atención y monto total de ítems.', sql: "SELECT so.id, so.order_number, dt.number AS mesa, SUM(oi.subtotal) AS total_pedido FROM sales_order so JOIN order_table ot ON so.id = ot.order_id JOIN dining_table dt ON ot.table_id = dt.id JOIN order_item oi ON so.id = oi.order_id WHERE so.status = 'Closed' AND so.order_type = 'Mesa' GROUP BY so.id, so.order_number, dt.number;", tablas: ['sales_order', 'order_table', 'dining_table', 'order_item'] },
  { id: 'VEN-010', modulo: 'ventas', dificultad: 'extra_dificil', pregunta: 'Ranking de ventas mensuales con función de ventana por producto y porcentaje sobre el total del mes.', sql: "WITH ventas_prod AS (SELECT DATE_TRUNC('month', so.ordered_at) AS mes, p.id AS prod_id, p.name AS producto, SUM(oi.subtotal) AS total_prod FROM sales_order so JOIN order_item oi ON so.id = oi.order_id JOIN product p ON oi.product_id = p.id WHERE so.status = 'Closed' GROUP BY DATE_TRUNC('month', so.ordered_at), p.id, p.name) SELECT mes, producto, total_prod, DENSE_RANK() OVER (PARTITION BY mes ORDER BY total_prod DESC) AS ranking, ROUND((total_prod / SUM(total_prod) OVER (PARTITION BY mes)) * 100, 2) AS pct_mes FROM ventas_prod ORDER BY mes DESC, ranking ASC;", tablas: ['sales_order', 'order_item', 'product'] },
  { id: 'COM-001', modulo: 'compras', dificultad: 'facil', pregunta: '¿Cuántos proveedores registrados están activos?', sql: 'SELECT COUNT(*) FROM supplier WHERE active = true;', tablas: ['supplier'] },
  { id: 'COM-002', modulo: 'compras', dificultad: 'facil', pregunta: 'Listar las órdenes de compra con estado Pending.', sql: "SELECT * FROM purchase_order WHERE status = 'Pending';", tablas: ['purchase_order'] },
  { id: 'COM-003', modulo: 'compras', dificultad: 'facil', pregunta: 'Suma total de gastos operativos en compras sin comprobante no anuladas.', sql: "SELECT COALESCE(SUM(amount_paid), 0.00) FROM informal_purchase WHERE purchase_type = 'OperatingExpense' AND annulled = false;", tablas: ['informal_purchase'] },
  { id: 'COM-004', modulo: 'compras', dificultad: 'medio', pregunta: 'Total comprado agrupado por proveedor en facturas de compra activas.', sql: 'SELECT s.business_name, SUM(pi.total_amount) AS total_comprado FROM purchase_invoice pi JOIN supplier s ON pi.supplier_id = s.id WHERE pi.active = true GROUP BY s.id, s.business_name ORDER BY total_comprado DESC;', tablas: ['purchase_invoice', 'supplier'] },
  { id: 'COM-005', modulo: 'compras', dificultad: 'medio', pregunta: 'Desglose de gastos en compras sin comprobante por categoría de gasto.', sql: 'SELECT expense_category, COUNT(*) AS operaciones, SUM(amount_paid) AS total FROM informal_purchase WHERE annulled = false GROUP BY expense_category ORDER BY total DESC;', tablas: ['informal_purchase'] },
  { id: 'COM-006', modulo: 'compras', dificultad: 'dificil', pregunta: 'Proveedores con saldo pendiente de pago por comprobantes no cancelados en su totalidad.', sql: 'SELECT s.business_name, pi.series, pi.number, pi.total_amount, COALESCE(SUM(pp.amount), 0.00) AS total_pagado, (pi.total_amount - COALESCE(SUM(pp.amount), 0.00)) AS saldo_pendiente FROM purchase_invoice pi JOIN supplier s ON pi.supplier_id = s.id LEFT JOIN purchase_payment pp ON pi.id = pp.purchase_invoice_id WHERE pi.active = true GROUP BY s.id, s.business_name, pi.id, pi.series, pi.number, pi.total_amount HAVING (pi.total_amount - COALESCE(SUM(pp.amount), 0.00)) > 0 ORDER BY saldo_pendiente DESC;', tablas: ['purchase_invoice', 'supplier', 'purchase_payment'] },
  { id: 'CAJ-001', modulo: 'caja', dificultad: 'facil', pregunta: '¿Cuántas sesiones de caja tienen estado OPEN actualmente?', sql: "SELECT COUNT(*) FROM cash_session WHERE status = 'OPEN';", tablas: ['cash_session'] },
  { id: 'CAJ-002', modulo: 'caja', dificultad: 'facil', pregunta: 'Total de dinero en movimientos manuales de egreso (EXPENSE).', sql: "SELECT COALESCE(SUM(amount), 0.00) FROM cash_movement WHERE type = 'EXPENSE';", tablas: ['cash_movement'] },
  { id: 'CAJ-003', modulo: 'caja', dificultad: 'medio', pregunta: 'Suma de ventas en efectivo vs ventas con otros medios por sesión cerrada.', sql: "SELECT id, opened_at, closed_at, sales_cash, sales_other, (sales_cash + sales_other) AS total_ventas FROM cash_session WHERE status = 'CLOSED' ORDER BY closed_at DESC;", tablas: ['cash_session'] },
  { id: 'INV-001', modulo: 'inventario', dificultad: 'facil', pregunta: 'Insumos cuyo stock actual está en o por debajo del stock mínimo.', sql: 'SELECT id, name, current_stock, minimum_stock FROM product WHERE current_stock <= minimum_stock AND active = true;', tablas: ['product'] },
  { id: 'INV-002', modulo: 'inventario', dificultad: 'medio', pregunta: 'Total de movimientos de inventario agrupados por tipo de movimiento.', sql: 'SELECT movement_type, COUNT(*) AS total_movimientos, SUM(quantity) AS cantidad_total FROM inventory_movement GROUP BY movement_type;', tablas: ['inventory_movement'] },
  { id: 'CON-001', modulo: 'contabilidad', dificultad: 'facil', pregunta: '¿Cuántos periodos contables están en estado OPEN?', sql: "SELECT COUNT(*) FROM accounting_period WHERE status = 'OPEN';", tablas: ['accounting_period'] },
  { id: 'CON-002', modulo: 'contabilidad', dificultad: 'facil', pregunta: 'Listar cuentas contables del elemento 1 (Activo disponible y exigible).', sql: "SELECT code, name, type FROM accounting_account WHERE code LIKE '1%' ORDER BY code ASC;", tablas: ['accounting_account'] },
  { id: 'CON-003', modulo: 'contabilidad', dificultad: 'medio', pregunta: 'Total de cargos (debe) y abonos (haber) registrados en asientos del libro Diario.', sql: "SELECT COALESCE(SUM(jed.debit), 0.00) AS total_debe, COALESCE(SUM(jed.credit), 0.00) AS total_haber FROM journal_entry_detail jed JOIN journal_entry je ON jed.entry_id = je.id WHERE je.status = true AND je.book = '05';", tablas: ['journal_entry_detail', 'journal_entry'] },
  { id: 'CON-004', modulo: 'contabilidad', dificultad: 'dificil', pregunta: 'Balance de comprobación por cuenta mayor (2 dígitos) para asientos contables válidos.', sql: 'SELECT SUBSTRING(aa.code, 1, 2) AS cuenta_mayor, SUM(jed.debit) AS suma_debe, SUM(jed.credit) AS suma_haber, (SUM(jed.debit) - SUM(jed.credit)) AS saldo_deudor FROM journal_entry_detail jed JOIN accounting_account aa ON jed.account_id = aa.id JOIN journal_entry je ON jed.entry_id = je.id WHERE je.status = true GROUP BY SUBSTRING(aa.code, 1, 2) ORDER BY cuenta_mayor ASC;', tablas: ['journal_entry_detail', 'accounting_account', 'journal_entry'] },
  { id: 'CON-005', modulo: 'contabilidad', dificultad: 'extra_dificil', pregunta: 'Detección de asientos descuadrados con diferencia mayor a un céntimo entre debe y haber.', sql: 'SELECT je.id, je.entry_code, je.entry_date, je.glosa, SUM(jed.debit) AS total_debe, SUM(jed.credit) AS total_haber, ABS(SUM(jed.debit) - SUM(jed.credit)) AS descuadre FROM journal_entry je JOIN journal_entry_detail jed ON je.id = jed.entry_id WHERE je.status = true GROUP BY je.id, je.entry_code, je.entry_date, je.glosa HAVING ABS(SUM(jed.debit) - SUM(jed.credit)) > 0.01 ORDER BY descuadre DESC;', tablas: ['journal_entry', 'journal_entry_detail'] }
];

const periods = [
  ['enero de 2026', '2026-01-01', '2026-01-31'],
  ['febrero de 2026', '2026-02-01', '2026-02-28'],
  ['marzo de 2026', '2026-03-01', '2026-03-31'],
  ['abril de 2026', '2026-04-01', '2026-04-30'],
  ['mayo de 2026', '2026-05-01', '2026-05-31'],
  ['junio de 2026', '2026-06-01', '2026-06-30'],
  ['julio de 2026', '2026-07-01', '2026-07-31'],
  ['agosto de 2026', '2026-08-01', '2026-08-31'],
  ['septiembre de 2026', '2026-09-01', '2026-09-30'],
  ['octubre de 2026', '2026-10-01', '2026-10-31'],
  ['noviembre de 2026', '2026-11-01', '2026-11-30'],
  ['diciembre de 2026', '2026-12-01', '2026-12-31']
];

const elementsPCGE = [
  ['1', 'Activo disponible y exigible'],
  ['2', 'Activo realizable'],
  ['3', 'Activo inmovilizado'],
  ['4', 'Pasivo corriente y no corriente'],
  ['5', 'Patrimonio neto'],
  ['6', 'Gastos por naturaleza'],
  ['7', 'Ingresos por ventas y servicios']
];

const paymentMethods = ['Efectivo', 'Yape', 'Plin', 'Tarjeta de Crédito', 'Transferencia Bancaria'];
const expenseCategories = ['TransportAndDelivery', 'CasualStaff', 'CleaningSupplies', 'OtherMinorExpenses'];

let items = [];
let caseIdx = 1;

for (const b of baseTemplates) {
  items.push({
    id: 'TEST-' + String(caseIdx).padStart(3, '0'),
    modulo: b.modulo,
    dificultad: b.dificultad,
    pregunta: b.pregunta,
    sql_gold: b.sql,
    tablas_esperadas: b.tablas
  });
  caseIdx++;
}

while (items.length < 350) {
  const p = periods[caseIdx % periods.length];
  const p_name = p[0], p_start = p[1], p_end = p[2];

  if (items.length < 115) {
    const pm = paymentMethods[caseIdx % paymentMethods.length];
    items.push({
      id: 'TEST-' + String(caseIdx).padStart(3, '0'),
      modulo: 'ventas',
      dificultad: caseIdx % 2 === 0 ? 'medio' : 'facil',
      pregunta: `¿Cuál fue el total cobrado mediante ${pm} en el periodo de ${p_name}?`,
      sql_gold: `SELECT COALESCE(SUM(sp.amount), 0.00) AS total FROM sales_payment sp JOIN payment_type pt ON sp.payment_type_id = pt.id WHERE pt.name ILIKE '%${pm}%' AND sp.paid_at >= '${p_start}' AND sp.paid_at <= '${p_end} 23:59:59';`,
      tablas_esperadas: ['sales_payment', 'payment_type']
    });
  } else if (items.length < 185) {
    const ec = expenseCategories[caseIdx % expenseCategories.length];
    items.push({
      id: 'TEST-' + String(caseIdx).padStart(3, '0'),
      modulo: 'compras',
      dificultad: caseIdx % 3 === 0 ? 'dificil' : 'medio',
      pregunta: `Monto de gastos no comprobados en la categoría ${ec} durante ${p_name}.`,
      sql_gold: `SELECT COALESCE(SUM(amount_paid), 0.00) AS total FROM informal_purchase WHERE expense_category = '${ec}' AND annulled = false AND date >= '${p_start}' AND date <= '${p_end}';`,
      tablas_esperadas: ['informal_purchase']
    });
  } else if (items.length < 235) {
    items.push({
      id: 'TEST-' + String(caseIdx).padStart(3, '0'),
      modulo: 'caja',
      dificultad: caseIdx % 2 === 0 ? 'medio' : 'facil',
      pregunta: `Total de egresos registrados en movimientos de caja en ${p_name}.`,
      sql_gold: `SELECT COALESCE(SUM(amount), 0.00) AS total_egresos FROM cash_movement WHERE type = 'EXPENSE' AND created_at >= '${p_start}' AND created_at <= '${p_end} 23:59:59';`,
      tablas_esperadas: ['cash_movement']
    });
  } else if (items.length < 280) {
    items.push({
      id: 'TEST-' + String(caseIdx).padStart(3, '0'),
      modulo: 'inventario',
      dificultad: caseIdx % 2 === 0 ? 'dificil' : 'medio',
      pregunta: `Insumos con salidas de almacén por venta registradas en ${p_name}.`,
      sql_gold: `SELECT p.name, SUM(im.quantity) AS total_salida FROM inventory_movement im JOIN product p ON im.product_id = p.id WHERE im.movement_type = 'OUT_SALE' AND im.created_at >= '${p_start}' AND im.created_at <= '${p_end} 23:59:59' GROUP BY p.id, p.name ORDER BY total_salida DESC;`,
      tablas_esperadas: ['inventory_movement', 'product']
    });
  } else {
    const el = elementsPCGE[caseIdx % elementsPCGE.length];
    const diff = caseIdx % 5 === 0 ? 'extra_dificil' : (caseIdx % 2 === 0 ? 'dificil' : 'medio');
    items.push({
      id: 'TEST-' + String(caseIdx).padStart(3, '0'),
      modulo: 'contabilidad',
      dificultad: diff,
      pregunta: `Saldo neto (Debe - Haber) del elemento ${el[0]} (${el[1]}) en asientos de ${p_name}.`,
      sql_gold: `SELECT aa.code, aa.name, COALESCE(SUM(jed.debit), 0.00) - COALESCE(SUM(jed.credit), 0.00) AS saldo FROM journal_entry_detail jed JOIN accounting_account aa ON jed.account_id = aa.id JOIN journal_entry je ON jed.entry_id = je.id WHERE je.status = true AND aa.code LIKE '${el[0]}%' AND je.entry_date >= '${p_start}' AND je.entry_date <= '${p_end}' GROUP BY aa.id, aa.code, aa.name ORDER BY aa.code ASC;`,
      tablas_esperadas: ['journal_entry_detail', 'accounting_account', 'journal_entry']
    });
  }
  caseIdx++;
}

items = items.slice(0, 350);

const outObj = {
  version: 'benchmark-v1-350',
  total_casos: items.length,
  distribucion_dificultad: {
    facil: items.filter(x => x.dificultad === 'facil').length,
    medio: items.filter(x => x.dificultad === 'medio').length,
    dificil: items.filter(x => x.dificultad === 'dificil').length,
    extra_dificil: items.filter(x => x.dificultad === 'extra_dificil').length
  },
  distribucion_modulo: {
    ventas: items.filter(x => x.modulo === 'ventas').length,
    compras: items.filter(x => x.modulo === 'compras').length,
    caja: items.filter(x => x.modulo === 'caja').length,
    inventario: items.filter(x => x.modulo === 'inventario').length,
    contabilidad: items.filter(x => x.modulo === 'contabilidad').length
  },
  casos: items
};

fs.writeFileSync('eval/benchmark_cases_350.json', JSON.stringify(outObj, null, 2), 'utf8');
console.log('Generados exitosamente ' + items.length + ' casos de prueba.');
console.log('Dificultades:', outObj.distribucion_dificultad);
console.log('Módulos:', outObj.distribucion_modulo);
