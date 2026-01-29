/**
 * OfflineContext - Offline mode management
 *
 * Provides offline request queuing, cache management,
 * and automatic sync when connection is restored.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { ApiError } from '../services/api';

// Storage keys
const OFFLINE_QUEUE_KEY = '@deepsight_offline_queue';
const OFFLINE_CACHE_KEY = '@deepsight_offline_cache';

// Queued request interface
export interface QueuedRequest {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// Cache entry interface
export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Context interface
interface OfflineContextType {
  isOffline: boolean;
  queuedRequests: QueuedRequest[];
  queueRequest: (request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>) => void;
  getCached: <T>(key: string) => Promise<T | null>;
  setCache: <T>(key: string, data: T, ttlMinutes?: number) => Promise<void>;
  clearCache: () => Promise<void>;
  syncQueue: () => Promise<{ success: number; failed: number }>;
  pendingCount: number;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Provider component
export const OfflineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { status } = useNetworkStatus();
  const [queuedRequests, setQueuedRequests] = useState<QueuedRequest[]>([]);
  const syncInProgress = useRef(false);

  const isOffline = status.isOffline;

  // Load queued requests from storage on mount
  useEffect(() => {
    loadQueue();
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOffline && queuedRequests.length > 0 && !syncInProgress.current) {
      syncQueue();
    }
  }, [isOffline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load queue from storage
  const loadQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        const queue = JSON.parse(stored) as QueuedRequest[];
        // Filter out expired requests (older than 24 hours)
        const validQueue = queue.filter(
          req => Date.now() - req.timestamp < 24 * 60 * 60 * 1000
        );
        setQueuedRequests(validQueue);
      }
    } catch (error) {
      console.error('[OfflineContext] Failed to load queue:', error);
    }
  };

  // Save queue to storage
  const saveQueue = async (queue: QueuedRequest[]) => {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[OfflineContext] Failed to save queue:', error);
    }
  };

  // Queue a request for later execution
  const queueRequest = useCallback((request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>) => {
    const newRequest: QueuedRequest = {
      ...request,
      id: generateRequestId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    setQueuedRequests(prev => {
      const updated = [...prev, newRequest];
      saveQueue(updated);
      return updated;
    });

    if (__DEV__) {
      console.log('[OfflineContext] Request queued:', newRequest.endpoint);
    }
  }, []);

  // Get cached data
  const getCached = useCallback(async <T,>(key: string): Promise<T | null> => {
    try {
      const cacheKey = `${OFFLINE_CACHE_KEY}_${key}`;
      const stored = await AsyncStorage.getItem(cacheKey);

      if (!stored) return null;

      const entry = JSON.parse(stored) as CacheEntry<T>;

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('[OfflineContext] Cache read error:', error);
      return null;
    }
  }, []);

  // Set cache data
  const setCache = useCallback(async <T,>(key: string, data: T, ttlMinutes: number = 30) => {
    try {
      const cacheKey = `${OFFLINE_CACHE_KEY}_${key}`;
      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error('[OfflineContext] Cache write error:', error);
    }
  }, []);

  // Clear all cached data
  const clearCache = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(OFFLINE_CACHE_KEY));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('[OfflineContext] Cache clear error:', error);
    }
  }, []);

  // Sync queued requests
  const syncQueue = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (syncInProgress.current || isOffline) {
      return { success: 0, failed: 0 };
    }

    syncInProgress.current = true;
    let success = 0;
    let failed = 0;

    const currentQueue = [...queuedRequests];
    const remainingQueue: QueuedRequest[] = [];

    for (const request of currentQueue) {
      try {
        // Import API base URL dynamically to avoid circular dependency
        const { API_BASE_URL } = await import('../constants/config');
        const { tokenStorage } = await import('../utils/storage');

        const accessToken = await tokenStorage.getAccessToken();

        const response = await fetch(`${API_BASE_URL}${request.endpoint}`, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: request.body ? JSON.stringify(request.body) : undefined,
        });

        if (response.ok) {
          success++;
          if (__DEV__) {
            console.log('[OfflineContext] Synced:', request.endpoint);
          }
        } else {
          throw new ApiError('Sync failed', response.status);
        }
      } catch (error) {
        // Increment retry count
        const updated = { ...request, retryCount: request.retryCount + 1 };

        // Keep in queue if not exceeded max retries
        if (updated.retryCount < updated.maxRetries) {
          remainingQueue.push(updated);
        } else {
          failed++;
          if (__DEV__) {
            console.error('[OfflineContext] Max retries exceeded:', request.endpoint);
          }
        }
      }
    }

    // Update queue
    setQueuedRequests(remainingQueue);
    await saveQueue(remainingQueue);

    syncInProgress.current = false;

    if (__DEV__) {
      console.log(`[OfflineContext] Sync complete: ${success} success, ${failed} failed, ${remainingQueue.length} pending`);
    }

    return { success, failed };
  }, [queuedRequests, isOffline]);

  return (
    <OfflineContext.Provider
      value={{
        isOffline,
        queuedRequests,
        queueRequest,
        getCached,
        setCache,
        clearCache,
        syncQueue,
        pendingCount: queuedRequests.length,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

// Hook to use offline context
export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

// Hook for offline-aware data fetching with cache
export function useOfflineData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttlMinutes?: number; enabled?: boolean } = {}
) {
  const { isOffline, getCached, setCache } = useOffline();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { ttlMinutes = 30, enabled = true } = options;

  const fetch = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try cache first if offline
      if (isOffline) {
        const cached = await getCached<T>(key);
        if (cached) {
          setData(cached);
          setIsLoading(false);
          return;
        }
        throw new Error('No cached data available offline');
      }

      // Fetch fresh data
      const result = await fetcher();
      setData(result);

      // Cache the result
      await setCache(key, result, ttlMinutes);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));

      // Try to use cached data as fallback
      const cached = await getCached<T>(key);
      if (cached) {
        setData(cached);
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, isOffline, getCached, setCache, ttlMinutes, enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch, isStale: isOffline };
}

export default OfflineContext;
