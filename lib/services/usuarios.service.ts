import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verificarPassword } from "@/lib/auth/password";

/** Error de negocio con el código HTTP que debe devolver la API. */
export class ErrorUsuario extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "ErrorUsuario";
  }
}

export interface DatosUsuario {
  primer_nombre: string;
  segundo_nombre?: string | null;
  apellido_paterno: string;
  apellido_materno?: string | null;
  dni: string;
  correo: string;
  username: string;
  password?: string;
  id_rol: number;
}

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_USERNAME = /^[a-z0-9._-]{3,20}$/;

const usuarioSelect = {
  id_usuario: true,
  username: true,
  correo: true,
  estado: true,
  ultimo_acceso: true,
  rol: { select: { id_rol: true, nombre: true } },
  empleado: {
    select: {
      id_empleado: true,
      dni: true,
      primer_nombre: true,
      segundo_nombre: true,
      apellido_paterno: true,
      apellido_materno: true,
    },
  },
} satisfies Prisma.UsuarioSelect;

/** Hash de relleno para que el login tarde igual exista o no el usuario. */
const HASH_RELLENO = "$2b$12$1efU1XxeuoovsRSuwQ.YM.2uDaqq/I5nwHjtrWlZNpvK.VxcdCEym";

function textoObligatorio(valor: unknown, campo: string): string {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (!t) throw new ErrorUsuario(`${campo} es obligatorio`);
  return t;
}

function textoOpcional(valor: unknown): string | null {
  const t = typeof valor === "string" ? valor.trim() : "";
  return t || null;
}

export function validarPassword(password: string): void {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new ErrorUsuario("La contraseña debe tener al menos 8 caracteres, con letras y números");
  }
}

/** Valida y normaliza (username y correo en minúsculas, para que la unicidad no distinga mayúsculas). */
function normalizar(datos: DatosUsuario) {
  const dni = textoObligatorio(datos.dni, "El documento");
  if (!/^\d{8}$/.test(dni)) throw new ErrorUsuario("El documento debe tener 8 dígitos");

  const correo = textoObligatorio(datos.correo, "El correo").toLowerCase();
  if (correo.length > 80 || !RE_CORREO.test(correo)) throw new ErrorUsuario("El correo no es válido");

  const username = textoObligatorio(datos.username, "El nombre de usuario").toLowerCase();
  if (!RE_USERNAME.test(username)) {
    throw new ErrorUsuario("El usuario debe tener de 3 a 20 caracteres (letras, números, . _ -)");
  }

  if (!Number.isInteger(datos.id_rol) || datos.id_rol <= 0) throw new ErrorUsuario("Selecciona un rol");

  return {
    empleado: {
      dni,
      primer_nombre: textoObligatorio(datos.primer_nombre, "El nombre"),
      segundo_nombre: textoOpcional(datos.segundo_nombre),
      apellido_paterno: textoObligatorio(datos.apellido_paterno, "El apellido paterno"),
      apellido_materno: textoOpcional(datos.apellido_materno),
    },
    username,
    correo,
    id_rol: datos.id_rol,
  };
}

/** Comprueba que usuario, correo y documento no estén tomados por otra persona. */
async function verificarDuplicados(
  db: Pick<typeof prisma, "usuario" | "empleado">,
  d: { username: string; correo: string; dni: string },
  excluirUsuario?: number,
  excluirEmpleado?: number,
) {
  const porUsuario = await db.usuario.findFirst({
    where: {
      OR: [{ username: d.username }, { correo: d.correo }],
      ...(excluirUsuario ? { NOT: { id_usuario: excluirUsuario } } : {}),
    },
    select: { username: true },
  });
  if (porUsuario) {
    throw new ErrorUsuario(
      porUsuario.username === d.username
        ? "Ya existe un usuario con ese nombre de usuario"
        : "Ya existe un usuario con ese correo",
      409,
    );
  }
  const porDni = await db.empleado.findFirst({
    where: { dni: d.dni, ...(excluirEmpleado ? { NOT: { id_empleado: excluirEmpleado } } : {}) },
    select: { id_empleado: true },
  });
  if (porDni) throw new ErrorUsuario("Ya existe un empleado con ese documento", 409);
}

/** Convierte la violación de unicidad de la BD (carrera entre dos altas) en un 409 legible. */
function traducirError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new ErrorUsuario("El usuario, correo o documento ya está registrado", 409);
  }
  throw e;
}

export async function listarUsuarios() {
  return prisma.usuario.findMany({ select: usuarioSelect, orderBy: { id_usuario: "asc" } });
}

export async function listarRoles() {
  return prisma.rol.findMany({
    where: { estado: true },
    select: { id_rol: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

/** Registra empleado y usuario en una sola transacción. */
export async function crearUsuario(datos: DatosUsuario) {
  const n = normalizar(datos);
  const password = textoObligatorio(datos.password, "La contraseña");
  validarPassword(password);
  const hash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      await verificarDuplicados(tx, { username: n.username, correo: n.correo, dni: n.empleado.dni });
      const empleado = await tx.empleado.create({ data: n.empleado });
      return tx.usuario.create({
        data: {
          id_empleado: empleado.id_empleado,
          id_rol: n.id_rol,
          username: n.username,
          correo: n.correo,
          password: hash,
        },
        select: usuarioSelect,
      });
    });
  } catch (e) {
    return traducirError(e);
  }
}

/** Modifica los datos del usuario y de su empleado; la contraseña solo cambia si se envía una nueva. */
export async function actualizarUsuario(idUsuario: number, datos: DatosUsuario) {
  const n = normalizar(datos);
  let hash: string | undefined;
  if (datos.password) {
    validarPassword(datos.password);
    hash = await hashPassword(datos.password);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.usuario.findUnique({
        where: { id_usuario: idUsuario },
        select: { id_empleado: true },
      });
      if (!actual) throw new ErrorUsuario("Usuario no encontrado", 404);

      await verificarDuplicados(
        tx,
        { username: n.username, correo: n.correo, dni: n.empleado.dni },
        idUsuario,
        actual.id_empleado,
      );
      await tx.empleado.update({ where: { id_empleado: actual.id_empleado }, data: n.empleado });
      return tx.usuario.update({
        where: { id_usuario: idUsuario },
        data: {
          username: n.username,
          correo: n.correo,
          id_rol: n.id_rol,
          ...(hash ? { password: hash } : {}),
        },
        select: usuarioSelect,
      });
    });
  } catch (e) {
    return traducirError(e);
  }
}

export async function cambiarEstadoUsuario(idUsuario: number, estado: boolean) {
  try {
    return await prisma.usuario.update({
      where: { id_usuario: idUsuario },
      data: { estado },
      select: usuarioSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new ErrorUsuario("Usuario no encontrado", 404);
    }
    throw e;
  }
}

/**
 * Valida credenciales por usuario o correo. Un usuario desactivado no entra, y
 * el mensaje de "inactivo" solo se da con la contraseña correcta para no
 * revelar qué cuentas existen.
 */
export async function autenticar(identificador: string, password: string) {
  const id = identificador.trim().toLowerCase();
  const usuario = id
    ? await prisma.usuario.findFirst({
        where: { OR: [{ username: id }, { correo: id }] },
        select: { id_usuario: true, username: true, password: true, estado: true, rol: { select: { nombre: true } } },
      })
    : null;

  const valido = await verificarPassword(password, usuario?.password ?? HASH_RELLENO).catch(() => false);
  if (!usuario || !valido) throw new ErrorUsuario("Usuario o contraseña incorrectos", 401);
  if (!usuario.estado) throw new ErrorUsuario("Tu usuario está desactivado. Contacta al administrador", 403);

  await prisma.usuario.update({
    where: { id_usuario: usuario.id_usuario },
    data: { ultimo_acceso: new Date() },
  });
  return { idUsuario: usuario.id_usuario, username: usuario.username, rol: usuario.rol.nombre };
}

/** ¿Sigue activo el usuario de la sesión? Permite que desactivar corte accesos ya abiertos. */
export async function usuarioActivo(idUsuario: number): Promise<boolean> {
  const u = await prisma.usuario.findUnique({ where: { id_usuario: idUsuario }, select: { estado: true } });
  return u?.estado === true;
}