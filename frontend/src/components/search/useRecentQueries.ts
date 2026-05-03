import { useCallback, useEffect, useState } from "react";
import { searchApi } from "../../services/api";

const STORAGE_KEY = "deepsight_recent_queries";
const MAX_LOCAL = 5;

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(queries: string[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(queries.slice(0, MAX_LOCAL)),
    );
  } catch {
    /* quota / private mode — silent ignore */
  }
}

export function useRecentQueries() {
  const [queries, setQueries] = useState<string[]>(() => readLocal());

  // Sync with server on mount (server has up to 10, merge with local)
  useEffect(() => {
    let cancelled = false;
    searchApi
      .getRecentQueries()
      .then(({ queries: server }) => {
        if (cancelled) return;
        const merged = Array.from(new Set([...readLocal(), ...server])).slice(
          0,
          MAX_LOCAL,
        );
        setQueries(merged);
        writeLocal(merged);
      })
      .catch(() => {
        /* offline / 404 / 401 — keep local */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setQueries((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(
        0,
        MAX_LOCAL,
      );
      writeLocal(next);
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    setQueries([]);
    writeLocal([]);
    try {
      await searchApi.clearRecentQueries();
    } catch {
      /* swallow */
    }
  }, []);

  return { queries, addQuery, clear };
}
