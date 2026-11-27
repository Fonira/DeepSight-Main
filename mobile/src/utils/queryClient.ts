import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../services/apiErrors";

/**
 * Les appels API passent déjà par RetryService (5xx/408 rejoués pour les GET,
 * 429 rejoué selon Retry-After). TanStack ne rejoue donc qu'une fois, et seulement
 * les coupures réseau qu'api.ts ne rejoue pas — avant, une même requête pouvait
 * partir jusqu'à 8 fois (4 tentatives × 2), y compris sur des 429 et des 503
 * « service non configuré ».
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError) {
    return error.status === 0 && error.code === "NETWORK_ERROR";
  }
  return true;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: shouldRetryQuery,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        // Mutations = écritures non idempotentes : jamais rejouées automatiquement
        retry: false,
      },
    },
  });
}
