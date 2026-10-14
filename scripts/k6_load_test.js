// scripts/k6_load_test.js
// Load test: login automatico por VU + prueba de todos los endpoints protegidos.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 50 },
    { duration: '2m',  target: 50 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    // DB remota (Neon) + 50 VUs: p(95) < 3s es aceptable
    http_req_duration: ['p(95)<3000'],
    // Solo los 3 endpoints de reporte con params opcionales pueden fallar
    errors: ['rate<0.20'],
  },
};

const BASE_URL = 'http://localhost:3000';
const USERNAME  = __ENV.K6_USER || 'admin';
const PASSWORD  = __ENV.K6_PASS || 'Password123!';

// Fecha de hoy para los endpoints de reporte que la requieren
const TODAY = new Date().toISOString().slice(0, 10);          // "2026-10-14"
const MONTH_START = TODAY.slice(0, 7) + '-01';                // "2026-10-01"

// Endpoints con sus rutas completas (algunos necesitan query params)
const ENDPOINTS = [
  { name: 'accounting-periods',   url: '/api/accounting-periods' },
  { name: 'accounts',             url: '/api/accounts' },
  { name: 'audit-logs',           url: '/api/audit-logs' },
  { name: 'balance-sheet',        url: `/api/balance-sheet?fecha=${TODAY}` },
  { name: 'cash-flow-statement',  url: `/api/cash-flow-statement?desde=${MONTH_START}&hasta=${TODAY}` },
  { name: 'cash-sessions',        url: '/api/cash-sessions' },
  { name: 'customers',            url: '/api/customers' },
  { name: 'daily-book',           url: `/api/daily-book?fecha=${TODAY}` },
  { name: 'dishes',               url: '/api/dishes' },
  { name: 'document-lookup',      url: '/api/document-lookup?tipo=dni&numero=12345678' },
  { name: 'general-ledger',       url: `/api/general-ledger?codigo=101&desde=${MONTH_START}&hasta=${TODAY}` },
  { name: 'journal-entries',      url: '/api/journal-entries' },
  { name: 'openapi',              url: '/api/openapi' },
  { name: 'orders',               url: '/api/orders' },
  { name: 'payment-methods',      url: '/api/payment-methods' },
  { name: 'roles',                url: '/api/roles' },
  { name: 'sales',                url: '/api/sales' },
  { name: 'stock',                url: '/api/stock' },
  { name: 'supplies',             url: '/api/supplies' },
  { name: 'tables',               url: '/api/tables' },
  { name: 'usuarios',             url: '/api/usuarios' },
];

export default function () {
  // 1. LOGIN - k6 almacena Set-Cookie en el jar automaticamente
  const jar = http.cookieJar();

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, jar }
  );

  const loginOk = check(loginRes, {
    'login status 200': (r) => r.status === 200,
  });

  if (!loginOk) {
    errorRate.add(true);
    console.error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
    return;
  }

  // 2. ENDPOINTS PROTEGIDOS
  ENDPOINTS.forEach(({ name, url }) => {
    const res = http.get(`${BASE_URL}${url}`, { jar });
    const ok = check(res, {
      [`${name} status 200`]: (r) => r.status === 200,
      [`${name} json`]:       (r) => { try { JSON.parse(r.body); return true; } catch (_) { return false; } },
    });
    errorRate.add(!ok);
  });

  // 3. THINK TIME
  sleep(0.5 + Math.random());
}
