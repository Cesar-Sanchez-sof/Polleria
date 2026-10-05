import { PrismaClient } from "@prisma/client";
import { seedCuentas } from "./seed-accounts";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando población de base de datos para la Pollería...");

  // 1. CLIENTE GENÉRICO (para ventas rápidas en caja)
  const existingCustomer = await prisma.customer.findFirst({
    where: { documentNumber: "00000000" },
  });
  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        documentNumber: "00000000",
        firstName: "CLIENTES VARIOS",
        lastName: "",
        phone: "000000000",
        personType: "Natural",
        active: true,
      },
    });
  }
  console.log("✔ Cliente genérico '00000000' registrado.");

  // 3. ADMIN USER CREATION
  // Ensure admin role exists
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN", description: "Administrador del sistema", active: true },
  });

  // Ensure an employee record for admin exists
  const adminEmployee = await prisma.employee.upsert({
    where: { dni: "00000001" },
    update: {},
    create: {
      dni: "00000001",
      firstName: "Admin",
      paternalLastName: "User",
      birthDate: new Date("1990-01-01"),
      hireDate: new Date(),
      active: true,
    },
  });

  // Create admin user if not exists
  const existingAdmin = await prisma.user.findFirst({ where: { username: "admin" } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin", 10);
    await prisma.user.create({
      data: {
        username: "admin",
        password: hashedPassword,
        employeeId: adminEmployee.id,
        roleId: adminRole.id,
        estado: true,
      },
    });
    console.log("✔ Usuario admin creado.");
  }


  // 2. MÉTODOS DE PAGO
  const paymentMethods = [
    "Efectivo",
    "Yape",
    "Plin",
    "Tarjeta / POS",
    "Transferencia",
  ];

  for (const name of paymentMethods) {
    const exists = await prisma.paymentType.findFirst({ where: { name } });
    if (!exists) {
      await prisma.paymentType.create({
        data: { name, active: true },
      });
    }
  }
  console.log("✔ Métodos de pago registrados (Efectivo, Yape, Plin, Tarjeta / POS).");

  // 3. MESAS DEL SALÓN (Mesas 1 a 12 con distintas capacidades)
  const tablesData = [
    { number: 1, capacity: 2 },
    { number: 2, capacity: 2 },
    { number: 3, capacity: 4 },
    { number: 4, capacity: 4 },
    { number: 5, capacity: 4 },
    { number: 6, capacity: 4 },
    { number: 7, capacity: 6 },
    { number: 8, capacity: 6 },
    { number: 9, capacity: 6 },
    { number: 10, capacity: 8 },
    { number: 11, capacity: 8 },
    { number: 12, capacity: 10 },
  ];

  for (const table of tablesData) {
    await prisma.diningTable.upsert({
      where: { number: table.number },
      update: { capacity: table.capacity, active: true },
      create: { number: table.number, capacity: table.capacity, active: true },
    });
  }
  console.log("✔ 12 Mesas del salón registradas y marcadas como disponibles.");

  // 4. CARTA DE PLATOS DE LA POLLERÍA
  const dishesData = [
    {
      name: "1/4 Pollo a la Brasa",
      description: "1/4 de pollo a la brasa tradicional con papas fritas crocantes, ensalada clásica y cremas caseras.",
      price: 21.9,
    },
    {
      name: "1/2 Pollo a la Brasa",
      description: "1/2 pollo a la brasa jugoso con papas fritas familiares, ensalada y cremas.",
      price: 39.9,
    },
    {
      name: "1 Pollo a la Brasa Entero",
      description: "1 pollo entero a la brasa con porción familiar de papas fritas, ensalada grande y cremas surtidas.",
      price: 72.9,
    },
    {
      name: "Mostrito Brasa Clásico",
      description: "1/4 de pollo a la brasa acompañado de arroz chaufa al wok, papas fritas y cremas.",
      price: 24.9,
    },
    {
      name: "Mostrito Especial",
      description: "1/4 de pollo a la brasa + chaufa especial + papas + huevo frito montado y plátano frito.",
      price: 27.5,
    },
    {
      name: "Porción de Papas Fritas",
      description: "Papas amarillas crocantes seleccionadas con sal marina.",
      price: 12.0,
    },
    {
      name: "Tequeños Brasa (8 unidades)",
      description: "Tequeños rellenos de pollo a la brasa y queso, con crema de palta artesanal.",
      price: 16.0,
    },
    {
      name: "Porción de Arroz Chaufa de Pollo",
      description: "Arroz chaufa salteado al wok con trozos de pollo, cebolla china y sillao.",
      price: 14.0,
    },
    {
      name: "Ensalada Clásica Familiar",
      description: "Lechuga fresca, rodajas de tomate, pepino, palta y vinagreta de la casa.",
      price: 10.0,
    },
    {
      name: "Inca Kola 1.5L",
      description: "Gaseosa Inca Kola en botella no retornable.",
      price: 10.0,
    },
    {
      name: "Coca Cola 1.5L",
      description: "Gaseosa Coca Cola en botella no retornable.",
      price: 10.0,
    },
    {
      name: "Jarra de Chicha Morada 1L",
      description: "Chicha morada casera preparada con maíz morado, piña, manzana y canela.",
      price: 12.0,
    },
    {
      name: "Jarra de Maracuyá 1L",
      description: "Refresco natural de maracuyá helada.",
      price: 12.0,
    },
    {
      name: "Agua Mineral 600ml",
      description: "Agua mineral sin gas personal.",
      price: 4.0,
    },
  ];

  for (const dish of dishesData) {
    const exists = await prisma.dish.findFirst({ where: { name: dish.name } });
    if (!exists) {
      await prisma.dish.create({
        data: {
          name: dish.name,
          description: dish.description,
          price: dish.price,
          active: true,
        },
      });
    }
  }
  console.log(`✔ ${dishesData.length} platos registrados en la carta.`);

  // 5. CATÁLOGO DE CUENTAS CONTABLES (PCGE 2019 simplificado para la pollería)
  await seedCuentas(prisma);

  console.log("✨ Población de datos completada con éxito!");
}

main()
  .catch((e) => {
    console.error("❌ Error al poblar la base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
