/**
 * Suite k6 Avanzada - Segunda Evaluación de Carga, Estrés y Concurrencia
 *
 * Complementa a `scripts/load-tests/local-stress-suite.mjs` para ejecutarse con Grafana k6
 * cuando esté instalado en el equipo:
 *   k6 run scripts/load-tests/k6-full-stress.js
 *   k6 run -e PROFILE=stress -e BASE_URL=http://localhost:3000 scripts/load-tests/k6-full-stress.js
 *   k6 run -e PROFILE=spike scripts/load-tests/k6-full-stress.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";
import { buildCatalogUrls } from "./api-catalog.mjs";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const AUTH_USER = __ENV.K6_USER || "admin";
const AUTH_PASS = __ENV.K6_PASS || "Password123!";
const PROFILE = (__ENV.PROFILE || "load").toLowerCase();

const unexpected5xxRate = new Rate("http_unexpected_5xx");
const authLoginDuration = new Trend("auth_login_ms");

const PROFILES = {
  load: [
    { duration: "15s", target: 20 },
    { duration: "30s", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "15s", target: 0 },
  ],
  stress: [
    { duration: "15s", target: 25 },
    { duration: "20s", target: 50 },
    { duration: "20s", target: 100 },
    { duration: "20s", target: 150 },
    { duration: "20s", target: 200 },
    { duration: "20s", target: 300 },
    { duration: "15s", target: 0 },
  ],
  spike: [
    { duration: "10s", target: 5 },
    { duration: "10s", target: 150 },
    { duration: "30s", target: 150 },
    { duration: "10s", target: 5 },
    { duration: "10s", target: 0 },
  ],
};

export const options = {
  scenarios: {
    api_read_concurrency: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: PROFILES[PROFILE] || PROFILES.load,
      gracefulRampDown: "10s",
      exec: "runApiSweep",
    },
    auth_cpu_contention: {
      executor: "constant-arrival-rate",
      rate: 2,
      timeUnit: "5s",
      duration: PROFILE === "stress" ? "90s" : "45s",
      preAllocatedVUs: 4,
      maxVUs: 10,
      exec: "runAuthContention",
      startTime: "5s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_unexpected_5xx: ["rate<0.05"],
  },
};

function extractSessionCookie(res) {
  const cookies = res.cookies && res.cookies.sesion;
  if (cookies && cookies.length > 0) {
    return `sesion=${cookies[0].value}`;
  }
  const setCookie = res.headers["Set-Cookie"] || res.headers["set-cookie"] || "";
  const match = String(setCookie).match(/sesion=([^;]+)/);
  return match ? `sesion=${match[1]}` : "";
}

function firstId(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
  const item = list[0];
  return item && item.id != null ? item.id : undefined;
}

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: AUTH_USER, password: AUTH_PASS }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(loginRes, {
    "setup login status 200": (r) => r.status === 200,
  });

  const cookieHeader = extractSessionCookie(loginRes);
  if (!cookieHeader) {
    throw new Error(`No se pudo autenticar en ${BASE_URL}/api/auth/login (HTTP ${loginRes.status})`);
  }

  const headers = { Cookie: cookieHeader };
  const probeEndpoints = [
    ["account", "/api/accounts"],
    ["journalEntry", "/api/journal-entries"],
    ["order", "/api/orders"],
    ["sale", "/api/sales"],
    ["product", "/api/products"],
    ["contract", "/api/contracts"],
    ["employee", "/api/employees"],
    ["payroll", "/api/payroll"],
    ["schedule", "/api/schedules"],
    ["role", "/api/roles"],
  ];

  const ids = {};
  for (const [key, ep] of probeEndpoints) {
    const res = http.get(`${BASE_URL}${ep}`, { headers });
    if (res.status >= 200 && res.status < 300) {
      try {
        const id = firstId(res.json());
        if (id !== undefined) ids[key] = id;
      } catch {
        // Usar fallback ID = 1 si el cuerpo no es JSON
      }
    }
  }

  const readUrls = buildCatalogUrls({ ids })
    .filter((entry) => entry.safety === "read")
    .map((entry) => ({ route: entry.route, domain: entry.domain, url: entry.url }));

  return { cookieHeader, readUrls };
}

export function runApiSweep(data) {
  const headers = { Cookie: data.cookieHeader };
  const batchSize = 4;
  const startIdx = ((__VU + __ITER) * batchSize) % data.readUrls.length;

  group(`domain_concurrent_batch`, () => {
    const requests = [];
    for (let i = 0; i < batchSize; i++) {
      const target = data.readUrls[(startIdx + i) % data.readUrls.length];
      requests.push(["GET", `${BASE_URL}${target.url}`, null, { headers, tags: { domain: target.domain, route: target.route } }]);
    }

    const responses = http.batch(requests);
    for (const res of responses) {
      unexpected5xxRate.add(res.status >= 500 || res.status === 0);
      check(res, {
        "status < 500": (r) => r.status > 0 && r.status < 500,
      });
    }
  });

  sleep(PROFILE === "stress" ? 0.1 : 0.4);
}

export function runAuthContention() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: AUTH_USER, password: AUTH_PASS }),
    { headers: { "Content-Type": "application/json" }, tags: { scenario: "auth_cpu" } }
  );
  authLoginDuration.add(res.timings.duration);
  unexpected5xxRate.add(res.status >= 500 || res.status === 0);
  check(res, {
    "auth login 200": (r) => r.status === 200,
  });
}
