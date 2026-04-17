// Crash Logger — persists boot-time errors that would otherwise vanish
// silently (the content script has no global window.onerror at the moment
// the error fires). History capped FIFO at 20 entries. Drained at
// service-worker boot by the Sentry reporter.

export interface BootStep {
  step: string;
  detail?: unknown;
  t: number;
}

export interface CrashRecord {
  message: string;
  stack?: string;
  context?: unknown;
  steps: string[];
  timestamp: number;
  url: string;
  userAgent: string;
}

const STORAGE_KEY = "ds_crash_log";
const MAX_CRASHES = 20;
const MAX_STEPS_IN_MEMORY = 100;

let _stepHistory: BootStep[] = [];

export function logBootStep(step: string, detail?: unknown): void {
  _stepHistory.push({ step, detail, t: Date.now() });
  if (_stepHistory.length > MAX_STEPS_IN_MEMORY) {
    _stepHistory = _stepHistory.slice(-MAX_STEPS_IN_MEMORY);
  }
  try {
    if (detail !== undefined) {
      console.log("[DeepSight-boot]", step, detail);
    } else {
      console.log("[DeepSight-boot]", step);
    }
  } catch {
    /* console may be unavailable */
  }
}

export function getBootStepHistory(): BootStep[] {
  return [..._stepHistory];
}

export async function persistCrash(
  err: unknown,
  context?: unknown,
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  const record: CrashRecord = {
    message: error.message || "Unknown error",
    stack: error.stack,
    context,
    steps: _stepHistory.map((s) => s.step),
    timestamp: Date.now(),
    url: typeof location !== "undefined" && location.href ? location.href : "",
    userAgent:
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "",
  };

  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const existing = Array.isArray(data[STORAGE_KEY])
      ? (data[STORAGE_KEY] as CrashRecord[])
      : [];
    const next = [...existing, record].slice(-MAX_CRASHES);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  } catch (storageErr) {
    try {
      console.error("[DeepSight-crash]", record, storageErr);
    } catch {
      /* swallow */
    }
  }
}

export async function drainCrashes(): Promise<CrashRecord[]> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const crashes = Array.isArray(data[STORAGE_KEY])
      ? (data[STORAGE_KEY] as CrashRecord[])
      : [];
    if (crashes.length > 0) {
      await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    }
    return crashes;
  } catch {
    return [];
  }
}

/** Test helper — reset in-memory step history. */
export function __resetForTest(): void {
  _stepHistory = [];
}
