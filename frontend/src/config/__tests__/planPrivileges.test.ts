/**
 * Tests Pricing v2 — planPrivileges.ts (Free / Pro 8.99 € / Expert 19.99 €).
 *
 * Replaces the obsolete v0/v1 test file. Covers :
 *   - PlanId v2 enum + hierarchy
 *   - PLAN_LIMITS / PLAN_FEATURES par plan v2
 *   - PLANS_INFO with priceMonthly + priceYearly (v2)
 *   - normalizePlanId : aliases legacy v0 -> v2 (plus->pro, etc.)
 *   - hasFeature, getLimit, isUnlimited, formatLimit, isPlanHigher
 *   - CONVERSION_TRIGGERS with trialEnabled true and trialPlan="pro"
 */

import { describe, it, expect } from "vitest";
import {
  PLAN_HIERARCHY,
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  hasFeature,
  getLimit,
  isUnlimited,
  getPlanInfo,
  isPlanHigher,
  getMinPlanForFeature,
  formatLimit,
  normalizePlanId,
  shouldShowLowCreditsAlert,
  calculateTimeSaved,
  CONVERSION_TRIGGERS,
  type PlanId,
} from "../planPrivileges";

// ═══════════════════════════════════════════════════════════════════════
// PRICING V2 — PLAN HIERARCHY
// ═══════════════════════════════════════════════════════════════════════

describe("Pricing v2 — Plan Hierarchy", () => {
  it("PlanId is free | pro | expert (3 tiers)", () => {
    expect(PLAN_HIERARCHY).toEqual<PlanId[]>(["free", "pro", "expert"]);
    expect(PLAN_HIERARCHY).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FREE PLAN
// ═══════════════════════════════════════════════════════════════════════

describe("Free Plan", () => {
  it("has correct analysis limits", () => {
    expect(PLAN_LIMITS.free.monthlyAnalyses).toBe(5);
    expect(PLAN_LIMITS.free.maxVideoLengthMin).toBe(15);
  });

  it("has zero voice minutes", () => {
    expect(PLAN_LIMITS.free.voiceChatMonthlyMinutes).toBe(0);
    expect(PLAN_FEATURES.free.voiceChat).toBe(false);
  });

  it("has no premium features", () => {
    expect(PLAN_FEATURES.free.mindmap).toBe(false);
    expect(PLAN_FEATURES.free.webSearch).toBe(false);
    expect(PLAN_FEATURES.free.exportPdf).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PRO PLAN v2 (anciennement Plus v0)
// ═══════════════════════════════════════════════════════════════════════

describe("Pro v2 (Tier intermédiaire)", () => {
  it("has 25 monthly analyses + 60 min max video", () => {
    expect(PLAN_LIMITS.pro.monthlyAnalyses).toBe(25);
    expect(PLAN_LIMITS.pro.maxVideoLengthMin).toBe(60);
  });

  it("has voice 30 min/month (v2 H4)", () => {
    expect(PLAN_LIMITS.pro.voiceChatEnabled).toBe(true);
    expect(PLAN_LIMITS.pro.voiceChatMonthlyMinutes).toBe(30);
    expect(PLAN_FEATURES.pro.voiceChat).toBe(true);
  });

  it("has mindmap, webSearch, fact-check, export pdf", () => {
    expect(PLAN_FEATURES.pro.mindmap).toBe(true);
    expect(PLAN_FEATURES.pro.webSearch).toBe(true);
    expect(PLAN_FEATURES.pro.factcheck).toBe(true);
    expect(PLAN_FEATURES.pro.exportPdf).toBe(true);
  });

  it("does NOT have playlists / deepResearch (Expert features)", () => {
    expect(PLAN_FEATURES.pro.playlists).toBe(false);
    expect(PLAN_FEATURES.pro.deepResearch).toBe(false);
    expect(PLAN_LIMITS.pro.deepResearchEnabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// EXPERT PLAN v2 (anciennement Pro v0)
// ═══════════════════════════════════════════════════════════════════════

describe("Expert v2 (Tier premium)", () => {
  it("has 100 monthly analyses + 240 min max video", () => {
    expect(PLAN_LIMITS.expert.monthlyAnalyses).toBe(100);
    expect(PLAN_LIMITS.expert.maxVideoLengthMin).toBe(240);
  });

  it("has voice 120 min/month (v2 H4)", () => {
    expect(PLAN_LIMITS.expert.voiceChatEnabled).toBe(true);
    expect(PLAN_LIMITS.expert.voiceChatMonthlyMinutes).toBe(120);
  });

  it("has unlimited chat, deepResearch, playlists", () => {
    expect(PLAN_LIMITS.expert.chatQuestionsPerVideo).toBe(-1);
    expect(PLAN_LIMITS.expert.chatDailyLimit).toBe(-1);
    expect(PLAN_FEATURES.expert.deepResearch).toBe(true);
    expect(PLAN_FEATURES.expert.playlists).toBe(true);
    expect(PLAN_LIMITS.expert.maxPlaylists).toBe(10);
  });

  it("has all Mistral models incl. large", () => {
    expect(PLAN_LIMITS.expert.allowedModels).toContain("mistral-large-2512");
    expect(PLAN_LIMITS.expert.defaultModel).toBe("mistral-large-2512");
  });

  it("has priority queue + TTS", () => {
    expect(PLAN_LIMITS.expert.priorityQueue).toBe(true);
    expect(PLAN_FEATURES.expert.ttsAudio).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PRICES v2
// ═══════════════════════════════════════════════════════════════════════

describe("Plans Pricing v2 (cents)", () => {
  it("Pro priceMonthly 899, priceYearly 8990 (-17 %)", () => {
    expect(PLANS_INFO.pro.priceMonthly).toBe(899);
    expect(PLANS_INFO.pro.priceYearly).toBe(8990);
  });

  it("Expert priceMonthly 1999, priceYearly 19990 (-17 %)", () => {
    expect(PLANS_INFO.expert.priceMonthly).toBe(1999);
    expect(PLANS_INFO.expert.priceYearly).toBe(19990);
  });

  it("Free is 0 / 0", () => {
    expect(PLANS_INFO.free.priceMonthly).toBe(0);
    expect(PLANS_INFO.free.priceYearly).toBe(0);
  });

  it("prices are strictly ascending", () => {
    const monthlies = PLAN_HIERARCHY.map((p) => PLANS_INFO[p].priceMonthly);
    for (let i = 1; i < monthlies.length; i++) {
      expect(monthlies[i]).toBeGreaterThan(monthlies[i - 1]);
    }
  });

  it("only Pro is popular (default trial target)", () => {
    expect(PLANS_INFO.free.popular).toBe(false);
    expect(PLANS_INFO.pro.popular).toBe(true);
    expect(PLANS_INFO.expert.popular).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// normalizePlanId — aliases legacy v0 -> v2 inverted
// ═══════════════════════════════════════════════════════════════════════

describe("normalizePlanId — aliases legacy v0 -> v2", () => {
  it("normalizes null/undefined/empty to free", () => {
    expect(normalizePlanId(null)).toBe("free");
    expect(normalizePlanId(undefined)).toBe("free");
    expect(normalizePlanId("")).toBe("free");
  });

  it("normalizes v2 canonical names", () => {
    expect(normalizePlanId("free")).toBe("free");
    expect(normalizePlanId("pro")).toBe("pro");
    expect(normalizePlanId("expert")).toBe("expert");
  });

  it("legacy v0 plus -> pro v2", () => {
    expect(normalizePlanId("plus")).toBe("pro");
    expect(normalizePlanId("Plus")).toBe("pro");
    expect(normalizePlanId("PLUS")).toBe("pro");
  });

  it("legacy student/etudiant/starter -> pro v2", () => {
    expect(normalizePlanId("starter")).toBe("pro");
    expect(normalizePlanId("etudiant")).toBe("pro");
    expect(normalizePlanId("étudiant")).toBe("pro");
    expect(normalizePlanId("student")).toBe("pro");
  });

  it("legacy team/equipe/unlimited -> expert v2", () => {
    expect(normalizePlanId("team")).toBe("expert");
    expect(normalizePlanId("equipe")).toBe("expert");
    expect(normalizePlanId("équipe")).toBe("expert");
    expect(normalizePlanId("unlimited")).toBe("expert");
    expect(normalizePlanId("admin")).toBe("expert");
  });

  it("unknown plans default to free", () => {
    expect(normalizePlanId("enterprise")).toBe("free");
    expect(normalizePlanId("foo")).toBe("free");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CONVERSION_TRIGGERS v2
// ═══════════════════════════════════════════════════════════════════════

describe("Conversion Triggers v2", () => {
  it("trial 7j enabled and targets Pro by default", () => {
    expect(CONVERSION_TRIGGERS.trialEnabled).toBe(true);
    expect(CONVERSION_TRIGGERS.trialDays).toBe(7);
    expect(CONVERSION_TRIGGERS.trialPlan).toBe("pro");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// hasFeature / getLimit / isUnlimited / formatLimit
// ═══════════════════════════════════════════════════════════════════════

describe("hasFeature / getLimit / isUnlimited / formatLimit", () => {
  it("hasFeature : flashcards unlocked at free (free has flashcards true)", () => {
    expect(hasFeature("free", "flashcardsEnabled")).toBe(true); // free has flashcards
    expect(hasFeature("pro", "flashcardsEnabled")).toBe(true);
    expect(hasFeature("expert", "flashcardsEnabled")).toBe(true);
  });

  it("hasFeature : webSearch unlocked at pro", () => {
    expect(hasFeature("free", "webSearchEnabled")).toBe(false);
    expect(hasFeature("pro", "webSearchEnabled")).toBe(true);
    expect(hasFeature("expert", "webSearchEnabled")).toBe(true);
  });

  it("getLimit : Pro 25 analyses, Expert 100", () => {
    expect(getLimit("pro", "monthlyAnalyses")).toBe(25);
    expect(getLimit("expert", "monthlyAnalyses")).toBe(100);
  });

  it("isUnlimited : Expert chat unlimited (-1)", () => {
    expect(isUnlimited("pro", "chatDailyLimit")).toBe(false);
    expect(isUnlimited("expert", "chatDailyLimit")).toBe(true);
    expect(isUnlimited("expert", "chatQuestionsPerVideo")).toBe(true);
  });

  it("formatLimit : -1 -> infinity, value -> string", () => {
    expect(formatLimit(-1)).toBe("∞");
    expect(formatLimit(50)).toBe("50");
    expect(formatLimit(15, "min")).toBe("15 min");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isPlanHigher
// ═══════════════════════════════════════════════════════════════════════

describe("isPlanHigher", () => {
  it("expert > pro > free", () => {
    expect(isPlanHigher("expert", "pro")).toBe(true);
    expect(isPlanHigher("pro", "free")).toBe(true);
    expect(isPlanHigher("expert", "free")).toBe(true);
  });

  it("free is not higher than pro/expert", () => {
    expect(isPlanHigher("free", "pro")).toBe(false);
    expect(isPlanHigher("free", "expert")).toBe(false);
  });

  it("same plan is not higher", () => {
    expect(isPlanHigher("pro", "pro")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getMinPlanForFeature
// ═══════════════════════════════════════════════════════════════════════

describe("getMinPlanForFeature v2", () => {
  it("webSearch unlocked at pro v2", () => {
    expect(getMinPlanForFeature("webSearchEnabled")).toBe("pro");
  });

  it("playlists require expert v2", () => {
    expect(getMinPlanForFeature("playlistsEnabled")).toBe("expert");
  });

  it("monthlyAnalyses available from free", () => {
    expect(getMinPlanForFeature("monthlyAnalyses")).toBe("free");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// shouldShowLowCreditsAlert / calculateTimeSaved (sanity)
// ═══════════════════════════════════════════════════════════════════════

describe("shouldShowLowCreditsAlert", () => {
  it("low credits triggers alert (free 5 analyses, threshold 1)", () => {
    expect(shouldShowLowCreditsAlert(1, "free")).toBe(true);
  });
  it("0 credits → no alert (already empty)", () => {
    expect(shouldShowLowCreditsAlert(0, "free")).toBe(false);
  });
});

describe("calculateTimeSaved", () => {
  it("100 analyses ≈ 25h", () => {
    const result = calculateTimeSaved(100);
    expect(result.hours).toBe(25);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getPlanInfo
// ═══════════════════════════════════════════════════════════════════════

describe("getPlanInfo", () => {
  it("returns free / pro / expert info correctly", () => {
    expect(getPlanInfo("free").name).toBe("Gratuit");
    expect(getPlanInfo("pro").name).toBe("Pro");
    expect(getPlanInfo("expert").name).toBe("Expert");
  });

  it("all v2 plans have priceYearly field (Pricing v2 enrichment)", () => {
    for (const plan of PLAN_HIERARCHY) {
      const info = getPlanInfo(plan);
      expect(typeof info.priceYearly).toBe("number");
    }
  });
});
