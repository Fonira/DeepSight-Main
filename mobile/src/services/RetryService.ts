/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🔄 RETRY SERVICE — Smart retry with exponential backoff                           ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Exponential backoff with jitter                                                  ║
 * ║  - Configurable retry strategies                                                    ║
 * ║  - Network-aware retries                                                            ║
 * ║  - Circuit breaker pattern                                                          ║
 * ║  - Retry hooks for UI feedback                                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import NetInfo from "@react-native-community/netinfo";
import { ApiError } from "./apiErrors";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier: number;
  /** Add random jitter to prevent thundering herd */
  jitter: boolean;
  /** Only retry on network errors */
  retryNetworkOnly: boolean;
  /** HTTP status codes to retry on */
  retryOnStatus: number[];
  /** Timeout for each attempt in milliseconds */
  timeoutMs: number;
  /** Skip the Promise.race timeout (use when caller already handles its own AbortController timeout) */
  skipTimeout?: boolean;
}

export interface RetryState {
  attempt: number;
  maxAttempts: number;
  nextDelayMs: number;
  lastError: Error | null;
}

export type RetryCallback = (state: RetryState) => void;

// Default configuration
const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryNetworkOnly: false,
  retryOnStatus: [408, 429, 500, 502, 503, 504],
  timeoutMs: 30000,
};

// Preset configurations
export const RETRY_PRESETS = {
  /** Quick retries for fast operations */
  quick: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
    jitter: true,
    retryNetworkOnly: false,
    retryOnStatus: [408, 429, 500, 502, 503, 504],
    timeoutMs: 10000,
  } as RetryConfig,

  /** Standard retries for API calls */
  standard: DEFAULT_CONFIG,

  /** Aggressive retries for critical operations */
  aggressive: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitter: true,
    retryNetworkOnly: false,
    retryOnStatus: [408, 429, 500, 502, 503, 504],
    timeoutMs: 60000,
  } as RetryConfig,

  /** Patient retries for long operations */
  patient: {
    maxRetries: 4,
    initialDelayMs: 2000,
    maxDelayMs: 120000,
    backoffMultiplier: 3,
    jitter: true,
    retryNetworkOnly: false,
    retryOnStatus: [408, 429, 500, 502, 503, 504],
    timeoutMs: 120000,
  } as RetryConfig,

  /** Network-only retries */
  networkOnly: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryNetworkOnly: true,
    retryOnStatus: [],
    timeoutMs: 30000,
  } as RetryConfig,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers: Map<string, CircuitBreakerState> = new Map();
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT = 60000; // 1 minute

function getCircuitBreaker(key: string): CircuitBreakerState {
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    });
  }
  return circuitBreakers.get(key)!;
}

function recordFailure(key: string): void {
  const breaker = getCircuitBreaker(key);
  breaker.failures++;
  breaker.lastFailure = Date.now();

  if (breaker.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    breaker.isOpen = true;
    if (__DEV__) {
      console.warn(`[RetryService] Circuit breaker opened for: ${key}`);
    }
  }
}

function recordSuccess(key: string): void {
  const breaker = getCircuitBreaker(key);
  breaker.failures = 0;
  breaker.isOpen = false;
}

function isCircuitOpen(key: string): boolean {
  const breaker = getCircuitBreaker(key);

  if (!breaker.isOpen) {
    return false;
  }

  // Check if reset timeout has passed
  if (Date.now() - breaker.lastFailure > CIRCUIT_RESET_TIMEOUT) {
    breaker.isOpen = false;
    breaker.failures = 0;
    return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  if (config.jitter) {
    // Add 0-25% random jitter
    const jitterFactor = 1 + Math.random() * 0.25;
    return Math.floor(cappedDelay * jitterFactor);
  }

  return Math.floor(cappedDelay);
}

/**
 * Check if we should retry based on the error
 */
function shouldRetry(error: unknown, config: RetryConfig): boolean {
  // Check for network errors
  if (
    error instanceof TypeError &&
    error.message.includes("Network request failed")
  ) {
    return true;
  }

  // Check for timeout errors
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  // If network-only, don't retry other errors
  if (config.retryNetworkOnly) {
    return false;
  }

  // Check for retryable HTTP status codes
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    return config.retryOnStatus.includes(status);
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚦 RETRY POLICY (idempotence, 429 Retry-After, services non configurés)
// ═══════════════════════════════════════════════════════════════════════════════

/** Attente maximale acceptée pour rejouer automatiquement un 429 ; au-delà, l'erreur remonte. */
export const MAX_RATE_LIMIT_WAIT_MS = 10_000;
/** Code de l'ApiError levée quand le disjoncteur d'un endpoint est ouvert. */
export const CIRCUIT_OPEN_CODE = "CIRCUIT_OPEN";

export interface RetryDecision {
  retry: boolean;
  /** Délai imposé (Retry-After) ; sinon backoff exponentiel. */
  delayMs?: number;
  rateLimited?: boolean;
}

interface ErrorShape {
  status?: number;
  code?: string;
  retryAfterMs?: number;
}

function errorShape(error: unknown): ErrorShape {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      retryAfterMs: error.retryAfterMs,
    };
  }
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    status: typeof record.status === "number" ? record.status : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    retryAfterMs:
      typeof record.retryAfterMs === "number" ? record.retryAfterMs : undefined,
  };
}

/**
 * Décide si une erreur doit être rejouée.
 * - 429 : le serveur n'a pas traité la requête → rejouable même en POST, une seule
 *   fois, uniquement si Retry-After est connu et ≤ MAX_RATE_LIMIT_WAIT_MS.
 * - Requêtes non idempotentes (POST/PATCH) : jamais rejouées sur timeout/5xx/réseau
 *   (doublons de Quick Chat, crédits débités deux fois, sessions voix en double).
 * - 503 avec un code métier (payments_unavailable, voice_service_unavailable…) :
 *   déterministe, pas de relance.
 */
export function getRetryDecision(
  error: unknown,
  config: RetryConfig,
  context: { idempotent: boolean; rateLimitRetried: boolean },
): RetryDecision {
  const { status, code, retryAfterMs } = errorShape(error);

  if (status === 429) {
    const canWait =
      !config.retryNetworkOnly &&
      config.retryOnStatus.includes(429) &&
      !context.rateLimitRetried &&
      retryAfterMs !== undefined &&
      retryAfterMs <= MAX_RATE_LIMIT_WAIT_MS;
    return canWait
      ? {
          retry: true,
          delayMs: retryAfterMs + Math.floor(Math.random() * 250),
          rateLimited: true,
        }
      : { retry: false };
  }

  if (!context.idempotent) return { retry: false };
  if (status === 503 && code) return { retry: false };

  return { retry: shouldRetry(error, config) };
}

/** Seules les pannes réseau/serveur comptent pour le disjoncteur (pas les 4xx ni les 503 métier). */
export function countsAsCircuitFailure(error: unknown): boolean {
  const { status, code } = errorShape(error);
  if (status === undefined) return true;
  if (status === 0) return code !== "OFFLINE" && code !== CIRCUIT_OPEN_CODE;
  if (status === 408) return true;
  if (status === 503 && code) return false;
  return status >= 500;
}

/**
 * Wait for a specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for network connectivity
 */
async function waitForNetwork(timeoutMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const state = await NetInfo.fetch();
    if (state.isConnected && state.isInternetReachable !== false) {
      return true;
    }
    await wait(1000); // Check every second
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryConfig> & {
    circuitBreakerKey?: string;
    onRetry?: RetryCallback;
    /** false pour POST/PATCH : jamais rejoués sur timeout/5xx (défaut : true). */
    idempotent?: boolean;
  } = {},
): Promise<T> {
  const config: RetryConfig = { ...DEFAULT_CONFIG, ...options };
  const { circuitBreakerKey, onRetry } = options;
  const idempotent = options.idempotent ?? true;

  // Check circuit breaker
  if (circuitBreakerKey && isCircuitOpen(circuitBreakerKey)) {
    throw new ApiError(
      "Service temporarily unavailable, please retry shortly",
      0,
      CIRCUIT_OPEN_CODE,
    );
  }

  let lastError: Error | null = null;
  let rateLimitRetried = false;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Check network before retries (not first attempt)
      if (attempt > 0) {
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          // Wait for network
          const hasNetwork = await waitForNetwork(5000);
          if (!hasNetwork) {
            throw new Error("No network connectivity");
          }
        }
      }

      // Execute with timeout (skip if caller already manages its own AbortController)
      const result = config.skipTimeout
        ? await fn()
        : await Promise.race([
            fn(),
            new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error("Request timeout")),
                config.timeoutMs,
              );
            }),
          ]);

      // Success - record for circuit breaker
      if (circuitBreakerKey) {
        recordSuccess(circuitBreakerKey);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const decision: RetryDecision =
        attempt < config.maxRetries
          ? getRetryDecision(error, config, { idempotent, rateLimitRetried })
          : { retry: false };

      if (!decision.retry) {
        // Record failure for circuit breaker (network/server failures only)
        if (circuitBreakerKey && countsAsCircuitFailure(error)) {
          recordFailure(circuitBreakerKey);
        }
        throw lastError;
      }

      if (decision.rateLimited) rateLimitRetried = true;

      // Calculate delay (Retry-After imposed by the server, else exponential backoff)
      const delayMs = decision.delayMs ?? calculateDelay(attempt, config);

      // Notify callback
      if (onRetry) {
        onRetry({
          attempt: attempt + 1,
          maxAttempts: config.maxRetries + 1,
          nextDelayMs: delayMs,
          lastError,
        });
      }

      if (__DEV__) {
        console.log(
          `[RetryService] Retry ${attempt + 1}/${config.maxRetries} in ${delayMs}ms`,
        );
      }

      // Wait before retry
      await wait(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error("Retry failed");
}

/**
 * Create a retryable fetch function
 */
export function createRetryableFetch(
  baseConfig: Partial<RetryConfig> = {},
): (url: string, init?: RequestInit) => Promise<Response> {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    return withRetry(
      async () => {
        const response = await fetch(url, init);

        if (
          !response.ok &&
          baseConfig.retryOnStatus?.includes(response.status)
        ) {
          const error = new Error(`HTTP ${response.status}`) as Error & {
            status: number;
          };
          error.status = response.status;
          throw error;
        }

        return response;
      },
      {
        ...baseConfig,
        circuitBreakerKey: new URL(url).hostname,
      },
    );
  };
}

/**
 * Retry hook for React components
 */
export function useRetryState() {
  const [state, setState] = React.useState<RetryState | null>(null);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const execute = React.useCallback(
    async <T>(
      fn: () => Promise<T>,
      config: Partial<RetryConfig> = {},
    ): Promise<T> => {
      setIsRetrying(true);
      setState(null);

      try {
        return await withRetry(fn, {
          ...config,
          onRetry: (retryState) => {
            setState(retryState);
          },
        });
      } finally {
        setIsRetrying(false);
        setState(null);
      }
    },
    [],
  );

  return { execute, state, isRetrying };
}

/**
 * Wrapper simplifié pour utiliser RetryService avec un preset dans api.ts.
 * Usage: const data = await withRetryPreset(() => fetch(...), 'standard');
 */
export async function withRetryPreset<T>(
  fn: () => Promise<T>,
  preset: keyof typeof RETRY_PRESETS = "standard",
  context?: string,
  options: { idempotent?: boolean } = {},
): Promise<T> {
  return withRetry(fn, {
    ...RETRY_PRESETS[preset],
    // api.ts already manages its own AbortController timeout per request,
    // so skip the Promise.race timeout to avoid double-timeout race conditions
    skipTimeout: true,
    circuitBreakerKey: context || "api-call",
    idempotent: options.idempotent,
  });
}

/**
 * Reset the circuit breaker for a specific key.
 * Call this before retrying a known-good endpoint (e.g., after analysis completion
 * with a fresh summaryId) so accumulated failures don't block the fetch.
 */
export function resetCircuitBreaker(key: string): void {
  const breaker = circuitBreakers.get(key);
  if (breaker) {
    breaker.failures = 0;
    breaker.isOpen = false;
    if (__DEV__) {
      console.log(`[RetryService] Circuit breaker reset for: ${key}`);
    }
  }
}

export const RetryService = {
  withRetry,
  withRetryPreset,
  createRetryableFetch,
  useRetryState,
  RETRY_PRESETS,
  isCircuitOpen,
  resetCircuitBreaker,
};

export default RetryService;
