// Crea el primer usuario administrador (empleado + usuario) para poder iniciar sesión.
// Uso: node --env-file=.env scripts/create-admin.mjs <usuario> <correo> <contraseña> <dni>
// Ejemplo: node --env-file=.env scripts/create-admin.mjs andy andy@correo.com Clave1234 12345678
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [username, email, password, dni] = process.argv.slice(2);

if (!username || !email || !password || !dni) {
  console.error("Uso: node --env-file=.env scripts/create-admin.mjs <usuario> <correo> <contraseña> <dni>");
  process.exit(1);
}
if (!/^[a-z0-9._-]{3,20}$/.test(username.toLowerCase())) {
  console.error("Usuario inválido (3 a 20 caracteres: letras, números, . _ -)");
  process.exit(1);
}
if (!/^\d{8}$/.test(dni)) {
  console.error("El DNI debe tener 8 dígitos");
  process.exit(1);
}
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error("La contraseña debe tener al menos 8 caracteres, con letras y números");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] },
  });
  if (exists) throw new Error("Ya existe un usuario con ese nombre de usuario o correo");

  // El rol debe llamarse ADMIN (así lo reconocen la auditoría y el seed).
  const role = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN", description: "Administrador del sistema", active: true },
  });

  const employee = await prisma.employee.upsert({
    where: { dni },
    update: {},
    create: { dni, firstName: "Administrador", paternalLastName: "Sistema", active: true },
  });

  await prisma.user.create({
    data: {
      employeeId: employee.id,
      roleId: role.id,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 12),
      active: true,
    },
  });
  console.log(`Administrador "${username.toLowerCase()}" creado con rol ADMIN`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}