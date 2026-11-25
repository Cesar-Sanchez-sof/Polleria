/**
 * SEED 2 · DATOS MAESTROS
 * Catálogos básicos que los módulos necesitan para operar: métodos de pago, salones y mesas,
 * caja registradora, clientes, proveedores, insumos (con su unidad de medida) y la carta de venta
 * con sus recetas.
 *
 * Notas del modelo de datos:
 *  - «Categorías de productos» = `ProductType` (RawMaterial = insumo, FinishedProduct = plato/bebida).
 *  - «Unidades de medida» = campo `unitOfMeasure` del producto (KG, LT, UND…).
 *  - «Tipos de documento» = tipo de persona/documento del cliente (DNI/RUC) y tipos de comprobante
 *    Boleta/Factura con sus series (ver seed 1).
 *
 * Idempotente: solo crea lo que falta y nunca resetea stock ni precios existentes.
 */
import type { PrismaClient } from "@prisma/client";

export const PAYMENT_METHODS = ["Efectivo", "Yape", "Tarjeta / POS", "Transferencia"];

export const SUPPLIERS = [
  { ruc: "20100154308", businessName: "Corporación Avícola San Fernando S.A.", contactPerson: "Carlos Mendoza", phone: "987654321", email: "ventas@sanfernando.com.pe", address: "Av. República de Panamá 4295, Surquillo, Lima" },
  { ruc: "20100070970", businessName: "Distribuidora de Abarrotes Lima Centro S.A.C.", contactPerson: "Rosa Paredes", phone: "986112233", email: "pedidos@abarroteslima.pe", address: "Jr. Andahuaylas 580, Cercado de Lima" },
  { ruc: "20509876543", businessName: "Bebidas del Perú S.A.C.", contactPerson: "Jorge Huamán", phone: "985223344", email: "ventas@bebidasperu.pe", address: "Av. Argentina 2100, Callao" },
  { ruc: "20512345678", businessName: "Carbón y Leña El Ahorro E.I.R.L.", contactPerson: "Luis Ccori", phone: "984334455", email: "contacto@carbonahorro.pe", address: "Panamericana Sur Km 18, Villa El Salvador" },
];

export const CUSTOMERS: Array<{ documentNumber: string; firstName: string; lastName: string; phone: string; personType: "Natural" | "Legal" }> = [
  { documentNumber: "00000000", firstName: "CLIENTES VARIOS", lastName: "", phone: "000000000", personType: "Natural" },
  { documentNumber: "45678123", firstName: "María", lastName: "Gonzales Pérez", phone: "987000111", personType: "Natural" },
  { documentNumber: "46123987", firstName: "Jorge", lastName: "Ramírez Soto", phone: "987000222", personType: "Natural" },
  { documentNumber: "47891234", firstName: "Ana", lastName: "Torres Vega", phone: "987000333", personType: "Natural" },
  { documentNumber: "20601234567", firstName: "Constructora Andes S.A.C.", lastName: "", phone: "014445566", personType: "Legal" },
  { documentNumber: "20556677889", firstName: "Eventos y Banquetes Sol S.R.L.", lastName: "", phone: "014447788", personType: "Legal" },
];

// Insumos (RawMaterial): [nombre, unidad, stock mínimo, último costo sin IGV]
export const RAW_MATERIALS: Array<[string, string, number, number]> = [
  ["Pollo entero", "KG", 20, 9.5],
  ["Papa amarilla", "KG", 30, 2.8],
  ["Aceite vegetal", "LT", 10, 7.5],
  ["Arroz", "KG", 20, 3.6],
  ["Lechuga", "KG", 5, 3.0],
  ["Tomate", "KG", 5, 3.5],
  ["Carbón", "KG", 40, 1.8],
  ["Sal y especias", "KG", 5, 6.0],
];

// Carta (FinishedProduct): [nombre, descripción, precio con IGV]
export const MENU: Array<[string, string, number]> = [
  ["1/4 Pollo a la Brasa", "1/4 de pollo a la brasa con papas fritas, ensalada y cremas.", 21.9],
  ["1/2 Pollo a la Brasa", "1/2 pollo a la brasa con papas fritas familiares, ensalada y cremas.", 39.9],
  ["1 Pollo a la Brasa Entero", "Pollo entero con papas, ensalada grande y cremas surtidas.", 72.9],
  ["Mostrito Brasa Clásico", "1/4 de pollo con arroz chaufa, papas fritas y cremas.", 24.9],
  ["Porción de Papas Fritas", "Papas amarillas crocantes con sal marina.", 12.0],
  ["Ensalada Clásica Familiar", "Lechuga, tomate, pepino, palta y vinagreta de la casa.", 10.0],
  ["Inca Kola 1.5L", "Gaseosa Inca Kola 1.5 litros.", 10.0],
  ["Coca Cola 1.5L", "Gaseosa Coca Cola 1.5 litros.", 10.0],
  ["Jarra de Chicha Morada 1L", "Chicha morada casera.", 12.0],
  ["Agua Mineral 600ml", "Agua mineral sin gas.", 4.0],
];

// Recetas por 1 unidad vendida: [plato, insumo, cantidad]
export const RECIPES: Array<[string, string, number]> = [
  ["1/4 Pollo a la Brasa", "Pollo entero", 0.25],
  ["1/4 Pollo a la Brasa", "Papa amarilla", 0.25],
  ["1/2 Pollo a la Brasa", "Pollo entero", 0.5],
  ["1/2 Pollo a la Brasa", "Papa amarilla", 0.4],
  ["1 Pollo a la Brasa Entero", "Pollo entero", 1],
  ["1 Pollo a la Brasa Entero", "Papa amarilla", 0.8],
  ["Mostrito Brasa Clásico", "Pollo entero", 0.25],
  ["Mostrito Brasa Clásico", "Arroz", 0.15],
  ["Porción de Papas Fritas", "Papa amarilla", 0.3],
  ["Ensalada Clásica Familiar", "Lechuga", 0.15],
  ["Ensalada Clásica Familiar", "Tomate", 0.1],
];

const TABLES = [
  [1, 2], [2, 2], [3, 4], [4, 4], [5, 4], [6, 4], [7, 6], [8, 6], [9, 6], [10, 8], [11, 8], [12, 10],
];

const AREAS = [
  { id: "area-1", name: "Salón Principal", level: "Piso 1", description: "Salón central climatizado.", tableNumbers: [1, 2, 3, 4, 5, 6], color: "emerald", active: true },
  { id: "area-2", name: "Terraza", level: "Piso 1 (Exterior)", description: "Área abierta al aire libre.", tableNumbers: [7, 8, 9], color: "amber", active: true },
  { id: "area-3", name: "Segundo Piso (Familiar)", level: "Piso 2", description: "Ambiente para grupos grandes y familias.", tableNumbers: [10, 11, 12], color: "blue", active: true },
];

export async function seedMaster(prisma: PrismaClient): Promise<void> {
  console.log("\n━━ SEED 2 · Datos maestros ━━");

  for (const name of PAYMENT_METHODS) {
    if (!(await prisma.paymentType.findFirst({ where: { name } }))) await prisma.paymentType.create({ data: { name, active: true } });
  }
  console.log(`✔ Métodos de pago: ${PAYMENT_METHODS.join(", ")}.`);

  for (const [number, capacity] of TABLES) {
    await prisma.diningTable.upsert({ where: { number }, update: {}, create: { number, capacity, active: true } });
  }
  for (const a of AREAS) await prisma.diningArea.upsert({ where: { id: a.id }, update: {}, create: a });
  console.log(`✔ ${TABLES.length} mesas en ${AREAS.length} salones.`);

  await prisma.cashRegister.upsert({
    where: { code: "CAJA-01" },
    update: {},
    create: { name: "Caja Principal - Salón", code: "CAJA-01", description: "Caja registradora principal del salón", active: true },
  });

  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({ where: { ruc: s.ruc }, update: {}, create: { ...s, active: true } });
  }
  console.log(`✔ ${SUPPLIERS.length} proveedores.`);

  for (const c of CUSTOMERS) {
    const exists = await prisma.customer.findFirst({ where: { documentNumber: c.documentNumber, personType: c.personType } });
    if (!exists) await prisma.customer.create({ data: { ...c, active: true } });
  }
  console.log(`✔ ${CUSTOMERS.length} clientes (incluye «CLIENTES VARIOS» para ventas rápidas).`);

  for (const [name, unit, min, cost] of RAW_MATERIALS) {
    if (await prisma.product.findFirst({ where: { name, type: "RawMaterial" } })) continue;
    await prisma.product.create({
      data: { name, type: "RawMaterial", unitOfMeasure: unit, minimumStock: min, lastCost: cost, averageCost: cost, currentStock: 0, sellable: false, active: true, affectationIgv: "Excluded" },
    });
  }
  for (const [name, description, price] of MENU) {
    if (await prisma.product.findFirst({ where: { name, type: "FinishedProduct" } })) continue;
    await prisma.product.create({
      data: { name, description, price, type: "FinishedProduct", unitOfMeasure: "UND", currentStock: 0, minimumStock: 5, sellable: true, active: true, affectationIgv: "Included" },
    });
  }
  console.log(`✔ Productos: ${RAW_MATERIALS.length} insumos y ${MENU.length} platos/bebidas en la carta.`);

  for (const [dish, ingredient, qty] of RECIPES) {
    const product = await prisma.product.findFirst({ where: { name: dish, type: "FinishedProduct" }, select: { id: true } });
    const ing = await prisma.product.findFirst({ where: { name: ingredient, type: "RawMaterial" }, select: { id: true } });
    if (!product || !ing) continue;
    await prisma.productRecipe.upsert({
      where: { productId_ingredientId: { productId: product.id, ingredientId: ing.id } },
      update: {},
      create: { productId: product.id, ingredientId: ing.id, quantityRequired: qty, active: true },
    });
  }
  console.log(`✔ ${RECIPES.length} líneas de receta.`);
}
