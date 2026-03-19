/**
 * Tests unitaires — Matrice des permissions par plan
 */

import { describe, it, expect } from 'vitest';
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
} from '../planPrivileges';

// ═══════════════════════════════════════════════════════════════════════
// PLAN HIERARCHY
// ═══════════════════════════════════════════════════════════════════════

describe('Plan Hierarchy', () => {
  it('should have 4 plans in order', () => {
    expect(PLAN_HIERARCHY).toEqual(['free', 'etudiant', 'starter', 'pro']);
    expect(PLAN_HIERARCHY).toHaveLength(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FREE PLAN
// ═══════════════════════════════════════════════════════════════════════

describe('Free Plan', () => {
  const limits = PLAN_LIMITS.free;
  const features = PLAN_FEATURES.free;

  it('has correct analysis limits', () => {
    expect(limits.monthlyAnalyses).toBe(5);
    expect(limits.maxVideoLengthMin).toBe(15);
    expect(limits.concurrentAnalyses).toBe(1);
  });

  it('has limited chat', () => {
    expect(limits.chatQuestionsPerVideo).toBe(5);
    expect(limits.chatDailyLimit).toBe(10);
  });

  it('does not have premium features', () => {
    expect(features.flashcards).toBe(false);
    expect(features.mindmap).toBe(false);
    expect(features.webSearch).toBe(false);
    expect(features.playlists).toBe(false);
    expect(features.exportPdf).toBe(false);
    expect(features.exportMarkdown).toBe(false);
  });

  it('has academic search enabled', () => {
    expect(features.academicSearch).toBe(true);
    expect(limits.academicPapersPerAnalysis).toBe(3);
    expect(features.bibliographyExport).toBe(false);
  });

  it('only supports txt export', () => {
    expect(limits.exportFormats).toEqual(['txt']);
  });

  it('has 60 days history retention', () => {
    expect(limits.historyRetentionDays).toBe(60);
  });

  it('only has basic model', () => {
    expect(limits.allowedModels).toEqual(['mistral-small-2603']);
    expect(limits.defaultModel).toBe('mistral-small-2603');
  });

  it('has no priority queue', () => {
    expect(limits.priorityQueue).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PRO PLAN
// ═══════════════════════════════════════════════════════════════════════

describe('Pro Plan', () => {
  const limits = PLAN_LIMITS.pro;
  const features = PLAN_FEATURES.pro;

  it('has all premium features', () => {
    expect(features.flashcards).toBe(true);
    expect(features.mindmap).toBe(true);
    expect(features.webSearch).toBe(true);
    expect(features.playlists).toBe(true);
    expect(features.exportPdf).toBe(true);
    expect(features.exportMarkdown).toBe(true);
    expect(features.prioritySupport).toBe(true);
  });

  it('has unlimited chat', () => {
    expect(limits.chatQuestionsPerVideo).toBe(-1);
    expect(limits.chatDailyLimit).toBe(-1);
  });

  it('has highest analysis limits', () => {
    expect(limits.monthlyAnalyses).toBe(200);
    expect(limits.maxVideoLengthMin).toBe(240);
    expect(limits.concurrentAnalyses).toBe(2);
  });

  it('has priority queue', () => {
    expect(limits.priorityQueue).toBe(true);
  });

  it('supports all export formats', () => {
    expect(limits.exportFormats).toEqual(['txt', 'md', 'pdf']);
  });

  it('has permanent history retention', () => {
    expect(limits.historyRetentionDays).toBe(-1);
  });

  it('has all models available', () => {
    expect(limits.allowedModels).toContain('mistral-small-2603');
    expect(limits.allowedModels).toContain('mistral-medium-2508');
    expect(limits.allowedModels).toContain('mistral-large-2512');
    expect(limits.defaultModel).toBe('mistral-medium-2508');
  });

  it('has playlist support', () => {
    expect(limits.playlistsEnabled).toBe(true);
    expect(limits.maxPlaylists).toBe(10);
    expect(limits.maxPlaylistVideos).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// hasFeature()
// ═══════════════════════════════════════════════════════════════════════

describe('hasFeature()', () => {
  it('returns false for free flashcards', () => {
    expect(hasFeature('free', 'flashcardsEnabled')).toBe(false);
  });

  it('returns true for etudiant flashcards', () => {
    expect(hasFeature('etudiant', 'flashcardsEnabled')).toBe(true);
  });

  it('returns true for numeric values > 0', () => {
    expect(hasFeature('free', 'monthlyAnalyses')).toBe(true); // 5 > 0
  });

  it('returns false for 0 numeric values', () => {
    expect(hasFeature('free', 'webSearchMonthly')).toBe(false); // 0
  });

  it('returns true for -1 (unlimited)', () => {
    expect(hasFeature('pro', 'chatDailyLimit')).toBe(true); // -1 = unlimited
  });

  it('returns true for non-empty arrays', () => {
    expect(hasFeature('pro', 'exportFormats')).toBe(true);
  });

  it('free has no playlists', () => {
    expect(hasFeature('free', 'playlistsEnabled')).toBe(false);
    expect(hasFeature('free', 'maxPlaylists')).toBe(false);
  });

  it('pro has playlists', () => {
    expect(hasFeature('pro', 'playlistsEnabled')).toBe(true);
    expect(hasFeature('pro', 'maxPlaylists')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getLimit()
// ═══════════════════════════════════════════════════════════════════════

describe('getLimit()', () => {
  it('returns numeric limits correctly', () => {
    expect(getLimit('free', 'monthlyAnalyses')).toBe(5);
    expect(getLimit('pro', 'monthlyAnalyses')).toBe(200);
  });

  it('returns -1 for unlimited values', () => {
    expect(getLimit('pro', 'chatDailyLimit')).toBe(-1);
  });

  it('returns 0 for non-numeric features', () => {
    expect(getLimit('free', 'exportFormats')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isUnlimited()
// ═══════════════════════════════════════════════════════════════════════

describe('isUnlimited()', () => {
  it('returns true for -1 values', () => {
    expect(isUnlimited('pro', 'chatDailyLimit')).toBe(true);
    expect(isUnlimited('pro', 'chatQuestionsPerVideo')).toBe(true);
    expect(isUnlimited('pro', 'historyRetentionDays')).toBe(true);
  });

  it('returns false for finite values', () => {
    expect(isUnlimited('free', 'chatDailyLimit')).toBe(false);
    expect(isUnlimited('free', 'monthlyAnalyses')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getPlanInfo()
// ═══════════════════════════════════════════════════════════════════════

describe('getPlanInfo()', () => {
  it('returns correct free plan info', () => {
    const info = getPlanInfo('free');
    expect(info.name).toBe('Gratuit');
    expect(info.priceMonthly).toBe(0);
    expect(info.popular).toBe(false);
  });

  it('returns correct pro plan info', () => {
    const info = getPlanInfo('pro');
    expect(info.name).toBe('Pro');
    expect(info.priceMonthly).toBe(1299);
    expect(info.popular).toBe(true);
    expect(info.badge).toEqual({ text: 'Populaire', color: '#8B5CF6' });
  });

  it('all plans have required fields', () => {
    for (const plan of PLAN_HIERARCHY) {
      const info = getPlanInfo(plan);
      expect(info.id).toBe(plan);
      expect(info.name).toBeTruthy();
      expect(info.nameEn).toBeTruthy();
      expect(typeof info.priceMonthly).toBe('number');
      expect(info.color).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isPlanHigher()
// ═══════════════════════════════════════════════════════════════════════

describe('isPlanHigher()', () => {
  it('pro is higher than free', () => {
    expect(isPlanHigher('pro', 'free')).toBe(true);
  });

  it('free is not higher than pro', () => {
    expect(isPlanHigher('free', 'pro')).toBe(false);
  });

  it('same plan is not higher', () => {
    expect(isPlanHigher('starter', 'starter')).toBe(false);
  });

  it('maintains correct order', () => {
    expect(isPlanHigher('etudiant', 'free')).toBe(true);
    expect(isPlanHigher('starter', 'etudiant')).toBe(true);
    expect(isPlanHigher('pro', 'starter')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getMinPlanForFeature()
// ═══════════════════════════════════════════════════════════════════════

describe('getMinPlanForFeature()', () => {
  it('flashcards require etudiant plan', () => {
    expect(getMinPlanForFeature('flashcardsEnabled')).toBe('etudiant');
  });

  it('webSearch requires starter', () => {
    expect(getMinPlanForFeature('webSearchEnabled')).toBe('starter');
  });

  it('playlists require pro', () => {
    expect(getMinPlanForFeature('playlistsEnabled')).toBe('pro');
  });

  it('monthlyAnalyses available from free', () => {
    expect(getMinPlanForFeature('monthlyAnalyses')).toBe('free');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatLimit()
// ═══════════════════════════════════════════════════════════════════════

describe('formatLimit()', () => {
  it('returns infinity symbol for -1', () => {
    expect(formatLimit(-1)).toBe('\u221e');
  });

  it('returns number as string', () => {
    expect(formatLimit(50)).toBe('50');
  });

  it('appends unit when provided', () => {
    expect(formatLimit(15, 'min')).toBe('15 min');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// normalizePlanId()
// ═══════════════════════════════════════════════════════════════════════

describe('normalizePlanId()', () => {
  it('normalizes null/undefined to free', () => {
    expect(normalizePlanId(null)).toBe('free');
    expect(normalizePlanId(undefined)).toBe('free');
    expect(normalizePlanId('')).toBe('free');
  });

  it('normalizes standard plan names', () => {
    expect(normalizePlanId('free')).toBe('free');
    expect(normalizePlanId('etudiant')).toBe('etudiant');
    expect(normalizePlanId('starter')).toBe('starter');
    expect(normalizePlanId('pro')).toBe('pro');
  });

  it('normalizes aliases', () => {
    expect(normalizePlanId('student')).toBe('etudiant');
    expect(normalizePlanId('gratuit')).toBe('free');
    expect(normalizePlanId('team')).toBe('pro');
    expect(normalizePlanId('equipe')).toBe('pro');
    expect(normalizePlanId('unlimited')).toBe('pro');
    expect(normalizePlanId('admin')).toBe('pro');
    expect(normalizePlanId('expert')).toBe('pro');
  });

  it('is case-insensitive', () => {
    expect(normalizePlanId('FREE')).toBe('free');
    expect(normalizePlanId('Pro')).toBe('pro');
    expect(normalizePlanId('STUDENT')).toBe('etudiant');
  });

  it('handles accented characters', () => {
    expect(normalizePlanId('étudiant')).toBe('etudiant');
    expect(normalizePlanId('équipe')).toBe('pro');
  });

  it('unknown plans default to free', () => {
    expect(normalizePlanId('enterprise')).toBe('free');
    expect(normalizePlanId('gold')).toBe('free');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// shouldShowLowCreditsAlert()
// ═══════════════════════════════════════════════════════════════════════

describe('shouldShowLowCreditsAlert()', () => {
  it('returns true when credits are low', () => {
    // Free plan: 5 analyses, 10% = 1 → threshold = max(1, 1) = 1
    expect(shouldShowLowCreditsAlert(1, 'free')).toBe(true);
  });

  it('returns false when credits are sufficient', () => {
    expect(shouldShowLowCreditsAlert(5, 'free')).toBe(false);
  });

  it('returns false when credits are 0', () => {
    expect(shouldShowLowCreditsAlert(0, 'free')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateTimeSaved()
// ═══════════════════════════════════════════════════════════════════════

describe('calculateTimeSaved()', () => {
  it('calculates hours for large counts', () => {
    const result = calculateTimeSaved(100);
    expect(result.hours).toBe(25); // 100 * 15min / 60
    expect(result.display).toBe('25h');
  });

  it('shows minutes for small counts', () => {
    const result = calculateTimeSaved(3);
    expect(result.hours).toBe(1); // 45min → rounds to 1h
    expect(result.display).toBe('1h');
  });

  it('returns 0 for no analyses', () => {
    const result = calculateTimeSaved(0);
    expect(result.hours).toBe(0);
    expect(result.display).toBe('0 min');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CONVERSION TRIGGERS
// ═══════════════════════════════════════════════════════════════════════

describe('Conversion Triggers', () => {
  it('has expected values', () => {
    expect(CONVERSION_TRIGGERS.freeAnalysisLimit).toBe(5);
    expect(CONVERSION_TRIGGERS.freeAnalysisWarning).toBe(3);
    expect(CONVERSION_TRIGGERS.trialEnabled).toBe(true);
    expect(CONVERSION_TRIGGERS.trialDays).toBe(7);
    expect(CONVERSION_TRIGGERS.trialPlan).toBe('pro');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PLANS INFO PRICING
// ═══════════════════════════════════════════════════════════════════════

describe('Plans Pricing', () => {
  it('has correct prices (in cents)', () => {
    expect(PLANS_INFO.free.priceMonthly).toBe(0);
    expect(PLANS_INFO.etudiant.priceMonthly).toBe(299);
    expect(PLANS_INFO.starter.priceMonthly).toBe(599);
    expect(PLANS_INFO.pro.priceMonthly).toBe(1299);
  });

  it('prices are strictly ascending', () => {
    const prices = PLAN_HIERARCHY.map(p => PLANS_INFO[p].priceMonthly);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it('only pro is popular', () => {
    expect(PLANS_INFO.free.popular).toBe(false);
    expect(PLANS_INFO.etudiant.popular).toBe(false);
    expect(PLANS_INFO.starter.popular).toBe(false);
    expect(PLANS_INFO.pro.popular).toBe(true);
  });
});
