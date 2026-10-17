import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Las contraseñas se guardan solo como hash bcrypt (con sal incluida). */
export function hashPassword(flat: string): Promise<string> {
  return bcrypt.hash(flat, ROUNDS);
}

export function verifyPassword(flat: string, hash: string): Promise<boolean> {
  return bcrypt.compare(flat, hash);
}