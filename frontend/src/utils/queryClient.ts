/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚙️ QueryClient Configuration — TanStack Query Setup                               ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Configuration optimisée pour Deep Sight avec:                                     ║
 * ║  • 🔄 Stale-while-revalidate par défaut                                           ║
 * ║  • 🔁 Retry intelligent avec backoff                                              ║
 * ║  • 💾 Garbage collection optimisée                                                ║
 * ║  • 📊 Logging des erreurs                                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { captureError } from '../lib/sentry';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const STALE_TIME = 5 * 60 * 1000;        // 5 minutes - données considérées fraîches
const GC_TIME = 30 * 60 * 1000;          // 30 minutes - durée de conservation en cache
const RETRY_COUNT = 3;                    // Nombre de tentatives
const RETRY_DELAY = 1000;                // Délai initial entre tentatives (ms)

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiError extends Error {
  status?: number;
  code?: string;
}

/**
 * Détermine si une erreur devrait déclencher un retry
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Ne pas retry au-delà du max
  if (failureCount >= RETRY_COUNT) return false;
  
  const apiError = error as ApiError;
  
  // Ne pas retry les erreurs 4xx (client errors) sauf 429 (rate limit)
  if (apiError.status && apiError.status >= 400 && apiError.status < 500) {
    return apiError.status === 429; // Retry uniquement rate limit
  }
  
  // Retry les erreurs réseau et serveur (5xx)
  return true;
}

/**
 * Calcule le délai de retry avec exponential backoff
 */
function getRetryDelay(attemptIndex: number): number {
  return Math.min(RETRY_DELAY * Math.pow(2, attemptIndex), 30000);
}

/**
 * Gestionnaire global d'erreurs de requête
 */
function handleQueryError(error: unknown): void {
  const apiError = error as ApiError;
  
  // Log l'erreur
  console.error('[QueryClient] Query error:', {
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  });
  
  if (error instanceof Error) {
    captureError(error, { type: 'query_error' });
  }
}

/**
 * Gestionnaire global d'erreurs de mutation
 */
function handleMutationError(error: unknown): void {
  const apiError = error as ApiError;

  console.error('[QueryClient] Mutation error:', {
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  });

  if (error instanceof Error) {
    captureError(error, { type: 'mutation_error' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏗️ QUERY CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleQueryError,
  }),
  mutationCache: new MutationCache({
    onError: handleMutationError,
  }),
  defaultOptions: {
    queries: {
      // ═══════════════════════════════════════════════════════════════════════
      // 🕐 TIMING
      // ═══════════════════════════════════════════════════════════════════════
      
      /** Durée pendant laquelle les données sont considérées fraîches */
      staleTime: STALE_TIME,
      
      /** Durée de conservation en cache après unmount */
      gcTime: GC_TIME,
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🔁 RETRY
      // ═══════════════════════════════════════════════════════════════════════
      
      /** Fonction personnalisée pour déterminer si on retry */
      retry: shouldRetry,
      
      /** Délai entre les tentatives avec exponential backoff */
      retryDelay: getRetryDelay,
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🔄 REFETCH BEHAVIOR
      // ═══════════════════════════════════════════════════════════════════════
      
      /** Refetch quand la fenêtre reprend le focus */
      refetchOnWindowFocus: true,
      
      /** Refetch quand la connexion réseau revient */
      refetchOnReconnect: true,
      
      /** Ne pas refetch automatiquement au mount si les données sont en cache */
      refetchOnMount: 'always',
      
      // ═══════════════════════════════════════════════════════════════════════
      // 📊 NETWORK MODE
      // ═══════════════════════════════════════════════════════════════════════
      
      /** Mode réseau: online (attendre connexion), always, offlineFirst */
      networkMode: 'online',
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🎯 STRUCTURAL SHARING
      // ═══════════════════════════════════════════════════════════════════════
      
      /** Optimise les re-renders en gardant les références stables */
      structuralSharing: true,
    },
    
    mutations: {
      /** Retry pour les mutations */
      retry: 1,
      
      /** Mode réseau pour les mutations */
      networkMode: 'online',
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Précharge des données dans le cache
 */
export async function prefetchQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  staleTime = STALE_TIME
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime,
  });
}

/**
 * Invalide toutes les requêtes d'un type
 */
export function invalidateQueries(prefix: string): void {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && key.startsWith(prefix);
    },
  });
}

/**
 * Vide complètement le cache (utilisé lors de la déconnexion)
 */
export function clearCache(): void {
  queryClient.clear();
}

/**
 * Récupère les données du cache sans déclencher de requête
 */
export function getQueryData<T>(queryKey: string[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Met à jour manuellement les données en cache
 */
export function setQueryData<T>(
  queryKey: string[],
  updater: T | ((old: T | undefined) => T)
): void {
  queryClient.setQueryData(queryKey, updater);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default queryClient;
