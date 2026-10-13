import fs from "fs";
import path from "path";

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

const DEFAULT_CONFIG: RestaurantGlobalConfig = {
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

/**
 * Obtiene la configuración global desde disco con fallback a los valores por defecto.
 */
export function getRestaurantGlobalConfig(): RestaurantGlobalConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      saveRestaurantGlobalConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      restaurant: { ...DEFAULT_CONFIG.restaurant, ...(parsed.restaurant || {}) },
      areas: Array.isArray(parsed.areas) && parsed.areas.length > 0 ? parsed.areas : DEFAULT_CONFIG.areas,
      printers: { ...DEFAULT_CONFIG.printers, ...(parsed.printers || {}) },
    };
  } catch (error) {
    console.warn("[restaurant-config] Error al leer configuración, usando defaults:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Guarda la configuración global en disco de manera segura.
 */
export function saveRestaurantGlobalConfig(config: RestaurantGlobalConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    console.error("[restaurant-config] Error al guardar configuración en disco:", error);
    throw new Error("No se pudo persistir la configuración en disco.");
  }
}

/**
 * Actualiza los datos del restaurante.
 */
export function updateRestaurantInfo(info: Partial<RestaurantInfo>): RestaurantInfo {
  const current = getRestaurantGlobalConfig();
  const updated = { ...current.restaurant, ...info };
  saveRestaurantGlobalConfig({ ...current, restaurant: updated });
  return updated;
}

/**
 * Actualiza los parámetros de impresoras y comprobantes.
 */
export function updatePrinterConfig(printers: Partial<PrinterConfig>): PrinterConfig {
  const current = getRestaurantGlobalConfig();
  const updated = {
    ...current.printers,
    ...printers,
    series: { ...current.printers.series, ...(printers.series || {}) },
    kitchenPrinter: { ...current.printers.kitchenPrinter, ...(printers.kitchenPrinter || {}) },
    barPrinter: { ...current.printers.barPrinter, ...(printers.barPrinter || {}) },
    cashierPrinter: { ...current.printers.cashierPrinter, ...(printers.cashierPrinter || {}) },
  };
  saveRestaurantGlobalConfig({ ...current, printers: updated });
  return updated;
}

/**
 * Gestiona salones y áreas.
 */
export function listDiningAreas(): DiningArea[] {
  return getRestaurantGlobalConfig().areas;
}

export function saveDiningArea(area: DiningArea): DiningArea[] {
  const current = getRestaurantGlobalConfig();
  const existingIdx = current.areas.findIndex((a) => a.id === area.id);
  let newAreas = [...current.areas];

  if (existingIdx >= 0) {
    newAreas[existingIdx] = { ...newAreas[existingIdx], ...area };
  } else {
    const newId = area.id || `area-${Date.now()}`;
    newAreas.push({ ...area, id: newId });
  }

  saveRestaurantGlobalConfig({ ...current, areas: newAreas });
  return newAreas;
}

export function deleteDiningArea(areaId: string): DiningArea[] {
  const current = getRestaurantGlobalConfig();
  const newAreas = current.areas.filter((a) => a.id !== areaId);
  saveRestaurantGlobalConfig({ ...current, areas: newAreas });
  return newAreas;
}
