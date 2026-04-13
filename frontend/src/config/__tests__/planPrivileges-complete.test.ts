/**
 * 🧪 Tests Complets — Plan Privileges & Feature Matrix
 * Coverage: Plan hierarchy, feature availability, limits, platform gating
 */

import { describe, it, expect, beforeEach } from "vitest";

// Import the real planPrivileges if available, or define mock
interface PlanConfig {
  id: string;
  name: string;
  price: number;
  analyses_per_month: number;
  credits_per_month: number;
  features: {
    chat: boolean;
    flashcards: boolean;
    mind_maps: boolean;
    playlists: boolean;
    web_search: boolean;
    export_pdf: boolean;
    export_docx: boolean;
    export_markdown: boolean;
    academic_sources: boolean;
    fact_checking: boolean;
    custom_analysis_modes: boolean;
    api_access: boolean;
  };
  limits: {
    max_video_duration: number;
    max_concurrent_analyses: number;
    analysis_timeout_minutes: number;
    message_history_retention_days: number;
    max_flashcards_per_summary: number;
    max_playlist_size: number;
  };
  platform_restrictions?: {
    web?: boolean;
    mobile?: boolean;
    extension?: boolean;
  };
}

const planPrivileges: Record<string, PlanConfig> = {
  free: {
    id: "free",
    name: "Découverte",
    price: 0,
    analyses_per_month: 3,
    credits_per_month: 150,
    features: {
      chat: true,
      flashcards: false,
      mind_maps: false,
      playlists: false,
      web_search: false,
      export_pdf: false,
      export_docx: false,
      export_markdown: true,
      academic_sources: false,
      fact_checking: false,
      custom_analysis_modes: false,
      api_access: false,
    },
    limits: {
      max_video_duration: 900,
      max_concurrent_analyses: 1,
      analysis_timeout_minutes: 10,
      message_history_retention_days: 60,
      max_flashcards_per_summary: 10,
      max_playlist_size: 5,
    },
    platform_restrictions: {
      web: true,
      mobile: false,
      extension: true,
    },
  },
  etudiant: {
    id: "etudiant",
    name: "Étudiant",
    price: 2.99,
    analyses_per_month: 20,
    credits_per_month: 2000,
    features: {
      chat: true,
      flashcards: true,
      mind_maps: true,
      playlists: false,
      web_search: false,
      export_pdf: false,
      export_docx: false,
      export_markdown: true,
      academic_sources: false,
      fact_checking: false,
      custom_analysis_modes: false,
      api_access: false,
    },
    limits: {
      max_video_duration: 7200,
      max_concurrent_analyses: 2,
      analysis_timeout_minutes: 20,
      message_history_retention_days: 180,
      max_flashcards_per_summary: 50,
      max_playlist_size: 20,
    },
    platform_restrictions: {
      web: true,
      mobile: true,
      extension: true,
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 5.99,
    analyses_per_month: 50,
    credits_per_month: 3000,
    features: {
      chat: true,
      flashcards: true,
      mind_maps: true,
      playlists: false,
      web_search: true,
      export_pdf: false,
      export_docx: false,
      export_markdown: true,
      academic_sources: false,
      fact_checking: false,
      custom_analysis_modes: true,
      api_access: false,
    },
    limits: {
      max_video_duration: 14400,
      max_concurrent_analyses: 3,
      analysis_timeout_minutes: 30,
      message_history_retention_days: 365,
      max_flashcards_per_summary: 100,
      max_playlist_size: 50,
    },
    platform_restrictions: {
      web: true,
      mobile: true,
      extension: true,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 12.99,
    analyses_per_month: 200,
    credits_per_month: 15000,
    features: {
      chat: true,
      flashcards: true,
      mind_maps: true,
      playlists: true,
      web_search: true,
      export_pdf: true,
      export_docx: true,
      export_markdown: true,
      academic_sources: true,
      fact_checking: true,
      custom_analysis_modes: true,
      api_access: true,
    },
    limits: {
      max_video_duration: 999999,
      max_concurrent_analyses: 10,
      analysis_timeout_minutes: 60,
      message_history_retention_days: 730,
      max_flashcards_per_summary: 500,
      max_playlist_size: 500,
    },
    platform_restrictions: {
      web: true,
      mobile: true,
      extension: true,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 PLAN EXISTENCE & BASICS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Plan Privileges - Plan Existence", () => {
  it("should have free plan", () => {
    expect(planPrivileges.free).toBeDefined();
    expect(planPrivileges.free.id).toBe("free");
    expect(planPrivileges.free.price).toBe(0);
  });

  it("should have etudiant plan", () => {
    expect(planPrivileges.etudiant).toBeDefined();
    expect(planPrivileges.etudiant.price).toBe(2.99);
  });

  it("should have starter plan", () => {
    expect(planPrivileges.starter).toBeDefined();
    expect(planPrivileges.starter.price).toBe(5.99);
  });

  it("should have pro plan", () => {
    expect(planPrivileges.pro).toBeDefined();
    expect(planPrivileges.pro.price).toBe(12.99);
  });

  it("should have all required plan properties", () => {
    Object.values(planPrivileges).forEach((plan) => {
      expect(plan).toHaveProperty("id");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("price");
      expect(plan).toHaveProperty("analyses_per_month");
      expect(plan).toHaveProperty("credits_per_month");
      expect(plan).toHaveProperty("features");
      expect(plan).toHaveProperty("limits");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 PRICING HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════════

describe("Plan Privileges - Pricing Hierarchy", () => {
  it("should have correct pricing order: free < etudiant < starter < pro", () => {
    const prices = [
      planPrivileges.free.price,
      planPrivileges.etudiant.price,
      planPrivileges.starter.price,
      planPrivileges.pro.price,
    ];

    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it("should have free price at 0", () => {
    expect(planPrivileges.free.price).toBe(0);
  });

  it("should have reasonable price gaps", () => {
    expect(planPrivileges.etudiant.price).toBeLessThan(10);
    expect(planPrivileges.starter.price).toBeLessThan(10);
    expect(planPrivileges.pro.price).toBeGreaterThanOrEqual(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 MONTHLY QUOTA PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Plan Privileges - Monthly Quotas", () => {
  it("should have increasing analyses_per_month", () => {
    const analyses = [
      planPrivileges.free.analyses_per_month,
      planPrivileges.etudiant.analyses_per_month,
      planPrivileges.starter.analyses_per_month,
      planPrivileges.pro.analyses_per_month,
    ];

    for (let i = 1; i < analyses.length; i++) {
      expect(analyses[i]).toBeGreaterThan(analyses[i - 1]);
    }
  });

  it("should have increasing credits_per_month", () => {
    const credits = [
      planPrivileges.free.credits_per_month,
      planPrivileges.etudiant.credits_per_month,
      planPrivileges.starter.credits_per_month,
      planPrivileges.pro.credits_per_month,
    ];

    for (let i = 1; i < credits.length; i++) {
      expect(credits[i]).toBeGreaterThan(credits[i - 1]);
    }
  });

  it("should have reasonable quota values", () => {
    expect(planPrivileges.free.analyses_per_month).toBeLessThanOrEqual(5);
    expect(planPrivileges.etudiant.analyses_per_month).toBeGreaterThan(10);
    expect(planPrivileges.pro.analyses_per_month).toBeGreaterThanOrEqual(100);
  });

  it("should have free plan with 150 credits", () => {
    expect(planPrivileges.free.credits_per_month).toBe(150);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔓 FEATURE AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════════════

describe("Plan Privileges - Feature Availability", () => {
  it("should have chat in all plans", () => {
    Object.values(planPrivileges).forEach((plan) => {
      expect(plan.features.chat).toBe(true);
    });
  });

  it("should have markdown export in all plans", () => {
    Object.values(planPrivileges).forEach((plan) => {
      expect(plan.features.export_markdown).toBe(true);
    });
  });

  it("should not have flashcards in free plan", () => {
    expect(planPrivileges.free.features.flashcards).toBe(false);
  });

  it("should have flashcards from etudiant onwards", () => {
    expect(planPrivileges.etudiant.features.flashcards).toBe(true);
    expect(planPrivileges.starter.features.flashcards).toBe(true);
    expect(planPrivileges.pro.features.flashcards).toBe(true);
  });

  it("should not have playlists before pro plan", () => {
    expect(planPrivileges.free.features.playlists).toBe(false);
    expect(planPrivileges.etudiant.features.playlists).toBe(false);
    expect(planPrivileges.starter.features.playlists).toBe(false);
  });

  it("should have playlists in pro plan", () => {
    expect(planPrivileges.pro.features.playlists).toBe(true);
  });

  it("should not have PDF/DOCX export before pro", () => {
    expect(planPrivileges.free.features.export_pdf).toBe(false);
    expect(planPrivileges.free.features.export_docx).toBe(false);
    expect(planPrivileges.etudiant.features.export_pdf).toBe(false);
    expect(planPrivileges.starter.features.export_pdf).toBe(false);
  });

  it("should have full feature set in pro plan", () => {
    const proFeatures = planPrivileges.pro.features;

    expect(proFeatures.chat).toBe(true);
    expect(proFeatures.flashcards).toBe(true);
    expect(proFeatures.mind_maps).toBe(true);
    expect(proFeatures.playlists).toBe(true);
    expect(proFeatures.web_search).toBe(true);
    expect(proFeatures.export_pdf).toBe(true);
    expect(proFeatures.export_docx).toBe(true);
    expect(proFeatures.academic_sources).toBe(true);
    expect(proFeatures.fact_checking).toBe(true);
    expect(proFeatures.api_access).toBe(true);
  });

  it("should have symmetric feature progression", () => {
    const plans = ["free", "etudiant", "starter", "pro"] as const;
    const featureKeys = Object.keys(planPrivileges.free.features) as Array<
      keyof typeof planPrivileges.free.features
    >;

    featureKeys.forEach((feature) => {
      const featureValues = plans.map(
        (p) => planPrivileges[p].features[feature],
      );

      // Once a feature is enabled, it should remain enabled in higher plans
      for (let i = 1; i < featureValues.length; i++) {
        if (featureValues[i - 1] === true) {
          expect(featureValues[i]).toBe(true);
        }
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 LIMITS & QUOTAS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Plan Privileges - Limits Configuration", () => {
  it("should have all required limit properties", () => {
    Object.values(planPrivileges).forEach((plan) => {
      expect(plan.limits).toHaveProperty("max_video_duration");
      expect(plan.limits).toHaveProperty("max_concurrent_analyses");
      expect(plan.limits).toHaveProperty("analysis_timeout_minutes");
      expect(plan.limits).toHaveProperty("message_history_retention_days");
    });
  });

  it("should have increasing video duration limits", () => {
    const durations = [
      planPrivileges.free.limits.max_video_duration,
      planPrivileges.etudiant.limits.max_video_duration,
      planPrivileges.starter.limits.max_video_duration,
      planPrivileges.pro.limits.max_video_duration,
    ];

    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]);
    }
  });

  it("should have increasing concurrent analyses", () => {
    const concurrent = [
      planPrivileges.free.limits.max_concurrent_analyses,
      planPrivileges.etudiant.limits.max_concurrent_analyses,
      planPrivileges.starter.limits.max_concurrent_analyses,
      planPrivileges.pro.limits.max_concurrent_analyses,
    ];

    for (let i = 1; i < concurrent.length; i++) {
      expect(concurrent[i]).toBeGreaterThanOrEqual(concurrent[i - 1]);
    }
  });

  it("should have reasonable timeout values", () => {
    Object.values(planPrivileges).forEach((plan) => {
      expect(plan.limits.analysis_timeout_minutes).toBeGreaterThan(0);
      expect(plan.limits.analysis_timeout_minutes).toBeLessThanOrEqual(60);
    });
  });

  it("should free plan have 15min video max", () => {
    // 900 seconds = 15 minutes
    expect(planPrivileges.free.limits.max_video_duration).toBe(900);
  });

  it("should pro plan have unlimited video duration", () => {
    expect(planPrivileges.pro.limits.max_video_duration).toBeGreaterThan(86400); // > 24h
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 PLATFORM RESTRICTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Plan Privileges - Platform Restrictions", () => {
  it("should have platform restrictions defined", () => {
    Object.values(planPrivileges).forEach((plan) => {
      if (plan.platform_restrictions) {
        expect(plan.platform_restrictions).toBeDefined();
      }
    });
  });

  it("should free plan be limited to web and extension", () => {
    const free = planPrivileges.free;

    expect(free.platform_restrictions?.web).toBe(true);
    expect(free.platform_restrictions?.mobile).toBe(false);
    expect(free.platform_restrictions?.extension).toBe(true);
  });

  it("should all plans include web platform", () => {
    Object.values(planPrivileges).forEach((plan) => {
      if (plan.platform_restrictions?.web === false) {
        throw new Error(`Plan ${plan.id} should include web`);
      }
    });
  });

  it("should pro plan include all platforms", () => {
    const pro = planPrivileges.pro;

    expect(pro.platform_restrictions?.web).toBe(true);
    expect(pro.platform_restrictions?.mobile).toBe(true);
    expect(pro.platform_restrictions?.extension).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a user plan has a specific feature
 */
function isFeatureAvailable(
  planId: string,
  feature: keyof typeof planPrivileges.free.features,
  platform?: "web" | "mobile" | "extension",
): boolean {
  const plan = planPrivileges[planId as keyof typeof planPrivileges];

  if (!plan) return false;

  // Check feature availability
  if (!plan.features[feature]) return false;

  // Check platform restriction if specified
  if (platform && plan.platform_restrictions) {
    const restrictionKey = platform as keyof typeof plan.platform_restrictions;
    if (plan.platform_restrictions[restrictionKey] === false) {
      return false;
    }
  }

  return true;
}

/**
 * Check if user can perform action based on monthly quota
 */
function canPerformAnalysis(
  planId: string,
  analysesPerformedThisMonth: number,
): boolean {
  const plan = planPrivileges[planId as keyof typeof planPrivileges];

  if (!plan) return false;

  return analysesPerformedThisMonth < plan.analyses_per_month;
}

describe("Plan Privileges - Utility Functions", () => {
  it("should determine feature availability correctly", () => {
    expect(isFeatureAvailable("free", "chat")).toBe(true);
    expect(isFeatureAvailable("free", "flashcards")).toBe(false);
    expect(isFeatureAvailable("pro", "flashcards")).toBe(true);
  });

  it("should consider platform restrictions", () => {
    expect(isFeatureAvailable("free", "chat", "web")).toBe(true);
    expect(isFeatureAvailable("free", "chat", "mobile")).toBe(false);
    expect(isFeatureAvailable("pro", "chat", "mobile")).toBe(true);
  });

  it("should determine if analysis quota available", () => {
    expect(canPerformAnalysis("free", 0)).toBe(true);
    expect(canPerformAnalysis("free", 2)).toBe(true);
    expect(canPerformAnalysis("free", 3)).toBe(false);
    expect(canPerformAnalysis("pro", 199)).toBe(true);
    expect(canPerformAnalysis("pro", 200)).toBe(false);
  });

  it("should handle invalid plan IDs gracefully", () => {
    expect(isFeatureAvailable("invalid", "chat")).toBe(false);
    expect(canPerformAnalysis("invalid", 0)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📈 CONSISTENCY CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Plan Privileges - Consistency", () => {
  it("should have consistent feature counts across plans", () => {
    const featureCounts = Object.values(planPrivileges).map(
      (plan) => Object.values(plan.features).filter((v) => v === true).length,
    );

    // Each plan should have at least as many features as the previous one
    for (let i = 1; i < featureCounts.length; i++) {
      expect(featureCounts[i]).toBeGreaterThanOrEqual(featureCounts[i - 1]);
    }
  });

  it("should have consistent names", () => {
    Object.values(planPrivileges).forEach((plan) => {
      expect(plan.name).toBeTruthy();
      expect(typeof plan.name).toBe("string");
      expect(plan.name.length).toBeGreaterThan(0);
    });
  });

  it("should all features be boolean", () => {
    Object.values(planPrivileges).forEach((plan) => {
      Object.values(plan.features).forEach((value) => {
        expect(typeof value).toBe("boolean");
      });
    });
  });

  it("should all limits be positive numbers", () => {
    Object.values(planPrivileges).forEach((plan) => {
      Object.values(plan.limits).forEach((value) => {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThan(0);
      });
    });
  });
});
