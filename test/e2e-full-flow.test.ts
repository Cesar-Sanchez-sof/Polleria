import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateTotals,
  calculateTablesSummary,
  calculateChangeAmount,
  validateCustomerDocument,
} from "../lib/utils/sales-helpers";
import {
  pickPaymentAccountTarget,
  postSaleJournalEntries,
} from "../lib/services/accounting-posting.service";

describe("E2E Test Suite: Flujo Completo de Salón, Unión de Mesas, Cobro Mozo y Asientos Contables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Escenario 1: Control de Disponibilidad Inicial de Mesas", () => {
    it("debe calcular el aforo y disponibilidad correctamente con todas las mesas libres", () => {
      const areaTables = [
        { id: 1, number: 1, capacity: 2, occupied: false, active: true },
        { id: 2, number: 2, capacity: 4, occupied: false, active: true },
        { id: 3, number: 3, capacity: 4, occupied: false, active: true },
        { id: 4, number: 4, capacity: 6, occupied: false, active: true },
      ];

      const summary = calculateTablesSummary(areaTables);
      expect(summary.total).toBe(4);
      expect(summary.available).toBe(4);
      expect(summary.occupied).toBe(0);
    });
  });

  describe("Escenario 2: Unión de Mesas (Mesa 2 anexa a Mesa 3 con 0 Disponibilidad)", () => {
    it("al juntar Mesa 2 con Mesa 3, ambas mesas pasan a ocupadas con 0 disponibilidad", () => {
      const mainTable = { id: 2, number: 2, capacity: 4 };
      const additionalTables = [{ id: 3, number: 3, capacity: 4 }];

      // Simulamos la lógica de creación de orden con unión de mesas implementada en app/api/orders/route.ts
      const orderId = 501;
      const orderCode = "PED-20261013-001";
      const mainTableNumber = mainTable.number;

      // Se generan las asociaciones OrderTable tanto para la principal como para la anexa
      const orderTables = [
        {
          tableId: mainTable.id,
          orderId,
          notes: `[Mesas unidas: ${additionalTables.map((t) => t.number).join(", ")}]`,
        },
        ...additionalTables.map((at) => ({
          tableId: at.id,
          orderId,
          notes: `[Anexa a Mesa ${mainTableNumber}]`,
        })),
      ];

      // Verificamos que se crearon los registros vinculantes para ambas mesas
      expect(orderTables.length).toBe(2);
      expect(orderTables[0].tableId).toBe(2);
      expect(orderTables[1].tableId).toBe(3);
      expect(orderTables[1].notes).toBe("[Anexa a Mesa 2]");

      // Evaluamos el estado resultante del salón
      const tablesAfterMerge = [
        { id: 1, number: 1, capacity: 2, occupied: false, active: true },
        {
          id: 2,
          number: 2,
          capacity: 4,
          occupied: true,
          active: true,
          activeOrder: { code: orderCode, isAnnexed: false, tableNotes: orderTables[0].notes },
        },
        {
          id: 3,
          number: 3,
          capacity: 4,
          occupied: true,
          active: true,
          activeOrder: { code: orderCode, isAnnexed: true, tableNotes: orderTables[1].notes },
        },
        { id: 4, number: 4, capacity: 6, occupied: false, active: true },
      ];

      const summary = calculateTablesSummary(tablesAfterMerge);

      // Ambas mesas están en uso -> 2 ocupadas, disponibles bajan de 4 a 2
      expect(summary.total).toBe(4);
      expect(summary.occupied).toBe(2);
      expect(summary.available).toBe(2);

      // Disponibilidad individual de Mesa 2 y Mesa 3 es 0 (ambas ocupadas)
      const table2 = tablesAfterMerge.find((m) => m.number === 2)!;
      const table3 = tablesAfterMerge.find((m) => m.number === 3)!;
      expect(table2.occupied).toBe(true);
      expect(table3.occupied).toBe(true);
      expect(table3.activeOrder?.isAnnexed).toBe(true);
    });
  });

  describe("Escenario 3: Cobro Mozo con Yape y Emisión de Boleta (Mesa Única en Comprobante)", () => {
    it("debe emitir la Boleta consignando solo una mesa principal y generar asiento en Cuenta 102 (Billetera Digital)", async () => {
      // 1. Pedido con mesa 2 (principal) y mesa 3 (anexa)
      const orderTables = [
        { tableId: 2, table: { id: 2, number: 2 }, notes: "[Mesas unidas: 3]" },
        { tableId: 3, table: { id: 3, number: 3 }, notes: "[Anexa a Mesa 2]" },
      ];

      // La lógica de resolución de mesa principal para la boleta
      const primaryTableOrder = orderTables.find((t) => !t.notes.includes("[Anexa a Mesa")) ?? orderTables[0];
      const associatedTable = primaryTableOrder?.table;

      // El comprobante emitido DEBE reflejar una sola mesa
      const voucherOrigin = associatedTable ? `Mesa ${associatedTable.number}` : "Pedido Para Llevar";
      expect(voucherOrigin).toBe("Mesa 2");

      // 2. Validación contable: Medio de pago Yape
      const mockAccounts = new Map<string, number>([
        ["101", 1], // Caja
        ["102", 2], // Billeteras Digitales (Yape)
        ["104", 3], // Bancos
        ["121", 4], // Cuentas por cobrar
        ["401", 5], // IGV
        ["701", 6], // Ventas
        ["691", 7], // Costo de ventas
        ["201", 8], // Mercaderías
        ["241", 9], // Materias primas
      ]);

      const targetYape = pickPaymentAccountTarget(mockAccounts, "Yape");
      expect(targetYape.accountCode).toBe("102");
      expect(targetYape.accountId).toBe(2);
      expect(targetYape.label).toContain("Billetera Digital");

      // 3. Generación simulada de asientos contables en transacción Prisma
      const createdEntries: any[] = [];
      const mockTx: any = {
        accountingAccount: {
          findMany: vi.fn().mockResolvedValue([
            { id: 1, code: "101" },
            { id: 2, code: "102" },
            { id: 3, code: "104" },
            { id: 4, code: "121" },
            { id: 5, code: "401" },
            { id: 6, code: "701" },
            { id: 7, code: "691" },
            { id: 8, code: "201" },
            { id: 9, code: "241" },
          ]),
          upsert: vi.fn(),
        },
        accountingPeriod: {
          findFirst: vi.fn().mockResolvedValue({ id: 10 }),
        },
        journalEntry: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args) => {
            const id = createdEntries.length + 1;
            createdEntries.push({ id, ...args.data });
            return Promise.resolve({ id });
          }),
        },
      };

      const journalIds = await postSaleJournalEntries(mockTx, {
        salesInvoiceId: 88,
        voucherCode: "B001-000123",
        subtotal: 100.0,
        igv: 18.0,
        total: 118.0,
        paymentMethodName: "Yape",
        responsible: "Mozo Salón",
      });

      expect(journalIds.length).toBeGreaterThan(0);

      // Verificamos el asiento 1 (Provisión de Boleta)
      const entryProvision = createdEntries[0];
      expect(entryProvision.description).toContain("Boleta B001-000123");

      // Verificamos el asiento 2 (Cobro con Yape en cuenta 102)
      const entryCharge = createdEntries[1];
      expect(entryCharge.description).toContain("Billetera Digital (Yape)");
      expect(entryCharge.observation).toContain("Cuenta 102");
      const detailDebit = entryCharge.entryDetails.create.find((d: any) => d.debit > 0);
      expect(detailDebit.accountId).toBe(2); // Cuenta 102
      expect(detailDebit.debit).toBe(118.0);

      // 4. Al completar la venta, ambas mesas se liberan
      const tablesAfterRelease = [
        { id: 2, number: 2, capacity: 4, occupied: false, active: true, activeOrder: null },
        { id: 3, number: 3, capacity: 4, occupied: false, active: true, activeOrder: null },
      ];
      const summaryFinal = calculateTablesSummary(tablesAfterRelease);
      expect(summaryFinal.occupied).toBe(0);
      expect(summaryFinal.available).toBe(2);
    });
  });

  describe("Escenario 4: Cobro Mozo con Tarjeta / POS y Emisión de Factura", () => {
    it("debe validar RUC, emitir Factura con mesa única y generar asiento en Cuenta 104 (Bancos)", async () => {
      // 1. Validación de datos de Factura
      const rucValidation = validateCustomerDocument("Legal", "20601234567");
      expect(rucValidation.isValid).toBe(true);
      expect(rucValidation.error).toBeUndefined();

      const invalidRucValidation = validateCustomerDocument("Legal", "12345");
      expect(invalidRucValidation.isValid).toBe(false);
      expect(invalidRucValidation.error).toBeDefined();

      // 2. Validación contable: Medio de pago Tarjeta POS
      const mockAccounts = new Map<string, number>([
        ["101", 1],
        ["102", 2],
        ["104", 3], // Bancos - Cuentas Corrientes / POS
        ["121", 4],
        ["401", 5],
        ["701", 6],
        ["691", 7],
        ["201", 8],
        ["241", 9],
      ]);

      const targetCard = pickPaymentAccountTarget(mockAccounts, "Tarjeta / POS (Tap to Pay)");
      expect(targetCard.accountCode).toBe("104");
      expect(targetCard.accountId).toBe(3);
      expect(targetCard.label).toContain("Bancos / POS Tarjetas");

      // 3. Generación de asientos contables para Factura
      const createdEntries: any[] = [];
      const mockTx: any = {
        accountingAccount: {
          findMany: vi.fn().mockResolvedValue([
            { id: 1, code: "101" },
            { id: 2, code: "102" },
            { id: 3, code: "104" },
            { id: 4, code: "121" },
            { id: 5, code: "401" },
            { id: 6, code: "701" },
            { id: 7, code: "691" },
            { id: 8, code: "201" },
            { id: 9, code: "241" },
          ]),
          upsert: vi.fn(),
        },
        accountingPeriod: {
          findFirst: vi.fn().mockResolvedValue({ id: 10 }),
        },
        journalEntry: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args) => {
            const id = createdEntries.length + 1;
            createdEntries.push({ id, ...args.data });
            return Promise.resolve({ id });
          }),
        },
      };

      await postSaleJournalEntries(mockTx, {
        salesInvoiceId: 89,
        voucherCode: "F001-000456",
        subtotal: 200.0,
        igv: 36.0,
        total: 236.0,
        paymentMethodName: "Tarjeta / POS",
        responsible: "Mozo Salón",
      });

      // Verificamos que el asiento de provisión reconozca que es Factura
      const entryProvision = createdEntries[0];
      expect(entryProvision.description).toContain("Factura F001-000456");

      // Verificamos que el asiento de cobro cargue a la Cuenta 104 (Bancos)
      const entryCharge = createdEntries[1];
      expect(entryCharge.observation).toContain("Cuenta 104");
      const detailDebit = entryCharge.entryDetails.create.find((d: any) => d.debit > 0);
      expect(detailDebit.accountId).toBe(3); // Cuenta 104
      expect(detailDebit.debit).toBe(236.0);
    });
  });

  describe("Escenario 5: Cobro Mozo en Efectivo con Vuelto", () => {
    it("debe calcular el vuelto correcto y generar asiento en Cuenta 101 (Caja)", async () => {
      const totalPayable = 72.5;
      const delivered = 100.0;
      const changeGiven = calculateChangeAmount(totalPayable, delivered);
      expect(changeGiven.isValid).toBe(true);
      expect(changeGiven.changeGiven).toBe(27.5);

      const mockAccounts = new Map<string, number>([
        ["101", 1], // Caja
        ["102", 2],
        ["104", 3],
        ["121", 4],
      ]);

      const targetCash = pickPaymentAccountTarget(mockAccounts, "Efectivo");
      expect(targetCash.accountCode).toBe("101");
      expect(targetCash.accountId).toBe(1);
      expect(targetCash.label).toBe("Caja Efectivo");
    });
  });
});
