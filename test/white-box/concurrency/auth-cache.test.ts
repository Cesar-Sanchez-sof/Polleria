import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolveWithAuthCache,
  primeAuthCache,
  invalidateAuthCache,
} from "@/lib/auth/auth-cache";

describe("Auth Cache y Singleflight para alta concurrencia HTTP", () => {
  beforeEach(() => {
    invalidateAuthCache();
  });

  it("deduplica 50 llamadas concurrentes para el mismo userId (singleflight) y luego responde desde caché", async () => {
    let dbQueries = 0;
    const loader = vi.fn(async () => {
      dbQueries++;
      await new Promise((r) => setTimeout(r, 15));
      return { superuser: true, codes: ["ventas.ver"] };
    });

    const wave1 = await Promise.all(
      Array.from({ length: 50 }, () =>
        resolveWithAuthCache("permissions", 7, loader, { forceEnable: true, ttlMs: 5_000 })
      )
    );

    expect(dbQueries).toBe(1);
    expect(wave1).toHaveLength(50);
    expect(wave1.every((item) => item.superuser)).toBe(true);

    // Segunda ráfaga dentro del TTL: 0 consultas a BD
    const wave2 = await Promise.all(
      Array.from({ length: 50 }, () =>
        resolveWithAuthCache("permissions", 7, loader, { forceEnable: true, ttlMs: 5_000 })
      )
    );
    expect(dbQueries).toBe(1);
    expect(wave2).toHaveLength(50);
  });

  it("invalida de inmediato por userId o globalmente cuando cambia un usuario o rol", async () => {
    let activeFlag = true;
    const loader = vi.fn(async () => activeFlag);

    expect(
      await resolveWithAuthCache("activeUser", 10, loader, { forceEnable: true, ttlMs: 10_000 })
    ).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);

    // Al desactivar usuario e invalidar, la lectura siguiente consulta inmediatamente la BD
    activeFlag = false;
    invalidateAuthCache(10);

    expect(
      await resolveWithAuthCache("activeUser", 10, loader, { forceEnable: true, ttlMs: 10_000 })
    ).toBe(false);
    expect(loader).toHaveBeenCalledTimes(2);

    // Hidratación directa e invalidación global (cambio de rol)
    primeAuthCache("activeUser", 11, true, { forceEnable: true, ttlMs: 10_000 });
    expect(
      await resolveWithAuthCache("activeUser", 11, async () => false, { forceEnable: true, ttlMs: 10_000 })
    ).toBe(true);

    invalidateAuthCache();
    expect(
      await resolveWithAuthCache("activeUser", 11, async () => false, { forceEnable: true, ttlMs: 10_000 })
    ).toBe(false);
  });

  it("vuelve a consultar al expirar el TTL corto", async () => {
    let calls = 0;
    const loader = async () => ++calls;

    expect(await resolveWithAuthCache("activeUser", 99, loader, { forceEnable: true, ttlMs: 25 })).toBe(1);
    await new Promise((r) => setTimeout(r, 40));
    expect(await resolveWithAuthCache("activeUser", 99, loader, { forceEnable: true, ttlMs: 25 })).toBe(2);
  });
});
