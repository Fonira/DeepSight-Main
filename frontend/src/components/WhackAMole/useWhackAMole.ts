/**
 * useWhackAMole — Game state machine, timers, and safe position calculation.
 * Supports two modes: 'classic' (catch mole → reveal fact) and 'reverse' (see image → guess keyword).
 * Consumes LoadingWordContext via getWordByFilter (does NOT mutate currentWord).
 */

import { useReducer, useEffect, useRef, useCallback, useMemo } from "react";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import type { LoadingWord } from "../../contexts/LoadingWordContext";
import {
  MOLE_VISIBLE_MIN,
  MOLE_VISIBLE_MAX,
  COOLDOWN_MIN,
  COOLDOWN_MAX,
  FACT_DISPLAY_DURATION,
  INITIAL_DELAY,
  MOLE_SIZE,
  EDGE_PADDING,
  SAFE_ZONE_BUFFER,
  POSITION_CANDIDATES,
  FACT_CARD_WIDTH,
  LS_ENABLED,
  LS_DAILY_CATCHES,
  LS_GAME_MODE,
  CONFETTI_MILESTONES,
  REVERSE_GUESS_DURATION,
} from "./whackAMoleConstants";
import { keywordImageApi } from "../../services/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GameMode = "classic" | "reverse";
type Phase =
  | "idle"
  | "visible"
  | "caught"
  | "missed"
  | "revealing"
  | "guessing";

interface WhackAMoleState {
  phase: Phase;
  position: { x: number; y: number };
  currentFact: LoadingWord | null;
  streak: number;
  totalCatches: number;
  enabled: boolean;
  visibleDuration: number;
  mode: GameMode;
  reverseImageUrl: string | null;
  lastGuessResult: "correct" | "close" | "wrong" | null;
}

type Action =
  | {
      type: "SPAWN";
      position: { x: number; y: number };
      fact: LoadingWord;
      duration: number;
    }
  | { type: "SPAWN_REVERSE"; fact: LoadingWord; imageUrl: string }
  | { type: "CATCH" }
  | { type: "MISS" }
  | { type: "GUESS_SUBMIT"; result: "correct" | "close" | "wrong" }
  | { type: "REVEAL_DONE" }
  | { type: "RESET_TO_IDLE" }
  | { type: "TOGGLE_ENABLED"; enabled: boolean }
  | { type: "SET_MODE"; mode: GameMode };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: WhackAMoleState, action: Action): WhackAMoleState {
  switch (action.type) {
    case "SPAWN":
      return {
        ...state,
        phase: "visible",
        position: action.position,
        currentFact: action.fact,
        visibleDuration: action.duration,
        reverseImageUrl: null,
        lastGuessResult: null,
      };
    case "SPAWN_REVERSE":
      return {
        ...state,
        phase: "guessing",
        currentFact: action.fact,
        reverseImageUrl: action.imageUrl,
        visibleDuration: REVERSE_GUESS_DURATION,
        lastGuessResult: null,
        position: {
          x: Math.max(12, (window.innerWidth - 360) / 2),
          y: Math.max(80, (window.innerHeight - 500) / 2),
        },
      };
    case "CATCH":
      return {
        ...state,
        phase: "caught",
        streak: state.streak + 1,
        totalCatches: state.totalCatches + 1,
      };
    case "MISS":
      return { ...state, phase: "missed", streak: 0 };
    case "GUESS_SUBMIT":
      return {
        ...state,
        phase: "revealing",
        lastGuessResult: action.result,
        streak: action.result === "correct" ? state.streak + 1 : 0,
        totalCatches:
          action.result === "correct"
            ? state.totalCatches + 1
            : state.totalCatches,
      };
    case "REVEAL_DONE":
      return { ...state, phase: "revealing" };
    case "RESET_TO_IDLE":
      return { ...state, phase: "idle", lastGuessResult: null };
    case "TOGGLE_ENABLED":
      return { ...state, enabled: action.enabled, phase: "idle" };
    case "SET_MODE":
      return { ...state, mode: action.mode, phase: "idle" };
    default:
      return state;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function getSafeZones(sidebarCollapsed: boolean, isMobile: boolean): Rect[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const zones: Rect[] = [];

  if (!isMobile) {
    const sidebarW = sidebarCollapsed ? 60 : 240;
    zones.push({ x: 0, y: 0, w: sidebarW, h: vh });
  }
  if (isMobile) {
    zones.push({ x: 0, y: 0, w: 60, h: 60 });
  }
  zones.push({ x: vw * 0.15, y: 0, w: vw * 0.7, h: 120 });
  if (isMobile) {
    zones.push({ x: 0, y: vh - 80, w: vw, h: 80 });
  }
  return zones;
}

function computeSafePosition(
  sidebarCollapsed: boolean,
  isMobile: boolean,
): { x: number; y: number } | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const zones = getSafeZones(sidebarCollapsed, isMobile);

  const minX = EDGE_PADDING;
  const maxX = vw - EDGE_PADDING - MOLE_SIZE;
  const minY = EDGE_PADDING;
  const maxY = vh - EDGE_PADDING - MOLE_SIZE;

  if (maxX <= minX || maxY <= minY) return null;

  const candidates: { x: number; y: number }[] = [];
  for (let i = 0; i < POSITION_CANDIDATES; i++) {
    const x = randomInRange(minX, maxX);
    const y = randomInRange(minY, maxY);
    const moleRect: Rect = {
      x: x - SAFE_ZONE_BUFFER,
      y: y - SAFE_ZONE_BUFFER,
      w: MOLE_SIZE + SAFE_ZONE_BUFFER * 2,
      h: MOLE_SIZE + SAFE_ZONE_BUFFER * 2,
    };
    const overlaps = zones.some((zone) => rectsOverlap(moleRect, zone));
    if (!overlaps) {
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Clamp fact card position so it doesn't overflow viewport */
export function clampFactPosition(molePos: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardH = 200;

  let x = molePos.x - FACT_CARD_WIDTH / 2 + MOLE_SIZE / 2;
  let y = molePos.y + MOLE_SIZE + 12;

  if (x < 12) x = 12;
  if (x + FACT_CARD_WIDTH > vw - 12) x = vw - FACT_CARD_WIDTH - 12;
  if (y + cardH > vh - 12) {
    y = molePos.y - cardH - 12;
  }
  if (y < 12) y = 12;

  return { x, y };
}

// ─── Daily catches persistence ──────────────────────────────────────────────

function getDailyCatches(): number {
  try {
    const raw = localStorage.getItem(LS_DAILY_CATCHES);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { date: string; count: number };
    const today = new Date().toISOString().slice(0, 10);
    return data.date === today ? data.count : 0;
  } catch {
    return 0;
  }
}

function incrementDailyCatches(): number {
  const today = new Date().toISOString().slice(0, 10);
  const current = getDailyCatches();
  const next = current + 1;
  try {
    localStorage.setItem(
      LS_DAILY_CATCHES,
      JSON.stringify({ date: today, count: next }),
    );
  } catch {
    /* */
  }
  return next;
}

// ─── Fuzzy answer matching (reverse mode) ──────────────────────────────────

function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(le |la |les |l'|l\u2019|the |a |an )/i, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function checkGuess(
  input: string,
  term: string,
): "correct" | "close" | "wrong" {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(term);
  if (!a) return "wrong";
  if (a === b) return "correct";
  if (a.includes(b) || b.includes(a)) return "close";
  if (levenshtein(a, b) <= 3) return "close";
  return "wrong";
}

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseWhackAMoleOptions {
  sidebarCollapsed: boolean;
}

export function useWhackAMole({ sidebarCollapsed }: UseWhackAMoleOptions) {
  const { getWordByFilter } = useLoadingWord();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  const initialEnabled = useMemo(() => {
    try {
      const stored = localStorage.getItem(LS_ENABLED);
      return stored !== "false";
    } catch {
      return true;
    }
  }, []);

  const initialMode = useMemo((): GameMode => {
    try {
      const stored = localStorage.getItem(LS_GAME_MODE);
      return stored === "reverse" ? "reverse" : "classic";
    } catch {
      return "classic";
    }
  }, []);

  const [state, dispatch] = useReducer(reducer, {
    phase: "idle",
    position: { x: 0, y: 0 },
    currentFact: null,
    streak: 0,
    totalCatches: 0,
    enabled: initialEnabled,
    visibleDuration: MOLE_VISIBLE_MIN,
    mode: initialMode,
    reverseImageUrl: null,
    lastGuessResult: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useMemo(() => {
    try {
      return (
        typeof window !== "undefined" &&
        (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ??
          false)
      );
    } catch {
      return false;
    }
  }, []);

  // Listen for storage events (from Sidebar toggle)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_ENABLED) {
        dispatch({ type: "TOGGLE_ENABLED", enabled: e.newValue !== "false" });
      }
      if (e.key === LS_GAME_MODE) {
        dispatch({
          type: "SET_MODE",
          mode: e.newValue === "reverse" ? "reverse" : "classic",
        });
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Clear any running timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Try to find a word with an image (for reverse mode)
  const findWordWithImage = useCallback(async (): Promise<{
    fact: LoadingWord;
    imageUrl: string;
  } | null> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const fact = getWordByFilter({});
      if (!fact) continue;
      if (fact.imageUrl) {
        return { fact, imageUrl: fact.imageUrl };
      }
      const result = await keywordImageApi.getKeywordImage(fact.term);
      if (result.image_url) {
        return { fact, imageUrl: result.image_url };
      }
    }
    return null;
  }, [getWordByFilter]);

  // Schedule next spawn
  const scheduleSpawn = useCallback(
    (delay?: number) => {
      clearTimer();
      const wait = delay ?? randomInRange(COOLDOWN_MIN, COOLDOWN_MAX);
      timerRef.current = setTimeout(async () => {
        if (state.mode === "reverse") {
          const result = await findWordWithImage();
          if (result) {
            dispatch({
              type: "SPAWN_REVERSE",
              fact: result.fact,
              imageUrl: result.imageUrl,
            });
          } else {
            // No image found — fall back to classic for this round
            const pos = computeSafePosition(sidebarCollapsed, isMobile);
            const fact = getWordByFilter({});
            if (pos && fact) {
              const duration = randomInRange(
                MOLE_VISIBLE_MIN,
                MOLE_VISIBLE_MAX,
              );
              dispatch({ type: "SPAWN", position: pos, fact, duration });
            } else {
              scheduleSpawn(3000);
            }
          }
        } else {
          const pos = computeSafePosition(sidebarCollapsed, isMobile);
          const fact = getWordByFilter({});
          if (pos && fact) {
            const duration = prefersReducedMotion
              ? 10000
              : randomInRange(MOLE_VISIBLE_MIN, MOLE_VISIBLE_MAX);
            dispatch({ type: "SPAWN", position: pos, fact, duration });
          } else {
            scheduleSpawn(3000);
          }
        }
      }, wait);
    },
    [
      clearTimer,
      sidebarCollapsed,
      isMobile,
      getWordByFilter,
      prefersReducedMotion,
      state.mode,
      findWordWithImage,
    ],
  );

  // Handle catch (classic mode)
  const handleCatch = useCallback(() => {
    if (state.phase !== "visible") return;
    clearTimer();
    dispatch({ type: "CATCH" });
    incrementDailyCatches();

    timerRef.current = setTimeout(() => {
      dispatch({ type: "REVEAL_DONE" });
    }, 500);
  }, [state.phase, clearTimer]);

  // Handle guess submission (reverse mode)
  const handleGuess = useCallback(
    (input: string) => {
      if (state.phase !== "guessing" || !state.currentFact) return;
      clearTimer();
      const result = checkGuess(input, state.currentFact.term);
      dispatch({ type: "GUESS_SUBMIT", result });
      if (result === "correct") {
        incrementDailyCatches();
      }
    },
    [state.phase, state.currentFact, clearTimer],
  );

  // Dismiss fact card (manual or auto)
  const dismissFact = useCallback(() => {
    clearTimer();
    dispatch({ type: "RESET_TO_IDLE" });
    scheduleSpawn();
  }, [clearTimer, scheduleSpawn]);

  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    const next = !state.enabled;
    dispatch({ type: "TOGGLE_ENABLED", enabled: next });
    try {
      localStorage.setItem(LS_ENABLED, String(next));
    } catch {
      /* */
    }
  }, [state.enabled]);

  // Set game mode
  const setMode = useCallback((mode: GameMode) => {
    dispatch({ type: "SET_MODE", mode });
    try {
      localStorage.setItem(LS_GAME_MODE, mode);
    } catch {
      /* */
    }
  }, []);

  // Phase-based timer management
  useEffect(() => {
    if (!state.enabled) {
      clearTimer();
      return;
    }

    switch (state.phase) {
      case "idle":
        break;
      case "visible": {
        clearTimer();
        timerRef.current = setTimeout(() => {
          dispatch({ type: "MISS" });
        }, state.visibleDuration);
        break;
      }
      case "missed": {
        clearTimer();
        timerRef.current = setTimeout(() => {
          dispatch({ type: "RESET_TO_IDLE" });
          scheduleSpawn();
        }, 600);
        break;
      }
      case "guessing": {
        clearTimer();
        timerRef.current = setTimeout(() => {
          dispatch({ type: "GUESS_SUBMIT", result: "wrong" });
        }, REVERSE_GUESS_DURATION);
        break;
      }
      case "revealing": {
        clearTimer();
        timerRef.current = setTimeout(() => {
          dismissFact();
        }, FACT_DISPLAY_DURATION);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.enabled, state.visibleDuration]);

  // Initial spawn on mount
  useEffect(() => {
    if (state.enabled) {
      scheduleSpawn(INITIAL_DELAY);
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.enabled]);

  // Check if this catch is a confetti milestone
  const isConfettiMilestone =
    state.phase === "caught" && CONFETTI_MILESTONES.includes(state.streak);

  return {
    phase: state.phase,
    position: state.position,
    currentFact: state.currentFact,
    streak: state.streak,
    totalCatches: state.totalCatches,
    enabled: state.enabled,
    visibleDuration: state.visibleDuration,
    mode: state.mode,
    reverseImageUrl: state.reverseImageUrl,
    lastGuessResult: state.lastGuessResult,
    prefersReducedMotion,
    isConfettiMilestone,
    handleCatch,
    handleGuess,
    dismissFact,
    toggleEnabled,
    setMode,
  };
}
