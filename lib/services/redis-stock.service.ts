import { Redis } from "@upstash/redis";

/**
 * Servicio de Control de Stock y Concurrencia con Upstash Redis Serverless (100% Gratuito).
 * 
 * Resuelve la condición de carrera (Race Condition) cuando dos mozos intentan
 * pedir la última porción de un plato al mismo milisegundo:
 * 
 * - Utiliza operaciones atómicas en memoria RAM con API REST Serverless.
 * - Ejecuta scripts Lua atómicos en Redis para verificar y descontar stock en un solo paso.
 * - Si no hay stock suficiente, rechaza inmediatamente el segundo pedido evitando sobreventas.
 * - Modo resiliente: Si UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN no están configuradas,
 *   utiliza un fallback local en memoria para permitir desarrollo y pruebas sin requerir conexión a internet.
 */

// Script Lua para verificación y decremento atómico
const LUA_DECREMENT_STOCK = `
  local key = KEYS[1]
  local requested = tonumber(ARGV[1])
  local raw = redis.call('get', key)

  -- Si el plato no tiene un stock fijado o restringido en Redis (nil), se permite la venta libremente
  if not raw then
    return 999
  end

  local current = tonumber(raw)
  if current >= requested then
    local remaining = current - requested
    redis.call('set', key, remaining)
    return remaining
  else
    return -1
  end
`;

// Instancia singleton de conexión Upstash Redis
let redisClient: Redis | null = null;

// Memoria local de fallback (para cuando no hay variables en .env o modo test)
const fallbackStockMemory: Map<string, number> = new Map();

/**
 * Reinicia la memoria de fallback (útil para pruebas unitarias y reinicio de caché).
 */
export function resetStockFallback(): void {
  fallbackStockMemory.clear();
}

/**
 * Obtiene o inicializa la conexión con Upstash Redis Serverless.
 */
export function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (
    !url ||
    !token ||
    url.trim() === "" ||
    token.trim() === "" ||
    url.includes("tu-db") ||
    token.includes("tu_token")
  ) {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis({
        url: url.trim(),
        token: token.trim(),
      });
    } catch (err) {
      console.warn("[Upstash Redis] No se pudo inicializar cliente:", err);
      redisClient = null;
    }
  }

  return redisClient;
}

/**
 * Clave estandarizada para el stock del plato en Redis.
 */
function dishStockKey(idPlato: number): string {
  return `stock:plato:${idPlato}`;
}

/**
 * Fija el stock disponible para un plato (ej: inicio de turno o reposición en cocina).
 */
export async function setDishStock(idPlato: number, stock: number): Promise<number> {
  const key = dishStockKey(idPlato);
  const client = getRedisClient();

  if (client) {
    try {
      const value = Math.max(0, stock);
      await client.set(key, value);
      return value;
    } catch (err) {
      console.warn("[Upstash Redis] Error al fijar stock, usando fallback:", err);
    }
  }

  fallbackStockMemory.set(key, Math.max(0, stock));
  return Math.max(0, stock);
}

/**
 * Consulta el stock actual disponible de un plato.
 */
export async function getDishStock(idPlato: number): Promise<number> {
  const key = dishStockKey(idPlato);
  const client = getRedisClient();

  if (client) {
    try {
      const val = await client.get<number | string>(key);
      if (val !== null && val !== undefined) {
        return Number(val);
      }
    } catch (err) {
      console.warn("[Upstash Redis] Error al consultar stock, usando fallback:", err);
    }
  }

  return fallbackStockMemory.get(key) ?? 999; // Si no se ha limitado, stock amplio por defecto
}

/**
 * Reserva atómicamente la cantidad de un plato.
 * Si el stock es insuficiente, retorna success: false sin descontar nada.
 */
export async function reserveDishStock(
  idPlato: number,
  cantidad: number
): Promise<{ success: boolean; remainingStock: number; message?: string }> {
  const qty = Math.max(1, cantidad);
  const key = dishStockKey(idPlato);
  const client = getRedisClient();

  if (client) {
    try {
      const res = (await client.eval(
        LUA_DECREMENT_STOCK,
        [key],
        [qty]
      )) as number;

      if (typeof res === "number" && res >= 0) {
        return { success: true, remainingStock: res };
      } else {
        const current = await getDishStock(idPlato);
        return {
          success: false,
          remainingStock: current,
          message: `Stock insuficiente. Solo quedan ${current} unidades disponibles.`,
        };
      }
    } catch (err) {
      console.warn("[Upstash Redis] Error al evaluar reserva en Lua, usando fallback:", err);
    }
  }

  // Fallback atómico en memoria
  if (!fallbackStockMemory.has(key)) {
    // Si no se ha limitado el stock de este plato en cocina, se permite la venta sin restricción
    return { success: true, remainingStock: 999 };
  }

  const current = fallbackStockMemory.get(key)!;
  if (current >= qty) {
    const remaining = current - qty;
    fallbackStockMemory.set(key, remaining);
    return { success: true, remainingStock: remaining };
  } else {
    return {
      success: false,
      remainingStock: current,
      message: `Stock insuficiente en cocina. Quedan ${current} unidades disponibles.`,
    };
  }
}

/**
 * Libera / devuelve stock a Redis (en caso de cancelación o edición de comanda).
 */
export async function releaseDishStock(idPlato: number, cantidad: number): Promise<number> {
  const qty = Math.max(1, cantidad);
  const key = dishStockKey(idPlato);
  const client = getRedisClient();

  if (client) {
    try {
      const res = await client.incrby(key, qty);
      return Number(res);
    } catch (err) {
      console.warn("[Upstash Redis] Error al liberar stock, usando fallback:", err);
    }
  }

  const current = fallbackStockMemory.get(key) ?? 0;
  const updated = current + qty;
  fallbackStockMemory.set(key, updated);
  return updated;
}

/**
 * Reserva atómica en lote para toda una comanda de múltiples platos.
 * Si aunque sea UN solo plato no tiene stock, hace rollback de los demás platos
 * para que la comanda no quede a medias ni se descuadre el inventario.
 */
export async function reserveOrderStock(
  items: Array<{ idPlato: number; cantidad: number; nombre?: string }>
): Promise<{ success: boolean; soldOutDish?: string; error?: string }> {
  const reservedDishes: Array<{ idPlato: number; cantidad: number }> = [];

  for (const item of items) {
    const res = await reserveDishStock(item.idPlato, item.cantidad);

    if (!res.success) {
      // ROLLBACK: Devolver los platos que ya se habían descontado en esta misma comanda
      for (const rev of reservedDishes) {
        await releaseDishStock(rev.idPlato, rev.cantidad);
      }

      return {
        success: false,
        soldOutDish: item.nombre || `Plato ID ${item.idPlato}`,
        error: `No se pudo confirmar la comanda: El plato '${item.nombre || item.idPlato}' se acaba de agotar. Solo quedan ${res.remainingStock} porciones disponibles.`,
      };
    }

    reservedDishes.push({ idPlato: item.idPlato, cantidad: item.cantidad });
  }

  return { success: true };
}
