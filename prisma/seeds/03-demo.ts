/**
 * SEED 3 · DATOS OPERATIVOS / DEMOSTRACIÓN
 * Un ciclo completo que muestra cómo se relacionan los módulos:
 *   compra (orden → comprobante → pago) → inventario (kardex y stock) → venta (pedido → comprobante → pago)
 *   → caja → asientos contables (con el mismo servicio contable que usa el sistema) → RR. HH. y planilla.
 *
 * Solo corre si la base NO tiene ventas ni compras (así nunca mezcla datos de demostración con datos
 * reales). Se puede omitir con SEED_DEMO=false (recomendado en producción).
 */
import { spawnSync } from "node:child_process";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;
const IGV = 0.18;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Fecha de hace `days` días a la hora indicada (hora local de Lima, UTC-5). */
function at(days: number, hour = 12, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour + 5, minute, 0, 0);
  return d;
}
const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

interface PurchaseSpec {
  supplierRuc: string;
  daysAgo: number;
  series: string;
  number: number;
  condition: "Contado" | "Credito";
  paidShare?: number; // fracción pagada (solo crédito)
  paymentMethod: string;
  items: Array<{ name: string; qty: number; unitCost: number }>;
  status?: "FullyReceived" | "Pending";
}

const PURCHASES: PurchaseSpec[] = [
  { supplierRuc: "20100154308", daysAgo: 12, series: "F001", number: 4512, condition: "Contado", paymentMethod: "Transferencia", items: [{ name: "Pollo entero", qty: 120, unitCost: 9.5 }] },
  {
    supplierRuc: "20100070970", daysAgo: 11, series: "F002", number: 880, condition: "Contado", paymentMethod: "Efectivo",
    items: [
      { name: "Papa amarilla", qty: 150, unitCost: 2.8 }, { name: "Arroz", qty: 60, unitCost: 3.6 }, { name: "Aceite vegetal", qty: 30, unitCost: 7.5 },
      { name: "Lechuga", qty: 15, unitCost: 3.0 }, { name: "Tomate", qty: 15, unitCost: 3.5 }, { name: "Sal y especias", qty: 10, unitCost: 6.0 },
    ],
  },
  {
    supplierRuc: "20509876543", daysAgo: 9, series: "F003", number: 2210, condition: "Credito", paidShare: 0.5, paymentMethod: "Transferencia",
    items: [{ name: "Inca Kola 1.5L", qty: 60, unitCost: 6.0 }, { name: "Coca Cola 1.5L", qty: 60, unitCost: 6.0 }, { name: "Agua Mineral 600ml", qty: 100, unitCost: 1.8 }],
  },
  { supplierRuc: "20512345678", daysAgo: 8, series: "F001", number: 1034, condition: "Contado", paymentMethod: "Efectivo", items: [{ name: "Carbón", qty: 200, unitCost: 1.8 }] },
];

// Ventas de ejemplo: [díasAtrás, hora, mesa|null, [[producto, cantidad]...], comprobante, cliente(doc), medios de pago]
type PayShare = [method: string, share: number];
const SALES: Array<[number, number, number | null, Array<[string, number]>, "Boleta" | "Factura", string, PayShare[]]> = [
  [3, 13, 3, [["1/4 Pollo a la Brasa", 2], ["Inca Kola 1.5L", 1]], "Boleta", "00000000", [["Efectivo", 1]]],
  [3, 14, 7, [["1/2 Pollo a la Brasa", 1], ["Porción de Papas Fritas", 1], ["Coca Cola 1.5L", 1]], "Boleta", "45678123", [["Yape", 1]]],
  [3, 20, 10, [["1 Pollo a la Brasa Entero", 1], ["Ensalada Clásica Familiar", 1], ["Jarra de Chicha Morada 1L", 1]], "Factura", "20601234567", [["Tarjeta / POS", 1]]],
  [2, 13, 1, [["Mostrito Brasa Clásico", 2], ["Agua Mineral 600ml", 2]], "Boleta", "00000000", [["Efectivo", 1]]],
  [2, 19, 5, [["1/4 Pollo a la Brasa", 3], ["Porción de Papas Fritas", 2]], "Boleta", "46123987", [["Efectivo", 0.5], ["Yape", 0.5]]],
  [2, 21, 11, [["1 Pollo a la Brasa Entero", 2], ["Inca Kola 1.5L", 2], ["Ensalada Clásica Familiar", 1]], "Factura", "20556677889", [["Transferencia", 1]]],
  [1, 12, 2, [["1/4 Pollo a la Brasa", 1], ["Agua Mineral 600ml", 1]], "Boleta", "00000000", [["Efectivo", 1]]],
  [1, 14, 8, [["1/2 Pollo a la Brasa", 2], ["Coca Cola 1.5L", 1]], "Boleta", "47891234", [["Tarjeta / POS", 1]]],
  [1, 20, 12, [["1 Pollo a la Brasa Entero", 1], ["Mostrito Brasa Clásico", 2], ["Jarra de Chicha Morada 1L", 2]], "Boleta", "00000000", [["Efectivo", 1]]],
  [0, 12, 4, [["1/4 Pollo a la Brasa", 2], ["Inca Kola 1.5L", 1]], "Boleta", "00000000", [["Yape", 1]]],
  [0, 13, null, [["1/2 Pollo a la Brasa", 1], ["Porción de Papas Fritas", 2]], "Boleta", "45678123", [["Efectivo", 1]]],
  [0, 14, 9, [["Mostrito Brasa Clásico", 1], ["Coca Cola 1.5L", 1], ["Ensalada Clásica Familiar", 1]], "Factura", "20601234567", [["Efectivo", 1]]],
];

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  console.log("\n━━ SEED 3 · Datos operativos de demostración ━━");

  if (process.env.SEED_DEMO === "false") {
    console.log("↷ Omitido (SEED_DEMO=false).");
    return;
  }
  const [invoices, purchases] = await Promise.all([prisma.salesInvoice.count(), prisma.purchaseInvoice.count()]);
  if (invoices > 0 || purchases > 0) {
    console.log("↷ La base ya tiene ventas o compras: no se agregan datos de demostración.");
    return;
  }

  const posting = await import("../../lib/services/accounting/accounting-posting.service");
  const { formatVoucherCode } = await import("../../lib/utils/series-validation");

  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" }, select: { id: true, employeeId: true } });
  const productByName = new Map((await prisma.product.findMany({ select: { id: true, name: true, type: true } })).map((p) => [p.name, p]));
  const paymentByName = new Map((await prisma.paymentType.findMany()).map((p) => [p.name, p.id]));
  const need = (name: string) => productByName.get(name) ?? (() => { throw new Error(`Falta el producto «${name}»: ejecuta primero el seed de datos maestros.`); })();

  // ───────────────────────── COMPRAS ─────────────────────────
  let orderSeq = 0;
  for (const spec of PURCHASES) {
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { ruc: spec.supplierRuc } });
    const when = at(spec.daysAgo, 10);
    const lines = spec.items.map((i) => {
      const subtotal = r2(i.qty * i.unitCost);
      const igv = r2(subtotal * IGV);
      return { ...i, product: need(i.name), subtotal, igv, total: r2(subtotal + igv) };
    });
    const subtotal = r2(lines.reduce((s, l) => s + l.subtotal, 0));
    const igv = r2(lines.reduce((s, l) => s + l.igv, 0));
    const total = r2(subtotal + igv);
    orderSeq++;
    const orderNumber = `OC-${when.getUTCFullYear()}-${String(orderSeq).padStart(5, "0")}`;

    await prisma.$transaction(
      async (tx: Tx) => {
        const order = await tx.purchaseOrder.create({
          data: {
            supplierId: supplier.id, employeeId: admin.employeeId, receivedById: admin.employeeId, orderNumber,
            issuedAt: dateOnly(when), receivedAt: when, status: "FullyReceived", subtotal, igv, total,
            notes: "Compra de demostración",
            items: {
              create: lines.map((l) => ({
                productId: l.product.id, quantityOrdered: l.qty, quantityReceived: l.qty, unitPrice: l.unitCost,
                affectationIgvApplied: "Excluded", subtotalLine: l.subtotal, igvLine: l.igv, finalAmountLine: l.total,
              })),
            },
          },
          include: { items: true },
        });

        for (const item of order.items) {
          const line = lines.find((l) => l.product.id === item.productId)!;
          await tx.inventoryMovement.create({
            data: { productId: item.productId, purchaseOrderItemId: item.id, movementType: "Purchase", quantity: line.qty, unitCost: line.unitCost, movedAt: when },
          });
          const p = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
          const stock = Number(p.currentStock);
          const avg = (stock * Number(p.averageCost) + line.qty * line.unitCost) / (stock + line.qty);
          await tx.product.update({ where: { id: p.id }, data: { currentStock: stock + line.qty, lastCost: line.unitCost, averageCost: r2(avg) } });
        }

        const invoice = await tx.purchaseInvoice.create({
          data: {
            supplierId: supplier.id, purchaseOrderId: order.id, voucherType: "Factura", series: spec.series, number: spec.number,
            issuedAt: dateOnly(when), subtotal, igv, totalAmount: total, createdAt: when,
          },
        });
        const label = `${spec.series}-${String(spec.number).padStart(8, "0")}`;
        const payTypeId = paymentByName.get(spec.paymentMethod)!;

        await posting.postPurchaseJournalEntries(tx, {
          purchaseInvoiceId: invoice.id, voucherLabel: label, entryDate: when, subtotal, igv, total,
          paymentCondition: spec.condition, paymentMethodName: spec.paymentMethod, responsible: "Administrador",
          items: lines.map((l) => ({ productType: l.product.type as "RawMaterial" | "FinishedProduct", subtotalLine: l.subtotal })),
        });

        if (spec.condition === "Contado") {
          await tx.purchasePayment.create({ data: { purchaseInvoiceId: invoice.id, paymentTypeId: payTypeId, amount: total, paidAt: when } });
        } else if (spec.paidShare) {
          const paid = r2(total * spec.paidShare);
          await tx.purchasePayment.create({ data: { purchaseInvoiceId: invoice.id, paymentTypeId: payTypeId, amount: paid, paidAt: at(spec.daysAgo - 3, 11) } });
          await posting.postPurchasePaymentJournalEntry(tx, {
            purchaseInvoiceId: invoice.id, voucherLabel: label, amount: paid, paymentMethodName: spec.paymentMethod, entryDate: at(spec.daysAgo - 3, 11), responsible: "Administrador",
          });
        }
      },
      { maxWait: 20000, timeout: 90000 },
    );
  }

  // Una orden de compra pendiente (aún no recibida): no mueve inventario ni contabilidad.
  const pendingSupplier = await prisma.supplier.findUniqueOrThrow({ where: { ruc: "20100154308" } });
  const pendingSubtotal = r2(80 * 9.6);
  await prisma.purchaseOrder.create({
    data: {
      supplierId: pendingSupplier.id, employeeId: admin.employeeId, orderNumber: `OC-${new Date().getFullYear()}-${String(++orderSeq).padStart(5, "0")}`,
      issuedAt: dateOnly(at(1)), expectedAt: dateOnly(at(-2)), status: "Pending", subtotal: pendingSubtotal, igv: r2(pendingSubtotal * IGV), total: r2(pendingSubtotal * (1 + IGV)),
      notes: "Reposición de pollo (pendiente de recibir)",
      items: { create: [{ productId: need("Pollo entero").id, quantityOrdered: 80, unitPrice: 9.6, subtotalLine: pendingSubtotal, igvLine: r2(pendingSubtotal * IGV), finalAmountLine: r2(pendingSubtotal * (1 + IGV)) }] },
    },
  });
  console.log(`✔ ${PURCHASES.length} compras recibidas (1 a crédito con pago parcial) y 1 orden de compra pendiente.`);

  // ───────────────────────── INVENTARIO ─────────────────────────
  // Stock inicial de los platos preparados (en la operación real sale de transformar insumos).
  const stocked = ["1/4 Pollo a la Brasa", "1/2 Pollo a la Brasa", "1 Pollo a la Brasa Entero", "Mostrito Brasa Clásico", "Porción de Papas Fritas", "Ensalada Clásica Familiar", "Jarra de Chicha Morada 1L"];
  for (const name of stocked) {
    const p = need(name);
    await prisma.inventoryMovement.create({ data: { productId: p.id, movementType: "Adjustment", quantity: 60, reason: "Stock inicial de demostración", movedAt: at(7, 8) } });
    await prisma.product.update({ where: { id: p.id }, data: { currentStock: 60 } });
  }
  // Una merma de insumo.
  const chicken = need("Pollo entero");
  await prisma.inventoryMovement.create({ data: { productId: chicken.id, movementType: "Shrinkage", quantity: 2, reason: "Merma por descongelamiento", movedAt: at(5, 9) } });
  await prisma.product.update({ where: { id: chicken.id }, data: { currentStock: { decrement: 2 } } });

  // ───────────────────────── CAJA Y VENTAS ─────────────────────────
  const register = await prisma.cashRegister.findUniqueOrThrow({ where: { code: "CAJA-01" } });
  const tables = new Map((await prisma.diningTable.findMany()).map((t) => [t.number, t.id]));
  const customers = new Map((await prisma.customer.findMany()).map((c) => [c.documentNumber, c.id]));
  const numbers: Record<string, number> = { B001: 0, F001: 0 };
  let orderCode = 0;

  const days = [...new Set(SALES.map((s) => s[0]))].sort((a, b) => b - a);
  for (const day of days) {
    const isToday = day === 0;
    const session = await prisma.cashSession.create({
      data: {
        cashRegisterId: register.id, openedById: admin.id, initialAmount: 100, openedAt: at(day, 9),
        status: isToday ? "OPEN" : "CLOSED", closedAt: isToday ? null : at(day, 23), closedById: isToday ? null : admin.id,
        notesOpening: "Turno de demostración",
      },
    });
    let salesCash = 0;
    let salesOther = 0;

    for (const [d, hour, tableNumber, lines, voucherType, doc, pays] of SALES.filter((s) => s[0] === day)) {
      const when = at(d, hour, 15);
      const items = lines.map(([name, qty]) => {
        const product = need(name);
        return { product, qty, price: 0 };
      });
      const priced = await Promise.all(items.map(async (i) => ({ ...i, price: Number((await prisma.product.findUniqueOrThrow({ where: { id: i.product.id }, select: { price: true } })).price) })));
      const total = r2(priced.reduce((s, i) => s + i.price * i.qty, 0));
      const subtotal = r2(total / (1 + IGV));
      const igv = r2(total - subtotal);
      const series = voucherType === "Factura" ? "F001" : "B001";
      const number = ++numbers[series];
      const payments = pays.map(([name, share], idx) => ({ name, amount: idx === pays.length - 1 ? r2(total - pays.slice(0, idx).reduce((s, [, sh]) => s + r2(total * sh), 0)) : r2(total * share) }));

      await prisma.$transaction(
        async (tx: Tx) => {
          const order = await tx.salesOrder.create({
            data: {
              code: `PED-DEMO-${String(++orderCode).padStart(4, "0")}`, orderType: tableNumber ? "Mesa" : "Llevar", orderedAt: when, status: "Closed",
              items: { create: priced.map((i) => ({ productId: i.product.id, quantity: i.qty, unitPrice: i.price, subtotal: r2(i.price * i.qty), itemStatus: "Served" })) },
              ...(tableNumber ? { tables: { create: [{ tableId: tables.get(tableNumber)! }] } } : {}),
            },
            include: { items: true },
          });
          for (const item of order.items) {
            await tx.inventoryMovement.create({ data: { productId: item.productId, orderItemId: item.id, movementType: "Sale", quantity: item.quantity, movedAt: when } });
            await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } });
          }
          const invoice = await tx.salesInvoice.create({
            data: {
              orderId: order.id, customerId: customers.get(doc)!, voucherType, series, number, issuedAt: dateOnly(when), subtotal, igv, totalAmount: total,
              createdAt: when, status: "Issued", cashSessionId: session.id,
            },
          });
          for (const p of payments) {
            await tx.salesPayment.create({ data: { salesInvoiceId: invoice.id, paymentTypeId: paymentByName.get(p.name)!, amount: p.amount, paidAt: when } });
          }
          await posting.postSaleJournalEntries(tx, {
            salesInvoiceId: invoice.id, orderId: order.id, voucherCode: formatVoucherCode(series, number), entryDate: when, subtotal, igv, total,
            paymentMethodName: payments[0].name, payments, responsible: "Administrador",
          });
        },
        { maxWait: 20000, timeout: 90000 },
      );
      for (const p of payments) {
        if (p.name === "Efectivo") salesCash += p.amount;
        else salesOther += p.amount;
      }
    }

    const totalSales = r2(salesCash + salesOther);
    const expected = r2(100 + salesCash);
    await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        salesCash: r2(salesCash), salesOther: r2(salesOther), totalSales,
        ...(isToday ? {} : { expectedAmount: expected, countedAmount: expected, difference: 0, notesClosing: "Arqueo conforme (demostración)" }),
      },
    });

    if (isToday) {
      await prisma.$transaction(
        async (tx: Tx) => {
          await posting.postCashSessionOpeningJournalEntry(tx, { sessionId: session.id, initialAmount: 100, entryDate: at(0, 9), responsible: "Administrador" });
          await tx.cashMovement.create({ data: { sessionId: session.id, type: "EXPENSE", amount: 20, reason: "Compra de hielo", createdAt: at(0, 15) } });
          await posting.postCashMovementExpenseJournalEntry(tx, { sessionId: session.id, amount: 20, reason: "Compra de hielo", entryDate: at(0, 15), responsible: "Administrador" });
        },
        { maxWait: 20000, timeout: 60000 },
      );
    }
  }
  console.log(`✔ ${SALES.length} ventas (boletas y facturas) con sus pagos, ${days.length} sesiones de caja (hoy abierta), kardex y asientos contables.`);

  // ───────────────────────── RR. HH. ─────────────────────────
  console.log("… RR. HH.: contratos, horarios, asistencia, vacaciones, seguros, adelantos y planilla");
  const hr = spawnSync("npx", ["tsx", "prisma/seed-hr-demo.ts", "--with-payroll"], { stdio: "inherit", shell: true });
  if (hr.status !== 0) console.warn("⚠ El seed de RR. HH. de demostración terminó con errores (revisa el mensaje anterior).");
}
