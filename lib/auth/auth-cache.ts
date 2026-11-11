export type AuthCacheNamespace = "activeUser" | "permissions";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface AuthCacheStore {
  activeUser: Map<number, CacheEntry<unknown>>;
  permissions: Map<number, CacheEntry<unknown>>;
  inflight: Map<string, Promise<unknown>>;
}

const DEFAULT_AUTH_CACHE_TTL_MS = 15_000;

const globalForAuthCache = globalThis as unknown as {
  __polleriaAuthCache?: AuthCacheStore;
};

function getStore(): AuthCacheStore {
  if (!globalForAuthCache.__polleriaAuthCache) {
    globalForAuthCache.__polleriaAuthCache = {
      activeUser: new Map(),
      permissions: new Map(),
      inflight: new Map(),
    };
  }
  return globalForAuthCache.__polleriaAuthCache;
}

export function getAuthCacheTtlMs(): number {
  const raw = Number(process.env.AUTH_CACHE_TTL_MS);
  if (Number.isFinite(raw) && raw >= 0) {
    return raw;
  }
  return DEFAULT_AUTH_CACHE_TTL_MS;
}

function isCacheDisabled(forceEnable?: boolean): boolean {
  if (forceEnable) return false;
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return true;
  }
  return getAuthCacheTtlMs() <= 0;
}

/**
 * Resuelve datos de autorización por usuario usando caché TTL en memoria y
 * deduplicación de promesas concurrentes (singleflight) bajo alta carga HTTP.
 */
export async function resolveWithAuthCache<T>(
  namespace: AuthCacheNamespace,
  userId: number,
  loader: () => Promise<T>,
  options?: { forceEnable?: boolean; ttlMs?: number }
): Promise<T> {
  if (isCacheDisabled(options?.forceEnable)) {
    return loader();
  }

  const store = getStore();
  const bucket = store[namespace];
  const now = Date.now();
  const cached = bucket.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const inflightKey = `${namespace}:${userId}`;
  const pending = store.inflight.get(inflightKey);
  if (pending) {
    return pending as Promise<T>;
  }

  const ttlMs = options?.ttlMs ?? getAuthCacheTtlMs();
  const task = loader()
    .then((value) => {
      if (ttlMs > 0) {
        bucket.set(userId, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      store.inflight.delete(inflightKey);
    });

  store.inflight.set(inflightKey, task);
  return task;
}

/**
 * Hidrata manualmente un valor en caché (por ejemplo `activeUser` desde `permissionsForUser`).
 */
export function primeAuthCache<T>(
  namespace: AuthCacheNamespace,
  userId: number,
  value: T,
  options?: { forceEnable?: boolean; ttlMs?: number }
): void {
  if (isCacheDisabled(options?.forceEnable)) return;
  const ttlMs = options?.ttlMs ?? getAuthCacheTtlMs();
  if (ttlMs <= 0) return;
  getStore()[namespace].set(userId, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalida el caché de autorización de un usuario puntual o de todos (al editar/eliminar roles).
 */
export function invalidateAuthCache(userId?: number): void {
  const store = getStore();
  if (typeof userId === "number") {
    store.activeUser.delete(userId);
    store.permissions.delete(userId);
    store.inflight.delete(`activeUser:${userId}`);
    store.inflight.delete(`permissions:${userId}`);
    return;
  }
  store.activeUser.clear();
  store.permissions.clear();
  store.inflight.clear();
}
