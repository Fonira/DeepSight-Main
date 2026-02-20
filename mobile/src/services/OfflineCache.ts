/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📦 OFFLINE CACHE SERVICE — Advanced caching with LRU & priority strategies       ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - LRU (Least Recently Used) eviction policy                                       ║
 * ║  - Priority-based cache retention                                                   ║
 * ║  - Automatic cache size management                                                  ║
 * ║  - Smart preloading for critical data                                               ║
 * ║  - Cache versioning for migrations                                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration
const CACHE_VERSION = 1;
const CACHE_PREFIX = '@deepsight_cache_v1_';
const CACHE_INDEX_KEY = '@deepsight_cache_index';
const MAX_CACHE_SIZE_MB = 50; // 50MB max cache
const MAX_CACHE_ENTRIES = 500;

// Priority levels for cache retention
export enum CachePriority {
  LOW = 1,      // Can be evicted easily (e.g., thumbnails)
  NORMAL = 2,   // Standard content (e.g., analysis results)
  HIGH = 3,     // Important data (e.g., user history)
  CRITICAL = 4, // Never auto-evict (e.g., user preferences)
}

// Cache entry metadata
export interface CacheEntryMeta {
  key: string;
  priority: CachePriority;
  size: number; // in bytes
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number | null; // null = never expires
  accessCount: number;
  tags: string[];
}

// Cache index for fast lookups
interface CacheIndex {
  version: number;
  totalSize: number;
  entries: Record<string, CacheEntryMeta>;
}

// Serialized cache entry
interface CacheEntry<T> {
  data: T;
  meta: CacheEntryMeta;
}

// Cache statistics
export interface CacheStats {
  totalEntries: number;
  totalSizeMB: number;
  hitRate: number;
  missRate: number;
  entriesByPriority: Record<CachePriority, number>;
}

// Request tracking for hit/miss rates
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Get the cache index
 */
async function getCacheIndex(): Promise<CacheIndex> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    if (stored) {
      const index = JSON.parse(stored) as CacheIndex;
      if (index.version === CACHE_VERSION) {
        return index;
      }
      // Version mismatch - clear old cache
      await clearAllCache();
    }
  } catch (error) {
    if (__DEV__) { console.warn('[OfflineCache] Failed to load cache index:', error); }
  }

  return {
    version: CACHE_VERSION,
    totalSize: 0,
    entries: {},
  };
}

/**
 * Save the cache index
 */
async function saveCacheIndex(index: CacheIndex): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    if (__DEV__) { console.error('[OfflineCache] Failed to save cache index:', error); }
  }
}

/**
 * Calculate string size in bytes
 */
function getByteSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Evict entries to make space using LRU + priority strategy
 */
async function evictEntries(index: CacheIndex, bytesNeeded: number): Promise<CacheIndex> {
  const entries = Object.values(index.entries);

  // Sort by priority (ascending) then by last access time (ascending = oldest first)
  entries.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority; // Lower priority first
    }
    return a.lastAccessedAt - b.lastAccessedAt; // Older access first
  });

  let freedBytes = 0;
  const keysToRemove: string[] = [];

  for (const entry of entries) {
    // Never evict CRITICAL priority entries
    if (entry.priority === CachePriority.CRITICAL) {
      continue;
    }

    if (freedBytes >= bytesNeeded) {
      break;
    }

    keysToRemove.push(entry.key);
    freedBytes += entry.size;
  }

  // Remove entries
  await AsyncStorage.multiRemove(keysToRemove.map(k => `${CACHE_PREFIX}${k}`));

  // Update index
  for (const key of keysToRemove) {
    delete index.entries[key];
  }
  index.totalSize -= freedBytes;

  if (__DEV__ && keysToRemove.length > 0) {
    console.log(`[OfflineCache] Evicted ${keysToRemove.length} entries (${(freedBytes / 1024).toFixed(2)} KB)`);
  }

  return index;
}

/**
 * Remove expired entries
 */
async function removeExpiredEntries(index: CacheIndex): Promise<CacheIndex> {
  const now = Date.now();
  const expiredKeys: string[] = [];
  let freedBytes = 0;

  for (const [key, meta] of Object.entries(index.entries)) {
    if (meta.expiresAt && meta.expiresAt < now) {
      expiredKeys.push(key);
      freedBytes += meta.size;
    }
  }

  if (expiredKeys.length > 0) {
    await AsyncStorage.multiRemove(expiredKeys.map(k => `${CACHE_PREFIX}${k}`));

    for (const key of expiredKeys) {
      delete index.entries[key];
    }
    index.totalSize -= freedBytes;

    if (__DEV__) {
      console.log(`[OfflineCache] Removed ${expiredKeys.length} expired entries`);
    }
  }

  return index;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set a value in the cache
 */
export async function set<T>(
  key: string,
  data: T,
  options: {
    priority?: CachePriority;
    ttlMinutes?: number | null; // null = never expires
    tags?: string[];
  } = {}
): Promise<void> {
  const {
    priority = CachePriority.NORMAL,
    ttlMinutes = 60, // Default 1 hour TTL
    tags = [],
  } = options;

  try {
    let index = await getCacheIndex();

    // Clean expired entries periodically
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      index = await removeExpiredEntries(index);
    }

    const serialized = JSON.stringify(data);
    const size = getByteSize(serialized);
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

    // Check if we need to evict entries
    if (index.totalSize + size > maxSizeBytes) {
      index = await evictEntries(index, size);
    }

    // Check entry count limit
    const entryCount = Object.keys(index.entries).length;
    if (entryCount >= MAX_CACHE_ENTRIES) {
      index = await evictEntries(index, 0); // Force eviction of lowest priority
    }

    const now = Date.now();
    const meta: CacheEntryMeta = {
      key,
      priority,
      size,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: ttlMinutes ? now + ttlMinutes * 60 * 1000 : null,
      accessCount: 0,
      tags,
    };

    // Update existing entry or add new
    if (index.entries[key]) {
      index.totalSize -= index.entries[key].size;
    }
    index.entries[key] = meta;
    index.totalSize += size;

    const entry: CacheEntry<T> = { data, meta };

    // Save entry and index
    await Promise.all([
      AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry)),
      saveCacheIndex(index),
    ]);

  } catch (error) {
    if (__DEV__) { console.error('[OfflineCache] Failed to set cache:', error); }
  }
}

/**
 * Get a value from the cache
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const stored = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);

    if (!stored) {
      cacheMisses++;
      return null;
    }

    const entry = JSON.parse(stored) as CacheEntry<T>;

    // Check expiration
    if (entry.meta.expiresAt && entry.meta.expiresAt < Date.now()) {
      await remove(key);
      cacheMisses++;
      return null;
    }

    // Update access metadata
    const index = await getCacheIndex();
    if (index.entries[key]) {
      index.entries[key].lastAccessedAt = Date.now();
      index.entries[key].accessCount++;
      await saveCacheIndex(index);
    }

    cacheHits++;
    return entry.data;

  } catch (error) {
    if (__DEV__) { console.error('[OfflineCache] Failed to get cache:', error); }
    cacheMisses++;
    return null;
  }
}

/**
 * Check if a key exists in cache (without updating access time)
 */
export async function has(key: string): Promise<boolean> {
  const index = await getCacheIndex();
  const meta = index.entries[key];

  if (!meta) return false;

  // Check expiration
  if (meta.expiresAt && meta.expiresAt < Date.now()) {
    return false;
  }

  return true;
}

/**
 * Remove a value from the cache
 */
export async function remove(key: string): Promise<void> {
  try {
    const index = await getCacheIndex();

    if (index.entries[key]) {
      index.totalSize -= index.entries[key].size;
      delete index.entries[key];
    }

    await Promise.all([
      AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`),
      saveCacheIndex(index),
    ]);

  } catch (error) {
    if (__DEV__) { console.error('[OfflineCache] Failed to remove cache:', error); }
  }
}

/**
 * Remove all entries with a specific tag
 */
export async function removeByTag(tag: string): Promise<number> {
  try {
    const index = await getCacheIndex();
    const keysToRemove: string[] = [];

    for (const [key, meta] of Object.entries(index.entries)) {
      if (meta.tags.includes(tag)) {
        keysToRemove.push(key);
        index.totalSize -= meta.size;
        delete index.entries[key];
      }
    }

    if (keysToRemove.length > 0) {
      await Promise.all([
        AsyncStorage.multiRemove(keysToRemove.map(k => `${CACHE_PREFIX}${k}`)),
        saveCacheIndex(index),
      ]);
    }

    return keysToRemove.length;

  } catch (error) {
    if (__DEV__) { console.error('[OfflineCache] Failed to remove by tag:', error); }
    return 0;
  }
}

/**
 * Clear all cache entries
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX) || k === CACHE_INDEX_KEY);
    await AsyncStorage.multiRemove(cacheKeys);

    // Reset stats
    cacheHits = 0;
    cacheMisses = 0;

    if (__DEV__) {
      console.log('[OfflineCache] All cache cleared');
    }

  } catch (error) {
    if (__DEV__) { console.error('[OfflineCache] Failed to clear cache:', error); }
  }
}

/**
 * Get cache statistics
 */
export async function getStats(): Promise<CacheStats> {
  const index = await getCacheIndex();

  const entriesByPriority: Record<CachePriority, number> = {
    [CachePriority.LOW]: 0,
    [CachePriority.NORMAL]: 0,
    [CachePriority.HIGH]: 0,
    [CachePriority.CRITICAL]: 0,
  };

  for (const meta of Object.values(index.entries)) {
    entriesByPriority[meta.priority]++;
  }

  const totalRequests = cacheHits + cacheMisses;

  return {
    totalEntries: Object.keys(index.entries).length,
    totalSizeMB: index.totalSize / (1024 * 1024),
    hitRate: totalRequests > 0 ? cacheHits / totalRequests : 0,
    missRate: totalRequests > 0 ? cacheMisses / totalRequests : 0,
    entriesByPriority,
  };
}

/**
 * Preload critical data for offline use
 */
export async function preloadForOffline<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    priority?: CachePriority;
    ttlMinutes?: number;
    tags?: string[];
  } = {}
): Promise<T | null> {
  const { priority = CachePriority.HIGH, ttlMinutes = 24 * 60, tags = [] } = options;

  // Check cache first
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  try {
    const data = await fetcher();
    await set(key, data, { priority, ttlMinutes, tags });
    return data;
  } catch (error) {
    if (__DEV__) { console.error('[OfflineCache] Preload failed:', error); }
    return null;
  }
}

/**
 * Get or fetch with cache-first strategy
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    priority?: CachePriority;
    ttlMinutes?: number;
    tags?: string[];
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { forceRefresh = false, ...cacheOptions } = options;

  // Check cache first unless force refresh
  if (!forceRefresh) {
    const cached = await get<T>(key);
    if (cached !== null) {
      return cached;
    }
  }

  // Fetch fresh data
  const data = await fetcher();
  await set(key, data, cacheOptions);
  return data;
}

export const OfflineCache = {
  set,
  get,
  has,
  remove,
  removeByTag,
  clearAllCache,
  getStats,
  preloadForOffline,
  getOrFetch,
  CachePriority,
};

export default OfflineCache;
