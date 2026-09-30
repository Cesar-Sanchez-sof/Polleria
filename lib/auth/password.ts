import bcrypt from "bcryptjs";

const RONDAS = 12;

/** Las contraseñas se guardan solo como hash bcrypt (con sal incluida). */
export function hashPassword(plana: string): Promise<string> {
  return bcrypt.hash(plana, RONDAS);
}

export function verificarPassword(plana: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plana, hash);
}