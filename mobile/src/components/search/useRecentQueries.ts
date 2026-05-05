/**
 * useRecentQueries — Hook AsyncStorage + sync API (best-effort).
 *
 * Primary cache : AsyncStorage clé "deepsight_recent_queries" (5 max).
 * Fallback API : `searchApi.getRecentQueries()` au mount si AsyncStorage vide.
 */

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { searchApi } from "@/services/api";

const STORAGE_KEY = "deepsight_recent_queries";
const MAX_LOCAL = 5;

interface UseRecentQueriesResult {
  queries: string[];
  loading: boolean;
  push: (q: string) => Promise<void>;
  clear: () => Promise<void>;
}

export function useRecentQueries(): UseRecentQueriesResult {
  const [queries, setQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load on mount: AsyncStorage first, fallback to API
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          if (active) setQueries(parsed.slice(0, MAX_LOCAL));
        } else {
          // Fallback API
          const res = await searchApi.getRecentQueries();
          if (active) {
            setQueries(res.queries.slice(0, MAX_LOCAL));
            await AsyncStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(res.queries.slice(0, MAX_LOCAL)),
            );
          }
        }
      } catch {
        if (active) setQueries([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const push = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setQueries((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(
        0,
        MAX_LOCAL,
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    setQueries([]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    await searchApi.clearRecentQueries().catch(() => {});
  }, []);

  return { queries, loading, push, clear };
}
