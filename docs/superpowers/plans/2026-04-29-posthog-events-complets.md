# PostHog Events Complets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Sub-agent model:** All Agent invocations MUST use `model: claude-opus-4-7[1m]` (perma rule from user memory).

**Goal:** Étendre `frontend/src/services/analytics.ts` avec 18 nouveaux events PostHog type-safe, un identify enrichi (plan, signup_date, is_legacy_pricing, analyses_count) et des side-effects automatiques sur les events de billing, pour fermer le gap "sans data on pilote à l'aveugle" identifié par l'audit Kimi du 2026-04-29.

**Architecture:** Nouveau fichier `analytics.types.ts` contenant `EventPayloadMap` (interface mappant chaque event name → payload schema). Le service `analytics.ts` reste rétro-compatible (`capture()` et `setUserProperties()` non typés conservés) et ajoute deux helpers typés `captureTyped<E>()` et `setUserPropertiesTyped()`. Les events `payment_completed` et `subscription_cancelled` déclenchent automatiquement un update du user property `plan` via une side-effect intégrée. Le hook existant `useAnalytics` est étendu avec une méthode `track<E>()` typée, et `trackLogin` change de signature pour porter le payload identify enrichi. Les events bloqués par d'autres plans (pricing-v2, edge-tts, voice-packs) sont câblés mais commentés avec un marqueur `// TODO uncomment after <plan-name> merge`.

**Tech Stack:** TypeScript 5 strict + React 18 + Vite 5 + posthog-js + Vitest + @testing-library/react. Pas de changement backend.

**Spec sources:**

- Audit Kimi 2026-04-29 : "Phase 4 — Observabilité"
- Plans dépendants : `docs/superpowers/plans/2026-04-29-RELEASE-ORCHESTRATION.md` (commit `021e4bf1`), `docs/superpowers/plans/2026-04-29-elevenlabs-voice-packs.md`, `docs/superpowers/plans/2026-04-29-pricing-v2-stripe-grandfathering.md`, `docs/superpowers/plans/2026-04-29-edge-tts-gratuit.md`

---

## Contexte préalable

### État actuel (vérifié 2026-04-29)

**Service analytics existant** (`frontend/src/services/analytics.ts`, 184 lignes) :

- PostHog (`posthog-js`) déjà intégré, RGPD-compliant
- Init guard : `hasAnalyticsConsent()` lu depuis `components/CookieBanner`
- Listener `cookie-consent-updated` pour init/shutdown dynamique
- API publique : `analytics.init()`, `identify(userId, traits)`, `reset()`, `capture(event, properties)`, `pageview(path?)`, `setUserProperties(props)`, `isFeatureEnabled(flag)`
- Init dans `frontend/src/App.tsx` ligne 1019 (`useEffect(() => { analytics.init(); }, [])`)

**Constantes existantes** (`AnalyticsEvents` const-as-as-const, lignes 149-180) :

```
SIGNUP, LOGIN, LOGOUT,
VIDEO_ANALYZED, VIDEO_ANALYSIS_STARTED, VIDEO_ANALYSIS_FAILED,
CHAT_MESSAGE_SENT, CHAT_SESSION_STARTED,
EXPORT_CREATED,
UPGRADE_STARTED, UPGRADE_COMPLETED, PLAN_CHANGED,
STUDY_TOOL_USED, FACTCHECK_VIEWED, PLAYLIST_ANALYZED,
ERROR_OCCURRED, API_ERROR
```

**Hook existant** (`frontend/src/hooks/useAnalytics.ts`, 81 lignes) — déjà présent contrairement à la mission initiale. Expose `trackSignup`, `trackLogin(userId, plan, method)`, `trackLogout`, `trackAnalysis`, `trackAnalysisStarted`, `trackExport`, `trackUpgrade`, `trackChat`, `trackError`, et `capture` brut. **Le shape `trackLogin` actuel sera modifié** — la signature va devenir `trackLogin(payload: LoginPayload)` (breaking change interne, 0 callers actuels selon `grep "useAnalytics()" frontend/src/`).

**Auth flow** :

- `frontend/src/contexts/AuthContext.tsx` (34 lignes) : Provider minimal avec `value` injecté par le parent. **N'expose PAS encore de `trackLogin`** — c'est `useAuth.ts` (hook) qui détient la logique de login.
- `frontend/src/hooks/useAuth.ts` (691 lignes) : `login()` ligne 394, `loginWithGoogle()` ligne 422, `logout()` ligne 506. Aucun appel analytics actuellement.
- `frontend/src/pages/Login.tsx` ligne 211 : `await loginWithGoogle()`
- `frontend/src/pages/AuthCallback.tsx` ligne 230 : `window.dispatchEvent(new CustomEvent("auth:success"))` après OAuth flow réussi

**User type** (`frontend/src/services/api.ts` ligne 28) :

```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  plan:
    | "free"
    | "plus"
    | "pro"
    | "etudiant"
    | "starter"
    | "student"
    | "team"
    | "expert"
    | "unlimited";
  credits: number;
  credits_monthly: number;
  is_admin: boolean;
  avatar_url?: string;
  created_at: string; // ✅ utilisable comme signup_date
  total_videos: number; // ✅ utilisable comme analyses_count
  // ...
}
```

**Voice analytics existant** (`frontend/src/components/voice/voiceAnalytics.ts`, 132 lignes) — **CONFLIT À NOTER** : utilise des event names DIFFÉRENTS (`voice_chat_started`, `voice_chat_ended`, `voice_chat_quota_warning`, etc.) que ceux demandés par la mission (`voice_call_started`, `voice_call_ended`, `voice_quota_exhausted`). Le plan ajoute les NOUVEAUX events sans toucher au fichier existant — une consolidation est listée comme question à l'utilisateur (D5) en self-review.

**Tests existants** :

- `frontend/src/services/__tests__/analytics.test.ts` (76 lignes) : 5 tests RGPD + AnalyticsEvents
- `frontend/src/hooks/__tests__/useAuth.test.ts` + `useAuth-complete.test.ts` (existants, ne pas régresser)
- `frontend/src/__tests__/setup.ts` + `test-utils.tsx` disponibles
- Pas encore de `frontend/src/hooks/__tests__/useAnalytics.test.ts`

### Gap audit Kimi vs constantes existantes

Le mapping des 18 events à ajouter, comparé aux 17 constantes existantes :

| Catégorie | Event                           | Existe déjà ?                                                                |
| --------- | ------------------------------- | ---------------------------------------------------------------------------- |
| Homepage  | `hero_analysis_clicked`         | ❌ ajouter                                                                   |
| Homepage  | `signup_started`                | ❌ ajouter (différent de `SIGNUP`/`user_signup` qui est l'**aboutissement**) |
| Homepage  | `pricing_viewed`                | ❌ ajouter                                                                   |
| Pricing   | `pricing_toggle_changed`        | ❌ ajouter (BLOCKED-BY pricing-v2)                                           |
| Pricing   | `plan_selected`                 | ❌ ajouter                                                                   |
| Pricing   | `checkout_started`              | ❌ ajouter (similaire à `UPGRADE_STARTED` mais nouvelle convention)          |
| Pricing   | `payment_completed`             | ❌ ajouter (similaire à `UPGRADE_COMPLETED`, conserver les deux)             |
| Pricing   | `subscription_cancelled`        | ❌ ajouter                                                                   |
| Dashboard | `analysis_started`              | ⚠️ `VIDEO_ANALYSIS_STARTED` existe — alias pour conformité audit             |
| Dashboard | `analysis_completed`            | ⚠️ `VIDEO_ANALYZED` existe — alias                                           |
| Dashboard | `feature_used`                  | ❌ ajouter (nouveau bucket générique)                                        |
| Dashboard | `export_generated`              | ⚠️ `EXPORT_CREATED` existe — alias                                           |
| Trial     | `trial_started`                 | ❌ ajouter (BLOCKED-BY pricing-v2)                                           |
| Trial     | `trial_converted`               | ❌ ajouter (BLOCKED-BY pricing-v2)                                           |
| Voice     | `voice_call_started`            | ❌ ajouter (BLOCKED-BY edge-tts + voice-packs)                               |
| Voice     | `voice_call_ended`              | ❌ ajouter (BLOCKED-BY)                                                      |
| Voice     | `voice_quota_exhausted`         | ❌ ajouter (BLOCKED-BY)                                                      |
| Voice     | `voice_pack_purchase_started`   | ❌ ajouter (BLOCKED-BY voice-packs)                                          |
| Voice     | `voice_pack_purchase_completed` | ❌ ajouter (BLOCKED-BY voice-packs)                                          |

**Décision** : pour les 4 events qui chevauchent (`analysis_started`, `analysis_completed`, `export_generated` vs constantes existantes), on garde les **deux noms** (anciens + nouveaux) côté code mais on n'envoie que le NOUVEAU en double-runtime à PostHog (un seul event par occurrence). Les anciens noms sont conservés dans `AnalyticsEvents` const pour rétro-compat avec d'éventuels callers actuels (à grepper en tâche 13).

### Dépendances externes (plans batch 2 parallèles)

| Event(s) bloqués                                                                                                    | Plan dépendant                                   | Action                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `pricing_toggle_changed`, `plan_selected`, `checkout_started`, `subscription_cancelled.reason`, `is_legacy_pricing` | `2026-04-29-pricing-v2-stripe-grandfathering.md` | Code écrit + commenté avec `// TODO uncomment after pricing-v2 merge` |
| `trial_started`, `trial_converted`                                                                                  | `2026-04-29-pricing-v2-stripe-grandfathering.md` | idem                                                                  |
| `voice_call_started.provider`, `voice_call_ended.provider`                                                          | `2026-04-29-edge-tts-gratuit.md`                 | Champ `provider: 'edge_tts' \| 'elevenlabs'` commenté                 |
| `voice_pack_purchase_started`, `voice_pack_purchase_completed`                                                      | `2026-04-29-elevenlabs-voice-packs.md`           | Code commenté                                                         |

**Stratégie** : on écrit toute l'infrastructure **maintenant** (types, helpers, tests RGPD), on câble tous les call sites **maintenant**, on **commente** uniquement les call sites des plans non-encore-mergés avec un marker grep-able `// TODO[posthog-blocked]: pricing-v2 ` (etc.). Au merge des plans bloquants, un seul `grep -rn "TODO\[posthog-blocked\]" frontend/src/` permet de tout décommenter en une passe.

---

## File Structure

### Files créés

| Fichier                                             | Responsabilité                                                                           | BLOCKED-BY |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| `frontend/src/services/analytics.types.ts`          | `EventPayloadMap` interface, `LoginIdentifyPayload`, types union plan                    | —          |
| `frontend/src/hooks/__tests__/useAnalytics.test.ts` | Vitest hook : trackLogin enrichi, track\<E\>() typé, RGPD guard                          | —          |
| `frontend/src/__tests__/landing-hero-cta.test.tsx`  | E2E mount LandingPage + click hero CTA + assert posthog.capture('hero_analysis_clicked') | —          |

### Files modifiés

| Fichier                                                                | Changement                                                                                                                                                                                                                                    | BLOCKED-BY                               |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `frontend/src/services/analytics.ts`                                   | Ajouter 14 nouvelles constantes dans `AnalyticsEvents` ; ajouter `captureTyped<E>()`, `setUserPropertiesTyped()` ; side-effects auto sur `payment_completed` (set plan) et `subscription_cancelled` (reset plan='free')                       | —                                        |
| `frontend/src/services/__tests__/analytics.test.ts`                    | Étendre — RGPD guard global sur les 18 events + tests des side-effects                                                                                                                                                                        | —                                        |
| `frontend/src/hooks/useAnalytics.ts`                                   | Refactor `trackLogin` (signature payload-objet) + ajouter `track<E>()` typé + `trackHeroClick`, `trackSignupStarted`, `trackPricingViewed`, `trackFeatureUsed`, `trackExportGenerated`, `trackPaymentCompleted`, `trackSubscriptionCancelled` | —                                        |
| `frontend/src/hooks/useAuth.ts`                                        | Appeler `trackLogin(...)` avec payload enrichi dans `login()` (succès) et `loginWithGoogle()` (succès)                                                                                                                                        | —                                        |
| `frontend/src/pages/AuthCallback.tsx`                                  | Appeler `trackLogin(...)` après `loadProfileWithRetry()` succès dans le flux OAuth                                                                                                                                                            | —                                        |
| `frontend/src/pages/LandingPage.tsx`                                   | Hero CTA "Analyser" → `trackHeroClick({ has_url })` ; CTAs login/register → `trackSignupStarted({ source })` ; lien Pricing → `trackPricingViewed({ from: 'homepage' })`                                                                      | —                                        |
| `frontend/src/pages/UpgradePage.tsx`                                   | Toggle annuel → `pricing_toggle_changed` ; CTA card → `plan_selected` ; checkout → `checkout_started` (commentés `TODO[posthog-blocked]: pricing-v2`)                                                                                         | pricing-v2                               |
| `frontend/src/pages/PaymentSuccess.tsx`                                | `trackPaymentCompleted({ plan, amount_cents, is_annual })` + `setUserPropertiesTyped({ plan })` (side-effect auto via `captureTyped`)                                                                                                         | —                                        |
| `frontend/src/pages/MyAccount.tsx`                                     | Cancel subscription → `trackSubscriptionCancelled({ plan, days_active, reason? })`                                                                                                                                                            | partiel : `reason` BLOCKED-BY pricing-v2 |
| `frontend/src/store/analysisStore.ts`                                  | `startAnalysis()` → `analytics.captureTyped('analysis_started', ...)` ; `completeAnalysis()` → `analysis_completed`                                                                                                                           | —                                        |
| `frontend/src/components/AnalysisHub/SynthesisTab.tsx`                 | export click → `trackExportGenerated({ format, plan })` (sur le path déjà identifié)                                                                                                                                                          | —                                        |
| `frontend/src/components/analysis/ExportMenu.tsx`                      | export click → `trackExportGenerated`                                                                                                                                                                                                         | —                                        |
| `frontend/src/components/analysis/AnalysisActionBar.tsx`               | export click → `trackExportGenerated`                                                                                                                                                                                                         | —                                        |
| `frontend/src/pages/History.tsx` (lignes 892, 2748)                    | export click → `trackExportGenerated`                                                                                                                                                                                                         | —                                        |
| `frontend/src/pages/VoiceCallPage.tsx`                                 | `voice_call_started` (avec `provider`, commenté), `voice_call_ended`, `voice_quota_exhausted` (commentés)                                                                                                                                     | edge-tts + voice-packs                   |
| `frontend/src/components/voice/VoicePacksWidget.tsx` (path à vérifier) | `voice_pack_purchase_started`, `voice_pack_purchase_completed` (commentés)                                                                                                                                                                    | voice-packs                              |

### Total file impact

- **3 fichiers créés**
- **15 fichiers modifiés** (dont 6 BLOCKED en tout ou partie)

---

## Tasks

### Task 1: Type safety — créer `analytics.types.ts`

**Files:**

- Create: `frontend/src/services/analytics.types.ts`

- [ ] **Step 1: Write the file**

```typescript
// frontend/src/services/analytics.types.ts
/**
 * 📊 EventPayloadMap — Type-safety pour les events PostHog
 *
 * Maps event name → payload schema strict. Utilisé par :
 *   analytics.captureTyped<'hero_analysis_clicked'>('hero_analysis_clicked', { has_url: true })
 *
 * Si vous ajoutez un event, déclarez-le ici en PREMIER.
 */

// ─── Plan enum (aligné avec User['plan']) ─────────────────────────────────────
export type AnalyticsPlan =
  | "free"
  | "pro"
  | "expert"
  | "starter"
  | "etudiant"
  | "student"
  | "team"
  | "plus"
  | "unlimited";

// ─── Identify payload (post-login enrichi) ────────────────────────────────────
export interface LoginIdentifyPayload {
  email: string;
  plan: AnalyticsPlan;
  signup_date: string; // ISO 8601
  is_legacy_pricing: boolean; // BLOCKED-BY pricing-v2 — false par défaut
  analyses_count: number;
}

// ─── User property updates ────────────────────────────────────────────────────
export interface UserPropertyMap {
  email: string;
  plan: AnalyticsPlan;
  signup_date: string;
  is_legacy_pricing: boolean;
  analyses_count: number;
}

// ─── Event payload map ────────────────────────────────────────────────────────
export interface EventPayloadMap {
  // Homepage (3)
  hero_analysis_clicked: { has_url: boolean };
  signup_started: { source: "header" | "hero" | "cta_bottom" | "pricing" };
  pricing_viewed: { from: "homepage" | "dashboard" | "extension" };

  // Pricing (5) — BLOCKED-BY pricing-v2
  pricing_toggle_changed: { is_yearly: boolean };
  plan_selected: {
    plan: "free" | "pro" | "expert";
    is_annual: boolean;
    has_trial: boolean;
  };
  checkout_started: {
    plan: "free" | "pro" | "expert";
    price_cents: number;
    is_annual: boolean;
  };
  payment_completed: {
    plan: "free" | "pro" | "expert";
    amount_cents: number;
    is_annual: boolean;
  };
  subscription_cancelled: {
    plan: AnalyticsPlan;
    days_active: number;
    reason?: string;
  };

  // Dashboard (4)
  analysis_started: {
    platform: "youtube" | "tiktok";
    duration_category: string;
    has_account: boolean;
  };
  analysis_completed: {
    platform: "youtube" | "tiktok";
    word_count: number;
    has_factcheck: boolean;
  };
  feature_used: {
    feature:
      | "chat"
      | "factcheck"
      | "flashcards"
      | "mindmap"
      | "export"
      | "debate"
      | "voice_call";
  };
  export_generated: {
    format: "pdf" | "markdown" | "text";
    plan: AnalyticsPlan;
  };

  // Trial (2) — BLOCKED-BY pricing-v2
  trial_started: { plan: "pro" | "expert"; source: string };
  trial_converted: { plan: "pro" | "expert"; days_to_convert: number };

  // Voice (5) — BLOCKED-BY edge-tts + voice-packs
  voice_call_started: {
    provider: "edge_tts" | "elevenlabs";
    plan: AnalyticsPlan;
  };
  voice_call_ended: {
    provider: "edge_tts" | "elevenlabs";
    duration_seconds: number;
    ended_reason: "user" | "quota" | "error";
  };
  voice_quota_exhausted: {
    type: "monthly_allowance" | "lifetime_trial" | "purchased";
  };
  voice_pack_purchase_started: { pack_slug: string };
  voice_pack_purchase_completed: {
    pack_slug: string;
    minutes: number;
    price_cents: number;
  };
}

export type AnalyticsEventName = keyof EventPayloadMap;
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS (no errors introduced — fichier autonome).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/analytics.types.ts
git commit -m "feat(analytics): add EventPayloadMap type-safe schema for 18 PostHog events"
```

---

### Task 2: Étendre `analytics.ts` avec helpers typés + side-effects (TDD)

**Files:**

- Modify: `frontend/src/services/analytics.ts`
- Test: `frontend/src/services/__tests__/analytics.test.ts`

- [ ] **Step 1: Write the failing tests** (extend existing)

Append to `frontend/src/services/__tests__/analytics.test.ts` :

```typescript
describe("captureTyped (type-safe wrapper)", () => {
  it("should call posthog.capture with the same args as capture()", () => {
    mockHasConsent.mockReturnValue(true);
    // Force initialized via opt-in (init guard)
    analytics.init();
    analytics.captureTyped("hero_analysis_clicked", { has_url: true });
    expect(posthog.capture).toHaveBeenCalledWith("hero_analysis_clicked", {
      has_url: true,
    });
  });

  it("should NOT capture without consent", () => {
    mockHasConsent.mockReturnValue(false);
    analytics.captureTyped("hero_analysis_clicked", { has_url: true });
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

describe("side-effects on billing events", () => {
  beforeEach(() => {
    mockHasConsent.mockReturnValue(true);
    analytics.init();
  });

  it("should auto-update user property plan after payment_completed", () => {
    analytics.captureTyped("payment_completed", {
      plan: "pro",
      amount_cents: 599,
      is_annual: false,
    });
    expect(posthog.people.set).toHaveBeenCalledWith({ plan: "pro" });
  });

  it("should reset user property plan to 'free' after subscription_cancelled", () => {
    analytics.captureTyped("subscription_cancelled", {
      plan: "pro",
      days_active: 42,
    });
    expect(posthog.people.set).toHaveBeenCalledWith({ plan: "free" });
  });

  it("should NOT trigger side-effect for non-billing events", () => {
    analytics.captureTyped("hero_analysis_clicked", { has_url: false });
    expect(posthog.people.set).not.toHaveBeenCalled();
  });
});

describe("setUserPropertiesTyped", () => {
  it("should call posthog.people.set with typed props", () => {
    mockHasConsent.mockReturnValue(true);
    analytics.init();
    analytics.setUserPropertiesTyped({ plan: "pro" });
    expect(posthog.people.set).toHaveBeenCalledWith({ plan: "pro" });
  });

  it("should NOT set without consent", () => {
    mockHasConsent.mockReturnValue(false);
    analytics.setUserPropertiesTyped({ plan: "pro" });
    expect(posthog.people.set).not.toHaveBeenCalled();
  });
});

describe("AnalyticsEvents — 18 new events", () => {
  it("should expose all 18 event constants", () => {
    expect(AnalyticsEvents.HERO_ANALYSIS_CLICKED).toBe("hero_analysis_clicked");
    expect(AnalyticsEvents.SIGNUP_STARTED).toBe("signup_started");
    expect(AnalyticsEvents.PRICING_VIEWED).toBe("pricing_viewed");
    expect(AnalyticsEvents.PRICING_TOGGLE_CHANGED).toBe(
      "pricing_toggle_changed",
    );
    expect(AnalyticsEvents.PLAN_SELECTED).toBe("plan_selected");
    expect(AnalyticsEvents.CHECKOUT_STARTED).toBe("checkout_started");
    expect(AnalyticsEvents.PAYMENT_COMPLETED).toBe("payment_completed");
    expect(AnalyticsEvents.SUBSCRIPTION_CANCELLED).toBe(
      "subscription_cancelled",
    );
    expect(AnalyticsEvents.ANALYSIS_STARTED).toBe("analysis_started");
    expect(AnalyticsEvents.ANALYSIS_COMPLETED).toBe("analysis_completed");
    expect(AnalyticsEvents.FEATURE_USED).toBe("feature_used");
    expect(AnalyticsEvents.EXPORT_GENERATED).toBe("export_generated");
    expect(AnalyticsEvents.TRIAL_STARTED).toBe("trial_started");
    expect(AnalyticsEvents.TRIAL_CONVERTED).toBe("trial_converted");
    expect(AnalyticsEvents.VOICE_CALL_STARTED).toBe("voice_call_started");
    expect(AnalyticsEvents.VOICE_CALL_ENDED).toBe("voice_call_ended");
    expect(AnalyticsEvents.VOICE_QUOTA_EXHAUSTED).toBe("voice_quota_exhausted");
    expect(AnalyticsEvents.VOICE_PACK_PURCHASE_STARTED).toBe(
      "voice_pack_purchase_started",
    );
    expect(AnalyticsEvents.VOICE_PACK_PURCHASE_COMPLETED).toBe(
      "voice_pack_purchase_completed",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/services/__tests__/analytics.test.ts`
Expected: FAIL with `TypeError: analytics.captureTyped is not a function` and missing constants.

- [ ] **Step 3: Implement minimal code**

Modify `frontend/src/services/analytics.ts` :

1. After existing imports, add :

```typescript
import type {
  EventPayloadMap,
  UserPropertyMap,
  AnalyticsEventName,
} from "./analytics.types";
```

2. Inside the `analytics` object (after `setUserProperties`), add :

```typescript
  /**
   * Tracker un événement avec payload typé (recommandé pour nouveaux events).
   * Déclenche automatiquement les side-effects pour les events de billing.
   */
  captureTyped<E extends AnalyticsEventName>(event: E, properties: EventPayloadMap[E]): void {
    if (!isInitialized || !hasAnalyticsConsent()) return;
    posthog.capture(event, properties);

    // Side-effects automatiques (billing → user property)
    if (event === "payment_completed") {
      const props = properties as EventPayloadMap["payment_completed"];
      posthog.people.set({ plan: props.plan });
    } else if (event === "subscription_cancelled") {
      posthog.people.set({ plan: "free" });
    }
  },

  /**
   * Set user properties typés (sous-ensemble de UserPropertyMap autorisé).
   */
  setUserPropertiesTyped(properties: Partial<UserPropertyMap>): void {
    if (!isInitialized || !hasAnalyticsConsent()) return;
    posthog.people.set(properties);
  },
```

3. Étendre `AnalyticsEvents` const-as-const (ligne 149) avec les 19 nouvelles entrées (18 events + alias rétrocompat) :

```typescript
export const AnalyticsEvents = {
  // ─── Auth (existant) ──────────────────────────────────────────────────────
  SIGNUP: "user_signup",
  LOGIN: "user_login",
  LOGOUT: "user_logout",

  // ─── Core feature (existant) ──────────────────────────────────────────────
  VIDEO_ANALYZED: "video_analyzed",
  VIDEO_ANALYSIS_STARTED: "video_analysis_started",
  VIDEO_ANALYSIS_FAILED: "video_analysis_failed",

  // ─── Chat (existant) ──────────────────────────────────────────────────────
  CHAT_MESSAGE_SENT: "chat_message_sent",
  CHAT_SESSION_STARTED: "chat_session_started",

  // ─── Export (existant) ────────────────────────────────────────────────────
  EXPORT_CREATED: "export_created",

  // ─── Billing (existant) ───────────────────────────────────────────────────
  UPGRADE_STARTED: "upgrade_started",
  UPGRADE_COMPLETED: "upgrade_completed",
  PLAN_CHANGED: "plan_changed",

  // ─── Engagement (existant) ────────────────────────────────────────────────
  STUDY_TOOL_USED: "study_tool_used",
  FACTCHECK_VIEWED: "factcheck_viewed",
  PLAYLIST_ANALYZED: "playlist_analyzed",

  // ─── Errors (existant) ────────────────────────────────────────────────────
  ERROR_OCCURRED: "error_occurred",
  API_ERROR: "api_error",

  // ─── 🆕 Homepage (audit Kimi 2026-04-29) ──────────────────────────────────
  HERO_ANALYSIS_CLICKED: "hero_analysis_clicked",
  SIGNUP_STARTED: "signup_started",
  PRICING_VIEWED: "pricing_viewed",

  // ─── 🆕 Pricing (BLOCKED-BY pricing-v2) ───────────────────────────────────
  PRICING_TOGGLE_CHANGED: "pricing_toggle_changed",
  PLAN_SELECTED: "plan_selected",
  CHECKOUT_STARTED: "checkout_started",
  PAYMENT_COMPLETED: "payment_completed",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",

  // ─── 🆕 Dashboard ─────────────────────────────────────────────────────────
  ANALYSIS_STARTED: "analysis_started",
  ANALYSIS_COMPLETED: "analysis_completed",
  FEATURE_USED: "feature_used",
  EXPORT_GENERATED: "export_generated",

  // ─── 🆕 Trial (BLOCKED-BY pricing-v2) ─────────────────────────────────────
  TRIAL_STARTED: "trial_started",
  TRIAL_CONVERTED: "trial_converted",

  // ─── 🆕 Voice (BLOCKED-BY edge-tts + voice-packs) ─────────────────────────
  VOICE_CALL_STARTED: "voice_call_started",
  VOICE_CALL_ENDED: "voice_call_ended",
  VOICE_QUOTA_EXHAUSTED: "voice_quota_exhausted",
  VOICE_PACK_PURCHASE_STARTED: "voice_pack_purchase_started",
  VOICE_PACK_PURCHASE_COMPLETED: "voice_pack_purchase_completed",
} as const;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/services/__tests__/analytics.test.ts`
Expected: ALL PASS (5 existing + ~10 new tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/analytics.ts frontend/src/services/__tests__/analytics.test.ts
git commit -m "feat(analytics): add captureTyped helper, billing side-effects, 19 new event constants"
```

---

### Task 3: Tests régression RGPD globaux sur les 18 events

**Files:**

- Modify: `frontend/src/services/__tests__/analytics.test.ts`

- [ ] **Step 1: Write the failing test** — Append a parametrized RGPD test :

```typescript
describe("RGPD compliance — global guard on 18 new events", () => {
  const NEW_EVENTS_18: Array<{ event: keyof EventPayloadMap; payload: any }> = [
    { event: "hero_analysis_clicked", payload: { has_url: true } },
    { event: "signup_started", payload: { source: "header" } },
    { event: "pricing_viewed", payload: { from: "homepage" } },
    { event: "pricing_toggle_changed", payload: { is_yearly: false } },
    {
      event: "plan_selected",
      payload: { plan: "pro", is_annual: false, has_trial: false },
    },
    {
      event: "checkout_started",
      payload: { plan: "pro", price_cents: 599, is_annual: false },
    },
    {
      event: "payment_completed",
      payload: { plan: "pro", amount_cents: 599, is_annual: false },
    },
    {
      event: "subscription_cancelled",
      payload: { plan: "pro", days_active: 30 },
    },
    {
      event: "analysis_started",
      payload: {
        platform: "youtube",
        duration_category: "short",
        has_account: true,
      },
    },
    {
      event: "analysis_completed",
      payload: { platform: "youtube", word_count: 1234, has_factcheck: true },
    },
    { event: "feature_used", payload: { feature: "chat" } },
    { event: "export_generated", payload: { format: "pdf", plan: "pro" } },
    { event: "trial_started", payload: { plan: "pro", source: "homepage" } },
    { event: "trial_converted", payload: { plan: "pro", days_to_convert: 5 } },
    {
      event: "voice_call_started",
      payload: { provider: "edge_tts", plan: "free" },
    },
    {
      event: "voice_call_ended",
      payload: {
        provider: "edge_tts",
        duration_seconds: 60,
        ended_reason: "user",
      },
    },
    { event: "voice_quota_exhausted", payload: { type: "monthly_allowance" } },
    { event: "voice_pack_purchase_started", payload: { pack_slug: "30min" } },
    {
      event: "voice_pack_purchase_completed",
      payload: { pack_slug: "30min", minutes: 30, price_cents: 299 },
    },
  ];

  it.each(NEW_EVENTS_18)(
    "should NOT capture $event without consent",
    ({ event, payload }) => {
      mockHasConsent.mockReturnValue(false);
      analytics.captureTyped(event as any, payload);
      expect(posthog.capture).not.toHaveBeenCalled();
    },
  );

  it("should have exactly 19 entries (18 events + voice_pack_purchase_completed counted in voice 5)", () => {
    expect(NEW_EVENTS_18.length).toBe(19);
  });
});
```

> Note : la mission parle de "18 events" mais le bullet voice contient 5 events (started/ended/quota_exhausted/pack_started/pack_completed). Le compte total est donc 19. On documente ce léger off-by-one dans le test pour éviter la confusion future.

- [ ] **Step 2: Run tests to verify they fail (or pass if already covered)**

Run: `cd frontend && npx vitest run src/services/__tests__/analytics.test.ts`
Expected: PASS si Task 2 correctement implémentée.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/__tests__/analytics.test.ts
git commit -m "test(analytics): RGPD guard regression on 19 new events"
```

---

### Task 4: Identify enrichi — modifier `useAnalytics.trackLogin` shape (TDD)

**Files:**

- Create: `frontend/src/hooks/__tests__/useAnalytics.test.ts`
- Modify: `frontend/src/hooks/useAnalytics.ts`

- [ ] **Step 1: Write the failing test** — Create new test file :

```typescript
// frontend/src/hooks/__tests__/useAnalytics.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    isFeatureEnabled: vi.fn(() => false),
    people: { set: vi.fn() },
  },
}));

vi.mock("../../components/CookieBanner", () => ({
  hasAnalyticsConsent: vi.fn(() => true),
  hasGivenConsent: vi.fn(() => true),
}));

import posthog from "posthog-js";
import { useAnalytics } from "../useAnalytics";
import { analytics } from "../../services/analytics";

describe("useAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analytics.init(); // ensure isInitialized=true via mocked posthog
  });

  describe("trackLogin (enriched identify)", () => {
    it("should call posthog.identify with full enriched payload", () => {
      const { result } = renderHook(() => useAnalytics());
      act(() => {
        result.current.trackLogin({
          userId: 123,
          email: "test@deepsight.com",
          plan: "pro",
          signup_date: "2025-01-15T00:00:00Z",
          is_legacy_pricing: false,
          analyses_count: 42,
          method: "email",
        });
      });
      expect(posthog.identify).toHaveBeenCalledWith("123", {
        email: "test@deepsight.com",
        plan: "pro",
        signup_date: "2025-01-15T00:00:00Z",
        is_legacy_pricing: false,
        analyses_count: 42,
      });
      expect(posthog.capture).toHaveBeenCalledWith("user_login", {
        method: "email",
        plan: "pro",
      });
    });
  });

  describe("track<E>() (typed)", () => {
    it("should forward to analytics.captureTyped", () => {
      const { result } = renderHook(() => useAnalytics());
      act(() => {
        result.current.track("hero_analysis_clicked", { has_url: true });
      });
      expect(posthog.capture).toHaveBeenCalledWith("hero_analysis_clicked", {
        has_url: true,
      });
    });
  });

  describe("trackHeroClick / trackSignupStarted / trackPricingViewed", () => {
    it("trackHeroClick fires hero_analysis_clicked", () => {
      const { result } = renderHook(() => useAnalytics());
      act(() => result.current.trackHeroClick({ has_url: false }));
      expect(posthog.capture).toHaveBeenCalledWith("hero_analysis_clicked", {
        has_url: false,
      });
    });

    it("trackSignupStarted fires signup_started", () => {
      const { result } = renderHook(() => useAnalytics());
      act(() => result.current.trackSignupStarted("hero"));
      expect(posthog.capture).toHaveBeenCalledWith("signup_started", {
        source: "hero",
      });
    });

    it("trackPricingViewed fires pricing_viewed", () => {
      const { result } = renderHook(() => useAnalytics());
      act(() => result.current.trackPricingViewed("homepage"));
      expect(posthog.capture).toHaveBeenCalledWith("pricing_viewed", {
        from: "homepage",
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useAnalytics.test.ts`
Expected: FAIL with `TypeError: result.current.track is not a function` and shape mismatch on trackLogin.

- [ ] **Step 3: Implement** — Replace content of `frontend/src/hooks/useAnalytics.ts` :

```typescript
/**
 * 📊 useAnalytics — Hook pour tracker les events critiques (typé)
 *
 * S'utilise dans les composants pour tracker des actions utilisateur.
 * Respecte automatiquement le consentement RGPD via le service analytics.
 */

import { useCallback } from "react";
import { analytics, AnalyticsEvents } from "../services/analytics";
import type {
  EventPayloadMap,
  AnalyticsEventName,
  AnalyticsPlan,
} from "../services/analytics.types";

// ─── trackLogin enriched payload ──────────────────────────────────────────────
export interface TrackLoginPayload {
  userId: string | number;
  email: string;
  plan: AnalyticsPlan;
  signup_date: string;
  is_legacy_pricing: boolean;
  analyses_count: number;
  method: "email" | "google";
}

export function useAnalytics() {
  // ─── Auth ───────────────────────────────────────────────────────────────────
  const trackSignup = useCallback((method: "email" | "google") => {
    analytics.capture(AnalyticsEvents.SIGNUP, { method });
  }, []);

  const trackLogin = useCallback((payload: TrackLoginPayload) => {
    const {
      userId,
      email,
      plan,
      signup_date,
      is_legacy_pricing,
      analyses_count,
      method,
    } = payload;
    analytics.identify(userId, {
      email,
      plan,
      signup_date,
      is_legacy_pricing,
      analyses_count,
    });
    analytics.capture(AnalyticsEvents.LOGIN, { method, plan });
  }, []);

  const trackLogout = useCallback(() => {
    analytics.capture(AnalyticsEvents.LOGOUT);
    analytics.reset();
  }, []);

  // ─── Generic typed tracker ──────────────────────────────────────────────────
  const track = useCallback(
    <E extends AnalyticsEventName>(event: E, props: EventPayloadMap[E]) => {
      analytics.captureTyped(event, props);
    },
    [],
  );

  // ─── Homepage ───────────────────────────────────────────────────────────────
  const trackHeroClick = useCallback(
    (props: EventPayloadMap["hero_analysis_clicked"]) => {
      analytics.captureTyped("hero_analysis_clicked", props);
    },
    [],
  );

  const trackSignupStarted = useCallback(
    (source: EventPayloadMap["signup_started"]["source"]) => {
      analytics.captureTyped("signup_started", { source });
    },
    [],
  );

  const trackPricingViewed = useCallback(
    (from: EventPayloadMap["pricing_viewed"]["from"]) => {
      analytics.captureTyped("pricing_viewed", { from });
    },
    [],
  );

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  const trackFeatureUsed = useCallback(
    (feature: EventPayloadMap["feature_used"]["feature"]) => {
      analytics.captureTyped("feature_used", { feature });
    },
    [],
  );

  const trackExportGenerated = useCallback(
    (props: EventPayloadMap["export_generated"]) => {
      analytics.captureTyped("export_generated", props);
    },
    [],
  );

  // ─── Billing ────────────────────────────────────────────────────────────────
  const trackPaymentCompleted = useCallback(
    (props: EventPayloadMap["payment_completed"]) => {
      analytics.captureTyped("payment_completed", props);
    },
    [],
  );

  const trackSubscriptionCancelled = useCallback(
    (props: EventPayloadMap["subscription_cancelled"]) => {
      analytics.captureTyped("subscription_cancelled", props);
    },
    [],
  );

  // ─── Legacy (pré-existant, conservé) ────────────────────────────────────────
  const trackAnalysis = useCallback(
    (props: {
      videoId?: string;
      duration?: string;
      mode?: string;
      model?: string;
    }) => {
      analytics.capture(AnalyticsEvents.VIDEO_ANALYZED, props);
    },
    [],
  );

  const trackAnalysisStarted = useCallback(
    (props: { url?: string; mode?: string; model?: string }) => {
      analytics.capture(AnalyticsEvents.VIDEO_ANALYSIS_STARTED, props);
    },
    [],
  );

  const trackExport = useCallback((format: string) => {
    analytics.capture(AnalyticsEvents.EXPORT_CREATED, { format });
  }, []);

  const trackUpgrade = useCallback((fromPlan: string, toPlan: string) => {
    analytics.capture(AnalyticsEvents.UPGRADE_STARTED, {
      from: fromPlan,
      to: toPlan,
    });
  }, []);

  const trackChat = useCallback(() => {
    analytics.capture(AnalyticsEvents.CHAT_MESSAGE_SENT);
  }, []);

  const trackError = useCallback((error: string, context?: string) => {
    analytics.capture(AnalyticsEvents.ERROR_OCCURRED, { error, context });
  }, []);

  return {
    // Generic typed
    track,
    // Auth
    trackSignup,
    trackLogin,
    trackLogout,
    // Homepage
    trackHeroClick,
    trackSignupStarted,
    trackPricingViewed,
    // Dashboard
    trackFeatureUsed,
    trackExportGenerated,
    // Billing
    trackPaymentCompleted,
    trackSubscriptionCancelled,
    // Legacy
    trackAnalysis,
    trackAnalysisStarted,
    trackExport,
    trackUpgrade,
    trackChat,
    trackError,
    // Raw
    capture: analytics.capture.bind(analytics),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useAnalytics.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Verify no caller regression**

Run: `cd frontend && grep -rn "trackLogin(" src/ --include="*.ts" --include="*.tsx"`
Expected: 0 calls outside `useAnalytics.ts` (le seul caller à mettre à jour est dans Task 5).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useAnalytics.ts frontend/src/hooks/__tests__/useAnalytics.test.ts
git commit -m "feat(useAnalytics): enriched trackLogin payload + typed track<E>() + 7 new helpers"
```

---

### Task 5: Wire `trackLogin` dans `useAuth.ts` + `AuthCallback.tsx`

**Files:**

- Modify: `frontend/src/hooks/useAuth.ts`
- Modify: `frontend/src/pages/AuthCallback.tsx`

- [ ] **Step 1: Modify `useAuth.ts` — appel post-login email/password**

Dans `frontend/src/hooks/useAuth.ts`, importer le hook :

```typescript
// En haut du fichier, après les imports existants :
import { analytics } from "../services/analytics";
```

Modifier la fonction `login` (ligne 394) — après `await refreshUser(true);` :

```typescript
const login = useCallback(
  async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await authApi.login(email, password);
      await refreshUser(true);

      // 📊 Analytics — identify enrichi
      const u = await authApi.me({ skipCache: true }).catch(() => null);
      if (u) {
        analytics.identify(u.id, {
          email: u.email,
          plan: u.plan,
          signup_date: u.created_at,
          is_legacy_pricing: false, // TODO[posthog-blocked]: pricing-v2 — replace with u.is_legacy_pricing
          analyses_count: u.total_videos ?? 0,
        });
        analytics.capture("user_login", { method: "email", plan: u.plan });
      }
    } catch (error) {
      // ... existant inchangé
    }
  },
  [refreshUser],
);
```

> Note : on évite d'utiliser `useAnalytics()` ici car on est déjà dans un hook custom — appel direct au service `analytics` pour rester simple.

- [ ] **Step 2: Modify `AuthCallback.tsx` — appel post-OAuth**

Dans `frontend/src/pages/AuthCallback.tsx`, ajouter import :

```typescript
import { authApi } from "../services/api";
import { analytics } from "../services/analytics";
```

Dans `processCallback`, après `setStatus("success");` (ligne 229 et ligne 265, deux flows OAuth) :

```typescript
// 📊 Analytics — identify enrichi post-OAuth
try {
  const u = await authApi.me({ skipCache: true });
  analytics.identify(u.id, {
    email: u.email,
    plan: u.plan,
    signup_date: u.created_at,
    is_legacy_pricing: false, // TODO[posthog-blocked]: pricing-v2
    analyses_count: u.total_videos ?? 0,
  });
  analytics.capture("user_login", { method: "google", plan: u.plan });
} catch {
  /* analytics non bloquant */
}
```

- [ ] **Step 3: Typecheck + tests**

Run: `cd frontend && npm run typecheck && npx vitest run src/hooks/__tests__/`
Expected: PASS (useAuth tests existants n'utilisent pas trackLogin → pas de régression).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useAuth.ts frontend/src/pages/AuthCallback.tsx
git commit -m "feat(auth): emit PostHog identify with enriched user props on login + OAuth"
```

---

### Task 6: Events Homepage (3) — LandingPage CTAs

**Files:**

- Modify: `frontend/src/pages/LandingPage.tsx`

- [ ] **Step 1: Identifier les 4 CTAs dans LandingPage.tsx**

Run: `cd frontend && grep -n 'navigate.*login\|onClick.*Analyser\|onClick.*Découvrir' src/pages/LandingPage.tsx`

Cibles connues (depuis grep préalable) :

- Ligne 632 : `onClick={() => navigate("/login")}` → CTA login header → `signup_started({ source: 'header' })` (si tab=login) ou `source: 'header'` générique
- Ligne 638 : `onClick={() => navigate("/login?tab=register")}` → signup CTA bottom → `signup_started({ source: 'cta_bottom' })`
- Ligne 754 : `onClick={handleGuestAnalyze}` → hero analyze (guest) → `hero_analysis_clicked({ has_url: !!videoUrl })`
- Ligne 866 : `onClick={() => navigate("/login?tab=register")}` → success guest → `signup_started({ source: 'hero' })`
- Ligne 1415 : `onClick={() => navigate("/login")}` → CTA bottom → `signup_started({ source: 'cta_bottom' })`

- [ ] **Step 2: Modify LandingPage.tsx — ajouter import + tracking**

En haut du fichier, après les imports :

```typescript
import { useAnalytics } from "../hooks/useAnalytics";
```

Dans le composant fonctionnel, juste après `const navigate = useNavigate();` :

```typescript
const { trackHeroClick, trackSignupStarted, trackPricingViewed } =
  useAnalytics();
```

Pour chaque onClick ciblé, wrapper l'action avec le track. Exemple ligne 754 :

```tsx
<button
  onClick={() => {
    trackHeroClick({ has_url: !!videoUrl });
    handleGuestAnalyze();
  }}
>
  {language === "fr" ? "Analyser" : "Analyze"}
</button>
```

Ligne 638 :

```tsx
<button
  onClick={() => {
    trackSignupStarted("cta_bottom");
    navigate("/login?tab=register");
  }}
>
```

Ligne 632 :

```tsx
<button
  onClick={() => {
    trackSignupStarted("header");
    navigate("/login");
  }}
>
```

Ligne 866 :

```tsx
<button
  onClick={() => {
    trackSignupStarted("hero");
    navigate("/login?tab=register");
  }}
>
```

Ligne 1415 :

```tsx
<button
  onClick={() => {
    trackSignupStarted("cta_bottom");
    navigate("/login");
  }}
>
```

Si une section pricing existe sur la LandingPage avec un click vers `/upgrade`, ajouter :

```tsx
onClick={() => {
  trackPricingViewed("homepage");
  navigate("/upgrade");
}}
```

> Si aucun lien pricing direct sur LandingPage, déclencher `trackPricingViewed('homepage')` au mount d'une section visible via `IntersectionObserver` est over-engineering — préférer émettre depuis `UpgradePage.tsx` (Task 7) avec `from: 'homepage'` lu depuis `document.referrer.endsWith('/')`.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx
git commit -m "feat(analytics): track hero_analysis_clicked + signup_started on LandingPage CTAs"
```

---

### Task 7: Events Pricing (5) — UpgradePage avec placeholders BLOCKED-BY pricing-v2

**Files:**

- Modify: `frontend/src/pages/UpgradePage.tsx`

- [ ] **Step 1: Identifier les call sites** existants (annual toggle, plan card click, checkout button)

Run: `cd frontend && grep -n 'isYearly\|is_annual\|plan.*pro\|plan.*expert\|checkout' src/pages/UpgradePage.tsx | head -30`

- [ ] **Step 2: Modify UpgradePage.tsx**

Imports :

```typescript
import { analytics } from "../services/analytics";
```

Au mount, ajouter pageview tracking :

```typescript
useEffect(() => {
  // pricing_viewed est déjà émis depuis LandingPage si on vient de là
  // On émet ici si on vient du dashboard ou de l'extension
  const referrer = document.referrer;
  let from: "homepage" | "dashboard" | "extension" = "dashboard";
  if (referrer.includes("/dashboard")) from = "dashboard";
  else if (referrer.includes("chrome-extension://")) from = "extension";
  else if (
    referrer.endsWith("/") ||
    referrer.endsWith(".com/") ||
    referrer.endsWith(".com")
  )
    from = "homepage";
  analytics.captureTyped("pricing_viewed", { from });
}, []);
```

Pour le toggle annuel/mensuel, dans le handler :

```typescript
const handleAnnualToggle = (newIsYearly: boolean) => {
  setIsYearly(newIsYearly);
  // TODO[posthog-blocked]: pricing-v2 — uncomment when toggle UI ships
  // analytics.captureTyped("pricing_toggle_changed", { is_yearly: newIsYearly });
};
```

Pour le click sur une plan card :

```typescript
const handlePlanClick = (plan: "free" | "pro" | "expert") => {
  // TODO[posthog-blocked]: pricing-v2 — uncomment when has_trial logic ships
  // analytics.captureTyped("plan_selected", { plan, is_annual: isYearly, has_trial: false });
  // ... logique existante
};
```

Pour le bouton checkout :

```typescript
const handleCheckout = async (plan: "pro" | "expert") => {
  const priceCents = isYearly
    ? PRICE_ANNUAL_CENTS[plan]
    : PRICE_MONTHLY_CENTS[plan];
  // TODO[posthog-blocked]: pricing-v2 — uncomment when annual pricing ships
  // analytics.captureTyped("checkout_started", { plan, price_cents: priceCents, is_annual: isYearly });
  // ... appel billingApi.createCheckout existant
};
```

> **Note BLOCKED** : `pricing_toggle_changed`, `plan_selected`, `checkout_started` restent commentés tant que pricing-v2 n'a pas mergé (le toggle annuel n'est pas encore en UI prod, `has_trial` dépend du nouveau modèle). Le marker `TODO[posthog-blocked]: pricing-v2` permet un grep -rn pour décommenter en une passe.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/UpgradePage.tsx
git commit -m "feat(analytics): wire pricing_viewed + commented placeholders (BLOCKED-BY pricing-v2)"
```

---

### Task 8: Events Conversion — PaymentSuccess + MyAccount cancel

**Files:**

- Modify: `frontend/src/pages/PaymentSuccess.tsx`
- Modify: `frontend/src/pages/MyAccount.tsx`

- [ ] **Step 1: Modify PaymentSuccess.tsx**

Imports :

```typescript
import { useAnalytics } from "../hooks/useAnalytics";
```

Dans le composant, après détection du succès Stripe (lire le plan et l'amount depuis searchParams ou billingApi.getMyPlan) :

```typescript
const { trackPaymentCompleted } = useAnalytics();

useEffect(() => {
  if (status === "success" && planInfo) {
    trackPaymentCompleted({
      plan: planInfo.id as "pro" | "expert", // narrow
      amount_cents: planInfo.price_cents,
      is_annual: planInfo.is_annual ?? false, // TODO[posthog-blocked]: pricing-v2 — read from real data
    });
  }
}, [status, planInfo, trackPaymentCompleted]);
```

> Le side-effect `posthog.people.set({ plan })` est appliqué automatiquement par `captureTyped`.

- [ ] **Step 2: Modify MyAccount.tsx — cancel handler**

Dans `frontend/src/pages/MyAccount.tsx` (autour de la ligne 207 `await billingApi.cancelSubscription()`) :

Imports :

```typescript
import { useAnalytics } from "../hooks/useAnalytics";
```

Dans le composant :

```typescript
const { trackSubscriptionCancelled } = useAnalytics();
```

Modifier le handler cancel :

```typescript
const handleCancelSubscription = async () => {
  if (!user) return;
  setCancelLoading(true);
  try {
    const signupDate = new Date(user.created_at);
    const daysActive = Math.floor(
      (Date.now() - signupDate.getTime()) / 86400000,
    );

    await billingApi.cancelSubscription();

    trackSubscriptionCancelled({
      plan: user.plan as any, // narrow vers AnalyticsPlan
      days_active: daysActive,
      // reason: undefined, // TODO[posthog-blocked]: pricing-v2 — collect via dialog
    });

    // ... existant inchangé
  } catch (e) {
    // ... existant
  } finally {
    setCancelLoading(false);
  }
};
```

> Le side-effect `posthog.people.set({ plan: 'free' })` est appliqué automatiquement.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PaymentSuccess.tsx frontend/src/pages/MyAccount.tsx
git commit -m "feat(analytics): emit payment_completed + subscription_cancelled with auto plan side-effect"
```

---

### Task 9: Events Dashboard — analysisStore + export call sites

**Files:**

- Modify: `frontend/src/store/analysisStore.ts`
- Modify: `frontend/src/components/AnalysisHub/SynthesisTab.tsx`
- Modify: `frontend/src/components/analysis/ExportMenu.tsx`
- Modify: `frontend/src/components/analysis/AnalysisActionBar.tsx`
- Modify: `frontend/src/pages/History.tsx` (lignes 892, 2748)

- [ ] **Step 1: Modify `analysisStore.ts`**

Imports en haut :

```typescript
import { analytics } from "../services/analytics";
```

Dans `startAnalysis` (ligne 223) — ajouter capture après le `set` :

```typescript
startAnalysis: (videoId: string) => {
  set((state) => {
    state.status = "loading";
    state.progress = 0;
    state.progressMessage = "";
    state.streamingText = "";
    state.error = null;
    state.metadata = null;
    state.chatMessages = [];
  });

  // 📊 Analytics
  const platform: "youtube" | "tiktok" = videoId.includes("tiktok") ? "tiktok" : "youtube";
  // duration_category sera mis à jour dans completeAnalysis avec le vrai metadata
  analytics.captureTyped("analysis_started", {
    platform,
    duration_category: "unknown",
    has_account: typeof window !== "undefined" && !!localStorage.getItem("access_token"),
  });
},
```

Dans `completeAnalysis` (ligne 258) — ajouter capture après le `set` :

```typescript
completeAnalysis: (summary: Summary) => {
  set((state) => { /* existant */ });

  // 📊 Analytics
  const platform: "youtube" | "tiktok" = (summary.platform as any) ?? "youtube";
  const wordCount = summary.full_digest?.split(/\s+/).length ?? 0;
  analytics.captureTyped("analysis_completed", {
    platform,
    word_count: wordCount,
    has_factcheck: !!summary.fact_check_results,
  });
},
```

> Note : si `state.startAnalysis` est appelé avec `_videoId` ignoré (cf. eslint-disable ligne 222), retirer le underscore et utiliser le param.

- [ ] **Step 2: Modify les 5 call sites export**

Pour chaque fichier `SynthesisTab.tsx`, `ExportMenu.tsx`, `AnalysisActionBar.tsx`, `History.tsx` (×2), trouver la ligne avec `videoApi.exportSummary(...)` et entourer :

```typescript
import { useAnalytics } from "../../hooks/useAnalytics"; // ajuster le path relatif
import { useAuth } from "../../hooks/useAuth";

// Dans le composant :
const { trackExportGenerated } = useAnalytics();
const { user } = useAuth();

// Dans le handler export :
const handleExport = async (format: "pdf" | "markdown" | "text") => {
  trackExportGenerated({ format, plan: (user?.plan ?? "free") as any });
  const blob = await videoApi.exportSummary(summary.id, format);
  // ... existant
};
```

> Si certains fichiers utilisent un `format` plus large (`docx`, `xlsx`), narrow vers les 3 valeurs de l'enum ou étendre le type `EventPayloadMap['export_generated']['format']` dans `analytics.types.ts` (édition cohérente type-only).

- [ ] **Step 3: feature_used pour chat / factcheck / mindmap / debate**

Identifier 4 call sites par grep :

Run: `cd frontend && grep -rn 'CHAT_MESSAGE_SENT\|FACTCHECK_VIEWED\|study_tool\|debate' src/ --include="*.tsx" --include="*.ts" | head -20`

Pour chaque emplacement où l'on émet déjà un legacy event (`CHAT_MESSAGE_SENT`, `FACTCHECK_VIEWED`, `STUDY_TOOL_USED`), **ajouter en plus** un `feature_used` :

```typescript
analytics.captureTyped("feature_used", { feature: "chat" }); // ou 'factcheck', 'flashcards', 'mindmap', 'debate'
```

> Stratégie : émettre en parallèle (le legacy + le nouveau) pour conserver les données historiques tout en alimentant la nouvelle vue PostHog.

- [ ] **Step 4: Typecheck + tests**

Run: `cd frontend && npm run typecheck && npx vitest run`
Expected: PASS sans régression sur les ~400 tests existants.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/analysisStore.ts frontend/src/components/AnalysisHub/SynthesisTab.tsx frontend/src/components/analysis/ExportMenu.tsx frontend/src/components/analysis/AnalysisActionBar.tsx frontend/src/pages/History.tsx
git commit -m "feat(analytics): emit analysis_started/completed, feature_used, export_generated on dashboard paths"
```

---

### Task 10: Events Voice — placeholders BLOCKED-BY edge-tts + voice-packs

**Files:**

- Modify: `frontend/src/pages/VoiceCallPage.tsx`
- Modify: `frontend/src/components/voice/voiceAnalytics.ts` (NE PAS supprimer — coexistence)
- Modify: voice-packs widget (path à confirmer dans grep)

- [ ] **Step 1: Identifier le widget voice-packs**

Run: `cd frontend && grep -rn 'voice.*pack\|VoicePack\|pack_slug' src/ --include="*.tsx" --include="*.ts" | head -20`

Si le widget n'existe pas encore, ajouter le hook au futur fichier dans la file-list du plan voice-packs.

- [ ] **Step 2: Modify VoiceCallPage.tsx**

Identifier les call sites des transitions de session voice :

Run: `cd frontend && grep -n 'startVoiceCall\|endVoiceCall\|onSessionEnd\|sessionStart' src/pages/VoiceCallPage.tsx | head -20`

Imports :

```typescript
import { analytics } from "../services/analytics";
```

Sur le start de session :

```typescript
const handleStartVoice = async () => {
  // TODO[posthog-blocked]: edge-tts — replace 'elevenlabs' fallback by real provider from session metadata
  // analytics.captureTyped("voice_call_started", {
  //   provider: providerFromConfig, // 'edge_tts' | 'elevenlabs'
  //   plan: (user?.plan ?? "free") as any,
  // });
  // ... existant
};
```

Sur l'end de session :

```typescript
const handleEndVoice = async (reason: "user" | "quota" | "error") => {
  // TODO[posthog-blocked]: edge-tts
  // analytics.captureTyped("voice_call_ended", {
  //   provider: providerFromSession,
  //   duration_seconds: secondsElapsed,
  //   ended_reason: reason,
  // });
  // ... existant
};
```

Sur quota épuisé (utiliser le path qui appelle déjà `VoiceAnalytics.trackQuotaReached` dans `voiceAnalytics.ts`) :

```typescript
// Dans le path quotaReached existant, ajouter EN PLUS du legacy :
analytics.captureTyped("voice_quota_exhausted", {
  type: "monthly_allowance", // TODO[posthog-blocked]: voice-packs — narrow par contexte (lifetime_trial / purchased)
});
```

- [ ] **Step 3: Voice packs widget**

Si le widget est identifié (ex: `frontend/src/components/voice/VoicePacksWidget.tsx`), wrapper le bouton "Acheter pack" :

```typescript
const handlePackPurchase = (pack: {
  slug: string;
  minutes: number;
  price_cents: number;
}) => {
  // TODO[posthog-blocked]: voice-packs
  // analytics.captureTyped("voice_pack_purchase_started", { pack_slug: pack.slug });
  // ... appel billingApi.purchasePack
};
```

Sur callback succès :

```typescript
const onPackPurchaseSuccess = (pack: any) => {
  // TODO[posthog-blocked]: voice-packs
  // analytics.captureTyped("voice_pack_purchase_completed", {
  //   pack_slug: pack.slug,
  //   minutes: pack.minutes,
  //   price_cents: pack.price_cents,
  // });
};
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/VoiceCallPage.tsx
git commit -m "feat(analytics): wire voice_call_*/voice_quota_exhausted placeholders (BLOCKED-BY edge-tts + voice-packs)"
```

---

### Task 11: Events Trial — placeholders BLOCKED-BY pricing-v2

**Files:**

- Modify: `frontend/src/pages/UpgradePage.tsx` (extension de Task 7)
- Modify: `frontend/src/pages/PaymentSuccess.tsx` (extension de Task 8)

- [ ] **Step 1: trial_started — bouton "Start Pro Trial" sur UpgradePage**

Identifier le call site dans `UpgradePage.tsx` :

Run: `cd frontend && grep -n 'startProTrial\|start_pro_trial\|trial' src/pages/UpgradePage.tsx | head -10`

Wrapper le handler :

```typescript
const handleStartTrial = async (plan: "pro" | "expert") => {
  // TODO[posthog-blocked]: pricing-v2
  // analytics.captureTyped("trial_started", {
  //   plan,
  //   source: document.referrer.includes("/dashboard") ? "dashboard" : "homepage",
  // });
  // ... appel billingApi.startProTrial existant
};
```

- [ ] **Step 2: trial_converted — sur PaymentSuccess si l'utilisateur convertit depuis un trial actif**

Dans `PaymentSuccess.tsx`, après `trackPaymentCompleted` :

```typescript
// TODO[posthog-blocked]: pricing-v2 — détection trial_converted
// const wasInTrial = await billingApi.wasUserInTrial(); // nouvelle API à exposer
// if (wasInTrial) {
//   const daysToConvert = Math.floor((Date.now() - new Date(wasInTrial.startedAt).getTime()) / 86400000);
//   analytics.captureTyped("trial_converted", { plan: planInfo.id, days_to_convert: daysToConvert });
// }
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/UpgradePage.tsx frontend/src/pages/PaymentSuccess.tsx
git commit -m "feat(analytics): trial_started + trial_converted placeholders (BLOCKED-BY pricing-v2)"
```

---

### Task 12: Test E2E `landing-hero-cta.test.tsx`

**Files:**

- Create: `frontend/src/__tests__/landing-hero-cta.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// frontend/src/__tests__/landing-hero-cta.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    isFeatureEnabled: vi.fn(() => false),
    people: { set: vi.fn() },
  },
}));

vi.mock("../components/CookieBanner", () => ({
  hasAnalyticsConsent: vi.fn(() => true),
  hasGivenConsent: vi.fn(() => true),
  CookieBanner: () => null,
}));

// Mock api pour éviter les vrais calls
vi.mock("../services/api", () => ({
  authApi: { me: vi.fn(), login: vi.fn(), loginWithGoogle: vi.fn() },
  videoApi: { analyzeVideo: vi.fn(), getGuestDemo: vi.fn() },
  billingApi: { getMyPlan: vi.fn() },
  api: {},
  ApiError: class ApiError extends Error {},
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
}));

import posthog from "posthog-js";
import { analytics } from "../services/analytics";
import LandingPage from "../pages/LandingPage";

describe("LandingPage hero CTA — analytics integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analytics.init();
  });

  it("should fire hero_analysis_clicked on hero analyze button click", async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // Cible le bouton hero "Analyser" / "Analyze"
    const analyzeButton = await screen.findByRole("button", {
      name: /analyser|analyze/i,
    });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith(
        "hero_analysis_clicked",
        expect.objectContaining({ has_url: expect.any(Boolean) }),
      );
    });
  });

  it("should fire signup_started on register CTA click", async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // Cible un CTA register (texte "Inscription" / "Register" / "Get started")
    const buttons = await screen.findAllByRole("button");
    const registerButton = buttons.find((b) =>
      /inscription|register|commencer|sign\s*up|get started/i.test(
        b.textContent ?? "",
      ),
    );
    expect(registerButton).toBeDefined();
    fireEvent.click(registerButton!);

    await waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith(
        "signup_started",
        expect.objectContaining({
          source: expect.stringMatching(/header|hero|cta_bottom|pricing/),
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify**

Run: `cd frontend && npx vitest run src/__tests__/landing-hero-cta.test.tsx`
Expected: PASS (le test peut nécessiter d'ajuster le selector si LandingPage utilise des `<a>` plutôt que `<button>`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/landing-hero-cta.test.tsx
git commit -m "test(analytics): E2E LandingPage hero CTA fires hero_analysis_clicked + signup_started"
```

---

### Task 13: Vérification globale + lint + build

**Files:** aucun (verification only)

- [ ] **Step 1: Audit des `analytics.capture` legacy non typés**

Run: `cd frontend && grep -rn "analytics\.capture(" src/ --include="*.ts" --include="*.tsx"`
Expected output : noter les emplacements qui n'utilisent PAS `captureTyped`. Document non-bloquant — migration progressive future.

- [ ] **Step 2: Audit des marqueurs BLOCKED**

Run: `cd frontend && grep -rn "TODO\[posthog-blocked\]" src/ --include="*.ts" --include="*.tsx"`
Expected : ~12 marqueurs (5 pricing-v2 + 4 voice-packs/edge-tts + 3 voice + 0 ou 2 trial selon implémentation).

> Stocker la liste dans le PR description pour le merge ordering futur.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS (warnings tolérés, errors zéro).

- [ ] **Step 4: Typecheck final**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Tests complets**

Run: `cd frontend && npx vitest run`
Expected: ~410+ tests (400 existants + ~10 nouveaux), tous PASS.

- [ ] **Step 6: Build production**

Run: `cd frontend && npm run build`
Expected: succès, bundle généré dans `dist/`.

- [ ] **Step 7: Commit final**

```bash
git commit --allow-empty -m "chore(analytics): verification pass — 18 events wired, RGPD-compliant, build green"
```

---

## Self-Review

### 1. Spec coverage

| Élément spec mission                                                           | Couvert par                       | Statut                                                                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 18 events typés (3 homepage + 5 pricing + 4 dashboard + 2 trial + 4 voice)     | Tasks 1, 6, 7, 8, 9, 10, 11       | ✅ (note : 19 events au total — voir Task 3 step 1)                                                                       |
| EventPayloadMap type-safe                                                      | Task 1                            | ✅                                                                                                                        |
| `captureTyped<E>()` rétro-compat                                               | Task 2                            | ✅ (`capture` original conservé)                                                                                          |
| `setUserPropertiesTyped`                                                       | Task 2                            | ✅                                                                                                                        |
| Side-effects auto sur `payment_completed` + `subscription_cancelled`           | Task 2                            | ✅                                                                                                                        |
| Identify enrichi (email, plan, signup_date, is_legacy_pricing, analyses_count) | Task 4 (shape) + Task 5 (wire)    | ✅                                                                                                                        |
| Hook `useAnalytics()` typé                                                     | Task 4 (existait déjà, refactoré) | ✅                                                                                                                        |
| `trackLogin` shape changé (breaking, doc)                                      | Task 4 step 3                     | ✅                                                                                                                        |
| Wire AuthContext / Login / AuthCallback                                        | Task 5                            | ✅ (note : on touche `useAuth.ts` plutôt que `AuthContext.tsx` car la logique vit là — choix justifié dans Task 5 step 1) |
| LandingPage CTAs                                                               | Task 6                            | ✅                                                                                                                        |
| UpgradePage events (BLOCKED)                                                   | Task 7                            | ✅ avec marqueurs                                                                                                         |
| PaymentSuccess + Cancel                                                        | Task 8                            | ✅                                                                                                                        |
| analysisStore + export call sites                                              | Task 9                            | ✅ (5 call sites couverts)                                                                                                |
| VoiceCallPage + voice-packs widget (BLOCKED)                                   | Task 10                           | ✅ avec marqueurs                                                                                                         |
| Trial events (BLOCKED)                                                         | Task 11                           | ✅ avec marqueurs                                                                                                         |
| Test RGPD étendu                                                               | Task 3                            | ✅                                                                                                                        |
| Test useAnalytics hook                                                         | Task 4 step 1                     | ✅                                                                                                                        |
| Test E2E `landing-hero-cta`                                                    | Task 12                           | ✅                                                                                                                        |

### 2. Placeholder scan

- ✅ Pas de "TBD"/"implement later" — tous les snippets sont complets.
- ✅ Tous les marker `TODO[posthog-blocked]` sont **intentionnels** et grep-ables (= pas un placeholder de plan, mais un decoupling explicite).
- ✅ Toutes les commandes ont leur Expected output.

### 3. Type consistency

- `EventPayloadMap` (Task 1) → `captureTyped<E extends AnalyticsEventName>` (Task 2) → `track<E>()` hook (Task 4) — **chaîne typée cohérente**.
- `LoginIdentifyPayload` Task 1 ≠ `TrackLoginPayload` Task 4 (l'un est le payload identify pur, l'autre ajoute `userId` et `method`) — **différence intentionnelle, documentée**.
- `AnalyticsPlan` (Task 1) couvre l'union plan élargie de `User['plan']` (incluant aliases legacy `etudiant`/`student`/`team`/`unlimited`/`plus`/`starter`) → cohérent avec `frontend/src/services/api.ts:33-42`.

### Décisions à confirmer avec l'utilisateur

| ID     | Décision                                                                                                                               | Recommandation par défaut                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | PostHog Python SDK côté backend pour events server-side (ex: webhook Stripe → `payment_completed` source-of-truth) ?                   | **Hors scope V1**. Backend déjà émet vers la table `AnalyticsEvent` ; mirror PostHog peut venir en V2.                                                                                          |
| **D2** | Activer `disable_session_recording: false` (currently true ligne 45) pour funnels visuels ?                                            | **Garder désactivé** (RGPD-friendly + coût PostHog). Ré-évaluer après 30 jours.                                                                                                                 |
| **D3** | Utiliser `analytics.isFeatureEnabled('flag-name')` pour A/B-tester les CTAs ?                                                          | Hors scope ce plan, infra déjà prête (`isFeatureEnabled` existe ligne 139 du service).                                                                                                          |
| **D4** | Exposer un nouveau backend field `users.subscription_started_at` pour calculer `days_active` plus fidèlement que `created_at` ?        | **Recommandé**. À ajouter dans `pricing-v2` plan (déjà BLOCKED par lui). En attendant on utilise `created_at` (proxy correct sauf changement de plan ancien).                                   |
| **D5** | Refactor `frontend/src/components/voice/voiceAnalytics.ts` pour adopter les nouveaux noms `voice_call_*` (au lieu de `voice_chat_*`) ? | **Hors scope V1**. Coexistence acceptée. Dette à inscrire au backlog post-merge edge-tts. Nouveaux events `voice_call_started/_ended/_quota_exhausted` rajoutent un dashboard PostHog distinct. |

---

## Execution Handoff

Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-29-posthog-events-complets.md`. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — dispatch fresh subagent par tâche, review entre tâches, itération rapide. Sub-agent model obligatoire : `claude-opus-4-7[1m]`.

**2. Inline Execution** — exécuter dans la session courante via `superpowers:executing-plans`, batch avec checkpoints.

Quelle approche ?
