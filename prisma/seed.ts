import { PrismaClient } from "@prisma/client";
import { seedCuentas } from "./seed-cuentas";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando población de base de datos para la Pollería...");

  // 1. CLIENTE GENÉRICO (para ventas rápidas en caja)
  const clienteExiste = await prisma.cliente.findFirst({
    where: { nro_doc: "00000000" },
  });
  if (!clienteExiste) {
    await prisma.cliente.create({
      data: {
        nro_doc: "00000000",
        nombre: "CLIENTES VARIOS",
        apellido: "",
        telefono: "000000000",
        tipo_persona: "Natural",
        estado: true,
      },
    });
  }
  console.log("✔ Cliente genérico '00000000' registrado.");

  // 2. MÉTODOS DE PAGO
  const metodosPago = [
    "Efectivo",
    "Yape",
    "Plin",
    "Tarjeta / POS",
    "Transferencia",
  ];

  for (const nombre of metodosPago) {
    const existe = await prisma.tipo_pago.findFirst({ where: { nombre } });
    if (!existe) {
      await prisma.tipo_pago.create({
        data: { nombre, estado: true },
      });
    }
  }
  console.log("✔ Métodos de pago registrados (Efectivo, Yape, Plin, Tarjeta / POS).");

  // 3. MESAS DEL SALÓN (Mesas 1 a 12 con distintas capacidades)
  const mesasData = [
    { numero: 1, aforo: 2 },
    { numero: 2, aforo: 2 },
    { numero: 3, aforo: 4 },
    { numero: 4, aforo: 4 },
    { numero: 5, aforo: 4 },
    { numero: 6, aforo: 4 },
    { numero: 7, aforo: 6 },
    { numero: 8, aforo: 6 },
    { numero: 9, aforo: 6 },
    { numero: 10, aforo: 8 },
    { numero: 11, aforo: 8 },
    { numero: 12, aforo: 10 },
  ];

  for (const mesa of mesasData) {
    await prisma.mesa.upsert({
      where: { numero: mesa.numero },
      update: { aforo: mesa.aforo, estado: true },
      create: { numero: mesa.numero, aforo: mesa.aforo, estado: true },
    });
  }
  console.log("✔ 12 Mesas del salón registradas y marcadas como disponibles.");

  // 4. CARTA DE PLATOS DE LA POLLERÍA
  const platosData = [
    {
      nombre: "1/4 Pollo a la Brasa",
      descripcion: "1/4 de pollo a la brasa tradicional con papas fritas crocantes, ensalada clásica y cremas caseras.",
      precio: 21.90,
    },
    {
      nombre: "1/2 Pollo a la Brasa",
      descripcion: "1/2 pollo a la brasa jugoso con papas fritas familiares, ensalada y cremas.",
      precio: 39.90,
    },
    {
      nombre: "1 Pollo a la Brasa Entero",
      descripcion: "1 pollo entero a la brasa con porción familiar de papas fritas, ensalada grande y cremas surtidas.",
      precio: 72.90,
    },
    {
      nombre: "Mostrito Brasa Clásico",
      descripcion: "1/4 de pollo a la brasa acompañado de arroz chaufa al wok, papas fritas y cremas.",
      precio: 24.90,
    },
    {
      nombre: "Mostrito Especial",
      descripcion: "1/4 de pollo a la brasa + chaufa especial + papas + huevo frito montado y plátano frito.",
      precio: 27.50,
    },
    {
      nombre: "Porción de Papas Fritas",
      descripcion: "Papas amarillas crocantes seleccionadas con sal marina.",
      precio: 12.00,
    },
    {
      nombre: "Tequeños Brasa (8 unidades)",
      descripcion: "Tequeños rellenos de pollo a la brasa y queso, con crema de palta artesanal.",
      precio: 16.00,
    },
    {
      nombre: "Porción de Arroz Chaufa de Pollo",
      descripcion: "Arroz chaufa salteado al wok con trozos de pollo, cebolla china y sillao.",
      precio: 14.00,
    },
    {
      nombre: "Ensalada Clásica Familiar",
      descripcion: "Lechuga fresca, rodajas de tomate, pepino, palta y vinagreta de la casa.",
      precio: 10.00,
    },
    {
      nombre: "Inca Kola 1.5L",
      descripcion: "Gaseosa Inca Kola en botella no retornable.",
      precio: 10.00,
    },
    {
      nombre: "Coca Cola 1.5L",
      descripcion: "Gaseosa Coca Cola en botella no retornable.",
      precio: 10.00,
    },
    {
      nombre: "Jarra de Chicha Morada 1L",
      descripcion: "Chicha morada casera preparada con maíz morado, piña, manzana y canela.",
      precio: 12.00,
    },
    {
      nombre: "Jarra de Maracuyá 1L",
      descripcion: "Refresco natural de maracuyá helada.",
      precio: 12.00,
    },
    {
      nombre: "Agua Mineral 600ml",
      descripcion: "Agua mineral sin gas personal.",
      precio: 4.00,
    },
  ];

  for (const plato of platosData) {
    const existe = await prisma.plato.findFirst({ where: { nombre: plato.nombre } });
    if (!existe) {
      await prisma.plato.create({
        data: {
          nombre: plato.nombre,
          descripcion: plato.descripcion,
          precio: plato.precio,
          estado: true,
        },
      });
    }
  }
  console.log(`✔ ${platosData.length} platos registrados en la carta.`);

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
