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

export interface UsuarioFilaDto {
  id_usuario: number;
  username: string;
  correo: string | null;
  estado: boolean;
  ultimo_acceso: string | null;
  rol: {
    id_rol: number;
    nombre: string;
  };
  empleado: {
    id_empleado: number;
    dni: string;
    primer_nombre: string;
    segundo_nombre: string | null;
    apellido_paterno: string;
    apellido_materno: string | null;
  };
}

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_USERNAME = /^[a-z0-9._-]{3,20}$/;

function mapearUsuarioADto(u: any): UsuarioFilaDto {
  return {
    id_usuario: u.id,
    username: u.username,
    correo: u.correo,
    estado: Boolean(u.estado),
    ultimo_acceso: u.lastAccessAt ? new Date(u.lastAccessAt).toISOString() : null,
    rol: {
      id_rol: u.role.id,
      nombre: u.role.name,
    },
    empleado: {
      id_empleado: u.employee.id,
      dni: u.employee.dni,
      primer_nombre: u.employee.firstName,
      segundo_nombre: u.employee.middleName ?? null,
      apellido_paterno: u.employee.paternalLastName,
      apellido_materno: u.employee.maternalLastName ?? null,
    },
  };
}

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
  db: Prisma.TransactionClient,
  d: { username: string; correo: string; dni: string },
  excluirUsuario?: number,
  excluirEmpleado?: number,
) {
  const porUsuario = await db.user.findFirst({
    where: {
      OR: [{ username: d.username }, { correo: d.correo }],
      ...(excluirUsuario ? { NOT: { id: excluirUsuario } } : {}),
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
  const porDni = await db.employee.findFirst({
    where: { dni: d.dni, ...(excluirEmpleado ? { NOT: { id: excluirEmpleado } } : {}) },
    select: { id: true },
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

export async function listarUsuarios(): Promise<UsuarioFilaDto[]> {
  const usuarios = await prisma.user.findMany({
    include: { employee: true, role: true },
    orderBy: { id: "asc" },
  });
  return usuarios.map(mapearUsuarioADto);
}

export async function listarRoles(): Promise<Array<{ id_rol: number; nombre: string }>> {
  const roles = await prisma.role.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return roles.map((r) => ({ id_rol: r.id, nombre: r.name }));
}

/** Registra empleado y usuario en una sola transacción. */
export async function crearUsuario(datos: DatosUsuario): Promise<UsuarioFilaDto> {
  const n = normalizar(datos);
  const password = textoObligatorio(datos.password, "La contraseña");
  validarPassword(password);
  const hash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      await verificarDuplicados(tx, { username: n.username, correo: n.correo, dni: n.empleado.dni });
      const empleado = await tx.employee.create({
        data: {
          dni: n.empleado.dni,
          firstName: n.empleado.primer_nombre,
          middleName: n.empleado.segundo_nombre,
          paternalLastName: n.empleado.apellido_paterno,
          maternalLastName: n.empleado.apellido_materno,
          active: true,
        },
      });
      const usuario = await tx.user.create({
        data: {
          employeeId: empleado.id,
          roleId: n.id_rol,
          username: n.username,
          correo: n.correo,
          password: hash,
          estado: true,
        },
        include: { employee: true, role: true },
      });
      return mapearUsuarioADto(usuario);
    });
  } catch (e) {
    return traducirError(e);
  }
}

/** Modifica los datos del usuario y de su empleado; la contraseña solo cambia si se envía una nueva. */
export async function actualizarUsuario(idUsuario: number, datos: DatosUsuario): Promise<UsuarioFilaDto> {
  const n = normalizar(datos);
  let hash: string | undefined;
  if (datos.password) {
    validarPassword(datos.password);
    hash = await hashPassword(datos.password);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.user.findUnique({
        where: { id: idUsuario },
        select: { employeeId: true },
      });
      if (!actual) throw new ErrorUsuario("Usuario no encontrado", 404);

      await verificarDuplicados(
        tx,
        { username: n.username, correo: n.correo, dni: n.empleado.dni },
        idUsuario,
        actual.employeeId,
      );
      await tx.employee.update({
        where: { id: actual.employeeId },
        data: {
          dni: n.empleado.dni,
          firstName: n.empleado.primer_nombre,
          middleName: n.empleado.segundo_nombre,
          paternalLastName: n.empleado.apellido_paterno,
          maternalLastName: n.empleado.apellido_materno,
        },
      });
      const usuario = await tx.user.update({
        where: { id: idUsuario },
        data: {
          username: n.username,
          correo: n.correo,
          roleId: n.id_rol,
          ...(hash ? { password: hash } : {}),
        },
        include: { employee: true, role: true },
      });
      return mapearUsuarioADto(usuario);
    });
  } catch (e) {
    return traducirError(e);
  }
}

export async function cambiarEstadoUsuario(idUsuario: number, estado: boolean): Promise<UsuarioFilaDto> {
  try {
    const usuario = await prisma.user.update({
      where: { id: idUsuario },
      data: { estado },
      include: { employee: true, role: true },
    });
    return mapearUsuarioADto(usuario);
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
    ? await prisma.user.findFirst({
        where: { OR: [{ username: id }, { correo: id }] },
        include: { role: true },
      })
    : null;

  const valido = await verificarPassword(password, usuario?.password ?? HASH_RELLENO).catch(() => false);
  if (!usuario || !valido) throw new ErrorUsuario("Usuario o contraseña incorrectos", 401);
  if (!usuario.estado) throw new ErrorUsuario("Tu usuario está desactivado. Contacta al administrador", 403);

  await prisma.user.update({
    where: { id: usuario.id },
    data: { lastAccessAt: new Date() },
  });
  return { idUsuario: usuario.id, username: usuario.username, rol: usuario.role.name };
}

/** ¿Sigue activo el usuario de la sesión? Permite que desactivar corte accesos ya abiertos. */
export async function usuarioActivo(idUsuario: number): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: idUsuario }, select: { estado: true } });
  return u?.estado === true;
}