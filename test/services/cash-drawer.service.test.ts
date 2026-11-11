import net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getPrinterConfig: vi.fn() }));
vi.mock("@/lib/services/settings/restaurant-config.service", () => ({ getPrinterConfig: m.getPrinterConfig }));

import {
  buildDrawerPayload,
  clearDrawerEvents,
  drawerPulseCommand,
  notifyCashDrawer,
  parseDevice,
  recentDrawerEvents,
  ticketLines,
  toPrinterText,
  type DrawerTicketInfo,
} from "@/lib/services/integrations/cash-drawer.service";

const info: DrawerTicketInfo = {
  registerName: "Caja Principal - Salón",
  sessionId: 12,
  cashier: "andy",
  at: new Date("2026-11-11T15:30:00.000Z"), // 10:30 Lima
  initialAmount: 150,
};

beforeEach(() => {
  delete process.env.CASH_DRAWER_MODE;
  delete process.env.CASH_DRAWER_HOST;
  delete process.env.CASH_DRAWER_PORT;
  clearDrawerEvents();
  m.getPrinterConfig.mockResolvedValue({ paperWidth: "80mm", cashierPrinter: { name: "Caja", ipOrPort: "USB001 / Local", active: true } });
});
afterEach(() => vi.restoreAllMocks());

describe("ESC/POS", () => {
  it("el pulso de gaveta es ESC p 0 25 250", () => {
    expect([...drawerPulseCommand()]).toEqual([0x1b, 0x70, 0, 25, 250]);
  });

  it("el payload inicia la impresora, pulsa la gaveta y corta el papel", () => {
    const bytes = buildDrawerPayload("OPEN_SESSION", info);
    expect([...bytes.subarray(0, 2)]).toEqual([0x1b, 0x40]); // ESC @
    expect([...bytes.subarray(2, 7)]).toEqual([0x1b, 0x70, 0, 25, 250]);
    expect([...bytes.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]); // GS V B 0
  });

  it("quita tildes para la página de códigos de la impresora", () => {
    expect(toPrinterText("Salón – Cajón")).toBe("Salon ? Cajon");
  });

  it("el ticket de cierre indica FALTANTE o SOBRANTE", () => {
    const base = { ...info, initialAmount: 100, salesCash: 500, incomes: 0, expenses: 50, expectedAmount: 550, countedAmount: 540 };
    expect(ticketLines("CLOSE_SESSION", { ...base, difference: -10 }).join("\n")).toMatch(/FALTANTE:\s+S\/ 10\.00/);
    expect(ticketLines("CLOSE_SESSION", { ...base, countedAmount: 560, difference: 10 }).join("\n")).toMatch(/SOBRANTE:\s+S\/ 10\.00/);
    expect(ticketLines("OPEN_SESSION", info).join("\n")).toMatch(/11\/11\/2026.*10:30/);
    expect(ticketLines("OPEN_SESSION", info).join("\n")).toMatch(/Fondo inicial:\s+S\/ 150\.00/);
  });
});

describe("configuración del dispositivo", () => {
  it("reconoce IP con o sin puerto y descarta puertos USB/locales", () => {
    expect(parseDevice("192.168.1.50")).toEqual({ host: "192.168.1.50", port: 9100 });
    expect(parseDevice("192.168.1.50:9101")).toEqual({ host: "192.168.1.50", port: 9101 });
    expect(parseDevice("caja.local:9100")).toEqual({ host: "caja.local", port: 9100 });
    expect(parseDevice("USB001 / Local")).toBeNull();
    expect(parseDevice("COM3")).toBeNull();
  });
});

describe("notifyCashDrawer", () => {
  it("modo simulado por defecto: devuelve el ticket y lo guarda en la bitácora", async () => {
    const r = await notifyCashDrawer("OPEN_SESSION", info);
    expect(r).toMatchObject({ ok: true, mode: "simulated", event: "OPEN_SESSION" });
    expect(r.ticket).toContain("APERTURA DE CAJA");
    expect(recentDrawerEvents()).toHaveLength(1);
  });

  it("CASH_DRAWER_MODE=off no hace nada", async () => {
    process.env.CASH_DRAWER_MODE = "off";
    const r = await notifyCashDrawer("CLOSE_SESSION", info);
    expect(r.mode).toBe("off");
    expect(recentDrawerEvents()).toHaveLength(0);
  });

  it("modo red: envía los bytes ESC/POS por TCP a la impresora", async () => {
    const received: Buffer[] = [];
    const server = net.createServer((s) => s.on("data", (d) => received.push(d)));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as net.AddressInfo;
    m.getPrinterConfig.mockResolvedValue({ paperWidth: "80mm", cashierPrinter: { name: "Caja", ipOrPort: `127.0.0.1:${port}`, active: true } });
    try {
      const r = await notifyCashDrawer("OPEN_SESSION", info);
      expect(r).toMatchObject({ ok: true, mode: "network", target: `127.0.0.1:${port}` });
      await vi.waitFor(() => expect(Buffer.concat(received).length).toBeGreaterThan(0));
      const data = Buffer.concat(received);
      expect([...data.subarray(2, 7)]).toEqual([0x1b, 0x70, 0, 25, 250]);
      expect(data.toString("latin1")).toContain("APERTURA DE CAJA");
    } finally {
      server.close();
    }
  });

  it("si la impresora no responde no lanza y avisa que se abra con la llave", async () => {
    const closed = net.createServer();
    await new Promise<void>((r) => closed.listen(0, "127.0.0.1", r));
    const { port } = closed.address() as net.AddressInfo;
    await new Promise((r) => closed.close(r)); // puerto sin nadie escuchando
    m.getPrinterConfig.mockResolvedValue({ paperWidth: "80mm", cashierPrinter: { name: "Caja", ipOrPort: `127.0.0.1:${port}`, active: true } });
    const r = await notifyCashDrawer("CLOSE_SESSION", info);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/llave/);
  });
});
