# Voice Prefs Apply Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-change auto-save in DeepSight web voice settings with a staged "Apply" flow backed by a global provider and a floating toolbar; when an ElevenLabs call is active and a restart-required field changes, Apply silently restarts the session via the existing `useVoiceChat.restart()`.

**Architecture:** A new `VoicePrefsStagingProvider` mounted at the root holds `applied` (last persisted prefs) and `staged` (pending diff). Both `VoiceSettings` (full page) and `VoiceLiveSettings` (in-call panel) write changes through `stage()` instead of calling `voiceApi.updatePreferences()` directly. A `StagedPrefsToolbar` floating component renders globally while changes are pending, exposing Apply / Cancel. Communication with the active call goes through 2 new events on the existing `voicePrefsBus`: `call_status_changed` (hook → provider) and `apply_with_restart` (provider → hook).

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS, Framer Motion, Vitest + Testing Library, Playwright. Working directory: `C:\Users\33667\DeepSight-Main` (frontend at `frontend/`).

**Reference spec:** `docs/superpowers/specs/2026-04-27-voice-prefs-apply-button-design.md`

---

## File Structure

### NEW files

| Path | Responsibility |
|---|---|
| `frontend/src/components/voice/staging/restartRequiredFields.ts` | Static set of fields that need a session restart + `isRestartRequired(staged, catalog)` helper |
| `frontend/src/components/voice/staging/VoicePrefsStagingProvider.tsx` | React Context Provider holding `applied`, `staged`, `callActive`, exposing `stage` / `cancel` / `apply` |
| `frontend/src/components/voice/staging/StagedPrefsToolbar.tsx` | Floating toolbar UI rendered globally when `hasChanges` |
| `frontend/src/components/voice/staging/__tests__/restartRequiredFields.test.ts` | Unit tests for the helper |
| `frontend/src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx` | Unit tests for the provider |
| `frontend/src/components/voice/staging/__tests__/StagedPrefsToolbar.test.tsx` | Unit tests for the toolbar |
| `frontend/e2e/voice-apply-flow.spec.ts` | E2E happy path |

### MODIFIED files

| Path | What changes |
|---|---|
| `frontend/src/components/voice/voicePrefsBus.ts` | Extend `VoicePrefsEvent` with 2 new event types |
| `frontend/src/components/voice/__tests__/voicePrefsBus.test.ts` (create if missing) | Cover new event types |
| `frontend/src/components/voice/useVoiceChat.ts` | Publish `call_status_changed`; subscribe to `apply_with_restart` |
| `frontend/src/components/voice/__tests__/useVoiceChat.test.ts` | New test cases for bus events |
| `frontend/src/components/voice/VoiceLiveSettings.tsx` | Replace direct `voiceApi.updatePreferences` calls with `stage()` for non-live fields |
| `frontend/src/components/voice/VoiceSettings.tsx` | Replace `savePreferences` with `stage()` everywhere; reset-defaults stages |
| `frontend/src/components/voice/__tests__/VoiceLiveSettings.test.tsx` | Adapt to staging-based behavior |
| `frontend/src/components/voice/__tests__/VoiceSettings.test.tsx` (or equivalent if exists) | Idem |
| `frontend/src/components/voice/VoiceModal.tsx` | Remove `restartRequired` state + amber banner + `restart_required` subscription |
| `frontend/src/App.tsx` | Wrap tree with `<VoicePrefsStagingProvider>` and render `<StagedPrefsToolbar />` |

---

## Tasks

### Task 1: Static set + isRestartRequired helper

**Files:**

- Create: `frontend/src/components/voice/staging/restartRequiredFields.ts`
- Test: `frontend/src/components/voice/staging/__tests__/restartRequiredFields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/voice/staging/__tests__/restartRequiredFields.test.ts
import { describe, it, expect } from "vitest";
import {
  RESTART_REQUIRED_FIELDS,
  isRestartRequired,
} from "../restartRequiredFields";
import type { VoiceChatSpeedPreset } from "../../../../services/api";

const PRESETS: VoiceChatSpeedPreset[] = [
  { id: "1x", label_fr: "Normal", label_en: "Normal", api_speed: 1, playback_rate: 1, concise: false },
  { id: "1.5x", label_fr: "Rapide", label_en: "Fast", api_speed: 1, playback_rate: 1.5, concise: false },
  { id: "3x", label_fr: "Concis", label_en: "Concise", api_speed: 1, playback_rate: 1, concise: true },
];

describe("RESTART_REQUIRED_FIELDS", () => {
  it("includes voice_id, voice_name, models, voice tuning, language, gender", () => {
    for (const key of [
      "voice_id",
      "voice_name",
      "tts_model",
      "voice_chat_model",
      "stability",
      "similarity_boost",
      "style",
      "use_speaker_boost",
      "language",
      "gender",
    ] as const) {
      expect(RESTART_REQUIRED_FIELDS.has(key)).toBe(true);
    }
  });

  it("does not include soft fields", () => {
    for (const key of [
      "ptt_key",
      "input_mode",
      "turn_timeout",
      "soft_timeout_seconds",
      "speed",
      "voice_chat_speed_preset",
    ] as const) {
      expect(RESTART_REQUIRED_FIELDS.has(key)).toBe(false);
    }
  });
});

describe("isRestartRequired", () => {
  it("returns false for empty staged", () => {
    expect(isRestartRequired({}, PRESETS)).toBe(false);
  });

  it("returns true when a hard field is staged", () => {
    expect(isRestartRequired({ voice_id: "abc" }, PRESETS)).toBe(true);
  });

  it("returns false when only soft fields are staged", () => {
    expect(
      isRestartRequired(
        { ptt_key: "Space", input_mode: "vad", turn_timeout: 12 },
        PRESETS,
      ),
    ).toBe(false);
  });

  it("returns true when staged voice_chat_speed_preset is a concise variant", () => {
    expect(
      isRestartRequired({ voice_chat_speed_preset: "3x" }, PRESETS),
    ).toBe(true);
  });

  it("returns false when staged voice_chat_speed_preset is a non-concise variant", () => {
    expect(
      isRestartRequired({ voice_chat_speed_preset: "1.5x" }, PRESETS),
    ).toBe(false);
  });

  it("returns false if catalog is empty (presets unknown → assume non-restart)", () => {
    expect(isRestartRequired({ voice_chat_speed_preset: "3x" }, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/staging/__tests__/restartRequiredFields.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/components/voice/staging/restartRequiredFields.ts
import type {
  VoicePreferences,
  VoiceChatSpeedPreset,
} from "../../../services/api";

/**
 * Fields that, when changed, require a fresh ElevenLabs session
 * (start/stop) for the change to take effect — they are baked into the
 * agent at startSession() time.
 *
 * Soft fields (input_mode, ptt_key, turn_timeout, soft_timeout_seconds,
 * speed, voice_chat_speed_preset non-concise) are persisted but do not
 * require a session restart.
 *
 * Live fields (volume, playback_rate) are not staged at all — they apply
 * directly to the DOM <audio> elements.
 */
export const RESTART_REQUIRED_FIELDS: ReadonlySet<keyof VoicePreferences> =
  new Set<keyof VoicePreferences>([
    "voice_id",
    "voice_name",
    "tts_model",
    "voice_chat_model",
    "stability",
    "similarity_boost",
    "style",
    "use_speaker_boost",
    "language",
    "gender",
  ]);

/**
 * Decide whether the staged diff requires an ElevenLabs session restart
 * to take effect. Handles the special case of voice_chat_speed_preset:
 * only concise variants need a restart (because they inject a system
 * prompt server-side at agent creation).
 */
export function isRestartRequired(
  staged: Partial<VoicePreferences>,
  speedPresets: VoiceChatSpeedPreset[],
): boolean {
  for (const key of Object.keys(staged) as (keyof VoicePreferences)[]) {
    if (RESTART_REQUIRED_FIELDS.has(key)) return true;
    if (key === "voice_chat_speed_preset") {
      const presetId = staged.voice_chat_speed_preset;
      const preset = speedPresets.find((p) => p.id === presetId);
      if (preset?.concise) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/voice/staging/__tests__/restartRequiredFields.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/staging/restartRequiredFields.ts frontend/src/components/voice/staging/__tests__/restartRequiredFields.test.ts
git commit -m "feat(voice): add RESTART_REQUIRED_FIELDS + isRestartRequired helper"
```

---

### Task 2: Extend voicePrefsBus event types

**Files:**

- Modify: `frontend/src/components/voice/voicePrefsBus.ts`
- Test: `frontend/src/components/voice/__tests__/voicePrefsBus.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/voice/__tests__/voicePrefsBus.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  emitVoicePrefsEvent,
  subscribeVoicePrefsEvents,
  presetToPlaybackRate,
} from "../voicePrefsBus";

describe("voicePrefsBus", () => {
  it("delivers playback_rate_changed (legacy)", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    emitVoicePrefsEvent({ type: "playback_rate_changed", value: 1.25 });
    expect(listener).toHaveBeenCalledWith({
      type: "playback_rate_changed",
      value: 1.25,
    });
    unsub();
  });

  it("delivers apply_with_restart (new)", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    emitVoicePrefsEvent({ type: "apply_with_restart" });
    expect(listener).toHaveBeenCalledWith({ type: "apply_with_restart" });
    unsub();
  });

  it("delivers call_status_changed (new)", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    emitVoicePrefsEvent({ type: "call_status_changed", active: true });
    expect(listener).toHaveBeenCalledWith({
      type: "call_status_changed",
      active: true,
    });
    unsub();
  });

  it("unsubscribe stops delivery", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    unsub();
    emitVoicePrefsEvent({ type: "apply_with_restart" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("preserves presetToPlaybackRate behavior", () => {
    expect(presetToPlaybackRate("1x")).toBe(1);
    expect(presetToPlaybackRate("1.5x")).toBe(1.5);
    expect(presetToPlaybackRate("unknown")).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/voicePrefsBus.test.ts`
Expected: FAIL on `apply_with_restart` and `call_status_changed` types (TS narrowing rejects unknown event types).

- [ ] **Step 3: Update the union type**

Edit `frontend/src/components/voice/voicePrefsBus.ts`. Replace the existing `VoicePrefsEvent` type definition with:

```ts
export type VoicePrefsEvent =
  | { type: "playback_rate_changed"; value: number }
  | { type: "restart_required"; reason: string }
  | { type: "apply_with_restart" }
  | { type: "call_status_changed"; active: boolean };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/voicePrefsBus.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/voicePrefsBus.ts frontend/src/components/voice/__tests__/voicePrefsBus.test.ts
git commit -m "feat(voice): add apply_with_restart and call_status_changed bus events"
```

---

### Task 3: VoicePrefsStagingProvider — skeleton + initial fetch

**Files:**

- Create: `frontend/src/components/voice/staging/VoicePrefsStagingProvider.tsx`
- Test: `frontend/src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx`

- [ ] **Step 1: Write the failing test for hydration + stage/cancel**

```tsx
// frontend/src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  VoicePrefsStagingProvider,
  useVoicePrefsStaging,
} from "../VoicePrefsStagingProvider";
import type {
  VoicePreferences,
  VoiceCatalog,
  VoiceChatSpeedPreset,
} from "../../../../services/api";

vi.mock("../../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/api")>(
    "../../../../services/api",
  );
  return {
    ...actual,
    voiceApi: {
      getPreferences: vi.fn(),
      getCatalog: vi.fn(),
      updatePreferences: vi.fn(),
    },
  };
});

import { voiceApi } from "../../../../services/api";

const APPLIED: VoicePreferences = {
  voice_id: "v1",
  voice_name: "Sophie",
  speed: 1.0,
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
  tts_model: "eleven_multilingual_v2",
  voice_chat_model: "eleven_flash_v2_5",
  language: "fr",
  gender: "female",
  input_mode: "ptt",
  ptt_key: " ",
  interruptions_enabled: true,
  turn_eagerness: 0.5,
  voice_chat_speed_preset: "1x",
  turn_timeout: 15,
  soft_timeout_seconds: 300,
};

const PRESETS: VoiceChatSpeedPreset[] = [
  { id: "1x", label_fr: "Normal", label_en: "Normal", api_speed: 1, playback_rate: 1, concise: false },
  { id: "3x", label_fr: "Concis", label_en: "Concise", api_speed: 1, playback_rate: 1, concise: true },
];

const CATALOG: VoiceCatalog = {
  voices: [],
  speed_presets: [],
  voice_chat_speed_presets: PRESETS,
  models: [],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VoicePrefsStagingProvider>{children}</VoicePrefsStagingProvider>
);

beforeEach(() => {
  vi.mocked(voiceApi.getPreferences).mockResolvedValue(APPLIED);
  vi.mocked(voiceApi.getCatalog).mockResolvedValue(CATALOG);
  vi.mocked(voiceApi.updatePreferences).mockReset();
});

describe("VoicePrefsStagingProvider", () => {
  it("hydrates applied + catalog on mount", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    expect(voiceApi.getPreferences).toHaveBeenCalled();
    expect(voiceApi.getCatalog).toHaveBeenCalled();
  });

  it("stage() merges into staged", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2" }));
    expect(result.current.staged).toEqual({ voice_id: "v2" });
    expect(result.current.hasChanges).toBe(true);
  });

  it("stage() with applied value removes the key (no-op detect)", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2" }));
    act(() => result.current.stage({ voice_id: "v1" }));
    expect(result.current.staged).toEqual({});
    expect(result.current.hasChanges).toBe(false);
  });

  it("cancel() clears staged", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2", language: "en" }));
    act(() => result.current.cancel());
    expect(result.current.staged).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation (skeleton — apply() comes in Task 4)**

```tsx
// frontend/src/components/voice/staging/VoicePrefsStagingProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  voiceApi,
  type VoicePreferences,
  type VoiceCatalog,
} from "../../../services/api";
import {
  emitVoicePrefsEvent,
  subscribeVoicePrefsEvents,
} from "../voicePrefsBus";
import { isRestartRequired } from "./restartRequiredFields";

export interface VoicePrefsStagingContextValue {
  applied: VoicePreferences | null;
  catalog: VoiceCatalog | null;
  staged: Partial<VoicePreferences>;
  hasChanges: boolean;
  hasRestartRequired: boolean;
  callActive: boolean;
  applying: boolean;
  applyError: string | null;
  stage: (updates: Partial<VoicePreferences>) => void;
  cancel: () => void;
  apply: () => Promise<void>;
}

const VoicePrefsStagingContext =
  createContext<VoicePrefsStagingContextValue | null>(null);

export const VoicePrefsStagingProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [applied, setApplied] = useState<VoicePreferences | null>(null);
  const [catalog, setCatalog] = useState<VoiceCatalog | null>(null);
  const [staged, setStaged] = useState<Partial<VoicePreferences>>({});
  const [callActive, setCallActive] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Hydrate prefs + catalog at mount.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([voiceApi.getPreferences(), voiceApi.getCatalog()])
      .then(([prefs, cat]) => {
        if (cancelled) return;
        setApplied(prefs);
        setCatalog(cat);
      })
      .catch(() => {
        // Silent failure — provider stays in loading state until the
        // first real `apply()` retries network.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to call_status_changed.
  useEffect(() => {
    const unsubscribe = subscribeVoicePrefsEvents((event) => {
      if (event.type === "call_status_changed") {
        setCallActive(event.active);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stage = useCallback(
    (updates: Partial<VoicePreferences>) => {
      setStaged((prev) => {
        const next: Partial<VoicePreferences> = { ...prev };
        for (const key of Object.keys(updates) as (keyof VoicePreferences)[]) {
          const value = updates[key];
          // No-op detect: if value matches applied, drop the key.
          if (applied && Object.is(applied[key], value)) {
            delete next[key];
          } else {
            // @ts-expect-error — heterogeneous union write is safe at runtime
            next[key] = value;
          }
        }
        return next;
      });
    },
    [applied],
  );

  const cancel = useCallback(() => {
    setStaged({});
    setApplyError(null);
  }, []);

  const apply = useCallback(async () => {
    if (Object.keys(staged).length === 0) return;
    setApplying(true);
    setApplyError(null);
    try {
      const next = await voiceApi.updatePreferences(staged);
      if (!isMountedRef.current) return;
      setApplied(next);
      const restartNeeded =
        callActive &&
        catalog != null &&
        isRestartRequired(staged, catalog.voice_chat_speed_presets);
      setStaged({});
      if (restartNeeded) {
        emitVoicePrefsEvent({ type: "apply_with_restart" });
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setApplyError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      if (isMountedRef.current) setApplying(false);
    }
  }, [staged, callActive, catalog]);

  const hasChanges = useMemo(() => Object.keys(staged).length > 0, [staged]);
  const hasRestartRequired = useMemo(
    () =>
      hasChanges &&
      catalog != null &&
      isRestartRequired(staged, catalog.voice_chat_speed_presets),
    [hasChanges, staged, catalog],
  );

  const value = useMemo<VoicePrefsStagingContextValue>(
    () => ({
      applied,
      catalog,
      staged,
      hasChanges,
      hasRestartRequired,
      callActive,
      applying,
      applyError,
      stage,
      cancel,
      apply,
    }),
    [
      applied,
      catalog,
      staged,
      hasChanges,
      hasRestartRequired,
      callActive,
      applying,
      applyError,
      stage,
      cancel,
      apply,
    ],
  );

  return (
    <VoicePrefsStagingContext.Provider value={value}>
      {children}
    </VoicePrefsStagingContext.Provider>
  );
};

export function useVoicePrefsStaging(): VoicePrefsStagingContextValue {
  const ctx = useContext(VoicePrefsStagingContext);
  if (!ctx) {
    throw new Error(
      "useVoicePrefsStaging must be used inside <VoicePrefsStagingProvider>",
    );
  }
  return ctx;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/staging/VoicePrefsStagingProvider.tsx frontend/src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx
git commit -m "feat(voice): add VoicePrefsStagingProvider with stage/cancel/apply"
```

---

### Task 4: Provider — apply() happy path + error path + restart event

**Files:**

- Modify: `frontend/src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx`

- [ ] **Step 1: Add failing tests for apply behavior**

Append to the existing `describe("VoicePrefsStagingProvider", ...)` block in `frontend/src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx`:

```tsx
  it("apply() sends a single batched updatePreferences call and resets staged", async () => {
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue({
      ...APPLIED,
      voice_id: "v2",
      language: "en",
    });
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2", language: "en" }));
    await act(async () => {
      await result.current.apply();
    });
    expect(voiceApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(voiceApi.updatePreferences).toHaveBeenCalledWith({
      voice_id: "v2",
      language: "en",
    });
    expect(result.current.staged).toEqual({});
    expect(result.current.applied?.voice_id).toBe("v2");
  });

  it("apply() emits apply_with_restart when callActive and hard field staged", async () => {
    const { emitVoicePrefsEvent: emit, subscribeVoicePrefsEvents: sub } =
      await import("../../voicePrefsBus");
    const listener = vi.fn();
    const unsub = sub(listener);
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue(APPLIED);
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => emit({ type: "call_status_changed", active: true }));
    await waitFor(() => expect(result.current.callActive).toBe(true));
    act(() => result.current.stage({ voice_id: "v2" }));
    await act(async () => {
      await result.current.apply();
    });
    expect(listener).toHaveBeenCalledWith({ type: "apply_with_restart" });
    unsub();
  });

  it("apply() does NOT emit apply_with_restart when callActive but only soft fields staged", async () => {
    const { subscribeVoicePrefsEvents: sub } = await import(
      "../../voicePrefsBus"
    );
    const listener = vi.fn();
    const unsub = sub(listener);
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue(APPLIED);
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    const { emitVoicePrefsEvent: emit } = await import("../../voicePrefsBus");
    act(() => emit({ type: "call_status_changed", active: true }));
    await waitFor(() => expect(result.current.callActive).toBe(true));
    act(() => result.current.stage({ ptt_key: "Shift" }));
    await act(async () => {
      await result.current.apply();
    });
    const apply = listener.mock.calls.find(
      ([e]) => e.type === "apply_with_restart",
    );
    expect(apply).toBeUndefined();
    unsub();
  });

  it("apply() preserves staged on error and sets applyError", async () => {
    vi.mocked(voiceApi.updatePreferences).mockRejectedValue(
      new Error("network down"),
    );
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2" }));
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.staged).toEqual({ voice_id: "v2" });
    expect(result.current.applyError).toBe("network down");
  });

  it("apply() is a no-op when staged is empty", async () => {
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue(APPLIED);
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    await act(async () => {
      await result.current.apply();
    });
    expect(voiceApi.updatePreferences).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx`
Expected: PASS — 9 tests total (4 from Task 3 + 5 new).

If any apply-related test fails, the implementation in Task 3 is the source of truth — fix it inline. The skeleton above is intended to make all these green; if it doesn't, debug.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/voice/staging/__tests__/VoicePrefsStagingProvider.test.tsx
git commit -m "test(voice): cover provider apply() happy + error + restart event"
```

---

### Task 5: StagedPrefsToolbar — UI component

**Files:**

- Create: `frontend/src/components/voice/staging/StagedPrefsToolbar.tsx`
- Test: `frontend/src/components/voice/staging/__tests__/StagedPrefsToolbar.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/components/voice/staging/__tests__/StagedPrefsToolbar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagedPrefsToolbar } from "../StagedPrefsToolbar";
import { VoicePrefsStagingProvider } from "../VoicePrefsStagingProvider";
import type { VoicePrefsStagingContextValue } from "../VoicePrefsStagingProvider";
import * as ProviderModule from "../VoicePrefsStagingProvider";

function renderWithStaging(
  override: Partial<VoicePrefsStagingContextValue>,
) {
  const value: VoicePrefsStagingContextValue = {
    applied: null,
    catalog: null,
    staged: {},
    hasChanges: false,
    hasRestartRequired: false,
    callActive: false,
    applying: false,
    applyError: null,
    stage: vi.fn(),
    cancel: vi.fn(),
    apply: vi.fn(),
    ...override,
  };
  vi.spyOn(ProviderModule, "useVoicePrefsStaging").mockReturnValue(value);
  return { value, ...render(<StagedPrefsToolbar />) };
}

describe("StagedPrefsToolbar", () => {
  it("renders nothing when hasChanges is false", () => {
    renderWithStaging({ hasChanges: false });
    expect(screen.queryByTestId("staged-prefs-toolbar")).toBeNull();
  });

  it("shows count and Apply / Cancel when hasChanges", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2", language: "en" },
    });
    const bar = screen.getByTestId("staged-prefs-toolbar");
    expect(bar).toBeTruthy();
    expect(screen.getByTestId("staged-count").textContent).toContain("2");
    expect(screen.getByTestId("staged-apply")).toBeTruthy();
    expect(screen.getByTestId("staged-cancel")).toBeTruthy();
  });

  it("uses 'Appliquer & redémarrer' label when callActive and restart required", () => {
    renderWithStaging({
      hasChanges: true,
      hasRestartRequired: true,
      callActive: true,
      staged: { voice_id: "v2" },
    });
    expect(screen.getByTestId("staged-apply").textContent).toMatch(
      /redémarrer/i,
    );
  });

  it("uses 'Appliquer' label otherwise", () => {
    renderWithStaging({
      hasChanges: true,
      hasRestartRequired: false,
      callActive: false,
      staged: { ptt_key: "Shift" },
    });
    expect(screen.getByTestId("staged-apply").textContent).toMatch(/appliquer/i);
    expect(screen.getByTestId("staged-apply").textContent).not.toMatch(
      /redémarrer/i,
    );
  });

  it("clicking Apply calls apply()", () => {
    const apply = vi.fn();
    renderWithStaging({ hasChanges: true, staged: { voice_id: "v2" }, apply });
    fireEvent.click(screen.getByTestId("staged-apply"));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("clicking Cancel calls cancel()", () => {
    const cancel = vi.fn();
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
      cancel,
    });
    fireEvent.click(screen.getByTestId("staged-cancel"));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while applying", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
      applying: true,
    });
    expect(
      (screen.getByTestId("staged-apply") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("staged-cancel") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows applyError when set", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
      applyError: "Erreur réseau",
    });
    expect(screen.getByTestId("staged-error").textContent).toContain(
      "Erreur réseau",
    );
  });

  it("count container has aria-live=polite", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
    });
    expect(screen.getByTestId("staged-count").getAttribute("aria-live")).toBe(
      "polite",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/staging/__tests__/StagedPrefsToolbar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/components/voice/staging/StagedPrefsToolbar.tsx
import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { useVoicePrefsStaging } from "./VoicePrefsStagingProvider";

export const StagedPrefsToolbar: React.FC = () => {
  const {
    hasChanges,
    hasRestartRequired,
    callActive,
    staged,
    applying,
    applyError,
    cancel,
    apply,
  } = useVoicePrefsStaging();

  const count = Object.keys(staged).length;
  const wantsRestart = hasRestartRequired && callActive;

  const node = (
    <AnimatePresence>
      {hasChanges && (
        <motion.div
          key="staged-prefs-toolbar"
          data-testid="staged-prefs-toolbar"
          role="region"
          aria-label="Modifications en attente"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] max-w-[calc(100vw-32px)]"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#12121a]/85 backdrop-blur-xl border border-white/10 shadow-2xl shadow-indigo-500/20">
            <span
              data-testid="staged-count"
              role="status"
              aria-live="polite"
              className="text-sm text-white/80 font-medium tabular-nums"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2 align-middle" />
              {count} modification{count > 1 ? "s" : ""} en attente
            </span>

            <button
              type="button"
              data-testid="staged-cancel"
              onClick={cancel}
              disabled={applying}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <span className="inline-flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />
                Annuler
              </span>
            </button>

            <button
              type="button"
              data-testid="staged-apply"
              onClick={apply}
              disabled={applying}
              aria-keyshortcuts="Mod+Enter"
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                wantsRestart
                  ? "bg-amber-500 text-[#0a0a0f] hover:bg-amber-400"
                  : "bg-indigo-500 text-white hover:bg-indigo-400"
              } disabled:opacity-50 disabled:cursor-wait`}
            >
              <span className="inline-flex items-center gap-1.5">
                {applying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : wantsRestart ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {wantsRestart ? "Appliquer & redémarrer" : "Appliquer"}
              </span>
            </button>
          </div>

          {applyError && (
            <div
              data-testid="staged-error"
              className="mt-2 mx-auto flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs"
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{applyError}</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined" || !document.body) return node;
  return createPortal(node, document.body);
};

export default StagedPrefsToolbar;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/voice/staging/__tests__/StagedPrefsToolbar.test.tsx`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/staging/StagedPrefsToolbar.tsx frontend/src/components/voice/staging/__tests__/StagedPrefsToolbar.test.tsx
git commit -m "feat(voice): add StagedPrefsToolbar floating UI"
```

---

### Task 6: Wire provider + toolbar into App

**Files:**

- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read current App.tsx structure**

Run: `head -200 frontend/src/App.tsx | grep -n "Provider\|<Router\|<Outlet\|<App"`

Identify the innermost provider wrapping the router (usually `AuthProvider`). The new `<VoicePrefsStagingProvider>` should be **inside** `AuthProvider` (it calls `voiceApi` which requires the auth token) and **outside** the router so the toolbar is rendered globally.

- [ ] **Step 2: Add the import**

In `frontend/src/App.tsx`, add near the existing voice imports:

```ts
import { VoicePrefsStagingProvider } from "./components/voice/staging/VoicePrefsStagingProvider";
import { StagedPrefsToolbar } from "./components/voice/staging/StagedPrefsToolbar";
```

- [ ] **Step 3: Wrap the tree**

Open `frontend/src/App.tsx` and locate the `AuthProvider` wrapper. The provider must be **inside** `AuthProvider` (it calls `voiceApi.getPreferences()` which needs auth) and must wrap the routing tree as well as the toolbar.

Concretely, find the JSX block that looks roughly like this (existing code):

```tsx
<AuthProvider>
  <LanguageProvider>
    {/* ... other providers ... */}
    <Router>
      <Routes>
        {/* existing routes */}
      </Routes>
    </Router>
  </LanguageProvider>
</AuthProvider>
```

Insert `<VoicePrefsStagingProvider>` as a child of the outermost auth-aware provider that wraps the router. The toolbar goes as a sibling of the `<Router>` block, INSIDE the new provider. Result:

```tsx
<AuthProvider>
  <LanguageProvider>
    {/* ... other providers ... */}
    <VoicePrefsStagingProvider>
      <Router>
        <Routes>
          {/* existing routes — UNCHANGED */}
        </Routes>
      </Router>
      <StagedPrefsToolbar />
    </VoicePrefsStagingProvider>
  </LanguageProvider>
</AuthProvider>
```

Do not modify any existing route, layout, or other provider — only insert the two tags. If the actual structure differs (e.g. multiple `<Router>` instances, or routing via `<Outlet>`), keep the existing wiring exactly and just slot the new provider+toolbar pair around the routing block while keeping it a descendant of `AuthProvider`.

- [ ] **Step 4: Verify the app still type-checks and tests pass**

Run: `cd frontend && npm run typecheck`
Expected: zero errors.

Run: `cd frontend && npm run test -- --run --reporter=verbose src/components/voice/staging`
Expected: PASS — provider + toolbar tests still green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(voice): mount VoicePrefsStagingProvider + StagedPrefsToolbar globally"
```

---

### Task 7: useVoiceChat publishes call_status_changed

**Files:**

- Modify: `frontend/src/components/voice/useVoiceChat.ts`
- Test: `frontend/src/components/voice/__tests__/useVoiceChat.test.ts`

- [ ] **Step 1: Add failing test for call_status_changed publish**

The existing `useVoiceChat.test.ts` already mocks `@elevenlabs/client` (`mockStartSession` returns `{ endSession: mockEndSession }`) and `fetch` (returns a session response). Configure `mockStartSession` to invoke `onConnect` synchronously, then capture bus events.

Append to `frontend/src/components/voice/__tests__/useVoiceChat.test.ts` (after the existing top-level `describe("useVoiceChat", ...)` block):

```ts
import { subscribeVoicePrefsEvents } from "../voicePrefsBus";

describe("useVoiceChat — call_status_changed events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          session_id: "sess-123",
          signed_url: "wss://test/signed",
          quota_remaining_minutes: 10,
          max_session_minutes: 30,
          input_mode: "ptt",
          ptt_key: " ",
          playback_rate: 1.0,
        }),
    });
    // Invoke onConnect synchronously when startSession is called.
    mockStartSession.mockImplementation(async (opts: any) => {
      opts.onConnect?.();
      return { endSession: mockEndSession, setVolume: vi.fn() };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits call_status_changed { active: true } onConnect", async () => {
    const events: boolean[] = [];
    const unsub = subscribeVoicePrefsEvents((e) => {
      if (e.type === "call_status_changed") events.push(e.active);
    });

    const { result } = renderHook(() => useVoiceChat({ summaryId: 1 }));

    await act(async () => {
      await result.current.start();
    });

    expect(events).toContain(true);
    unsub();
  });

  it("emits call_status_changed { active: false } on stop", async () => {
    const events: boolean[] = [];
    const unsub = subscribeVoicePrefsEvents((e) => {
      if (e.type === "call_status_changed") events.push(e.active);
    });

    const { result } = renderHook(() => useVoiceChat({ summaryId: 1 }));

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(events.filter((v) => v === false)).toHaveLength(1);
    unsub();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/useVoiceChat.test.ts -t "call_status_changed"`
Expected: FAIL — events array is empty.

- [ ] **Step 3: Add publish points in useVoiceChat**

In `frontend/src/components/voice/useVoiceChat.ts`:

a) At the top, change the existing import from `voicePrefsBus` to also pull `emitVoicePrefsEvent`:

```ts
import {
  subscribeVoicePrefsEvents,
  emitVoicePrefsEvent,
} from "./voicePrefsBus";
```

b) Inside the `Conversation.startSession({ ... })` call, find the existing `onConnect` handler and add the emit at the very end of its body:

```ts
onConnect: () => {
  if (isMountedRef.current) {
    setStatus("listening");
    setSessionStartedAt(Date.now());
  }
  emitVoicePrefsEvent({ type: "call_status_changed", active: true });
},
```

c) Inside the existing `stop()` callback, add the emit at the very end of the body (after the state resets):

```ts
const stop = useCallback(async () => {
  stopTimer();
  cleanupPlaybackObserver();
  cleanupPlaybackPolling();

  if (conversationRef.current) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (conversationRef.current as any).endSession();
    } catch {
      /* ignore */
    }
    conversationRef.current = null;
  }

  releaseMediaStream();

  if (isMountedRef.current) {
    setStatus("idle");
    setIsSpeaking(false);
    setIsMuted(false);
    setIsTalking(false);
    setActiveTool(null);
    setElapsedSeconds(0);
    setPlaybackRate(1.0);
    setVoiceSessionId(null);
    setSessionStartedAt(null);
  }

  emitVoicePrefsEvent({ type: "call_status_changed", active: false });
}, [
  stopTimer,
  releaseMediaStream,
  cleanupPlaybackObserver,
  cleanupPlaybackPolling,
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/useVoiceChat.test.ts -t "call_status_changed"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/useVoiceChat.ts frontend/src/components/voice/__tests__/useVoiceChat.test.ts
git commit -m "feat(voice): publish call_status_changed from useVoiceChat"
```

---

### Task 8: useVoiceChat subscribes to apply_with_restart

**Files:**

- Modify: `frontend/src/components/voice/useVoiceChat.ts`
- Test: `frontend/src/components/voice/__tests__/useVoiceChat.test.ts`

- [ ] **Step 1: Add failing test**

Append to `frontend/src/components/voice/__tests__/useVoiceChat.test.ts`:

```ts
import { emitVoicePrefsEvent } from "../voicePrefsBus";

describe("useVoiceChat — apply_with_restart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          session_id: "sess-123",
          signed_url: "wss://test/signed",
          quota_remaining_minutes: 10,
          max_session_minutes: 30,
          input_mode: "ptt",
          ptt_key: " ",
          playback_rate: 1.0,
        }),
    });
    mockStartSession.mockImplementation(async (opts: any) => {
      opts.onConnect?.();
      return { endSession: mockEndSession, setVolume: vi.fn() };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls restart (start invoked again) when active session receives apply_with_restart", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 1 }));
    await act(async () => {
      await result.current.start();
    });
    const callsAfterStart = mockStartSession.mock.calls.length;

    await act(async () => {
      emitVoicePrefsEvent({ type: "apply_with_restart" });
      // restart() awaits 400ms internally before re-calling start()
      vi.advanceTimersByTime(500);
      // Flush pending microtasks
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockStartSession.mock.calls.length).toBeGreaterThan(callsAfterStart);
  });

  it("is a no-op when there is no active conversation", async () => {
    renderHook(() => useVoiceChat({ summaryId: 1 }));

    await act(async () => {
      emitVoicePrefsEvent({ type: "apply_with_restart" });
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(mockStartSession).not.toHaveBeenCalled();
  });
});
```

> The 400ms delay corresponds to the existing `restart()` implementation: `stop()` → `await new Promise(r => setTimeout(r, 400))` → `start()`. `vi.advanceTimersByTime(500)` flushes that delay under fake timers.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/useVoiceChat.test.ts -t "apply_with_restart"`
Expected: FAIL.

- [ ] **Step 3: Implement the subscription**

In `frontend/src/components/voice/useVoiceChat.ts`, add a new `useEffect` near the existing `useEffect` that subscribes to `playback_rate_changed`:

```ts
// Live-restart when the staging provider applies a restart-required diff.
useEffect(() => {
  const unsubscribe = subscribeVoicePrefsEvents((event) => {
    if (event.type !== "apply_with_restart") return;
    if (!conversationRef.current) return;
    void restart();
  });
  return unsubscribe;
}, [restart]);
```

> The existing `restart` callback (defined just above this effect in the file) already chains `stop` + 400ms + `start`; reuse it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/useVoiceChat.test.ts -t "apply_with_restart"`
Expected: PASS — both tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/useVoiceChat.ts frontend/src/components/voice/__tests__/useVoiceChat.test.ts
git commit -m "feat(voice): wire useVoiceChat to apply_with_restart event"
```

---

### Task 9: Migrate VoiceLiveSettings to staging

**Files:**

- Modify: `frontend/src/components/voice/VoiceLiveSettings.tsx`
- Modify: `frontend/src/components/voice/__tests__/VoiceLiveSettings.test.tsx`

- [ ] **Step 1: Update existing tests for stage-based behavior**

Open `frontend/src/components/voice/__tests__/VoiceLiveSettings.test.tsx`. For tests that currently assert `voiceApi.updatePreferences` was called when a user clicks input_mode / ptt_key / language, change the assertion to check that a mocked `useVoicePrefsStaging().stage()` was called instead.

Add this mock at the top of the test file (after existing imports):

```tsx
const stageMock = vi.fn();
vi.mock("../staging/VoicePrefsStagingProvider", () => ({
  useVoicePrefsStaging: () => ({
    applied: {
      voice_id: "v1",
      voice_name: "Sophie",
      speed: 1,
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
      tts_model: "eleven_multilingual_v2",
      voice_chat_model: "eleven_flash_v2_5",
      language: "fr",
      gender: "female",
      input_mode: "ptt",
      ptt_key: " ",
      interruptions_enabled: true,
      turn_eagerness: 0.5,
      voice_chat_speed_preset: "1x",
      turn_timeout: 15,
      soft_timeout_seconds: 300,
    },
    catalog: null,
    staged: {},
    hasChanges: false,
    hasRestartRequired: false,
    callActive: false,
    applying: false,
    applyError: null,
    stage: stageMock,
    cancel: vi.fn(),
    apply: vi.fn(),
  }),
  VoicePrefsStagingProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

beforeEach(() => {
  stageMock.mockReset();
});
```

For each existing test that simulates a click on an input_mode toggle, ptt_key recorder result, or language toggle, replace the existing `voiceApi.updatePreferences` assertion with:

```tsx
expect(stageMock).toHaveBeenCalledWith({ input_mode: "vad" });
// or { ptt_key: "a" }, { language: "en" }, etc.
```

For volume slider tests, **keep** the existing behavior assertion — the volume must still update DOM `<audio>.volume` and **must not** call `stageMock`.

For playback_rate tests, **keep** the existing `emitVoicePrefsEvent({ type: "playback_rate_changed", value })` and `voiceApi.updatePreferences({ voice_chat_speed_preset })` assertions for now — we keep that one as live for backward compatibility (rate ≤ 1.x is live-applicable). If existing tests don't cover rate at all, leave them alone.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/VoiceLiveSettings.test.tsx`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Refactor the component**

Edit `frontend/src/components/voice/VoiceLiveSettings.tsx`:

a) Add the import at the top:

```ts
import { useVoicePrefsStaging } from "./staging/VoicePrefsStagingProvider";
```

b) Replace the local-state `prefs` initial fetch with reads from the provider. Inside the component body, replace:

```ts
const [prefs, setPrefs] = useState<VoicePreferences | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [saving, setSaving] = useState(false);
```

with:

```ts
const { applied, staged, stage } = useVoicePrefsStaging();
const prefs = applied
  ? ({ ...applied, ...staged } as VoicePreferences)
  : null;
const loading = applied === null;
const error = null; // surfaced by the toolbar if any
const saving = false;
```

c) Remove the `useEffect` that calls `voiceApi.getPreferences()` (the provider does it now). Remove the unused `voiceApi` import if no other callsite remains in this file.

d) Replace the `save` callback body. The volume + playback_rate paths stay live; everything else routes through `stage()`:

```ts
const save = useCallback(
  async (updates: Partial<VoicePreferences>) => {
    stage(updates);
    onChange?.(updates);
  },
  [stage, onChange],
);
```

e) Keep `handleVolume` exactly as-is (DOM-only).

f) Keep `handleRate` as-is (still emits `playback_rate_changed` + persists via `save({ voice_chat_speed_preset: preset.id })` → which now goes through `stage()`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/VoiceLiveSettings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/VoiceLiveSettings.tsx frontend/src/components/voice/__tests__/VoiceLiveSettings.test.tsx
git commit -m "refactor(voice): route VoiceLiveSettings non-live changes through stage()"
```

---

### Task 10: Migrate VoiceSettings to staging

**Files:**

- Modify: `frontend/src/components/voice/VoiceSettings.tsx`
- Modify or Create: `frontend/src/components/voice/__tests__/VoiceSettings.test.tsx`

- [ ] **Step 1: Inspect existing VoiceSettings tests**

Run: `ls frontend/src/components/voice/__tests__ | grep -i voicesettings`

If a test file exists, read it to identify which assertions reference `voiceApi.updatePreferences`. If no test file exists, create one with the staging mock from Task 9 and a single happy-path test:

```tsx
// frontend/src/components/voice/__tests__/VoiceSettings.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VoiceSettings from "../VoiceSettings";

const stageMock = vi.fn();
vi.mock("../staging/VoicePrefsStagingProvider", () => ({
  useVoicePrefsStaging: () => ({
    applied: {
      voice_id: "v1",
      voice_name: "Sophie",
      speed: 1,
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
      tts_model: "eleven_multilingual_v2",
      voice_chat_model: "eleven_flash_v2_5",
      language: "fr",
      gender: "female",
      input_mode: "ptt",
      ptt_key: " ",
      interruptions_enabled: true,
      turn_eagerness: 0.5,
      voice_chat_speed_preset: "1x",
      turn_timeout: 15,
      soft_timeout_seconds: 300,
    },
    catalog: {
      voices: [
        {
          voice_id: "v2",
          name: "Mathieu",
          description_fr: "",
          description_en: "",
          gender: "male",
          accent: "fr",
          language: "fr",
          use_case: "tutor",
          recommended: false,
          preview_url: "https://example.com/v2.mp3",
        },
      ],
      speed_presets: [
        { id: "1.0", label_fr: "1x", label_en: "1x", value: 1, icon: "" },
      ],
      voice_chat_speed_presets: [
        {
          id: "1x",
          label_fr: "Normal",
          label_en: "Normal",
          api_speed: 1,
          playback_rate: 1,
          concise: false,
        },
      ],
      models: [
        {
          id: "eleven_flash_v2_5",
          name: "Flash",
          description_fr: "",
          description_en: "",
          latency: "lowest",
          recommended_for: "voice_chat",
        },
      ],
    },
    staged: {},
    hasChanges: false,
    hasRestartRequired: false,
    callActive: false,
    applying: false,
    applyError: null,
    stage: stageMock,
    cancel: vi.fn(),
    apply: vi.fn(),
  }),
}));

beforeEach(() => {
  stageMock.mockReset();
});

describe("VoiceSettings — staging", () => {
  it("clicking a different voice card calls stage()", async () => {
    render(<VoiceSettings />);
    // Voice section is collapsed by default — open it.
    fireEvent.click(screen.getByText("Sélection de voix"));
    await waitFor(() => screen.getByText("Mathieu"));
    fireEvent.click(screen.getByText("Mathieu"));
    expect(stageMock).toHaveBeenCalledWith({
      voice_id: "v2",
      voice_name: "Mathieu",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/VoiceSettings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Refactor VoiceSettings**

Edit `frontend/src/components/voice/VoiceSettings.tsx`:

a) Add the import:

```ts
import { useVoicePrefsStaging } from "./staging/VoicePrefsStagingProvider";
```

b) Replace the local fetch + state. Replace:

```tsx
const [preferences, setPreferences] = useState<VoicePreferences | null>(null);
const [catalog, setCatalog] = useState<VoiceCatalog | null>(null);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const [successMsg, setSuccessMsg] = useState<string | null>(null);
```

with:

```tsx
const { applied, staged, catalog, stage } = useVoicePrefsStaging();
const preferences = applied
  ? ({ ...applied, ...staged } as VoicePreferences)
  : null;
const loading = applied === null || catalog === null;
const saving = false;
const error: string | null = null;
const successMsg: string | null = null;
```

c) Delete the `useEffect` that loads `voiceApi.getPreferences` + `voiceApi.getCatalog` (provider does it).

d) Replace the body of `savePreferences`:

```tsx
const savePreferences = useCallback(
  async (updates: Partial<VoicePreferences>) => {
    stage(updates);
  },
  [stage],
);
```

The optimistic-update logic disappears — the merged `applied + staged` covers it.

e) Find the "Réinitialiser les valeurs par défaut" button. Its `onClick` already calls `savePreferences({...defaults})`; thanks to the refactor above this is now `stage(defaults)`. Leave it.

f) Remove the floating "Saving indicator" at the bottom of the component (`{saving && (...)}`); the toolbar covers feedback now.

g) Remove unused imports: `useState`, `useEffect`, `voiceApi`, `DeepSightSpinnerMicro` if no longer referenced. Run typecheck to identify.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run typecheck`
Expected: zero errors.

Run: `cd frontend && npx vitest run src/components/voice/__tests__/VoiceSettings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/VoiceSettings.tsx frontend/src/components/voice/__tests__/VoiceSettings.test.tsx
git commit -m "refactor(voice): route VoiceSettings changes through stage()"
```

---

### Task 11: Remove restart_required banner in VoiceModal

**Files:**

- Modify: `frontend/src/components/voice/VoiceModal.tsx`

- [ ] **Step 1: Identify and remove**

In `frontend/src/components/voice/VoiceModal.tsx`:

a) Remove the imports:

```ts
import { subscribeVoicePrefsEvents } from "./voicePrefsBus";
```

(Only if no other usage remains — grep first.)

b) Remove these two state hooks:

```ts
const [restartRequired, setRestartRequired] = useState(false);
const [restarting, setRestarting] = useState(false);
```

c) Remove the `useEffect` that subscribes to `restart_required`:

```ts
useEffect(() => {
  const unsubscribe = subscribeVoicePrefsEvents((event) => {
    if (event.type === "restart_required") {
      setRestartRequired(true);
    }
  });
  return unsubscribe;
}, []);
```

d) Remove the `handleRestart` callback (the toolbar's Apply now triggers restart automatically via the bus).

e) Inside the settings overlay JSX, remove the entire amber banner block (the one wrapped in `{hasActiveSession && (<div className={`mx-3 sm:mx-5 mt-3 ...`}>...</div>)}` that mentions "Redémarrage requis"). Keep the rest of the settings overlay unchanged.

- [ ] **Step 2: Verify no orphan references remain**

Run: `cd frontend && grep -n "restartRequired\|restart_required\|handleRestart" src/components/voice/VoiceModal.tsx`
Expected: no output (all references gone) or only the `onRestart` prop, which is fine to keep — VoiceModal still accepts an `onRestart` prop in case any caller wants to wire a manual restart button later.

- [ ] **Step 3: Type-check + run modal tests**

Run: `cd frontend && npm run typecheck`
Expected: zero errors.

Run: `cd frontend && npx vitest run src/components/voice`
Expected: all voice tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/voice/VoiceModal.tsx
git commit -m "refactor(voice): remove restart_required banner from VoiceModal (toolbar covers it)"
```

---

### Task 12: E2E happy-path for the apply flow

**Files:**

- Create: `frontend/e2e/voice-apply-flow.spec.ts`

- [ ] **Step 1: Inspect existing E2E patterns**

Run: `ls frontend/e2e && head -30 frontend/e2e/*.spec.ts | head -100`

Identify how other specs mock auth + how they navigate. Match the pattern.

- [ ] **Step 2: Write the spec**

```ts
// frontend/e2e/voice-apply-flow.spec.ts
import { test, expect } from "@playwright/test";

// Adapt the route mocks to the existing harness — the patterns below
// match the typical setup but should be aligned with what other voice
// E2E specs in this repo already do (auth bypass, prefs fixture, etc.).

const PREFS_FIXTURE = {
  voice_id: "v1",
  voice_name: "Sophie",
  speed: 1.0,
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
  tts_model: "eleven_multilingual_v2",
  voice_chat_model: "eleven_flash_v2_5",
  language: "fr",
  gender: "female",
  input_mode: "ptt",
  ptt_key: " ",
  interruptions_enabled: true,
  turn_eagerness: 0.5,
  voice_chat_speed_preset: "1x",
  turn_timeout: 15,
  soft_timeout_seconds: 300,
};

const CATALOG_FIXTURE = {
  voices: [
    {
      voice_id: "v1",
      name: "Sophie",
      description_fr: "",
      description_en: "",
      gender: "female",
      accent: "fr",
      language: "fr",
      use_case: "tutor",
      recommended: true,
      preview_url: "https://example.com/v1.mp3",
    },
    {
      voice_id: "v2",
      name: "Mathieu",
      description_fr: "",
      description_en: "",
      gender: "male",
      accent: "fr",
      language: "fr",
      use_case: "tutor",
      recommended: false,
      preview_url: "https://example.com/v2.mp3",
    },
  ],
  speed_presets: [
    { id: "1.0", label_fr: "1x", label_en: "1x", value: 1, icon: "" },
  ],
  voice_chat_speed_presets: [
    {
      id: "1x",
      label_fr: "Normal",
      label_en: "Normal",
      api_speed: 1,
      playback_rate: 1,
      concise: false,
    },
    {
      id: "3x",
      label_fr: "Concis",
      label_en: "Concise",
      api_speed: 1,
      playback_rate: 1,
      concise: true,
    },
  ],
  models: [
    {
      id: "eleven_flash_v2_5",
      name: "Flash",
      description_fr: "",
      description_en: "",
      latency: "lowest",
      recommended_for: "voice_chat",
    },
  ],
};

test.describe("Voice prefs apply flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/voice/preferences", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({ json: PREFS_FIXTURE });
      } else {
        const body = route.request().postDataJSON();
        await route.fulfill({ json: { ...PREFS_FIXTURE, ...body } });
      }
    });
    await page.route("**/api/voice/catalog", async (route) => {
      await route.fulfill({ json: CATALOG_FIXTURE });
    });
  });

  test("staging voice + concise preset triggers a single batched updatePreferences", async ({
    page,
  }) => {
    let postBody: Record<string, unknown> | null = null;
    let postCount = 0;
    await page.route("**/api/voice/preferences", async (route) => {
      const method = route.request().method();
      if (method === "POST" || method === "PATCH" || method === "PUT") {
        postCount += 1;
        postBody = route.request().postDataJSON();
        await route.fulfill({ json: { ...PREFS_FIXTURE, ...postBody } });
      } else {
        await route.fulfill({ json: PREFS_FIXTURE });
      }
    });

    // Navigate to the voice settings page (adapt path if different)
    await page.goto("/settings/voice");

    // Open the voice catalog section
    await page.getByText("Sélection de voix").click();
    await page.getByText("Mathieu").click();

    // Open the chat-speed section + pick the concise variant
    await page.getByText("Vitesse du chat vocal").click();
    await page.getByText("Concis").click();

    // Toolbar should now show "2 modifications"
    const bar = page.getByTestId("staged-prefs-toolbar");
    await expect(bar).toBeVisible();
    await expect(page.getByTestId("staged-count")).toContainText("2");

    // Apply
    await page.getByTestId("staged-apply").click();
    await expect(bar).toBeHidden();

    expect(postCount).toBe(1);
    expect(postBody).toEqual({
      voice_id: "v2",
      voice_name: "Mathieu",
      voice_chat_speed_preset: "3x",
    });
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `cd frontend && npx playwright test voice-apply-flow.spec.ts`
Expected: PASS.

- [ ] **Step 4: If the page route or auth differs from the assumption above, adapt**

If `/settings/voice` doesn't exist or requires auth, mirror the auth-mock pattern from a sibling spec (e.g. `frontend/e2e/voice-modal.spec.ts` if it exists, or any other passing spec).

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/voice-apply-flow.spec.ts
git commit -m "test(e2e): cover voice prefs apply happy path"
```

---

### Task 13: Final verification + cleanup

- [ ] **Step 1: Full type-check**

Run: `cd frontend && npm run typecheck`
Expected: zero errors.

- [ ] **Step 2: Full unit test suite**

Run: `cd frontend && npm run test`
Expected: all tests pass.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: zero errors.

- [ ] **Step 4: Manual QA checklist**

Run the dev server: `cd frontend && npm run dev`

Open `http://localhost:5173` (or the configured port) and verify on three surfaces:

1. **Page Paramètres vocaux standalone** (`/settings/voice` or wherever the route lives):
   - Change voix → toolbar apparaît avec compteur 1
   - Change preset vitesse normal (non-concis) → compteur passe à 2, label reste "Appliquer"
   - Click Apply → un seul appel réseau, applied mis à jour, toolbar disparaît

2. **Modal d'analyse** (`VoiceModal` ouvert depuis une analyse) :
   - Bouton settings ouvre le panneau, plus de banner amber
   - Hors appel : Apply persiste, pas de restart
   - Démarrer appel → modifier voix → toolbar dit "Appliquer & redémarrer" → click → coupure ~1.5s → reprise

3. **Hub Chat IA** (`/chat` avec call actif) :
   - Bouton settings dans VoiceOverlay ouvre VoiceLiveSettings
   - Volume slider reste live (DOM)
   - Changer langue → toolbar avec "Appliquer & redémarrer" → click → restart silencieux

- [ ] **Step 5: Commit any QA fixes**

If manual QA reveals a small UI bug, fix it inline and commit.

```bash
git add -A
git commit -m "fix(voice): <specific QA issue>"
```

If no fixes needed, skip this step.

- [ ] **Step 6: Push for review**

```bash
git push origin feat/voice-mobile-final
```

(or whichever branch the work happened on).

---

## Spec Coverage Audit (post-write self-check)

| Spec section | Tasks |
|---|---|
| 5. Architecture (provider + bus + toolbar) | T3, T4, T5, T6 |
| 6. Categorization (live / soft / hard) | T1 |
| 7. Provider API (stage / cancel / apply) | T3, T4 |
| 8.1 Provider component | T3 |
| 8.2 Toolbar | T5 |
| 8.3 restartRequiredFields | T1 |
| 8.4 voicePrefsBus extension | T2 |
| 8.5 useVoiceChat publish + subscribe | T7, T8 |
| 8.6 VoiceLiveSettings refactor | T9 |
| 8.7 VoiceSettings refactor | T10 |
| 8.8 VoiceModal banner removal | T11 |
| 8.9 App.tsx wrap | T6 |
| 9. Data flow scenarios A/B/C | Covered by E2E (T12) + manual QA (T13) |
| 10. Edge cases | T4 (no-op detect, error path), T11 (idempotent stop) |
| 11. Tests (unit) | T1, T2, T3, T4, T5, T7, T8, T9, T10 |
| 11. Tests (E2E) | T12 |
| 12. Critères d'acceptation | T13 |
| 13. Plan de migration phases 1-8 | T1 → T11 |

No gaps detected.
