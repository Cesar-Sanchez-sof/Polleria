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
const LUA_DESCONTAR_STOCK = `
  local clave = KEYS[1]
  local pedido = tonumber(ARGV[1])
  local actual = tonumber(redis.call('get', clave) or '0')

  if actual >= pedido then
    local restante = actual - pedido
    redis.call('set', clave, restante)
    return restante
  else
    return -1
  end
`;

// Instancia singleton de conexión Upstash Redis
let clienteRedis: Redis | null = null;

// Memoria local de fallback (para cuando no hay variables en .env o modo test)
const stockMemoriaFallback: Map<string, number> = new Map();

/**
 * Reinicia la memoria de fallback (útil para pruebas unitarias y reinicio de caché).
 */
export function reiniciarStockFallback(): void {
  stockMemoriaFallback.clear();
}

/**
 * Obtiene o inicializa la conexión con Upstash Redis Serverless.
 */
export function obtenerClienteRedis(): Redis | null {
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

  if (!clienteRedis) {
    try {
      clienteRedis = new Redis({
        url: url.trim(),
        token: token.trim(),
      });
    } catch (err) {
      console.warn("[Upstash Redis] No se pudo inicializar cliente:", err);
      clienteRedis = null;
    }
  }

  return clienteRedis;
}

/**
 * Clave estandarizada para el stock del plato en Redis.
 */
function claveStockPlato(idPlato: number): string {
  return `stock:plato:${idPlato}`;
}

/**
 * Fija el stock disponible para un plato (ej: inicio de turno o reposición en cocina).
 */
export async function fijarStockPlato(idPlato: number, stock: number): Promise<number> {
  const clave = claveStockPlato(idPlato);
  const cliente = obtenerClienteRedis();

  if (cliente) {
    try {
      const valor = Math.max(0, stock);
      await cliente.set(clave, valor);
      return valor;
    } catch (err) {
      console.warn("[Upstash Redis] Error al fijar stock, usando fallback:", err);
    }
  }

  stockMemoriaFallback.set(clave, Math.max(0, stock));
  return Math.max(0, stock);
}

/**
 * Consulta el stock actual disponible de un plato.
 */
export async function consultarStockPlato(idPlato: number): Promise<number> {
  const clave = claveStockPlato(idPlato);
  const cliente = obtenerClienteRedis();

  if (cliente) {
    try {
      const val = await cliente.get<number | string>(clave);
      if (val !== null && val !== undefined) {
        return Number(val);
      }
    } catch (err) {
      console.warn("[Upstash Redis] Error al consultar stock, usando fallback:", err);
    }
  }

  return stockMemoriaFallback.get(clave) ?? 999; // Si no se ha limitado, stock amplio por defecto
}

/**
 * Reserva atómicamente la cantidad de un plato.
 * Si el stock es insuficiente, retorna exito: false sin descontar nada.
 */
export async function reservarStockPlato(
  idPlato: number,
  cantidad: number
): Promise<{ exito: boolean; stockRestante: number; mensaje?: string }> {
  const cant = Math.max(1, cantidad);
  const clave = claveStockPlato(idPlato);
  const cliente = obtenerClienteRedis();

  if (cliente) {
    try {
      const res = (await cliente.eval(
        LUA_DESCONTAR_STOCK,
        [clave],
        [cant]
      )) as number;

      if (typeof res === "number" && res >= 0) {
        return { exito: true, stockRestante: res };
      } else {
        const actual = await consultarStockPlato(idPlato);
        return {
          exito: false,
          stockRestante: actual,
          mensaje: `Stock insuficiente. Solo quedan ${actual} unidades disponibles.`,
        };
      }
    } catch (err) {
      console.warn("[Upstash Redis] Error al evaluar reserva en Lua, usando fallback:", err);
    }
  }

  // Fallback atómico en memoria
  const actual = stockMemoriaFallback.get(clave) ?? 999;
  if (actual >= cant) {
    const restante = actual - cant;
    stockMemoriaFallback.set(clave, restante);
    return { exito: true, stockRestante: restante };
  } else {
    return {
      exito: false,
      stockRestante: actual,
      mensaje: `Stock insuficiente en cocina. Quedan ${actual} unidades disponibles.`,
    };
  }
}

/**
 * Libera / devuelve stock a Redis (en caso de cancelación o edición de comanda).
 */
export async function liberarStockPlato(idPlato: number, cantidad: number): Promise<number> {
  const cant = Math.max(1, cantidad);
  const clave = claveStockPlato(idPlato);
  const cliente = obtenerClienteRedis();

  if (cliente) {
    try {
      const res = await cliente.incrby(clave, cant);
      return Number(res);
    } catch (err) {
      console.warn("[Upstash Redis] Error al liberar stock, usando fallback:", err);
    }
  }

  const actual = stockMemoriaFallback.get(clave) ?? 0;
  const nuevo = actual + cant;
  stockMemoriaFallback.set(clave, nuevo);
  return nuevo;
}

/**
 * Reserva atómica en lote para toda una comanda de múltiples platos.
 * Si aunque sea UN solo plato no tiene stock, hace rollback de los demás platos
 * para que la comanda no quede a medias ni se descuadre el inventario.
 */
export async function reservarStockComanda(
  items: Array<{ idPlato: number; cantidad: number; nombre?: string }>
): Promise<{ exito: boolean; platoAgotado?: string; error?: string }> {
  const platosReservados: Array<{ idPlato: number; cantidad: number }> = [];

  for (const item of items) {
    const res = await reservarStockPlato(item.idPlato, item.cantidad);

    if (!res.exito) {
      // ROLLBACK: Devolver los platos que ya se habían descontado en esta misma comanda
      for (const rev of platosReservados) {
        await liberarStockPlato(rev.idPlato, rev.cantidad);
      }

      return {
        exito: false,
        platoAgotado: item.nombre || `Plato ID ${item.idPlato}`,
        error: `No se pudo confirmar la comanda: El plato '${item.nombre || item.idPlato}' se acaba de agotar. Solo quedan ${res.stockRestante} porciones disponibles.`,
      };
    }

    platosReservados.push({ idPlato: item.idPlato, cantidad: item.cantidad });
  }

  return { exito: true };
}
