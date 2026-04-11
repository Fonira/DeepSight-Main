/**
 * useWhackAMole — Game state machine, timers, and safe position calculation.
 * Consumes LoadingWordContext via getWordByFilter (does NOT mutate currentWord).
 */

import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLoadingWord } from '../../contexts/LoadingWordContext';
import type { LoadingWord } from '../../contexts/LoadingWordContext';
import {
  MOLE_VISIBLE_MIN, MOLE_VISIBLE_MAX,
  COOLDOWN_MIN, COOLDOWN_MAX,
  FACT_DISPLAY_DURATION, INITIAL_DELAY,
  MOLE_SIZE, EDGE_PADDING, SAFE_ZONE_BUFFER,
  POSITION_CANDIDATES, FACT_CARD_WIDTH,
  LS_ENABLED, LS_DAILY_CATCHES,
  CONFETTI_MILESTONES,
} from './whackAMoleConstants';

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'visible' | 'caught' | 'missed' | 'revealing';

interface WhackAMoleState {
  phase: Phase;
  position: { x: number; y: number };
  currentFact: LoadingWord | null;
  streak: number;
  totalCatches: number;
  enabled: boolean;
  visibleDuration: number;
}

type Action =
  | { type: 'SPAWN'; position: { x: number; y: number }; fact: LoadingWord; duration: number }
  | { type: 'CATCH' }
  | { type: 'MISS' }
  | { type: 'REVEAL_DONE' }
  | { type: 'RESET_TO_IDLE' }
  | { type: 'TOGGLE_ENABLED'; enabled: boolean };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: WhackAMoleState, action: Action): WhackAMoleState {
  switch (action.type) {
    case 'SPAWN':
      return {
        ...state,
        phase: 'visible',
        position: action.position,
        currentFact: action.fact,
        visibleDuration: action.duration,
      };
    case 'CATCH':
      return {
        ...state,
        phase: 'caught',
        streak: state.streak + 1,
        totalCatches: state.totalCatches + 1,
      };
    case 'MISS':
      return { ...state, phase: 'missed', streak: 0 };
    case 'REVEAL_DONE':
      return { ...state, phase: 'revealing' };
    case 'RESET_TO_IDLE':
      return { ...state, phase: 'idle' };
    case 'TOGGLE_ENABLED':
      return { ...state, enabled: action.enabled, phase: 'idle' };
    default:
      return state;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function getSafeZones(sidebarCollapsed: boolean, isMobile: boolean): Rect[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const zones: Rect[] = [];

  // Sidebar (desktop)
  if (!isMobile) {
    const sidebarW = sidebarCollapsed ? 60 : 240;
    zones.push({ x: 0, y: 0, w: sidebarW, h: vh });
  }

  // Mobile hamburger area
  if (isMobile) {
    zones.push({ x: 0, y: 0, w: 60, h: 60 });
  }

  // SmartInputBar (center top area)
  zones.push({ x: vw * 0.15, y: 0, w: vw * 0.7, h: 120 });

  // BottomNav (mobile)
  if (isMobile) {
    zones.push({ x: 0, y: vh - 80, w: vw, h: 80 });
  }

  return zones;
}

function computeSafePosition(sidebarCollapsed: boolean, isMobile: boolean): { x: number; y: number } | null {
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

    const overlaps = zones.some(zone => rectsOverlap(moleRect, zone));
    if (!overlaps) {
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Clamp fact card position so it doesn't overflow viewport */
export function clampFactPosition(molePos: { x: number; y: number }): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardH = 200; // approximate

  let x = molePos.x - FACT_CARD_WIDTH / 2 + MOLE_SIZE / 2;
  let y = molePos.y + MOLE_SIZE + 12;

  // Clamp horizontal
  if (x < 12) x = 12;
  if (x + FACT_CARD_WIDTH > vw - 12) x = vw - FACT_CARD_WIDTH - 12;

  // If overflows bottom, show above the mole
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
    localStorage.setItem(LS_DAILY_CATCHES, JSON.stringify({ date: today, count: next }));
  } catch { /* */ }
  return next;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseWhackAMoleOptions {
  sidebarCollapsed: boolean;
}

export function useWhackAMole({ sidebarCollapsed }: UseWhackAMoleOptions) {
  const { getWordByFilter } = useLoadingWord();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  const initialEnabled = useMemo(() => {
    try {
      const stored = localStorage.getItem(LS_ENABLED);
      return stored !== 'false'; // default true
    } catch {
      return true;
    }
  }, []);

  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    position: { x: 0, y: 0 },
    currentFact: null,
    streak: 0,
    totalCatches: 0,
    enabled: initialEnabled,
    visibleDuration: MOLE_VISIBLE_MIN,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Listen for storage events (from Sidebar toggle)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_ENABLED) {
        dispatch({ type: 'TOGGLE_ENABLED', enabled: e.newValue !== 'false' });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Clear any running timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Schedule next spawn
  const scheduleSpawn = useCallback((delay?: number) => {
    clearTimer();
    const wait = delay ?? randomInRange(COOLDOWN_MIN, COOLDOWN_MAX);
    timerRef.current = setTimeout(() => {
      const pos = computeSafePosition(sidebarCollapsed, isMobile);
      const fact = getWordByFilter({});
      if (pos && fact) {
        const duration = prefersReducedMotion
          ? 10000
          : randomInRange(MOLE_VISIBLE_MIN, MOLE_VISIBLE_MAX);
        dispatch({ type: 'SPAWN', position: pos, fact, duration });
      } else {
        // Retry after short delay if no valid position/fact
        scheduleSpawn(3000);
      }
    }, wait);
  }, [clearTimer, sidebarCollapsed, isMobile, getWordByFilter, prefersReducedMotion]);

  // Handle catch
  const handleCatch = useCallback(() => {
    if (state.phase !== 'visible') return;
    clearTimer();
    dispatch({ type: 'CATCH' });
    incrementDailyCatches();

    // After caught animation, transition to revealing
    timerRef.current = setTimeout(() => {
      dispatch({ type: 'REVEAL_DONE' });
    }, 500);
  }, [state.phase, clearTimer]);

  // Dismiss fact card (manual or auto)
  const dismissFact = useCallback(() => {
    clearTimer();
    dispatch({ type: 'RESET_TO_IDLE' });
    scheduleSpawn();
  }, [clearTimer, scheduleSpawn]);

  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    const next = !state.enabled;
    dispatch({ type: 'TOGGLE_ENABLED', enabled: next });
    try {
      localStorage.setItem(LS_ENABLED, String(next));
    } catch { /* */ }
  }, [state.enabled]);

  // Phase-based timer management
  useEffect(() => {
    if (!state.enabled) {
      clearTimer();
      return;
    }

    switch (state.phase) {
      case 'idle':
        // Don't auto-schedule here — handled by dismissFact and initial mount
        break;
      case 'visible': {
        // Auto-miss after visible duration
        clearTimer();
        timerRef.current = setTimeout(() => {
          dispatch({ type: 'MISS' });
        }, state.visibleDuration);
        break;
      }
      case 'missed': {
        // After miss animation, go idle and schedule next
        clearTimer();
        timerRef.current = setTimeout(() => {
          dispatch({ type: 'RESET_TO_IDLE' });
          scheduleSpawn();
        }, 600);
        break;
      }
      case 'revealing': {
        // Auto-dismiss fact card
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
  const isConfettiMilestone = state.phase === 'caught' && CONFETTI_MILESTONES.includes(state.streak);

  return {
    phase: state.phase,
    position: state.position,
    currentFact: state.currentFact,
    streak: state.streak,
    totalCatches: state.totalCatches,
    enabled: state.enabled,
    visibleDuration: state.visibleDuration,
    prefersReducedMotion,
    isConfettiMilestone,
    handleCatch,
    dismissFact,
    toggleEnabled,
  };
}
