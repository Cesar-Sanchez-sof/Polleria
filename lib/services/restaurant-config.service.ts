import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { isValidVoucherSeries } from "@/lib/utils/series-validation";
import { uploadYapeQrToS3 } from "@/lib/services/s3-storage.service";
import { logAudit } from "@/lib/services/audit.service";

export interface RestaurantInfo {
  name: string;
  commercialName: string;
  ruc: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  ticketFooter: string;
  currency: string;
  logoUrl?: string;
  yapePhone?: string;
  yapeName?: string;
  yapeQrImageUrl?: string;
}

export interface DiningArea {
  id: string;
  name: string;
  level: string;
  description: string;
  tableNumbers: number[];
  active: boolean;
  color?: string;
}

export interface PrinterDevice {
  name: string;
  ipOrPort: string;
  active: boolean;
  autoPrintOnOrder?: boolean;
}

export interface PrinterConfig {
  paperWidth: "80mm" | "58mm";
  autoCut: boolean;
  autoPrintVoucher: boolean;
  printWaiterCopy: boolean;
  series: {
    boleta: string;
    factura: string;
    ticket: string;
  };
  kitchenPrinter: PrinterDevice;
  barPrinter: PrinterDevice;
  cashierPrinter: PrinterDevice;
}

export interface RestaurantGlobalConfig {
  restaurant: RestaurantInfo;
  areas: DiningArea[];
  printers: PrinterConfig;
}

export const DEFAULT_CONFIG: RestaurantGlobalConfig = {
  restaurant: {
    name: "POLLERÍA & BRASAS EL BUEN SABOR S.A.C.",
    commercialName: "El Buen Sabor a la Brasa",
    ruc: "20608976543",
    address: "Av. Los Héroes 456, San Juan de Miraflores",
    city: "Lima, Perú",
    phone: "+51 987 654 321",
    email: "contacto@elbuensabor.pe",
    ticketFooter: "¡Gracias por su visita! Pollería & Brasas les desea un excelente día. Para comprobante electrónico visite www.elbuensabor.pe",
    currency: "S/ PEN",
    logoUrl: "",
    yapePhone: "954316272",
    yapeName: "El Buen Sabor a la Brasa",
    yapeQrImageUrl: "",
  },
  areas: [
    {
      id: "area-1",
      name: "Salón Principal",
      level: "Piso 1",
      description: "Salón central climatizado, cerca a caja y recepción.",
      tableNumbers: [1, 2, 3, 4, 5, 6],
      active: true,
      color: "emerald",
    },
    {
      id: "area-2",
      name: "Terraza",
      level: "Piso 1 (Exterior)",
      description: "Área abierta al aire libre con vista a la avenida.",
      tableNumbers: [7, 8, 9],
      active: true,
      color: "amber",
    },
    {
      id: "area-3",
      name: "Segundo Piso (Familiar)",
      level: "Piso 2",
      description: "Ambiente espacioso para grupos grandes y familias.",
      tableNumbers: [10, 11, 12],
      active: true,
      color: "blue",
    },
    {
      id: "area-4",
      name: "Barra & Lounge",
      level: "Piso 1",
      description: "Mesas altas y atención rápida de bebidas y piqueos.",
      tableNumbers: [],
      active: false,
      color: "purple",
    },
  ],
  printers: {
    paperWidth: "80mm",
    autoCut: true,
    autoPrintVoucher: true,
    printWaiterCopy: false,
    series: {
      boleta: "B001",
      factura: "F001",
      ticket: "T001",
    },
    kitchenPrinter: {
      name: "Comandera Cocina (Epson TM-T20III)",
      ipOrPort: "192.168.1.200:9100",
      active: true,
      autoPrintOnOrder: true,
    },
    barPrinter: {
      name: "Comandera Bar / Bebidas",
      ipOrPort: "192.168.1.201:9100",
      active: false,
      autoPrintOnOrder: false,
    },
    cashierPrinter: {
      name: "Impresora Térmica Caja 80mm",
      ipOrPort: "USB001 / Local",
      active: true,
    },
  },
};

const CONFIG_FILE_PATH = path.join(process.cwd(), "data", "restaurant-config.json");

function mapDbToRestaurantInfo(record: any): RestaurantInfo {
  return {
    name: record.name,
    commercialName: record.commercialName,
    ruc: record.ruc,
    address: record.address,
    city: record.city,
    phone: record.phone,
    email: record.email,
    ticketFooter: record.ticketFooter,
    currency: record.currency || "S/ PEN",
    logoUrl: record.logoUrl ?? "",
    yapePhone: record.yapePhone ?? "",
    yapeName: record.yapeName ?? "",
    yapeQrImageUrl: record.yapeQrImageUrl ?? "",
  };
}

let inMemoryRestaurantCache: RestaurantInfo = { ...DEFAULT_CONFIG.restaurant };

/**
 * Lee la identidad comercial y fiscal del restaurante directamente desde JSON o defaults (fallback estático).
 */
export function getJsonConfigRestaurantInfo(): RestaurantInfo {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.restaurant) {
        return { ...DEFAULT_CONFIG.restaurant, ...parsed.restaurant };
      }
    }
  } catch (error) {
    console.warn("[restaurant-config] Error al leer información del restaurante desde JSON:", error);
  }
  return DEFAULT_CONFIG.restaurant;
}

/**
 * Helper para hacer que una promesa también exponga propiedades síncronas de lectura inmediata,
 * manteniendo compatibilidad tanto con código que use `await getRestaurantInfo()` como llamadas directas `getRestaurantInfo().ruc`.
 */
function makeThenable<T extends object>(syncFallback: T, promise: Promise<T>): Promise<T> & T {
  return Object.assign(promise, syncFallback) as Promise<T> & T;
}

/**
 * Lee la identidad comercial y fiscal del restaurante desde PostgreSQL con Prisma ORM.
 * Si la tabla aún no tiene datos, ejecuta la migración/inicialización idempotente desde el archivo JSON actual.
 */
export function getRestaurantInfo(): Promise<RestaurantInfo> & RestaurantInfo {
  const asyncPromise = (async (): Promise<RestaurantInfo> => {
    try {
      const record = await prisma.restaurantConfig.findUnique({
        where: { id: "default" },
      });

      if (!record) {
        // Inicialización idempotente desde el JSON existente
        const fromJson = getJsonConfigRestaurantInfo();
        let qrUrl = fromJson.yapeQrImageUrl || "";
        if (qrUrl.startsWith("data:")) {
          try {
            const uploadRes = await uploadYapeQrToS3({ imageBase64: qrUrl });
            qrUrl = uploadRes.publicUrl;
          } catch {
            qrUrl = "";
          }
        }

        try {
          const created = await prisma.restaurantConfig.create({
            data: {
              id: "default",
              name: fromJson.name,
              commercialName: fromJson.commercialName,
              ruc: fromJson.ruc,
              address: fromJson.address,
              city: fromJson.city,
              phone: fromJson.phone,
              email: fromJson.email,
              ticketFooter: fromJson.ticketFooter,
              currency: fromJson.currency || "S/ PEN",
              logoUrl: fromJson.logoUrl || null,
              yapePhone: fromJson.yapePhone || null,
              yapeName: fromJson.yapeName || null,
              yapeQrImageUrl: qrUrl || null,
            },
          });
          const mapped = mapDbToRestaurantInfo(created);
          inMemoryRestaurantCache = { ...mapped };
          return mapped;
        } catch {
          // Fallback por concurrencia si otro proceso lo creó simultáneamente
          const existing = await prisma.restaurantConfig.findUnique({
            where: { id: "default" },
          }).catch(() => null);
          if (existing) {
            const mapped = mapDbToRestaurantInfo(existing);
            inMemoryRestaurantCache = { ...mapped };
            return mapped;
          }
        }
      } else {
        const mapped = mapDbToRestaurantInfo(record);
        inMemoryRestaurantCache = { ...mapped };
        return mapped;
      }
    } catch (error) {
      console.warn("[restaurant-config] Error al consultar restaurantConfig en Prisma, usando caché:", error);
    }
    return inMemoryRestaurantCache;
  })();

  return makeThenable(inMemoryRestaurantCache, asyncPromise);
}

/**
 * Actualiza los datos del restaurante e identidad fiscal en PostgreSQL mediante Prisma ORM.
 * Sube el QR de Yape a S3 si se envía en base64 y registra la auditoría del cambio.
 */
export function updateRestaurantInfo(
  info: Partial<RestaurantInfo>,
  options?: {
    actor?: { userId: number | null; username: string } | null;
    ipAddress?: string | null;
  }
): Promise<RestaurantInfo> & RestaurantInfo {
  // Pre-actualizar caché local para retorno síncrono inmediato si no se usa await
  const safePreCache = { ...info };
  if (safePreCache.yapeQrImageUrl?.startsWith("data:")) {
    delete safePreCache.yapeQrImageUrl;
  }
  inMemoryRestaurantCache = { ...inMemoryRestaurantCache, ...safePreCache };

  const asyncPromise = (async (): Promise<RestaurantInfo> => {
    let finalQrUrl = info.yapeQrImageUrl;
    if (finalQrUrl && finalQrUrl.startsWith("data:")) {
      try {
        const uploadRes = await uploadYapeQrToS3({ imageBase64: finalQrUrl });
        finalQrUrl = uploadRes.publicUrl;
      } catch (err) {
        console.warn("[restaurant-config] Error al subir QR a S3:", err);
      }
    }

    // Salvaguarda: NUNCA permitir que un string base64 alcance Prisma (excede VARCHAR(500))
    if (finalQrUrl && finalQrUrl.startsWith("data:")) {
      finalQrUrl = inMemoryRestaurantCache.yapeQrImageUrl || "";
    }

    const current = await getRestaurantInfo();

    // Si se reenvía una presigned URL temporal (firmas AWS), conservar la URL canónica existente
    if (finalQrUrl && (finalQrUrl.includes("X-Amz-Signature") || finalQrUrl.includes("X-Amz-Credential")) && current.yapeQrImageUrl) {
      finalQrUrl = current.yapeQrImageUrl;
    }
    const updatedData: RestaurantInfo = {
      ...current,
      ...info,
      ...(finalQrUrl !== undefined && { yapeQrImageUrl: finalQrUrl }),
    };

    try {
      const record = await prisma.restaurantConfig.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          name: updatedData.name,
          commercialName: updatedData.commercialName,
          ruc: updatedData.ruc,
          address: updatedData.address,
          city: updatedData.city,
          phone: updatedData.phone,
          email: updatedData.email,
          ticketFooter: updatedData.ticketFooter,
          currency: updatedData.currency || "S/ PEN",
          logoUrl: updatedData.logoUrl || null,
          yapePhone: updatedData.yapePhone || null,
          yapeName: updatedData.yapeName || null,
          yapeQrImageUrl: updatedData.yapeQrImageUrl || null,
        },
        update: {
          ...(info.name !== undefined && { name: info.name }),
          ...(info.commercialName !== undefined && { commercialName: info.commercialName }),
          ...(info.ruc !== undefined && { ruc: info.ruc }),
          ...(info.address !== undefined && { address: info.address }),
          ...(info.city !== undefined && { city: info.city }),
          ...(info.phone !== undefined && { phone: info.phone }),
          ...(info.email !== undefined && { email: info.email }),
          ...(info.ticketFooter !== undefined && { ticketFooter: info.ticketFooter }),
          ...(info.currency !== undefined && { currency: info.currency }),
          ...(info.logoUrl !== undefined && { logoUrl: info.logoUrl || null }),
          ...(info.yapePhone !== undefined && { yapePhone: info.yapePhone || null }),
          ...(info.yapeName !== undefined && { yapeName: info.yapeName || null }),
          ...(finalQrUrl !== undefined && { yapeQrImageUrl: finalQrUrl || null }),
        },
      });

      const mapped = mapDbToRestaurantInfo(record);
      inMemoryRestaurantCache = { ...mapped };

      // Criterio 5: Cada cambio de configuración genera un registro de auditoría
      try {
        await logAudit({
          actor: options?.actor ?? null,
          action: "UPDATE",
          module: "Configuracion",
          entity: "RestaurantConfig",
          entityId: "default",
          description: `Actualización de identidad y datos del restaurante (${mapped.commercialName})`,
          details: {
            changedFields: Object.keys(info),
            ruc: mapped.ruc,
            commercialName: mapped.commercialName,
          },
          ipAddress: options?.ipAddress ?? null,
        });
      } catch (auditErr) {
        console.warn("[restaurant-config] Aviso al registrar auditoría:", auditErr);
      }

      // Mantener respaldo local en data/restaurant-config.json (sin base64 gigante)
      try {
        const dir = path.dirname(CONFIG_FILE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let existingData: any = {};
        if (fs.existsSync(CONFIG_FILE_PATH)) {
          existingData = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf-8"));
        }
        existingData.restaurant = mapped;
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(existingData, null, 2), "utf-8");
      } catch {
        // En entornos de solo lectura (como Vercel Serverless), esto no afectará la operación
      }

      return mapped;
    } catch (error) {
      console.error("[restaurant-config] Error al actualizar restaurantConfig en Prisma:", error);
      throw error;
    }
  })();

  return makeThenable(inMemoryRestaurantCache, asyncPromise);
}

/**
 * Criterio 4: Migración de datos idempotente desde el JSON actual hacia PostgreSQL.
 */
export async function migrateRestaurantConfigFromJson(): Promise<{
  success: boolean;
  migrated: boolean;
  restaurant: RestaurantInfo;
}> {
  try {
    const existing = await prisma.restaurantConfig.findUnique({
      where: { id: "default" },
    });

    if (existing) {
      const mapped = mapDbToRestaurantInfo(existing);
      inMemoryRestaurantCache = { ...mapped };
      return { success: true, migrated: false, restaurant: mapped };
    }

    const fromJson = getJsonConfigRestaurantInfo();
    let qrUrl = fromJson.yapeQrImageUrl || "";
    if (qrUrl.startsWith("data:")) {
      try {
        const uploadRes = await uploadYapeQrToS3({ imageBase64: qrUrl });
        qrUrl = uploadRes.publicUrl;
      } catch {
        qrUrl = "";
      }
    }

    const created = await prisma.restaurantConfig.create({
      data: {
        id: "default",
        name: fromJson.name,
        commercialName: fromJson.commercialName,
        ruc: fromJson.ruc,
        address: fromJson.address,
        city: fromJson.city,
        phone: fromJson.phone,
        email: fromJson.email,
        ticketFooter: fromJson.ticketFooter,
        currency: fromJson.currency || "S/ PEN",
        logoUrl: fromJson.logoUrl || null,
        yapePhone: fromJson.yapePhone || null,
        yapeName: fromJson.yapeName || null,
        yapeQrImageUrl: qrUrl || null,
      },
    });

    const mapped = mapDbToRestaurantInfo(created);
    inMemoryRestaurantCache = { ...mapped };
    return { success: true, migrated: true, restaurant: mapped };
  } catch (error) {
    console.error("[restaurant-config] Error en migración idempotente desde JSON:", error);
    throw error;
  }
}

// =====================================================================
// PERSISTENCIA EN BD CON PRISMA: SALONES Y ÁREAS
// =====================================================================

function mapDbToDiningArea(record: any): DiningArea {
  return {
    id: record.id,
    name: record.name,
    level: record.level || "Piso 1",
    description: record.description ?? "",
    tableNumbers: Array.isArray(record.tableNumbers) ? record.tableNumbers : [],
    active: Boolean(record.active),
    color: record.color ?? undefined,
  };
}

/**
 * Lista todos los salones y áreas configuradas desde la base de datos con Prisma.
 * Si la tabla está vacía, la inicializa con los salones por defecto.
 */
export async function listDiningAreas(): Promise<DiningArea[]> {
  try {
    const areas = await prisma.diningArea.findMany({
      orderBy: { createdAt: "asc" },
    });

    if (areas.length === 0) {
      try {
        await prisma.diningArea.createMany({
          data: DEFAULT_CONFIG.areas.map((a) => ({
            id: a.id,
            name: a.name,
            level: a.level,
            description: a.description,
            tableNumbers: a.tableNumbers,
            active: a.active,
            color: a.color || "emerald",
          })),
          skipDuplicates: true,
        });

        const seeded = await prisma.diningArea.findMany({
          orderBy: { createdAt: "asc" },
        });

        if (seeded.length > 0) {
          return seeded.map(mapDbToDiningArea);
        }
      } catch {
        return DEFAULT_CONFIG.areas;
      }
    }

    return areas.map(mapDbToDiningArea);
  } catch (error) {
    console.warn("[restaurant-config] Error al consultar salones en Prisma, usando defaults:", error);
    return DEFAULT_CONFIG.areas;
  }
}

/**
 * Crea o actualiza un salón en la base de datos con Prisma.
 * Retorna la lista completa y actualizada de salones.
 */
export async function saveDiningArea(area: DiningArea): Promise<DiningArea[]> {
  const targetId = area.id?.trim() || `area-${Date.now()}`;
  try {
    await prisma.diningArea.upsert({
      where: { id: targetId },
      create: {
        id: targetId,
        name: area.name,
        level: area.level || "Piso 1",
        description: area.description || "",
        tableNumbers: Array.isArray(area.tableNumbers) ? area.tableNumbers : [],
        active: area.active !== false,
        color: area.color || "emerald",
      },
      update: {
        ...(area.name !== undefined && { name: area.name }),
        ...(area.level !== undefined && { level: area.level }),
        ...(area.description !== undefined && { description: area.description }),
        ...(area.tableNumbers !== undefined && { tableNumbers: area.tableNumbers }),
        ...(area.active !== undefined && { active: area.active }),
        ...(area.color !== undefined && { color: area.color }),
      },
    });
  } catch (error) {
    console.error("[restaurant-config] Error al guardar salón en Prisma:", error);
    throw error;
  }

  return listDiningAreas();
}

/**
 * Elimina un salón de la base de datos con Prisma.
 * Retorna la lista actualizada de salones restantes.
 */
export async function deleteDiningArea(areaId: string): Promise<DiningArea[]> {
  try {
    await prisma.diningArea
      .delete({
        where: { id: areaId },
      })
      .catch(() => null);
  } catch (error) {
    console.error("[restaurant-config] Error al eliminar salón en Prisma:", error);
    throw error;
  }

  return listDiningAreas();
}

// =====================================================================
// PERSISTENCIA EN BD CON PRISMA: IMPRESORAS Y COMPROBANTES
// =====================================================================

function mapDbToPrinterConfig(record: any): PrinterConfig {
  return {
    paperWidth: record.paperWidth === "58mm" ? "58mm" : "80mm",
    autoCut: Boolean(record.autoCut),
    autoPrintVoucher: Boolean(record.autoPrintVoucher),
    printWaiterCopy: Boolean(record.printWaiterCopy),
    series: typeof record.series === "string" ? JSON.parse(record.series) : (record.series || DEFAULT_CONFIG.printers.series),
    kitchenPrinter:
      typeof record.kitchenPrinter === "string"
        ? JSON.parse(record.kitchenPrinter)
        : (record.kitchenPrinter || DEFAULT_CONFIG.printers.kitchenPrinter),
    barPrinter:
      typeof record.barPrinter === "string"
        ? JSON.parse(record.barPrinter)
        : (record.barPrinter || DEFAULT_CONFIG.printers.barPrinter),
    cashierPrinter:
      typeof record.cashierPrinter === "string"
        ? JSON.parse(record.cashierPrinter)
        : (record.cashierPrinter || DEFAULT_CONFIG.printers.cashierPrinter),
  };
}

/**
 * Obtiene la configuración de impresoras y comprobantes desde Prisma en la BD.
 * Si no existe, inicializa con la configuración predeterminada.
 */
export async function getPrinterConfig(): Promise<PrinterConfig> {
  try {
    const record = await prisma.printerConfig.findUnique({
      where: { id: "default" },
    });

    if (!record) {
      try {
        const created = await prisma.printerConfig.create({
          data: {
            id: "default",
            paperWidth: DEFAULT_CONFIG.printers.paperWidth,
            autoCut: DEFAULT_CONFIG.printers.autoCut,
            autoPrintVoucher: DEFAULT_CONFIG.printers.autoPrintVoucher,
            printWaiterCopy: DEFAULT_CONFIG.printers.printWaiterCopy,
            series: DEFAULT_CONFIG.printers.series as any,
            kitchenPrinter: DEFAULT_CONFIG.printers.kitchenPrinter as any,
            barPrinter: DEFAULT_CONFIG.printers.barPrinter as any,
            cashierPrinter: DEFAULT_CONFIG.printers.cashierPrinter as any,
          },
        });
        return mapDbToPrinterConfig(created);
      } catch {
        return DEFAULT_CONFIG.printers;
      }
    }

    return mapDbToPrinterConfig(record);
  } catch (error) {
    console.warn("[restaurant-config] Error al leer configuración de impresoras en Prisma:", error);
    return DEFAULT_CONFIG.printers;
  }
}

/**
 * Actualiza los parámetros de impresoras y comprobantes en la base de datos con Prisma.
 */
export async function updatePrinterConfig(printers: Partial<PrinterConfig>): Promise<PrinterConfig> {
  if (printers.series) {
    if (printers.series.boleta !== undefined && !isValidVoucherSeries(printers.series.boleta, "Boleta")) {
      throw new Error(`Serie de boleta inválida (${printers.series.boleta}). Debe tener formato B### (ej. B001, B002).`);
    }
    if (printers.series.factura !== undefined && !isValidVoucherSeries(printers.series.factura, "Factura")) {
      throw new Error(`Serie de factura inválida (${printers.series.factura}). Debe tener formato F### (ej. F001, F002).`);
    }
  }
  const current = await getPrinterConfig();
  const updated: PrinterConfig = {
    ...current,
    ...printers,
    series: { ...current.series, ...(printers.series || {}) },
    kitchenPrinter: { ...current.kitchenPrinter, ...(printers.kitchenPrinter || {}) },
    barPrinter: { ...current.barPrinter, ...(printers.barPrinter || {}) },
    cashierPrinter: { ...current.cashierPrinter, ...(printers.cashierPrinter || {}) },
  };

  try {
    const record = await prisma.printerConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        paperWidth: updated.paperWidth,
        autoCut: updated.autoCut,
        autoPrintVoucher: updated.autoPrintVoucher,
        printWaiterCopy: updated.printWaiterCopy,
        series: updated.series as any,
        kitchenPrinter: updated.kitchenPrinter as any,
        barPrinter: updated.barPrinter as any,
        cashierPrinter: updated.cashierPrinter as any,
      },
      update: {
        paperWidth: updated.paperWidth,
        autoCut: updated.autoCut,
        autoPrintVoucher: updated.autoPrintVoucher,
        printWaiterCopy: updated.printWaiterCopy,
        series: updated.series as any,
        kitchenPrinter: updated.kitchenPrinter as any,
        barPrinter: updated.barPrinter as any,
        cashierPrinter: updated.cashierPrinter as any,
      },
    });

    return mapDbToPrinterConfig(record);
  } catch (error) {
    console.error("[restaurant-config] Error al actualizar impresoras en Prisma:", error);
    throw error;
  }
}

// =====================================================================
// CONFIGURACIÓN GLOBAL AGREGADA
// =====================================================================

/**
 * Obtiene la configuración consolidada (restaurante, salones e impresoras).
 */
export async function getRestaurantGlobalConfig(): Promise<RestaurantGlobalConfig> {
  const [areas, printers, restaurant] = await Promise.all([
    listDiningAreas(),
    getPrinterConfig(),
    getRestaurantInfo(),
  ]);

  return {
    restaurant,
    areas,
    printers,
  };
}

/**
 * Versión síncrona de fallback para contextos que no soportan async.
 */
export function getRestaurantGlobalConfigSync(): RestaurantGlobalConfig {
  return {
    restaurant: getRestaurantInfo(),
    areas: DEFAULT_CONFIG.areas,
    printers: DEFAULT_CONFIG.printers,
  };
}
