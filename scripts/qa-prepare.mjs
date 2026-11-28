/**
 * Deja listas las cuentas que piden los casos de prueba de docs/qa y no vienen en los seeds.
 * Idempotente: si la cuenta ya existe, no la toca.
 * Uso:  BASE_URL=http://localhost:3000 node scripts/qa-prepare.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Password123!";

const ACCOUNTS = [
  { username: "contador.prueba", role: "CONTADOR", first_name: "Carla", paternal_last_name: "Contadora", dni: "70009901", password: "Prueba2026a" },
];

let cookie = "";
async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of res.headers.getSetCookie?.() ?? []) cookie = c.split(";")[0];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: res.status, json, text };
}

const login = await call("POST", "/api/auth/login", { username: "admin", password: ADMIN_PASSWORD });
if (login.status !== 200) { console.error("No se pudo iniciar sesión como admin:", login.text); process.exit(1); }
const roles = (await call("GET", "/api/roles")).json ?? [];
const users = (await call("GET", "/api/users")).json;
const existing = new Set((users.users ?? users).map((u) => u.username));

for (const a of ACCOUNTS) {
  if (existing.has(a.username)) { console.log(`= ${a.username} ya existe`); continue; }
  const role = roles.find((r) => r.name === a.role);
  if (!role) { console.error(`✘ ${a.username}: no existe el rol ${a.role}`); continue; }
  const r = await call("POST", "/api/users", {
    first_name: a.first_name, paternal_last_name: a.paternal_last_name, dni: a.dni,
    email: `${a.username}@example.com`, username: a.username, password: a.password, role_id: role.role_id,
  });
  console.log(r.status === 201 ? `✔ ${a.username} (${a.role}) creado — clave ${a.password}` : `✘ ${a.username}: ${r.status} ${r.text.slice(0, 160)}`);
}
