/**
 * SEED 1 · CONFIGURACIÓN INICIAL (obligatorio)
 * Lo mínimo para que el ERP funcione desde el primer inicio: usuario administrador, roles y
 * permisos, plan de cuentas, datos de la empresa, impresoras/series y personalización.
 *
 * Es IDEMPOTENTE y NO destructivo: solo crea lo que falta. Nunca pisa lo que el negocio ya
 * personalizó (contraseña del admin, permisos editados de un rol, datos de la empresa…).
 */
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { seedRolesPermissions } from "../seed-roles";
import { seedAccounts } from "../seed-accounts";
import { seedBranding } from "../seed-branding";

export const ADMIN_USERNAME = "admin";
export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";

export async function seedConfig(prisma: PrismaClient): Promise<void> {
  console.log("\n━━ SEED 1 · Configuración inicial ━━");

  try {
    await prisma.$executeRawUnsafe("SET timezone TO 'America/Lima';");
  } catch {
    /* solo afecta a esta sesión */
  }

  // Roles (ADMIN, GERENTE, CAJERO, MESERO, COCINERO, CONTADOR, RRHH, EMPLEADO) y sus permisos.
  await seedRolesPermissions(prisma);

  // Empleado + usuario administrador. La contraseña solo se define al crearlo.
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const adminEmployee = await prisma.employee.upsert({
    where: { dni: "00000001" },
    update: {},
    create: {
      dni: "00000001",
      firstName: "Administrador",
      paternalLastName: "del Sistema",
      birthDate: new Date("1990-01-01"),
      hireDate: new Date(),
      active: true,
    },
  });
  const existingAdmin = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        password: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "Password123!", 10),
        employeeId: adminEmployee.id,
        roleId: adminRole.id,
        active: true,
      },
    });
    console.log(`✔ Usuario administrador creado (usuario «${ADMIN_USERNAME}», correo ${ADMIN_EMAIL}).`);
  } else {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { roleId: adminRole.id, active: true } });
    console.log("✔ Usuario administrador ya existía (se conserva su contraseña).");
  }

  // Plan de cuentas (PCGE simplificado para la pollería).
  await seedAccounts(prisma);

  // Datos de la empresa.
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
      ticketFooter: "¡Gracias por su visita! Esperamos verlo pronto.",
      currency: "S/ PEN",
      logoUrl: "",
      yapePhone: "954316272",
      yapeName: "El Buen Sabor a la Brasa",
      yapeQrImageUrl: "/storage/comprobantes/restaurant/yape-qr.png",
    },
  });

  // Impresoras y series de comprobantes.
  await prisma.printerConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      paperWidth: "80mm",
      autoCut: true,
      autoPrintVoucher: true,
      printWaiterCopy: false,
      series: { boleta: "B001", factura: "F001", ticket: "T001" },
      kitchenPrinter: { name: "Comandera Cocina", ipOrPort: "192.168.1.200:9100", active: true, autoPrintOnOrder: true },
      barPrinter: { name: "Comandera Bar / Bebidas", ipOrPort: "192.168.1.201:9100", active: false, autoPrintOnOrder: false },
      cashierPrinter: { name: "Impresora Térmica Caja 80mm", ipOrPort: "USB001 / Local", active: true },
    },
  });
  console.log("✔ Datos de la empresa, series de comprobantes e impresoras listos.");

  // Personalización (textos y logo por defecto).
  await seedBranding(prisma);
}
