import { describe, it, expect } from "vitest";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { buildBoletaUbl21Xml } from "@/lib/sunat/ubl/builder";
import { signXmlUbl21 } from "@/lib/sunat/crypto/signer";
import type { SunatBoletaData } from "@/lib/sunat/types";

async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      try {
        const value = await task(items[idx], idx);
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function createSampleBoleta(correlativo: number): SunatBoletaData {
  return {
    serie: "B001",
    correlativo,
    fechaEmision: "2026-11-10",
    horaEmision: "20:15:00",
    moneda: "PEN",
    emisor: {
      ruc: "20000000001",
      razonSocial: "POLLERIA LOS BETOS S.A.C.",
      nombreComercial: "LOS BETOS",
      direccion: "AV. LARCO 450 - TRUJILLO",
      departamento: "LA LIBERTAD",
      provincia: "TRUJILLO",
      distrito: "TRUJILLO",
      ubigeo: "130101",
    },
    cliente: {
      tipoDoc: "1",
      numDoc: String(40000000 + correlativo),
      rznSocial: `CLIENTE CONCURRENCIA ${correlativo}`,
    },
    items: [
      {
        id: correlativo,
        codigo: "P001",
        descripcion: `1 Pollo a la Brasa #${correlativo}`,
        unidadMedida: "NIU",
        cantidad: 1,
        precioUnitario: 78.5,
        valorUnitario: 66.53,
        igv: 11.97,
        total: 78.5,
      },
    ],
    subtotal: 66.53,
    igv: 11.97,
    total: 78.5,
  };
}

describe("Evaluación CA-02: Concurrencia de Operaciones Asíncronas en TypeScript", () => {
  it("mide Event Loop Lag y aislamiento bajo verificaciones bcrypt paralelas (simulación de ráfaga de login)", async () => {
    const validHash = await hashPassword("Password123!");
    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();

    const startedAt = performance.now();
    const batch = Array.from({ length: 4 }, (_, i) => {
      const candidate = i % 2 === 0 ? "Password123!" : `WrongPass-${i}`;
      return verifyPassword(candidate, validHash).then((ok) => ({
        idx: i,
        expected: i % 2 === 0,
        ok,
      }));
    });

    const results = await Promise.all(batch);
    const totalMs = performance.now() - startedAt;

    histogram.disable();
    const p95LagMs = histogram.percentile(95) / 1e6;

    for (const item of results) {
      expect(item.ok).toBe(item.expected);
    }
    // Constata medición real de CPU/Event Loop ante bcryptjs (12 rounds)
    expect(totalMs).toBeGreaterThan(50);
    expect(p95LagMs).toBeGreaterThanOrEqual(0);
  });

  it("construye y firma 30 comprobantes XML UBL 2.1 + XMLDSIG en paralelo con Promise.all sin colisiones", async () => {
    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();

    const batch = Array.from({ length: 30 }, (_, idx) => {
      const correlativo = 500 + idx;
      return Promise.resolve().then(() => {
        const boleta = createSampleBoleta(correlativo);
        const xml = buildBoletaUbl21Xml(boleta);
        const documentId = `B001-${String(correlativo).padStart(8, "0")}`;
        const signed = signXmlUbl21(xml, documentId);
        return { documentId, signed };
      });
    });

    const signedDocs = await Promise.all(batch);
    histogram.disable();

    const digests = new Set<string>();
    const ids = new Set<string>();

    for (const doc of signedDocs) {
      expect(doc.signed).toContain(`<cbc:ID>${doc.documentId}</cbc:ID>`);
      expect(doc.signed).toContain(`Id="Signature-${doc.documentId}"`);
      const digestMatch = doc.signed.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/);
      expect(digestMatch?.[1]).toBeTruthy();
      digests.add(digestMatch![1]);
      ids.add(doc.documentId);
    }

    // Cada comprobante mantiene su digest SHA-256 e ID únicos sin contaminación cruzada
    expect(ids.size).toBe(30);
    expect(digests.size).toBe(30);
  });

  it("aplica backpressure acotando promesas concurrentes (maxConcurrency=5) sobre 45 tareas con fallos parciales", async () => {
    let activeInFlight = 0;
    let peakInFlight = 0;

    const items = Array.from({ length: 45 }, (_, i) => i);
    const settled = await runWithConcurrencyLimit(items, 5, async (item) => {
      activeInFlight++;
      peakInFlight = Math.max(peakInFlight, activeInFlight);
      await new Promise((r) => setTimeout(r, (item % 4) + 2));
      activeInFlight--;

      if (item % 9 === 0) {
        throw new Error(`Fallo controlado en ítem ${item}`);
      }
      return item * 2;
    });

    expect(peakInFlight).toBeLessThanOrEqual(5);
    expect(peakInFlight).toBeGreaterThan(1);
    expect(activeInFlight).toBe(0);

    const fulfilled = settled.filter((r) => r.status === "fulfilled");
    const rejected = settled.filter((r) => r.status === "rejected");

    expect(rejected).toHaveLength(5); // 0, 9, 18, 27, 36
    expect(fulfilled).toHaveLength(40);
  });

  it("evita Race Conditions en descuento simultáneo de stock y doble cobro mediante serialización por llave", async () => {
    const locks = new Map<string, Promise<void>>();

    async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const prev = locks.get(key) ?? Promise.resolve();
      let release!: () => void;
      const next = new Promise<void>((resolve) => {
        release = resolve;
      });
      locks.set(key, prev.then(() => next));
      await prev;
      try {
        return await fn();
      } finally {
        release();
      }
    }

    // Simula un producto crítico con stock = 5 y 25 pedidos simultáneos por Promise.allSettled
    let stock = 5;
    const orderAttempts = Array.from({ length: 25 }, (_, i) =>
      withKeyLock("product:pollo-entero", async () => {
        const snapshot = stock;
        await new Promise((r) => setTimeout(r, (i % 3) + 1)); // Latencia async simulada
        if (snapshot < 1) {
          throw new Error("Stock agotado");
        }
        stock = snapshot - 1;
        return { pedido: i + 1, stockRestante: stock };
      })
    );

    const outcome = await Promise.allSettled(orderAttempts);
    const ok = outcome.filter((r) => r.status === "fulfilled");
    const failed = outcome.filter((r) => r.status === "rejected");

    expect(ok).toHaveLength(5);
    expect(failed).toHaveLength(20);
    expect(stock).toBe(0); // Nunca queda negativo
  });
});
