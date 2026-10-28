import { PrismaClient } from "@prisma/client";
import { seedAccounts } from "./seed-accounts";
import bcrypt from "bcryptjs";
import { seedRolesPermissions } from "./seed-roles";

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

  // Ensure admin user exists with email
  const hashedPassword = await bcrypt.hash("Password123!", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      email: "admin@example.com",
      password: hashedPassword,
    },
    create: {
      username: "admin",
      email: "admin@example.com",
      password: hashedPassword,
      employeeId: adminEmployee.id,
      roleId: adminRole.id,
      active: true,
    },
  });
  console.log("✔ Usuario admin creado o actualizado.");
    await seedRolesPermissions(prisma);

  // 2. MÉTODOS DE PAGO
  const paymentMethods = [
    "Efectivo",
    "Yape",
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

  // 3.1 SALONES Y ÁREAS DEL RESTAURANTE
  const defaultAreas = [
    {
      id: "area-1",
      name: "Salón Principal",
      level: "Piso 1",
      description: "Salón central climatizado, cerca a caja y recepción.",
      tableNumbers: [1, 2, 3, 4, 5, 6],
      active: true,
      color: "emerald",
    },
    {
      id: "area-2",
      name: "Terraza",
      level: "Piso 1 (Exterior)",
      description: "Área abierta al aire libre con vista a la avenida.",
      tableNumbers: [7, 8, 9],
      active: true,
      color: "amber",
    },
    {
      id: "area-3",
      name: "Segundo Piso (Familiar)",
      level: "Piso 2",
      description: "Ambiente espacioso para grupos grandes y familias.",
      tableNumbers: [10, 11, 12],
      active: true,
      color: "blue",
    },
    {
      id: "area-4",
      name: "Barra & Lounge",
      level: "Piso 1",
      description: "Mesas altas y atención rápida de bebidas y piqueos.",
      tableNumbers: [],
      active: false,
      color: "purple",
    },
  ];

  for (const area of defaultAreas) {
    await prisma.diningArea.upsert({
      where: { id: area.id },
      update: {
        name: area.name,
        level: area.level,
        description: area.description,
        tableNumbers: area.tableNumbers,
        active: area.active,
        color: area.color,
      },
      create: {
        id: area.id,
        name: area.name,
        level: area.level,
        description: area.description,
        tableNumbers: area.tableNumbers,
        active: area.active,
        color: area.color,
      },
    });
  }
  console.log("✔ Salones y áreas registradas.");

  // 3.2 CONFIGURACIÓN DE IMPRESORAS Y COMPROBANTES
  await prisma.printerConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      paperWidth: "80mm",
      autoCut: true,
      autoPrintVoucher: true,
      printWaiterCopy: false,
      series: {
        boleta: "B001",
        factura: "F001",
        ticket: "T001",
      },
      kitchenPrinter: {
        name: "Comandera Cocina (Epson TM-T20III)",
        ipOrPort: "192.168.1.200:9100",
        active: true,
        autoPrintOnOrder: true,
      },
      barPrinter: {
        name: "Comandera Bar / Bebidas",
        ipOrPort: "192.168.1.201:9100",
        active: false,
        autoPrintOnOrder: false,
      },
      cashierPrinter: {
        name: "Impresora Térmica Caja 80mm",
        ipOrPort: "USB001 / Local",
        active: true,
      },
    },
  });
  console.log("✔ Configuración de impresoras térmicas registrada.");

  // 3.3 CONFIGURACIÓN DE IDENTIDAD DEL RESTAURANTE Y YAPE
  await prisma.restaurantConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "POLLERÍA & BRASAS EL BUEN SABOR S.A.C.",
      commercialName: "El Buen Sabor a la Brasa",
      ruc: "20608976543",
      address: "Av. Los Héroes 456, San Juan de Miraflores",
      city: "Lima, Perú",
      phone: "+51 987 654 321",
      email: "contacto@elbuensabor.pe",
      ticketFooter: "¡Gracias por su visita! Pollería & Brasas les desea un excelente día. Para comprobante electrónico visite www.elbuensabor.pe",
      currency: "S/ PEN",
      logoUrl: "",
      yapePhone: "954316272",
      yapeName: "El Buen Sabor a la Brasa",
      yapeQrImageUrl: "/storage/comprobantes/restaurant/yape-qr.png",
    },
  });
  console.log("✔ Identidad del restaurante y configuración de Yape registradas en PostgreSQL.");

  // 4. CARTA DE PRODUCTOS DE LA POLLERÍA (productos terminados que se venden)
  const productsData = [
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

  // El stock de cada producto empieza en 0: se llena con compras, transformación o un ajuste en el Kardex.
  for (const product of productsData) {
    const exists = await prisma.product.findFirst({ where: { name: product.name, sellable: true } });
    if (!exists) {
      await prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          price: product.price,
          type: "FinishedProduct",
          unitOfMeasure: "UND",
          sellable: true,
          active: true,
        },
      });
    }
  }
  console.log(`✔ ${productsData.length} productos registrados en la carta.`);

  // 5. CATÁLOGO DE CUENTAS CONTABLES (PCGE 2019 simplificado para la pollería)
  await seedAccounts(prisma);

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
