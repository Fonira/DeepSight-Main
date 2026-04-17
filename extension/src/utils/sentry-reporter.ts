// Full implementation in Phase 5. This stub exists so that background.ts
// can import it now without circular dep issues.

import type { CrashRecord } from "./crash-logger";

export async function reportCrashes(crashes: CrashRecord[]): Promise<void> {
  if (crashes.length === 0) return;
  try {
    console.warn(
      `[DeepSight] ${crashes.length} previous crash(es) detected — will ship to Sentry in Phase 5`,
      crashes,
    );
  } catch {
    /* swallow */
  }
}
