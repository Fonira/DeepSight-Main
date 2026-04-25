// Ships drained crash records to Sentry. No-op if SENTRY_DSN_EXTENSION
// is not configured at build time. Sentry is loaded via dynamic import so
// the SDK is excluded from the main bundle when no DSN is set.

import type { CrashRecord } from "./crash-logger";

let _inited = false;

async function initSentry(): Promise<boolean> {
  if (_inited) return true;
  if (!__SENTRY_DSN__) return false;
  try {
    const Sentry = await import("@sentry/browser");
    Sentry.init({
      dsn: __SENTRY_DSN__,
      release: "deepsight-extension@" + chrome.runtime.getManifest().version,
      environment: "production",
      sampleRate: 1.0,
      tracesSampleRate: 0,
      autoSessionTracking: false,
      defaultIntegrations: false,
      integrations: [],
    });
    _inited = true;
    return true;
  } catch {
    return false;
  }
}

export async function reportCrashes(crashes: CrashRecord[]): Promise<void> {
  if (crashes.length === 0) return;
  const ready = await initSentry();
  if (!ready) {
    try {
      console.warn(
        `[DeepSight] ${crashes.length} previous crash(es) — no Sentry DSN configured`,
        crashes,
      );
    } catch {
      /* swallow */
    }
    return;
  }
  try {
    const Sentry = await import("@sentry/browser");
    for (const c of crashes) {
      Sentry.captureMessage(`[boot] ${c.message}`, {
        level: "error",
        tags: { component: "content-script", browser: __TARGET_BROWSER__ },
        contexts: {
          crash: {
            url: c.url,
            userAgent: c.userAgent,
            timestamp: c.timestamp,
            steps: c.steps.join(" > "),
            context: JSON.stringify(c.context ?? null),
          },
        },
        extra: { stack: c.stack },
      });
    }
    await Sentry.flush(3000);
  } catch {
    /* never block startup on telemetry */
  }
}
