/**
 * Tests — utils/plan.ts (adaptation de GET /api/billing/my-plan).
 *
 * Bug couvert : l'extension lisait plan_id / monthly_analyses /
 * analyses_this_month / features directement dans la réponse, qui expose en
 * réalité plan / limits / usage → « undefined/undefined analyses ».
 */

import {
  UNLIMITED_ANALYSES,
  isAnalysisQuotaExceeded,
  normalizePlanInfo,
} from "../../src/utils/plan";
import type { User } from "../../src/types";

const user: User = {
  id: 1,
  username: "alice",
  email: "a@b.c",
  plan: "pro",
  credits: 4200,
  credits_monthly: 5000,
};

// Extrait réel de la réponse backend (billing/router.py::get_my_plan).
const proPlan = {
  plan: "pro",
  plan_name: "Pro",
  plan_icon: "⭐",
  plan_color: "#3B82F6",
  limits: {
    monthly_credits: 5000,
    monthly_analyses: 30,
    flashcards_enabled: true,
    mindmap_enabled: true,
    web_search_enabled: true,
    playlists_enabled: true,
    export_pdf: true,
    export_markdown: true,
  },
  platform_features: { analyse: true, chat: true, flashcards: false },
  usage: { analyses_this_month: 12, chat_today: 3, web_searches_this_month: 1 },
  subscription: { status: "none", current_period_end: null },
  voice_quota: { trial_used: false, monthly_minutes_used: 4.5 },
};

describe("normalizePlanInfo", () => {
  it("maps plan / limits / usage to the side panel model", () => {
    expect(normalizePlanInfo(proPlan, user)).toEqual({
      plan_id: "pro",
      plan_name: "Pro",
      monthly_analyses: 30,
      analyses_this_month: 12,
      credits: 4200,
      credits_monthly: 5000,
      features: {
        analysis: true,
        synthesis: true,
        chat: true,
        flashcards: true,
        mind_maps: true,
        web_search: true,
        playlists: true,
        exports: true,
      },
      voice_quota: { trial_used: false, monthly_minutes_used: 4.5 },
    });
  });

  it("locks web features the plan does not include", () => {
    const free = normalizePlanInfo(
      {
        plan: "free",
        plan_name: "Gratuit",
        limits: {
          monthly_analyses: 5,
          monthly_credits: 250,
          flashcards_enabled: true,
          mindmap_enabled: false,
          web_search_enabled: false,
          playlists_enabled: false,
          export_pdf: false,
          export_markdown: false,
        },
        usage: { analyses_this_month: 5 },
      },
      { ...user, plan: "free" },
    );
    expect(free.features).toMatchObject({
      flashcards: true,
      mind_maps: false,
      web_search: false,
      exports: false,
    });
    expect(isAnalysisQuotaExceeded(free)).toBe(true);
  });

  it("treats the admin 'unlimited' plan as having no quota", () => {
    const admin = normalizePlanInfo(
      {
        plan: "unlimited",
        plan_name: "Expert",
        limits: { monthly_analyses: 100, monthly_credits: 15000 },
        usage: { analyses_this_month: 250 },
      },
      { ...user, plan: "unlimited", credits: 0 },
    );
    expect(admin.plan_id).toBe("unlimited");
    expect(admin.monthly_analyses).toBe(UNLIMITED_ANALYSES);
    expect(admin.credits_monthly).toBe(0);
    expect(isAnalysisQuotaExceeded(admin)).toBe(false);
  });

  it("keeps an already-normalised payload untouched", () => {
    const legacy = {
      plan_name: "Pro",
      plan_id: "pro" as const,
      monthly_analyses: 200,
      analyses_this_month: 42,
      credits: 12000,
      credits_monthly: 15000,
      features: {
        analysis: true,
        synthesis: true,
        chat: true,
        flashcards: true,
        mind_maps: true,
        web_search: true,
        playlists: true,
        exports: true,
      },
    };
    expect(normalizePlanInfo(legacy, user)).toBe(legacy);
  });

  it("falls back to the stored user plan on an empty payload", () => {
    const plan = normalizePlanInfo({}, user);
    expect(plan.plan_id).toBe("pro");
    expect(plan.analyses_this_month).toBe(0);
    expect(isAnalysisQuotaExceeded(plan)).toBe(false);
  });
});
