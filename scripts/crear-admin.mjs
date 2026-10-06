// Crea el primer usuario administrador (empleado + usuario) para poder iniciar sesión.
// Uso: node --env-file=.env scripts/crear-admin.mjs <usuario> <correo> <contraseña> <dni>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [username, correo, password, dni] = process.argv.slice(2);

if (!username || !correo || !password || !dni) {
  console.error("Uso: node --env-file=.env scripts/crear-admin.mjs <usuario> <correo> <contraseña> <dni>");
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
  const existe = await prisma.usuario.findFirst({
    where: { OR: [{ username: username.toLowerCase() }, { correo: correo.toLowerCase() }] },
  });
  if (existe) throw new Error("Ya existe un usuario con ese nombre de usuario o correo");

  let rol = await prisma.rol.findFirst({ where: { nombre: "Administrador" } });
  if (!rol) rol = await prisma.rol.create({ data: { nombre: "Administrador", descripcion: "Acceso total al sistema" } });

  const empleado =
    (await prisma.empleado.findUnique({ where: { dni } })) ??
    (await prisma.empleado.create({ data: { dni, primer_nombre: "Administrador", apellido_paterno: "Sistema" } }));

  await prisma.usuario.create({
    data: {
      id_empleado: empleado.id_empleado,
      id_rol: rol.id_rol,
      username: username.toLowerCase(),
      correo: correo.toLowerCase(),
      password: await bcrypt.hash(password, 12),
    },
  });
  console.log(`Administrador "${username.toLowerCase()}" creado`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}