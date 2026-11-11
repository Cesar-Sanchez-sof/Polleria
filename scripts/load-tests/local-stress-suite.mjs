#!/usr/bin/env node
/**
 * Suite Automatizada Local de Carga, Estrés y Concurrencia (Segunda Evaluación)
 *
 * Evalúa contra el servidor local (http://localhost:3000) conectado a los servicios
 * externos reales configurados en `.env` (Neon PostgreSQL, AWS S3, Upstash Redis, RENIEC):
 *   - CA-01: Concurrencia HTTP a todas las APIs (barrido de rutas + escalado de VUs + SSE).
 *   - CA-02: Concurrencia asíncrona TypeScript/Node (Event Loop Lag + ráfaga bcrypt login).
 *   - CA-03: Concurrencia de accesos a BD y servicios externos (Neon, Redis, S3, RENIEC).
 *
 * Uso:
 *   npm run test:load:local
 *   npm run test:load:break
 *   node scripts/load-tests/local-stress-suite.mjs --mode=stress --with-reniec --with-s3-write
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { buildCatalogUrls, API_CATALOG } from "./api-catalog.mjs";

// ---------------------------------------------------------------------------
// 1. Carga segura de variables de entorno (.env) sin exponer secretos en logs
// ---------------------------------------------------------------------------
function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

// ---------------------------------------------------------------------------
// 2. Parseo de argumentos CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    baseUrl: process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    user: process.env.LOAD_USER || process.env.K6_USER || "admin",
    pass: process.env.LOAD_PASS || process.env.K6_PASS || "Password123!",
    mode: "safe",
    stages: null,
    duration: null,
    sseClients: 40,
    withReniec: false,
    withS3Write: false,
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) args.baseUrl = arg.split("=")[1].replace(/\/+$/, "");
    else if (arg.startsWith("--user=")) args.user = arg.split("=")[1];
    else if (arg.startsWith("--pass=")) args.pass = arg.split("=")[1];
    else if (arg.startsWith("--mode=")) args.mode = arg.split("=")[1];
    else if (arg.startsWith("--stages=")) {
      args.stages = arg
        .split("=")[1]
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    } else if (arg.startsWith("--duration=")) args.duration = Number(arg.split("=")[1]);
    else if (arg.startsWith("--sse-clients=")) args.sseClients = Number(arg.split("=")[1]);
    else if (arg === "--with-reniec") args.withReniec = true;
    else if (arg === "--with-s3-write") args.withS3Write = true;
    else if (arg === "--dry-run") args.dryRun = true;
  }

  const isStress = args.mode === "stress" || args.mode === "breakpoint";
  if (!args.stages) {
    args.stages = isStress ? [10, 25, 50, 100, 150, 200, 300] : [10, 25, 50, 100];
  }
  if (!args.duration || !Number.isFinite(args.duration)) {
    args.duration = isStress ? 10 : 7;
  }

  // En localhost siempre preferir http://localhost:3000 si NEXT_PUBLIC_APP_URL apunta a prod
  if (args.baseUrl.includes("vercel.app") && !argv.some((a) => a.startsWith("--base-url="))) {
    args.baseUrl = "http://localhost:3000";
  }

  return args;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(1));
}

function summarizeLatencies(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    min: sorted.length ? Number(sorted[0].toFixed(1)) : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? Number(sorted[sorted.length - 1].toFixed(1)) : 0,
  };
}

function isConfigured(key) {
  const v = process.env[key] || "";
  return Boolean(v.trim() && !v.includes("TU_"));
}

function getEnvStatus() {
  return {
    neon: isConfigured("DATABASE_URL"),
    s3:
      isConfigured("AWS_ACCESS_KEY_ID") &&
      isConfigured("AWS_SECRET_ACCESS_KEY") &&
      isConfigured("AWS_ENDPOINT_URL_S3"),
    redis: isConfigured("UPSTASH_REDIS_REST_URL") && isConfigured("UPSTASH_REDIS_REST_TOKEN"),
    reniec: isConfigured("JSON_PE_TOKEN") || isConfigured("JSON_PE_API_KEY"),
    mercadoPago: isConfigured("MERCADO_PAGO_ACCESS_TOKEN"),
  };
}

// ---------------------------------------------------------------------------
// 3. Autenticación y autodescubrimiento de IDs reales
// ---------------------------------------------------------------------------
async function loginSession(baseUrl, username, password) {
  const started = performance.now();
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15_000),
  });
  const elapsedMs = performance.now() - started;

  let cookieHeader = "";
  if (typeof res.headers.getSetCookie === "function") {
    const cookies = res.headers.getSetCookie();
    cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  } else {
    const raw = res.headers.get("set-cookie") || "";
    cookieHeader = raw.split(";")[0];
  }

  return {
    ok: res.status === 200 && cookieHeader.includes("sesion="),
    status: res.status,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    cookieHeader,
  };
}

async function discoverSampleIds(baseUrl, cookieHeader) {
  const extractFirstId = async (url, pick) => {
    try {
      const res = await fetch(`${baseUrl}${url}`, {
        headers: { Cookie: cookieHeader },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return 1;
      const json = await res.json();
      return pick(json) ?? 1;
    } catch {
      return 1;
    }
  };

  const firstFrom = (json) => {
    const arr = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.entries)
      ? json.entries
      : [];
    return arr[0]?.id ?? null;
  };

  const [account, order, product, employee, contract, payroll, schedule, role, sale, journalEntry, cashSession] =
    await Promise.all([
      extractFirstId("/api/accounts", firstFrom),
      extractFirstId("/api/orders", firstFrom),
      extractFirstId("/api/products", firstFrom),
      extractFirstId("/api/employees", firstFrom),
      extractFirstId("/api/contracts", firstFrom),
      extractFirstId("/api/payroll", firstFrom),
      extractFirstId("/api/schedules", firstFrom),
      extractFirstId("/api/roles", firstFrom),
      extractFirstId("/api/sales", firstFrom),
      extractFirstId("/api/journal-entries", firstFrom),
      extractFirstId("/api/cash-sessions", (json) => json?.activeSession?.id ?? 1),
    ]);

  return { account, order, product, employee, contract, payroll, schedule, role, sale, journalEntry, cashSession };
}

// ---------------------------------------------------------------------------
// 4. Barrido de cobertura HTTP (todas las rutas de lectura)
// ---------------------------------------------------------------------------
async function sweepAllReadApis(baseUrl, cookieHeader, endpoints) {
  const results = [];
  for (const ep of endpoints) {
    const started = performance.now();
    try {
      const res = await fetch(`${baseUrl}${ep.url}`, {
        headers: { Cookie: cookieHeader },
        signal: AbortSignal.timeout(15_000),
      });
      await res.arrayBuffer();
      results.push({
        route: ep.route,
        url: ep.url,
        domain: ep.domain,
        status: res.status,
        ms: Number((performance.now() - started).toFixed(1)),
        ok: res.status >= 200 && res.status < 400,
      });
    } catch (err) {
      results.push({
        route: ep.route,
        url: ep.url,
        domain: ep.domain,
        status: 0,
        ms: Number((performance.now() - started).toFixed(1)),
        ok: false,
        error: err.message,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 5. Escalado Progresivo de VUs (Carga -> Estrés -> Punto de Quiebre)
// ---------------------------------------------------------------------------
async function runVuStage({ baseUrl, cookieHeader, urls, vus, durationSec, isStress }) {
  const latencies = [];
  const statusCounts = {};
  let netErrors = 0;
  let server5xx = 0;
  let client4xx = 0;
  let success2xx = 0;

  const deadline = performance.now() + durationSec * 1000;
  const elHistogram = monitorEventLoopDelay({ resolution: 20 });
  elHistogram.enable();

  const stageStarted = performance.now();

  async function virtualUser(vuIdx) {
    let cursor = vuIdx % urls.length;
    while (performance.now() < deadline) {
      const target = urls[cursor % urls.length];
      cursor++;
      const reqStart = performance.now();
      try {
        const res = await fetch(`${baseUrl}${target}`, {
          headers: { Cookie: cookieHeader },
          signal: AbortSignal.timeout(10_000),
        });
        await res.arrayBuffer();
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
        if (res.status >= 200 && res.status < 400) success2xx++;
        else if (res.status >= 500) server5xx++;
        else client4xx++;
      } catch {
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        netErrors++;
      }

      if (!isStress) {
        // Pequeño think-time de usuario realista en modo safe
        await new Promise((r) => setTimeout(r, 40));
      }
    }
  }

  await Promise.all(Array.from({ length: vus }, (_, i) => virtualUser(i)));
  const totalWallSec = Math.max(0.1, (performance.now() - stageStarted) / 1000);
  elHistogram.disable();

  const totalRequests = success2xx + client4xx + server5xx + netErrors;
  const failureCount = server5xx + netErrors;
  const errorRatePct = totalRequests > 0 ? Number(((failureCount / totalRequests) * 100).toFixed(2)) : 100;
  const latencyStats = summarizeLatencies(latencies);
  const rps = Number((totalRequests / totalWallSec).toFixed(1));
  const slaPassed = latencyStats.p95 <= 3000 && errorRatePct < 5;

  return {
    vus,
    durationSec: Number(totalWallSec.toFixed(1)),
    totalRequests,
    rps,
    success2xx,
    client4xx,
    server5xx,
    netErrors,
    errorRatePct,
    latency: latencyStats,
    clientEventLoopP95Ms: Number((elHistogram.percentile(95) / 1e6).toFixed(2)),
    slaPassed,
    statusCounts,
  };
}

// ---------------------------------------------------------------------------
// 6. Concurrencia SSE (/api/realtime) + Ráfaga CPU Auth (bcrypt)
// ---------------------------------------------------------------------------
async function runRealtimeSseStress(baseUrl, cookieHeader, clientCount) {
  const controllers = [];
  const openedStatuses = [];
  const started = performance.now();

  await Promise.all(
    Array.from({ length: clientCount }, async () => {
      const ac = new AbortController();
      controllers.push(ac);
      try {
        const res = await fetch(`${baseUrl}/api/realtime`, {
          headers: { Cookie: cookieHeader },
          signal: ac.signal,
        });
        openedStatuses.push(res.status);
        // Leer primer bloque (evento 'connected') sin bloquear indefinidamente
        const reader = res.body?.getReader();
        if (reader) {
          await Promise.race([
            reader.read(),
            new Promise((r) => setTimeout(r, 1500)),
          ]);
        }
      } catch (err) {
        if (err.name !== "AbortError") openedStatuses.push(0);
      }
    })
  );

  // Enviar 5 broadcasts simultáneos mientras las conexiones SSE siguen abiertas
  const broadcastResults = await Promise.all(
    Array.from({ length: 5 }, (_, idx) =>
      fetch(`${baseUrl}/api/realtime`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          type: "PING",
          payload: { loadTestProbe: true, seq: idx + 1 },
        }),
        signal: AbortSignal.timeout(5_000),
      }).then((r) => r.status).catch(() => 0)
    )
  );

  for (const ac of controllers) ac.abort();

  return {
    requestedClients: clientCount,
    connectedOk: openedStatuses.filter((s) => s === 200).length,
    broadcastsOk: broadcastResults.filter((s) => s === 200).length,
    elapsedMs: Number((performance.now() - started).toFixed(1)),
  };
}

async function runAuthBcryptBurst(baseUrl, username, password, parallelCount) {
  const latencies = [];
  let ok = 0;
  let failed = 0;
  const started = performance.now();

  await Promise.all(
    Array.from({ length: parallelCount }, async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(20_000),
        });
        await res.arrayBuffer();
        latencies.push(performance.now() - t0);
        if (res.status === 200) ok++;
        else failed++;
      } catch {
        latencies.push(performance.now() - t0);
        failed++;
      }
    })
  );

  const wallMs = Number((performance.now() - started).toFixed(1));
  return {
    parallelLogins: parallelCount,
    ok,
    failed,
    totalWallMs: wallMs,
    rps: Number(((parallelCount / Math.max(1, wallMs)) * 1000).toFixed(2)),
    latency: summarizeLatencies(latencies),
  };
}

// ---------------------------------------------------------------------------
// 7. Sonda de Concurrencia Real a Servicios Externos (.env)
// ---------------------------------------------------------------------------
async function probeNeonConcurrency(levels) {
  if (!isConfigured("DATABASE_URL")) {
    return { configured: false, reason: "DATABASE_URL no configurada" };
  }
  const prisma = new PrismaClient({ log: ["error"] });
  const results = [];

  try {
    // Despertar Neon (cold-start) una vez antes de medir olas concurrentes
    await prisma.$queryRaw`SELECT 1`;

    for (const concurrency of levels) {
      const latencies = [];
      let ok = 0;
      let p2024 = 0;
      let otherErrors = 0;
      const tStart = performance.now();

      await Promise.allSettled(
        Array.from({ length: concurrency }, async () => {
          const t0 = performance.now();
          try {
            await prisma.role.count();
            latencies.push(performance.now() - t0);
            ok++;
          } catch (err) {
            latencies.push(performance.now() - t0);
            if (err?.code === "P2024") p2024++;
            else otherErrors++;
          }
        })
      );

      results.push({
        concurrency,
        ok,
        p2024,
        otherErrors,
        wallMs: Number((performance.now() - tStart).toFixed(1)),
        latency: summarizeLatencies(latencies),
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  return { configured: true, waves: results };
}

async function probeRedisConcurrency(levels) {
  if (!isConfigured("UPSTASH_REDIS_REST_URL") || !isConfigured("UPSTASH_REDIS_REST_TOKEN")) {
    return { configured: false, reason: "UPSTASH_REDIS_REST_URL/TOKEN no configuradas" };
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const tempKey = `polleria:loadtest:${Date.now()}`;
  const waves = [];

  try {
    for (const concurrency of levels) {
      const latencies = [];
      let ok = 0;
      let errors = 0;
      const tStart = performance.now();

      await Promise.allSettled(
        Array.from({ length: concurrency }, async () => {
          const t0 = performance.now();
          try {
            await redis.incr(tempKey);
            latencies.push(performance.now() - t0);
            ok++;
          } catch {
            latencies.push(performance.now() - t0);
            errors++;
          }
        })
      );

      waves.push({
        concurrency,
        ok,
        errors,
        wallMs: Number((performance.now() - tStart).toFixed(1)),
        latency: summarizeLatencies(latencies),
      });
    }
  } finally {
    await redis.del(tempKey).catch(() => {});
  }

  return { configured: true, waves };
}

async function probeS3Concurrency({ withS3Write }) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT;
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "comprobantes";
  const region = process.env.AWS_REGION || "us-east-2";

  if (!accessKey || !secretKey || !endpoint || accessKey.includes("TU_")) {
    return { configured: false, reason: "Credenciales S3 no configuradas" };
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });

  const headLatencies = [];
  let headOk = 0;
  let headErrors = 0;

  // 15 HeadBucket paralelos (no destructivo)
  await Promise.allSettled(
    Array.from({ length: 15 }, async () => {
      const t0 = performance.now();
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        headLatencies.push(performance.now() - t0);
        headOk++;
      } catch {
        headLatencies.push(performance.now() - t0);
        headErrors++;
      }
    })
  );

  let writeProbe = null;
  if (withS3Write) {
    const keysToDelete = [];
    const writeLatencies = [];
    let writeOk = 0;
    let writeErrors = 0;

    await Promise.allSettled(
      Array.from({ length: 10 }, async (_, idx) => {
        const key = `load-test-probe/${Date.now()}-${idx}.txt`;
        const t0 = performance.now();
        try {
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: Buffer.from(`probe-${idx}`),
              ContentType: "text/plain",
            })
          );
          keysToDelete.push(key);
          writeLatencies.push(performance.now() - t0);
          writeOk++;
        } catch {
          writeLatencies.push(performance.now() - t0);
          writeErrors++;
        }
      })
    );

    // Limpieza inmediata de objetos de prueba
    await Promise.allSettled(
      keysToDelete.map((Key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })))
    );

    writeProbe = {
      concurrency: 10,
      ok: writeOk,
      errors: writeErrors,
      latency: summarizeLatencies(writeLatencies),
    };
  }

  return {
    configured: true,
    bucket,
    headConcurrency15: {
      ok: headOk,
      errors: headErrors,
      latency: summarizeLatencies(headLatencies),
    },
    writeProbe,
  };
}

async function probeReniecConcurrency({ baseUrl, cookieHeader, withReniec }) {
  if (!withReniec) {
    return {
      executed: false,
      reason: "Omitido por defecto para proteger tu cuota de json.pe (ejecuta con --with-reniec para incluir 3 consultas paralelas).",
    };
  }

  const latencies = [];
  const sources = [];
  let ok = 0;
  let errors = 0;

  await Promise.all(
    Array.from({ length: 3 }, async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${baseUrl}/api/document-lookup?tipo=dni&numero=47829103`, {
          headers: { Cookie: cookieHeader },
          signal: AbortSignal.timeout(10_000),
        });
        const json = await res.json();
        latencies.push(performance.now() - t0);
        if (res.ok) {
          ok++;
          sources.push(json?.data?.source || json?.source || "desconocido");
        } else {
          errors++;
        }
      } catch {
        latencies.push(performance.now() - t0);
        errors++;
      }
    })
  );

  return {
    executed: true,
    concurrency: 3,
    ok,
    errors,
    sources,
    latency: summarizeLatencies(latencies),
  };
}

// ---------------------------------------------------------------------------
// 8. Generación automática de informe Markdown y JSON
// ---------------------------------------------------------------------------
function generateMarkdownReport(report) {
  const lines = [];
  lines.push("# Reporte de Segunda Evaluación: Carga, Estrés y Concurrencia");
  lines.push("");
  lines.push(`- **Fecha de ejecución:** ${report.timestamp}`);
  lines.push(`- **Objetivo (URL):** \`${report.config.baseUrl}\``);
  lines.push(`- **Modo:** \`${report.config.mode}\``);
  lines.push(`- **Hardware local:** ${report.hardware.cpus} núcleos CPU | ${report.hardware.totalMemoryGb} GB RAM | Node ${report.hardware.nodeVersion} (${report.hardware.platform})`);
  lines.push("");
  lines.push("## 1. Veredicto de Capacidad (¿Cuántos usuarios simultáneos soporta?)");
  lines.push("");
  lines.push(`> **Capacidad máxima saludable (SLA p95 <= 3,000 ms y error < 5%):** **${report.verdict.maxHealthyVus} usuarios concurrentes activos (VUs)**`);
  lines.push(`> **Punto de quiebre / degradación detectado:** ${report.verdict.breakpointVus ? `**${report.verdict.breakpointVus} VUs** (${report.verdict.breakpointReason})` : `No alcanzado hasta ${report.verdict.maxTestedVus} VUs (puedes subir con \`--mode=stress --stages=100,200,300,400\`)`}`);
  lines.push("");

  lines.push("## 2. Escalado HTTP de Todas las APIs (CA-01)");
  lines.push("");
  lines.push(`- **Rutas de lectura cubiertas en barrido inicial:** ${report.apiSweep.okCount}/${report.apiSweep.total} respondieron OK (<400)`);
  if (Array.isArray(report.apiSweep.slowestRoutes) && report.apiSweep.slowestRoutes.length > 0) {
    lines.push(
      `- **Endpoints más lentos en barrido:** ${report.apiSweep.slowestRoutes
        .slice(0, 5)
        .map((r) => `\`${r.route}\` (${r.ms} ms)`)
        .join(", ")}`
    );
  }
  lines.push("");
  lines.push("| VUs | Requests | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Error % | SLA |");
  lines.push("| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |");
  for (const s of report.vuStages) {
    lines.push(
      `| **${s.vus}** | ${s.totalRequests} | ${s.rps} | ${s.latency.p50} | ${s.latency.p95} | ${s.latency.p99} | ${s.latency.max} | ${s.errorRatePct}% | ${s.slaPassed ? "PASA" : "QUIEBRE"} |`
    );
  }
  lines.push("");
  lines.push(`- **Concurrencia SSE (\`/api/realtime\`):** ${report.sseStress.connectedOk}/${report.sseStress.requestedClients} clientes simultáneos conectados, ${report.sseStress.broadcastsOk}/5 broadcasts entregados (${report.sseStress.elapsedMs} ms).`);
  lines.push("");

  lines.push("## 3. Concurrencia Asíncrona TypeScript / CPU (CA-02)");
  lines.push("");
  lines.push(`- **Ráfaga paralela de Login (\`POST /api/auth/login\` con \`bcryptjs\` 12 rounds):**`);
  lines.push(`  - Logins simultáneos: **${report.authBurst.parallelLogins}**`);
  lines.push(`  - Exitosos / Fallidos: **${report.authBurst.ok} / ${report.authBurst.failed}**`);
  lines.push(`  - Throughput CPU auth: **${report.authBurst.rps} logins/seg** | p50: **${report.authBurst.latency.p50} ms** | p95: **${report.authBurst.latency.p95} ms**`);
  lines.push("");

  lines.push("## 4. Concurrencia a Base de Datos y Recursos Externos (CA-03)");
  lines.push("");
  if (report.external.neon.configured) {
    lines.push("### 4.1. Neon PostgreSQL (Prisma Pool)");
    lines.push("| Concurrencia | OK | Error P2024 | Otros | Wall (ms) | p50 (ms) | p95 (ms) |");
    lines.push("| :---: | :---: | :---: | :---: | :---: | :---: | :---: |");
    for (const w of report.external.neon.waves) {
      lines.push(`| ${w.concurrency} | ${w.ok} | ${w.p2024} | ${w.otherErrors} | ${w.wallMs} | ${w.latency.p50} | ${w.latency.p95} |`);
    }
    lines.push("");
  }
  if (report.external.redis.configured) {
    lines.push("### 4.2. Upstash Redis");
    lines.push("| Concurrencia | OK | Errores | Wall (ms) | p50 (ms) | p95 (ms) |");
    lines.push("| :---: | :---: | :---: | :---: | :---: | :---: | :---: |");
    for (const w of report.external.redis.waves) {
      lines.push(`| ${w.concurrency} | ${w.ok} | ${w.errors} | ${w.wallMs} | ${w.latency.p50} | ${w.latency.p95} |`);
    }
    lines.push("");
  }
  if (report.external.s3.configured) {
    lines.push("### 4.3. AWS S3 / Neon Object Storage");
    lines.push(`- **Bucket:** \`${report.external.s3.bucket}\``);
    lines.push(`- **15 HeadBucket paralelos:** ${report.external.s3.headConcurrency15.ok}/15 OK | p50: ${report.external.s3.headConcurrency15.latency.p50} ms | p95: ${report.external.s3.headConcurrency15.latency.p95} ms`);
    if (report.external.s3.writeProbe) {
      lines.push(`- **10 PutObject paralelos (+ limpieza):** ${report.external.s3.writeProbe.ok}/10 OK | p95: ${report.external.s3.writeProbe.latency.p95} ms`);
    }
    lines.push("");
  }
  lines.push("### 4.4. RENIEC / SUNAT (`json.pe`)");
  if (report.external.reniec.executed) {
    lines.push(`- **3 consultas paralelas:** ${report.external.reniec.ok}/3 OK | Fuentes: ${report.external.reniec.sources.join(", ")} | p95: ${report.external.reniec.latency.p95} ms`);
  } else {
    lines.push(`- ${report.external.reniec.reason}`);
  }
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 9. Orquestador principal
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envStatus = getEnvStatus();

  console.log("======================================================================");
  console.log(" SEGUNDA EVALUACIÓN: CARGA, ESTRÉS Y CONCURRENCIA (LOCAL + EXTERNOS) ");
  console.log("======================================================================");
  console.log(`Target URL       : ${args.baseUrl}`);
  console.log(`Modo             : ${args.mode} | VUs escalados: [${args.stages.join(" -> ")}] (${args.duration}s/escalón)`);
  console.log(`Catálogo APIs    : ${API_CATALOG.length} rutas totales en app/api/`);
  console.log(
    `Servicios .env   : Neon=${envStatus.neon ? "OK" : "NO"} | S3=${envStatus.s3 ? "OK" : "NO"} | Redis=${envStatus.redis ? "OK" : "NO"} | RENIEC=${envStatus.reniec ? "OK" : "NO"}`
  );

  if (args.dryRun) {
    console.log("\n[dry-run] Validación de configuración y catálogo completada correctamente.");
    return;
  }

  // Verificar que el servidor local esté levantado
  try {
    const ping = await fetch(`${args.baseUrl}/api/openapi`, { signal: AbortSignal.timeout(5_000) });
    if (!ping.ok && ping.status !== 401) {
      throw new Error(`HTTP ${ping.status}`);
    }
  } catch (err) {
    console.error(`\n[ERROR] No se pudo conectar a ${args.baseUrl} (${err.message}).`);
    console.error("Pasos para ejecutar en local con tus servicios externos:");
    console.error("  1. Terminal 1: npm run build ; npm run start");
    console.error("  2. Terminal 2: npm run test:load:local");
    process.exit(1);
  }

  // Login inicial
  console.log(`\n[1/5] Autenticando usuario '${args.user}' en ${args.baseUrl}/api/auth/login...`);
  const login = await loginSession(args.baseUrl, args.user, args.pass);
  if (!login.ok) {
    console.error(`[ERROR] Login falló con status ${login.status}. Verifica --user y --pass.`);
    process.exit(1);
  }
  console.log(`      ✔ Sesión establecida (${login.elapsedMs} ms)`);

  // Autodescubrir IDs reales y preparar URLs de lectura seguras
  const ids = await discoverSampleIds(args.baseUrl, login.cookieHeader);
  const resolvedCatalog = buildCatalogUrls({ ids });
  const safeReadEndpoints = resolvedCatalog.filter((e) => e.safety === "read");

  console.log(`\n[2/5] Barrido funcional de ${safeReadEndpoints.length} APIs de lectura seguras (CA-01)...`);
  const sweep = await sweepAllReadApis(args.baseUrl, login.cookieHeader, safeReadEndpoints);
  const okUrls = sweep.filter((r) => r.ok).map((r) => r.url);
  const failedSweep = sweep.filter((r) => !r.ok);
  const slowestSweepRoutes = [...sweep].sort((a, b) => b.ms - a.ms).slice(0, 8);
  console.log(`      ✔ ${okUrls.length}/${sweep.length} endpoints respondieron OK (2xx)`);
  console.log(
    `      ⏱ Top más lentas en barrido: ${slowestSweepRoutes
      .slice(0, 4)
      .map((s) => `${s.route}(${s.ms}ms)`)
      .join(", ")}`
  );
  if (failedSweep.length > 0) {
    console.log(
      `      ℹ Rutas con respuesta distinta de 2xx en barrido: ${failedSweep
        .slice(0, 6)
        .map((f) => `${f.route}(${f.status})`)
        .join(", ")}${failedSweep.length > 6 ? "..." : ""}`
    );
  }

  const targetUrls = okUrls.length > 0 ? okUrls : safeReadEndpoints.map((e) => e.url);

  console.log(`\n[3/5] Escalado progresivo de Usuarios Virtuales para detectar capacidad y quiebre (CA-01)...`);
  const vuStages = [];
  for (const vus of args.stages) {
    const stage = await runVuStage({
      baseUrl: args.baseUrl,
      cookieHeader: login.cookieHeader,
      urls: targetUrls,
      vus,
      durationSec: args.duration,
      isStress: args.mode === "stress" || args.mode === "breakpoint",
    });
    vuStages.push(stage);
    console.log(
      `      VUs=${String(stage.vus).padStart(3)} | RPS=${String(stage.rps).padStart(5)} | p50=${String(stage.latency.p50).padStart(6)}ms | p95=${String(stage.latency.p95).padStart(6)}ms | err=${stage.errorRatePct}% | ${stage.slaPassed ? "PASA" : "QUIEBRE"}`
    );
  }

  console.log(`\n[4/5] Concurrencia SSE (${args.sseClients} clientes) y ráfaga CPU bcrypt Login (CA-01 / CA-02)...`);
  const sseStress = await runRealtimeSseStress(args.baseUrl, login.cookieHeader, args.sseClients);
  console.log(
    `      ✔ SSE /api/realtime: ${sseStress.connectedOk}/${sseStress.requestedClients} conectados, ${sseStress.broadcastsOk}/5 broadcasts (${sseStress.elapsedMs} ms)`
  );

  const authCount = args.mode === "stress" ? 12 : 6;
  const authBurst = await runAuthBcryptBurst(args.baseUrl, args.user, args.pass, authCount);
  console.log(
    `      ✔ Auth Burst (${authCount} logins paralelos bcryptjs): ${authBurst.ok}/${authCount} OK | ${authBurst.rps} logins/s | p95=${authBurst.latency.p95}ms`
  );

  console.log(`\n[5/5] Sonda de concurrencia real hacia servicios externos de .env (CA-03)...`);
  const neonLevels = args.mode === "stress" ? [5, 15, 30, 50] : [5, 15, 30];
  const redisLevels = args.mode === "stress" ? [10, 30, 60] : [10, 30];

  const neonResult = await probeNeonConcurrency(neonLevels);
  if (neonResult.configured) {
    for (const w of neonResult.waves) {
      console.log(`      ✔ Neon Pool x${w.concurrency}: ${w.ok}/${w.concurrency} OK | P2024=${w.p2024} | p95=${w.latency.p95}ms`);
    }
  }

  const redisResult = await probeRedisConcurrency(redisLevels);
  if (redisResult.configured) {
    for (const w of redisResult.waves) {
      console.log(`      ✔ Upstash Redis x${w.concurrency}: ${w.ok}/${w.concurrency} OK | p95=${w.latency.p95}ms`);
    }
  }

  const s3Result = await probeS3Concurrency({ withS3Write: args.withS3Write });
  if (s3Result.configured) {
    console.log(
      `      ✔ S3 HeadBucket x15: ${s3Result.headConcurrency15.ok}/15 OK | p95=${s3Result.headConcurrency15.latency.p95}ms`
    );
  }

  const reniecResult = await probeReniecConcurrency({
    baseUrl: args.baseUrl,
    cookieHeader: login.cookieHeader,
    withReniec: args.withReniec,
  });
  console.log(
    reniecResult.executed
      ? `      ✔ RENIEC json.pe x3: ${reniecResult.ok}/3 OK | p95=${reniecResult.latency.p95}ms`
      : `      ℹ RENIEC: ${reniecResult.reason}`
  );

  // Calcular veredicto
  const passingStages = vuStages.filter((s) => s.slaPassed);
  const failingStage = vuStages.find((s) => !s.slaPassed);
  const maxHealthyVus = passingStages.length > 0 ? passingStages[passingStages.length - 1].vus : 0;

  const report = {
    timestamp: new Date().toISOString(),
    config: { baseUrl: args.baseUrl, mode: args.mode, stages: args.stages, durationSec: args.duration },
    hardware: {
      cpus: os.cpus().length,
      totalMemoryGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
      nodeVersion: process.version,
      platform: os.platform(),
    },
    verdict: {
      maxHealthyVus,
      maxTestedVus: vuStages[vuStages.length - 1]?.vus ?? 0,
      breakpointVus: failingStage?.vus ?? null,
      breakpointReason: failingStage
        ? `p95=${failingStage.latency.p95}ms, error=${failingStage.errorRatePct}%`
        : null,
    },
    apiSweep: {
      total: sweep.length,
      okCount: okUrls.length,
      failedRoutes: failedSweep,
      slowestRoutes: slowestSweepRoutes,
    },
    vuStages,
    sseStress,
    authBurst,
    external: {
      neon: neonResult,
      redis: redisResult,
      s3: s3Result,
      reniec: reniecResult,
    },
  };

  const reportsDir = path.resolve(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const mdPath = path.join(reportsDir, "load-evaluation-latest.md");
  const jsonPath = path.join(reportsDir, "load-evaluation-latest.json");

  fs.writeFileSync(mdPath, generateMarkdownReport(report), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n======================================================================");
  console.log(` VEREDICTO FINAL: Soporta ${report.verdict.maxHealthyVus} VUs saludables simultáneos`);
  if (report.verdict.breakpointVus) {
    console.log(` PUNTO DE QUIEBRE: ${report.verdict.breakpointVus} VUs (${report.verdict.breakpointReason})`);
  }
  console.log(` Evidencia Markdown : ${mdPath}`);
  console.log(` Evidencia JSON     : ${jsonPath}`);
  console.log("======================================================================");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
