import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { developerSetting: { findMany: m.findMany, findUnique: m.findUnique, upsert: m.upsert } },
}));
vi.mock("@/lib/services/security/audit.service", () => ({ logAudit: m.logAudit }));

import { ALL_FLAGS_OFF, DEVELOPER_SETTING_KEYS, DEVELOPER_SETTINGS, isDeveloperSettingKey } from "@/lib/developer-settings/catalog";
import {
  clearDeveloperFlagsCache,
  FLAGS_TTL_MS,
  getDeveloperFlags,
  listDeveloperSettings,
  setDeveloperSetting,
} from "@/lib/services/settings/developer-settings.service";

beforeEach(() => {
  vi.clearAllMocks();
  clearDeveloperFlagsCache();
  m.findMany.mockResolvedValue([]);
  m.findUnique.mockResolvedValue(null);
  m.upsert.mockResolvedValue({});
  m.logAudit.mockResolvedValue(undefined);
});

describe("catálogo de interruptores", () => {
  it("tiene claves únicas y cortas, y todo apagado por defecto", () => {
    expect(new Set(DEVELOPER_SETTING_KEYS).size).toBe(DEVELOPER_SETTING_KEYS.length);
    expect(DEVELOPER_SETTING_KEYS.every((key) => key.length <= 60)).toBe(true);
    expect(Object.values(ALL_FLAGS_OFF).every((value) => value === false)).toBe(true);
    expect(Object.keys(ALL_FLAGS_OFF).sort()).toEqual([...DEVELOPER_SETTING_KEYS].sort());
  });

  it("marca como sensibles las barreras de seguridad y la salida de audio a un tercero", () => {
    const sensitive = DEVELOPER_SETTINGS.filter((s) => "sensitive" in s && s.sensitive).map((s) => s.key);
    expect(sensitive).toEqual(
      expect.arrayContaining(["assistant.eval", "assistant.allow_production_eval", "assistant.real_data", "assistant.diagnostics", "assistant.voice"]),
    );
  });

  it("solo reconoce claves del catálogo", () => {
    expect(isDeveloperSettingKey("assistant.voice")).toBe(true);
    for (const value of ["", "AI_ASSISTANT_VOICE", "assistant.nueva", undefined, null, 1]) {
      expect(isDeveloperSettingKey(value)).toBe(false);
    }
  });
});

describe("getDeveloperFlags", () => {
  it("una bandera sin fila está apagada; las filas encendidas se reflejan", async () => {
    m.findMany.mockResolvedValue([
      { key: "assistant.voice", enabled: true },
      { key: "assistant.demo", enabled: false },
      { key: "clave.desconocida", enabled: true },
    ]);
    const flags = await getDeveloperFlags();
    expect(flags["assistant.voice"]).toBe(true);
    expect(flags["assistant.demo"]).toBe(false);
    expect(flags["assistant.real_data"]).toBe(false);
    expect(Object.keys(flags).sort()).toEqual([...DEVELOPER_SETTING_KEYS].sort());
  });

  it("cachea unos segundos y vuelve a leer al vencer", async () => {
    const t = 1_000;
    await getDeveloperFlags(() => t);
    await getDeveloperFlags(() => t + FLAGS_TTL_MS - 1);
    expect(m.findMany).toHaveBeenCalledTimes(1);
    await getDeveloperFlags(() => t + FLAGS_TTL_MS + 1);
    expect(m.findMany).toHaveBeenCalledTimes(2);
  });

  it("falla cerrado: si la base falla, todo queda apagado y no se cachea el error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.findMany.mockRejectedValueOnce(new Error("db caída"));
    expect(await getDeveloperFlags()).toEqual(ALL_FLAGS_OFF);
    m.findMany.mockResolvedValueOnce([{ key: "assistant.voice", enabled: true }]);
    expect((await getDeveloperFlags())["assistant.voice"]).toBe(true);
    warn.mockRestore();
  });
});

describe("setDeveloperSetting", () => {
  it("guarda el estado con quien lo cambió, invalida el caché y audita antes/después", async () => {
    m.findUnique.mockResolvedValue({ enabled: false });
    await getDeveloperFlags();
    m.findMany.mockResolvedValue([{ key: "assistant.voice", enabled: true, updatedBy: "andy", updatedAt: new Date() }]);

    await setDeveloperSetting("assistant.voice", true, { actor: { userId: 3, username: "andy" }, ipAddress: "10.0.0.1" });

    expect(m.upsert).toHaveBeenCalledWith({
      where: { key: "assistant.voice" },
      create: { key: "assistant.voice", enabled: true, updatedBy: "andy" },
      update: { enabled: true, updatedBy: "andy" },
    });
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        module: "Configuracion",
        entity: "DeveloperSetting",
        entityId: "assistant.voice",
        details: { antes: false, despues: true },
        ipAddress: "10.0.0.1",
      }),
    );
    expect((await getDeveloperFlags())["assistant.voice"]).toBe(true); // el caché se invalidó
  });

  it("un fallo de auditoría no deshace el cambio", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.logAudit.mockRejectedValueOnce(new Error("auditoría caída"));
    await expect(setDeveloperSetting("assistant.demo", true, { actor: null })).resolves.toBeDefined();
    expect(m.upsert).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("listDeveloperSettings", () => {
  it("lista todo el catálogo, con las filas guardadas aplicadas", async () => {
    const updatedAt = new Date("2026-11-02T15:00:00Z");
    m.findMany.mockResolvedValue([{ key: "assistant.voice", enabled: true, updatedBy: "andy", updatedAt }]);
    const list = await listDeveloperSettings();
    expect(list.map((s) => s.key)).toEqual([...DEVELOPER_SETTING_KEYS]);
    expect(list.find((s) => s.key === "assistant.voice")).toMatchObject({
      enabled: true, sensitive: true, updatedBy: "andy", updatedAt: updatedAt.toISOString(),
    });
    expect(list.find((s) => s.key === "assistant.demo")).toMatchObject({ enabled: false, updatedBy: null, updatedAt: null });
  });
});
