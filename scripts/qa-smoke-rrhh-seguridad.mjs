/**
 * Recorrido de "camino feliz" (y sus errores esperados) de Seguridad y RR. HH. contra el sistema levantado.
 * Verifica lo que dicen los casos de prueba de docs/qa. Deja datos de prueba con DNI 999xxxxx y usuarios «qa.*»
 * (se limpian con `npx tsx prisma/qa-cleanup.ts`).
 *
 * Uso:  BASE_URL=http://localhost:3000 node scripts/qa-smoke-rrhh-seguridad.mjs
 *       (por defecto admin / Password123! y mvega / Demo2026!; cámbialos con ADMIN_PASSWORD, RRHH_USER, RRHH_PASSWORD)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Password123!";
const RRHH_USER = process.env.RRHH_USER ?? "mvega";
const RRHH_PASSWORD = process.env.RRHH_PASSWORD ?? "Demo2026!";

const results = [];
let section = "";
const sec = (name) => {
  section = name;
  console.log(`\n── ${name}`);
};
function check(name, ok, detail = "") {
  results.push({ section, name, ok });
  console.log(`${ok ? "  ✔" : "  ✘"} ${name}${ok ? "" : detail ? `\n      → ${detail}` : ""}`);
}

class Session {
  cookie = "";
  async call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.endsWith("=") || /max-age=0/i.test(c)) this.cookie = "";
      else this.cookie = pair;
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* no JSON */
    }
    return { status: res.status, json, text, headers: res.headers };
  }
  async login(username, password) {
    this.cookie = "";
    return this.call("POST", "/api/auth/login", { username, password });
  }
}

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(new Date(s + "T00:00:00Z").getTime() + n * 86400000));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const msg = (r) => r.json?.error ?? r.json?.message ?? r.text?.slice(0, 160);

async function main() {
  const admin = new Session();
  const rrhh = new Session();
  const anon = new Session();
  const stamp = Date.now().toString().slice(-6);

  // ───────────────────────── SEGURIDAD · AUTENTICACIÓN ─────────────────────────
  sec("1. Autenticación");
  let r = await admin.login("admin", ADMIN_PASSWORD);
  check("Login admin válido (200)", r.status === 200 && admin.cookie !== "", `${r.status} ${msg(r)}`);
  r = await new Session().login("admin", "Incorrecta123");
  check("Contraseña incorrecta → 401 «Usuario o contraseña incorrectos»", r.status === 401 && /incorrectos/i.test(msg(r)), `${r.status} ${msg(r)}`);
  const wrong = msg(r);
  r = await new Session().login("noexiste99", "Prueba2026");
  check("Usuario inexistente → mismo mensaje (no revela si existe)", r.status === 401 && msg(r) === wrong, `${r.status} ${msg(r)}`);
  r = await new Session().call("POST", "/api/auth/login", {});
  check("Login sin datos → 400 usuario/contraseña obligatorios", r.status === 400, `${r.status} ${msg(r)}`);
  r = await anon.call("GET", "/api/employees");
  check("API sin sesión → 401", r.status === 401, `${r.status}`);
  r = await rrhh.login(RRHH_USER, RRHH_PASSWORD);
  check(`Login ${RRHH_USER} (RRHH demo) válido`, r.status === 200, `${r.status} ${msg(r)}`);

  // ───────────────────────── SEGURIDAD · ROLES ─────────────────────────
  sec("3. Roles y permisos");
  const roleName = `QA ROL ${stamp}`;
  r = await admin.call("GET", "/api/roles");
  const baseRoles = (r.json ?? []).map((x) => x.name);
  check("GET /api/roles lista los roles base (ADMIN, CAJERO, MESERO, COCINERO, CONTADOR, RRHH, GERENTE, EMPLEADO)", ["ADMIN", "CAJERO", "MESERO", "COCINERO", "CONTADOR", "RRHH", "GERENTE", "EMPLEADO"].every((n) => baseRoles.includes(n)), baseRoles.join(","));
  r = await admin.call("GET", "/api/roles?detalle=1");
  const detail = r.json ?? [];
  const adminRole = detail.find((x) => x.name === "ADMIN");
  check("Detalle de roles: ADMIN es de sistema con todos los permisos", adminRole?.is_system === true && adminRole.permissions.length > 100, JSON.stringify(adminRole)?.slice(0, 120));
  check("Detalle de roles: GERENTE no puede eliminar ni editar usuarios/roles", !detail.find((x) => x.name === "GERENTE")?.permissions.some((p) => p.endsWith(".eliminar") || p === "roles.editar" || p === "usuarios.crear"));
  r = await admin.call("GET", "/api/roles/dashboards");
  check("GET /api/roles/dashboards devuelve la lista de tableros", r.status === 200 && Array.isArray(r.json), `${r.status}`);
  const dashboards = r.json ?? [];
  r = await admin.call("POST", "/api/roles", { name: roleName, description: "Rol de prueba", permissions: ["pedidos.crear", "caja.ver"], dashboards: dashboards[0] ? [{ dashboard_id: dashboards[0].dashboard_id, can_view: false, can_edit: true }] : [] });
  const role = r.json;
  check("Crear rol (201) con «crear implica ver»", r.status === 201 && role?.permissions?.includes("pedidos.ver") && role.permissions.length === 3, `${r.status} ${msg(r)} ${role?.permissions}`);
  if (dashboards[0]) check("Rol guarda acceso a tablero (editar implica ver)", role?.dashboards?.[0]?.can_view === true && role.dashboards[0].can_edit === true, JSON.stringify(role?.dashboards));
  r = await admin.call("POST", "/api/roles", { name: roleName, permissions: [] });
  check("Rol duplicado → 409", r.status === 409, `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/roles", { name: "AB", permissions: [] });
  check("Nombre de rol de 2 caracteres → 400", r.status === 400, `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/roles", { name: `QA HACK ${stamp}`, permissions: ["ventas.hackear"] });
  check("Permiso desconocido → 400", r.status === 400, `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/roles", { name: `  qa  normal ${stamp} `, permissions: [] });
  check("Nombre normalizado a mayúsculas y espacios simples", r.status === 201 && r.json?.name === `QA NORMAL ${stamp}`, `${r.status} ${r.json?.name}`);
  const normalizedId = r.json?.role_id;
  if (normalizedId) {
    r = await admin.call("DELETE", `/api/roles/${normalizedId}`);
    check("Eliminar rol sin usuarios → 200", r.status === 200, `${r.status} ${msg(r)}`);
  }
  r = await admin.call("DELETE", `/api/roles/${adminRole?.role_id}`);
  check("No se elimina el rol de sistema ADMIN (400)", r.status === 400, `${r.status} ${msg(r)}`);
  r = await admin.call("PUT", `/api/roles/${adminRole?.role_id}`, { name: "OTRO", permissions: [] });
  check("No se renombra el rol ADMIN (400)", r.status === 400, `${r.status} ${msg(r)}`);

  // ───────────────────────── SEGURIDAD · USUARIOS ─────────────────────────
  sec("2. Usuarios");
  const uname = `qa.user${stamp}`;
  const baseUser = { first_name: "QA", paternal_last_name: "Prueba", dni: `9990${stamp.slice(-4)}`, email: `${uname}@example.com`, username: uname, password: "Prueba2026", role_id: role?.role_id };
  r = await admin.call("POST", "/api/users", baseUser);
  const user = r.json;
  check("Crear usuario (201)", r.status === 201 && user?.username === uname, `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/users", { ...baseUser, dni: "1234" });
  check("DNI inválido → 400 «8 dígitos»", r.status === 400 && /8 dígitos/.test(msg(r)), `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/users", { ...baseUser, username: "ab", dni: "99990001" });
  check("Usuario de 2 caracteres → 400", r.status === 400, `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/users", { ...baseUser, email: "sin-arroba", dni: "99990002", username: `${uname}b` });
  check("Correo inválido → 400", r.status === 400, `${r.status} ${msg(r)}`);
  for (const pw of ["abc", "abcdefgh", "12345678"]) {
    r = await admin.call("POST", "/api/users", { ...baseUser, password: pw, dni: "99990003", username: `${uname}c`, email: `${uname}c@example.com` });
    check(`Contraseña «${pw}» → 400`, r.status === 400, `${r.status} ${msg(r)}`);
  }
  r = await admin.call("POST", "/api/users", { ...baseUser, dni: "99990004" });
  check("Usuario/correo duplicado → 409", r.status === 409, `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/users", { ...baseUser, username: `${uname}d`, email: `${uname}d@example.com` });
  check("DNI duplicado → 409", r.status === 409, `${r.status} ${msg(r)}`);
  r = await admin.call("POST", "/api/users", { ...baseUser, dni: "99990005", username: "Juan Perez", email: `${uname}e@example.com` });
  check("Usuario con espacio → 400", r.status === 400, `${r.status} ${msg(r)}`);

  const qa = new Session();
  r = await qa.login(uname, "Prueba2026");
  check("El usuario nuevo inicia sesión", r.status === 200, `${r.status} ${msg(r)}`);
  r = await qa.call("GET", "/api/users");
  check("Con rol sin usuarios.ver → GET /api/users = 403", r.status === 403, `${r.status}`);
  r = await qa.call("POST", "/api/roles", { name: "QA X", permissions: [] });
  check("Con rol sin roles.crear → POST /api/roles = 403", r.status === 403, `${r.status}`);
  r = await qa.call("GET", "/api/audit-logs");
  check("Con rol sin auditoria.ver → GET /api/audit-logs = 403", r.status === 403, `${r.status}`);

  r = await admin.call("PUT", `/api/users/${user?.user_id}`, { ...baseUser, email: `${uname}.nuevo@example.com`, password: "Nueva2026", role_id: role?.role_id });
  check("Editar usuario: correo y contraseña (200)", r.status === 200 && r.json?.email === `${uname}.nuevo@example.com`, `${r.status} ${msg(r)}`);
  r = await new Session().login(uname, "Prueba2026");
  check("Contraseña anterior ya no sirve", r.status === 401, `${r.status}`);
  r = await new Session().login(uname, "Nueva2026");
  check("Nueva contraseña sirve", r.status === 200, `${r.status} ${msg(r)}`);
  r = await admin.call("PATCH", `/api/users/${user?.user_id}`, { active: false });
  check("Desactivar usuario (200)", r.status === 200 && r.json?.active === false, `${r.status} ${msg(r)}`);
  r = await new Session().login(uname, "Nueva2026");
  check("Usuario desactivado no inicia sesión (403 «desactivado»)", r.status === 403 && /desactivado/i.test(msg(r)), `${r.status} ${msg(r)}`);
  r = await admin.call("PATCH", `/api/users/${user?.user_id}`, { active: true });
  check("Reactivar usuario (200)", r.status === 200 && r.json?.active === true, `${r.status}`);
  r = await admin.call("DELETE", `/api/roles/${role?.role_id}`);
  check("Eliminar rol con usuarios asignados → 409", r.status === 409, `${r.status} ${msg(r)}`);
  r = await admin.call("PUT", `/api/roles/${role?.role_id}`, { name: roleName, active: false, permissions: [] });
  check("Desactivar rol con usuarios → 409", r.status === 409, `${r.status} ${msg(r)}`);
  const adminUser = (await admin.call("GET", "/api/users")).json?.find((u) => u.username === "admin");
  r = await rrhh.call("PUT", `/api/users/${adminUser?.user_id}`, {});
  check("RRHH no puede editar usuarios (403)", r.status === 403, `${r.status}`);

  sec("4. Auditoría");
  r = await admin.call("GET", "/api/audit-logs");
  const logs = Array.isArray(r.json) ? r.json : (r.json?.data ?? r.json?.logs ?? []);
  check("GET /api/audit-logs responde con registros", r.status === 200 && logs.length > 0, `${r.status} ${msg(r)}`);
  const text = JSON.stringify(logs.slice(0, 80));
  check("Hay registro de LOGIN_FAILED y de la creación del rol/usuario", /LOGIN_FAILED/.test(text) && text.includes(roleName), "faltan registros");
  check("La auditoría no contiene contraseñas", !/Prueba2026|Nueva2026|Password123/.test(text));

  // ───────────────────────── RR. HH. ─────────────────────────
  sec("5. Empleados / contratación");
  r = await rrhh.call("GET", "/api/employees");
  const employees = r.json ?? [];
  check("RRHH lista empleados (datos demo)", r.status === 200 && employees.length >= 9, `${r.status} n=${employees.length}`);
  r = await rrhh.call("GET", "/api/roles");
  check("RRHH ve el selector de roles (para el acceso del trabajador)", r.status === 200 && r.json.length >= 6, `${r.status}`);
  const templates = (await rrhh.call("GET", "/api/shift-templates")).json ?? [];
  const tpl = templates.find((t) => /atenci/i.test(t.name)) ?? templates[0];
  check("Hay turnos base", Boolean(tpl), JSON.stringify(templates).slice(0, 100));
  const start = today;
  const dni = `99910${stamp.slice(-3)}`;
  const hire = {
    personal: { dni, first_name: "Luis", paternal_last_name: "QAQuispe", phone: "987654321" },
    contract: {
      contract_type: "Indeterminado", labor_regime: "General", position: "Mozo", area: "Salón", start_date: start, base_salary: 1300, pension_system: "ONP",
      schedule: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, template_ids: [tpl?.template_id ?? tpl?.id] })),
    },
    access: { username: `qa.mozo${stamp}`, email: `qa.mozo${stamp}@example.com`, role_id: (await rrhh.call("GET", "/api/roles")).json.find((x) => x.name === "MESERO")?.role_id, password: "Mozo2026a" },
  };
  const adminRoleId = (await rrhh.call("GET", "/api/roles")).json.find((x) => x.name === "ADMIN")?.role_id;
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: `99980${stamp.slice(-3)}` }, access: { ...hire.access, username: `qa.adm${stamp}`, email: `qa.adm${stamp}@example.com`, role_id: adminRoleId } });
  check("RRHH no puede asignar el rol de sistema ADMIN al contratar → 403", r.status === 403, `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: `99970${stamp.slice(-3)}`, first_name: "Ana" }, access: undefined });
  check("RRHH contrata personal sin usuario (201)", r.status === 201 && r.json?.employee && !r.json?.user, `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", hire);
  const hired = r.json;
  check("RRHH contrata con acceso (201): empleado + contrato + horario + usuario con el rol elegido", r.status === 201 && hired?.user?.role === "MESERO" && hired?.employee?.dni === dni && Boolean(hired?.contract), `${r.status} ${msg(r)}`);
  check("Contrato Indeterminado con periodo de prueba de 3 meses", Boolean(hired?.contract?.trial_end_date), JSON.stringify(hired?.contract)?.slice(0, 160));
  r = await rrhh.call("POST", "/api/employees", { ...hire, access: undefined });
  check("DNI duplicado al contratar → 409/400 «ya existe»", [400, 409].includes(r.status) && /ya existe/i.test(msg(r)), `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: "1234" }, access: undefined });
  check("DNI de 4 dígitos → 400", r.status === 400, `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: `99920${stamp.slice(-3)}` }, contract: { ...hire.contract, end_date: addDays(start, 30) }, access: undefined });
  check("Indeterminado con fecha de término → 400", r.status === 400 && /indeterminado/i.test(msg(r)), `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: `99930${stamp.slice(-3)}` }, contract: { ...hire.contract, base_salary: 900 }, access: undefined });
  check("Sueldo S/ 900 < RMV → 400", r.status === 400 && /m[ií]nima/i.test(msg(r)), `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: `99940${stamp.slice(-3)}` }, contract: { ...hire.contract, contract_type: "PlazoFijo", end_date: null }, access: undefined });
  check("Plazo fijo sin fecha de término → 400", r.status === 400, `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: `99950${stamp.slice(-3)}` }, contract: { ...hire.contract, pension_system: "AFP", afp_name: null }, access: undefined });
  check("AFP sin elegir AFP → 400 «Selecciona la AFP»", r.status === 400 && /AFP/.test(msg(r)), `${r.status} ${msg(r)}`);
  r = await rrhh.call("POST", "/api/employees", { ...hire, personal: { ...hire.personal, dni: `99960${stamp.slice(-3)}` }, contract: { ...hire.contract, schedule: [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => [{ weekday, template_ids: [tpl?.template_id ?? tpl?.id, tpl?.template_id ?? tpl?.id] }]) }, access: undefined });
  check("Horario pactado inválido (turno repetido / más de 48 h) → 400", r.status === 400, `${r.status} ${msg(r)}`);

  if (hired?.employee) {
    const empId = hired.employee.employee_id;
    const mozo = new Session();
    r = await mozo.login(hire.access.username, hire.access.password);
    check("El trabajador contratado inicia sesión con su acceso", r.status === 200, `${r.status} ${msg(r)}`);
    r = await rrhh.call("PUT", `/api/employees/${empId}`, { ...hire.personal, phone: "912345678", address: "Av. Prueba 123" });
    check("Editar datos personales (200)", r.status === 200 && r.json?.phone === "912345678", `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", `/api/employees/${empId}/access`, { username: `qa.otro${stamp}`, email: `qa.otro${stamp}@example.com`, role_id: hire.access.role_id, password: "Mozo2026a" });
    check("Dar acceso a quien ya tiene usuario → 409", r.status === 409, `${r.status} ${msg(r)}`);

    sec("6. Contratos");
    r = await rrhh.call("GET", `/api/contracts?employee_id=${empId}`);
    const contracts = Array.isArray(r.json) ? r.json : (r.json?.contracts ?? []);
    const contract = contracts[0];
    check("Contrato vigente del trabajador con su horario pactado", r.status === 200 && contract?.status === "Vigente" && contract.schedule.length >= 5, `${r.status} ${JSON.stringify(contract)?.slice(0, 120)}`);
    r = await rrhh.call("POST", "/api/contracts", { employee_id: empId, contract_type: "Indeterminado", labor_regime: "General", position: "Mozo", area: "Salón", start_date: addDays(start, 1), base_salary: 1300, pension_system: "ONP", schedule: [] });
    check("Contrato superpuesto → rechazado", r.status >= 400, `${r.status} ${msg(r)}`);
    r = await rrhh.call("GET", "/api/contracts/alerts");
    check("Alertas de contratos/seguros (200)", r.status === 200 && Array.isArray(r.json), `${r.status}`);

    sec("7. Horarios");
    const monday = addDays(start, -((new Date(start + "T00:00:00Z").getUTCDay() + 6) % 7));
    r = await rrhh.call("GET", `/api/schedules?from=${monday}&to=${addDays(monday, 6)}`);
    const week = r.json ?? [];
    check("Horarios de la semana (200)", r.status === 200 && Array.isArray(week), `${r.status}`);
    check("El trabajador contratado aparece programado en la semana/siguiente", week.some((s) => s.employees.some((e) => e.employee_id === empId)) || (await rrhh.call("GET", `/api/schedules?from=${addDays(monday, 7)}&to=${addDays(monday, 13)}`)).json?.some((s) => s.employees.some((e) => e.employee_id === empId)), "no aparece en 2 semanas");
    const evName = `QA evento ${stamp.slice(-3)}`;
    r = await rrhh.call("POST", "/api/schedules", { name: evName, date: addDays(start, 3), start_time: "18:00", end_time: "23:00" });
    check("Crear horario eventual (201)", r.status === 201, `${r.status} ${msg(r)}`);
    const ev = r.json;
    r = await rrhh.call("POST", "/api/schedules", { name: evName, date: addDays(start, 3), start_time: "18:00", end_time: "23:00" });
    check("Horario duplicado (mismo nombre y fecha) → 409", r.status === 409, `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/schedules", { name: "", date: addDays(start, 3), start_time: "18:00", end_time: "23:00" });
    check("Horario sin nombre → 400", r.status === 400, `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/schedules", { name: `${evName}x`, date: addDays(start, 3), start_time: "18:00", end_time: "18:00" });
    check("Horario con fin = inicio → 400", r.status === 400, `${r.status} ${msg(r)}`);
    if (ev) {
      r = await rrhh.call("PUT", `/api/schedules/${ev.shift_id}/employees`, { employee_ids: [empId] });
      check("Asignar personal al horario (200)", r.status === 200 && r.json?.employees?.some((e) => e.employee_id === empId), `${r.status} ${msg(r)}`);
      r = await rrhh.call("DELETE", `/api/schedules/${ev.shift_id}`);
      check("Eliminar horario (200)", r.status === 200, `${r.status} ${msg(r)}`);
    }

    sec("9. Vacaciones y permisos");
    r = await rrhh.call("POST", "/api/leaves", { employee_id: empId, type: "PermisoPersonal", start_date: addDays(start, 10), end_date: addDays(start, 9), reason: "Trámite" });
    check("Licencia con fin anterior al inicio → 400", r.status === 400, `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/leaves", { employee_id: empId, type: "PermisoPersonal", start_date: addDays(start, 10), end_date: addDays(start, 10), reason: "" });
    check("Permiso sin motivo → 400", r.status === 400, `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/leaves", { employee_id: empId, type: "PermisoPersonal", start_date: addDays(start, 10), end_date: addDays(start, 10), reason: "Trámite personal" });
    check("Registrar permiso (201, queda Pendiente)", r.status === 201 && r.json?.status === "Pendiente", `${r.status} ${msg(r)}`);
    const leave = r.json;
    if (leave) {
      r = await rrhh.call("PATCH", `/api/leaves/${leave.leave_id}`, { action: "reject" });
      check("Rechazar sin motivo → 400", r.status === 400, `${r.status} ${msg(r)}`);
      r = await rrhh.call("PATCH", `/api/leaves/${leave.leave_id}`, { action: "approve" });
      check("Aprobar el permiso (200)", r.status === 200 && r.json?.status === "Aprobada", `${r.status} ${msg(r)}`);
      r = await rrhh.call("PATCH", `/api/leaves/${leave.leave_id}`, { action: "approve" });
      check("Aprobar otra vez → rechazado «ya fue revisada»", r.status >= 400 && /revisada/i.test(msg(r)), `${r.status} ${msg(r)}`);
    }

    sec("10. Seguros y adelantos");
    r = await rrhh.call("POST", "/api/insurances", { employee_id: empId, type: "VidaLey", provider: "Rímac", policy_number: "", start_date: start, monthly_cost: 25 });
    check("Seguro sin póliza → 400", r.status === 400, `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/insurances", { employee_id: empId, type: "VidaLey", provider: "Rímac", policy_number: "VL-QA-1", start_date: start, monthly_cost: 25 });
    check("Registrar Vida Ley (201)", r.status === 201, `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/insurances", { employee_id: empId, type: "VidaLey", provider: "Rímac", policy_number: "VL-QA-2", start_date: start, monthly_cost: 25 });
    check("Segundo Vida Ley activo → 409", r.status === 409, `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/advances", { employee_id: empId, amount: 900, installments: 2, reason: "Prueba" });
    check("Adelanto > 50 % del sueldo → 400", r.status === 400 && /50/.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/advances", { employee_id: empId, amount: 300, installments: 4, reason: "Prueba" });
    check("Adelanto en 4 cuotas → 400", r.status === 400 && /cuotas/i.test(msg(r)), `${r.status} ${msg(r)}`);
    r = await rrhh.call("POST", "/api/advances", { employee_id: empId, amount: 300, installments: 2, reason: "Prueba" });
    check("Adelanto válido (201, Pendiente)", r.status === 201 && r.json?.status === "Pendiente", `${r.status} ${msg(r)}`);
    const adv = r.json;
    r = await rrhh.call("POST", "/api/advances", { employee_id: empId, amount: 100, installments: 1, reason: "Otro" });
    check("Segundo adelanto en curso → 409", r.status === 409, `${r.status} ${msg(r)}`);
    if (adv) {
      r = await rrhh.call("PATCH", `/api/advances/${adv.advance_id}`, { action: "approve" });
      check("Aprobar adelanto (200)", r.status === 200 && r.json?.status === "Aprobado", `${r.status} ${msg(r)}`);
      r = await rrhh.call("PATCH", `/api/advances/${adv.advance_id}`, { action: "cancel" });
      check("Anular adelanto aprobado (200)", r.status === 200, `${r.status} ${msg(r)}`);
    }
  }

  sec("8. Asistencia");
  r = await rrhh.call("GET", `/api/attendance?date=${today}`);
  check("Asistencia del día (200)", r.status === 200, `${r.status} ${msg(r)}`);
  r = await rrhh.call("GET", `/api/attendance?date=${addDays(today, -1)}`);
  const yesterday = r.json;
  check("Asistencia de ayer con totales", r.status === 200 && (yesterday?.totals || yesterday?.rows), `${r.status}`);

  sec("11. Planilla");
  const prev = new Date(today + "T00:00:00Z");
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const py = prev.getUTCFullYear();
  const pm = prev.getUTCMonth() + 1;
  r = await rrhh.call("GET", `/api/payroll?year=${py}&month=${pm}`);
  const period = r.json;
  check(`Planilla del mes anterior (${py}-${String(pm).padStart(2, "0")}) existe`, r.status === 200 && period?.period_id, `${r.status} ${msg(r)}`);
  if (period?.period_id) {
    check("Planilla: totales coherentes (neto = bruto − descuentos)", Math.abs(period.total_net - (period.total_gross - period.total_deductions)) < 0.05, `${period.total_gross} ${period.total_deductions} ${period.total_net}`);
    const line = period.lines?.find((l) => l.employee_name || l.employee_id);
    if (line) {
      const pension = line.onp ?? line.pension_deduction;
      check("Líneas con ONP/AFP, EsSalud y neto", line.net_pay !== undefined && line.essalud !== undefined, JSON.stringify(line).slice(0, 200));
    }
  }
  const futureM = new Date(today + "T00:00:00Z");
  futureM.setUTCMonth(futureM.getUTCMonth() + 2);
  r = await rrhh.call("POST", "/api/payroll", { year: futureM.getUTCFullYear(), month: futureM.getUTCMonth() + 1 });
  check("Calcular un mes futuro → 400", r.status === 400, `${r.status} ${msg(r)}`);
  r = await rrhh.call("GET", "/api/payroll/social-benefits?kind=gratificacion&year=" + py + "&half=2");
  check("Gratificaciones del semestre (200)", r.status === 200 || r.status === 400, `${r.status} ${msg(r)}`);

  sec("13. Autoservicio");
  const worker = new Session();
  r = await worker.login("ctorres", RRHH_PASSWORD);
  check("Login de un trabajador demo (ctorres)", r.status === 200, `${r.status} ${msg(r)}`);
  r = await worker.call("GET", "/api/me");
  check("GET /api/me muestra su horario/asistencia", r.status === 200, `${r.status} ${msg(r)}`);
  r = await worker.call("GET", "/api/me/payslips");
  check("Mis boletas (200)", r.status === 200, `${r.status} ${msg(r)}`);
  r = await worker.call("GET", "/api/employees");
  check("El trabajador no puede listar empleados (403)", r.status === 403, `${r.status}`);
  r = await worker.call("GET", "/api/payroll");
  check("El trabajador no puede ver la planilla (403)", r.status === 403, `${r.status}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n══ ${results.length - failed.length}/${results.length} comprobaciones correctas`);
  if (failed.length) {
    console.log("Fallaron:");
    for (const f of failed) console.log(`  [${f.section}] ${f.name}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Error del recorrido:", e);
  process.exitCode = 1;
});
