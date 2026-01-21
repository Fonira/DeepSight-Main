/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚡ useSmartApi — Hook API Intelligent avec Cache SWR                              ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FONCTIONNALITÉS:                                                                  ║
 * ║  • 🔄 Stale-While-Revalidate pattern                                              ║
 * ║  • 🚫 Déduplication des requêtes concurrentes                                     ║
 * ║  • 🔁 Retry automatique avec exponential backoff                                  ║
 * ║  • 💾 Cache multi-niveaux (memory + localStorage)                                 ║
 * ║  • 🎯 Optimistic updates pour mutations                                           ║
 * ║  • 📊 Cache invalidation par pattern                                              ║
 * ║  • 🔌 Integration TanStack Query                                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  QueryClient,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { getAccessToken, API_URL, ApiError } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SmartApiOptions<T> {
  /** Durée pendant laquelle les données sont considérées fraîches (ms) */
  staleTime?: number;
  /** Durée de conservation en cache après unmount (ms) */
  cacheTime?: number;
  /** Activer la déduplication des requêtes */
  dedupe?: boolean;
  /** Nombre de retry en cas d'erreur */
  retry?: number | boolean;
  /** Délai entre les retry (ms) */
  retryDelay?: number | ((attempt: number) => number);
  /** Refetch quand la fenêtre reprend le focus */
  refetchOnWindowFocus?: boolean;
  /** Refetch quand la connexion réseau revient */
  refetchOnReconnect?: boolean;
  /** Intervalle de polling (ms, 0 = désactivé) */
  refetchInterval?: number;
  /** Données initiales (pour SSR ou prefetch) */
  initialData?: T;
  /** Callback après succès */
  onSuccess?: (data: T) => void;
  /** Callback après erreur */
  onError?: (error: ApiError) => void;
  /** Transformer les données avant de les retourner */
  select?: (data: T) => T;
  /** Désactiver la requête (pour requêtes conditionnelles) */
  enabled?: boolean;
  /** Utiliser le cache localStorage persistant */
  persistCache?: boolean;
}

interface MutationOptions<TData, TVariables> {
  /** Callback de mise à jour optimiste */
  onMutate?: (variables: TVariables) => Promise<{ previousData?: unknown }> | { previousData?: unknown };
  /** Callback après succès */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Callback après erreur (rollback) */
  onError?: (error: ApiError, variables: TVariables, context?: { previousData?: unknown }) => void;
  /** Callback final (succès ou erreur) */
  onSettled?: (data: TData | undefined, error: ApiError | null, variables: TVariables) => void;
  /** Clés de cache à invalider après succès */
  invalidateKeys?: QueryKey[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_STALE_TIME = 5 * 60 * 1000;      // 5 minutes
const DEFAULT_CACHE_TIME = 30 * 60 * 1000;    // 30 minutes
const DEFAULT_RETRY = 3;
const PERSIST_CACHE_KEY = 'ds_api_cache';

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 CACHE PERSISTANT (localStorage)
// ═══════════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PersistentCache {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 100;

  get<T>(key: string): T | null {
    // Check memory first
    const memEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry && Date.now() < memEntry.timestamp + memEntry.ttl) {
      return memEntry.data;
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(`${PERSIST_CACHE_KEY}:${key}`);
      if (stored) {
        const entry = JSON.parse(stored) as CacheEntry<T>;
        if (Date.now() < entry.timestamp + entry.ttl) {
          // Promote to memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // Expired, clean up
          localStorage.removeItem(`${PERSIST_CACHE_KEY}:${key}`);
        }
      }
    } catch {
      // localStorage unavailable or parse error
    }

    return null;
  }

  set<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TIME): void {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
    
    // Store in memory
    this.memoryCache.set(key, entry);
    
    // Evict if over size
    if (this.memoryCache.size > this.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }

    // Store in localStorage
    try {
      localStorage.setItem(`${PERSIST_CACHE_KEY}:${key}`, JSON.stringify(entry));
    } catch {
      // localStorage full or unavailable
    }
  }

  delete(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(`${PERSIST_CACHE_KEY}:${key}`);
    } catch {
      // Ignore
    }
  }

  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    // Memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // localStorage
    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PERSIST_CACHE_KEY) && regex.test(key)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignore
    }
  }

  clear(): void {
    this.memoryCache.clear();
    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PERSIST_CACHE_KEY)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignore
    }
  }
}

const persistentCache = new PersistentCache();

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 REQUEST DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════════════════

const inflightRequests = new Map<string, Promise<unknown>>();

async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check if request is already in-flight
  const existing = inflightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Create new request
  const request = fetcher().finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, request);
  return request;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔌 HTTP CLIENT — Fetch wrapper avec auth et retry
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function smartFetch<T>(
  endpoint: string, 
  options: RequestOptions = {},
  retryCount = DEFAULT_RETRY
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  const token = getAccessToken();
  
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
    ...(body && { body: JSON.stringify(body) }),
  };

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.detail || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }
      
      // Handle empty response
      const text = await response.text();
      if (!text) return {} as T;
      
      return JSON.parse(text) as T;
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on 4xx errors (client errors)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Exponential backoff for retries
      if (attempt < retryCount) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Request failed');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎣 useSmartApi — Hook principal pour les requêtes GET
// ═══════════════════════════════════════════════════════════════════════════════

export function useSmartApi<T>(
  endpoint: string | null,
  options: SmartApiOptions<T> = {}
) {
  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    dedupe = true,
    retry = DEFAULT_RETRY,
    retryDelay,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    refetchInterval = 0,
    initialData,
    onSuccess,
    onError,
    select,
    enabled = true,
    persistCache = false,
  } = options;

  const queryKey = useMemo(() => 
    endpoint ? ['api', endpoint] : ['api', 'null'],
    [endpoint]
  );

  // Check persistent cache for initial data
  const persistedData = useMemo(() => {
    if (persistCache && endpoint) {
      return persistentCache.get<T>(endpoint);
    }
    return null;
  }, [persistCache, endpoint]);

  const queryFn = useCallback(async (): Promise<T> => {
    if (!endpoint) {
      throw new Error('Endpoint is required');
    }

    const fetcher = () => smartFetch<T>(endpoint, { method: 'GET' }, retry as number);
    
    // Use deduplication if enabled
    const data = dedupe 
      ? await deduplicatedFetch(endpoint, fetcher)
      : await fetcher();

    // Store in persistent cache if enabled
    if (persistCache) {
      persistentCache.set(endpoint, data, cacheTime);
    }

    return data;
  }, [endpoint, dedupe, retry, persistCache, cacheTime]);

  const query = useQuery({
    queryKey,
    queryFn,
    staleTime,
    gcTime: cacheTime,
    retry: typeof retry === 'number' ? retry : retry ? 3 : 0,
    retryDelay: retryDelay || ((attempt) => Math.min(1000 * 2 ** attempt, 30000)),
    refetchOnWindowFocus,
    refetchOnReconnect,
    refetchInterval: refetchInterval || false,
    initialData: initialData ?? persistedData ?? undefined,
    select,
    enabled: enabled && !!endpoint,
  });

  // Handle callbacks
  const prevDataRef = useRef<T | undefined>();
  const prevErrorRef = useRef<Error | null>(null);

  if (query.data !== prevDataRef.current && query.data !== undefined) {
    prevDataRef.current = query.data;
    onSuccess?.(query.data);
  }

  if (query.error !== prevErrorRef.current && query.error) {
    prevErrorRef.current = query.error;
    onError?.(query.error as ApiError);
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as ApiError | null,
    isStale: query.isStale,
    refetch: query.refetch,
    // Additional utilities
    isSuccess: query.isSuccess,
    status: query.status,
    fetchStatus: query.fetchStatus,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 useSmartMutation — Hook pour les mutations (POST, PUT, DELETE)
// ═══════════════════════════════════════════════════════════════════════════════

export function useSmartMutation<TData, TVariables = unknown>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  options: MutationOptions<TData, TVariables> = {}
) {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError, onSettled, invalidateKeys = [] } = options;

  const mutation = useMutation({
    mutationFn: async (variables: TVariables) => {
      return smartFetch<TData>(endpoint, {
        method,
        body: variables,
      });
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['api'] });
      
      if (onMutate) {
        return onMutate(variables);
      }
      return {};
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      invalidateKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      
      onSuccess?.(data, variables);
    },
    onError: (error, variables, context) => {
      onError?.(error as ApiError, variables, context);
    },
    onSettled: (data, error, variables) => {
      onSettled?.(data, error as ApiError | null, variables);
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ CACHE UTILITIES — Fonctions utilitaires pour manipuler le cache
// ═══════════════════════════════════════════════════════════════════════════════

export function useCacheUtils() {
  const queryClient = useQueryClient();

  return useMemo(() => ({
    /**
     * Invalide une ou plusieurs clés de cache
     */
    invalidate: (keys: QueryKey | QueryKey[]) => {
      const keyArray = Array.isArray(keys[0]) ? keys : [keys];
      keyArray.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key as QueryKey });
      });
    },

    /**
     * Invalide toutes les requêtes API
     */
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['api'] });
    },

    /**
     * Met à jour directement le cache (sans refetch)
     */
    setData: <T>(key: QueryKey, updater: T | ((old: T | undefined) => T)) => {
      queryClient.setQueryData(key, updater);
    },

    /**
     * Récupère les données du cache sans déclencher de requête
     */
    getData: <T>(key: QueryKey): T | undefined => {
      return queryClient.getQueryData<T>(key);
    },

    /**
     * Précharge des données dans le cache
     */
    prefetch: async <T>(endpoint: string, staleTime = DEFAULT_STALE_TIME) => {
      await queryClient.prefetchQuery({
        queryKey: ['api', endpoint],
        queryFn: () => smartFetch<T>(endpoint),
        staleTime,
      });
    },

    /**
     * Vide tout le cache
     */
    clear: () => {
      queryClient.clear();
      persistentCache.clear();
    },

    /**
     * Invalide le cache par pattern (ex: "history:*")
     */
    invalidatePattern: (pattern: string) => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey.join(':');
          return regex.test(key);
        },
      });
      persistentCache.deletePattern(pattern);
    },
  }), [queryClient]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 PREBUILT HOOKS — Hooks préconfigurés pour les cas d'usage courants
// ═══════════════════════════════════════════════════════════════════════════════

/** Hook pour récupérer l'historique des analyses avec pagination */
export function useHistory(page = 1, limit = 20) {
  return useSmartApi<{
    items: unknown[];
    total: number;
    page: number;
    pages: number;
  }>(`/api/history?page=${page}&limit=${limit}`, {
    staleTime: 2 * 60 * 1000,  // 2 min (change souvent)
    refetchOnWindowFocus: true,
    persistCache: true,
  });
}

/** Hook pour récupérer un résumé spécifique */
export function useSummary(summaryId: number | null) {
  return useSmartApi<unknown>(
    summaryId ? `/api/videos/summary/${summaryId}` : null,
    {
      staleTime: 10 * 60 * 1000,  // 10 min (rarement modifié)
      persistCache: true,
    }
  );
}

/** Hook pour récupérer les quotas de l'utilisateur */
export function useUserQuota() {
  return useSmartApi<{
    credits: number;
    dailyUsed: number;
    dailyLimit: number;
  }>('/api/auth/me', {
    staleTime: 30 * 1000,  // 30 sec (mise à jour fréquente)
    refetchOnWindowFocus: true,
  });
}

/** Hook pour récupérer les playlists */
export function usePlaylists() {
  return useSmartApi<unknown[]>('/api/playlists', {
    staleTime: 5 * 60 * 1000,
    persistCache: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { smartFetch, persistentCache };
export type { SmartApiOptions, MutationOptions };
