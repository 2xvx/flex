// cache.ts
// Tiny in-memory TTL cache shared across all services.
// No localStorage — just a Map that lives for the lifetime of the browser tab.
//
// Default TTL: 30 seconds (good for a feed that polls every 15 s anyway).

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Read a cached value. Returns null if missing or expired. */
export const getCache = <T>(key: string): T | null => {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
};

/** Write a value into the cache with an optional TTL (default 30 s). */
export const setCache = <T>(key: string, data: T, ttlMs = 30_000): void => {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
};

/** Evict a single cache key. */
export const invalidateCache = (key: string): void => {
  store.delete(key);
};

/** Evict every key that starts with `prefix` — useful for "invalidate all pages". */
export const invalidateCachePrefix = (prefix: string): void => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};
