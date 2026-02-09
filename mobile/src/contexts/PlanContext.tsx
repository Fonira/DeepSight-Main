/**
 * PlanContext - Plan limits and feature gating management
 *
 * Provides plan-based feature access control, usage tracking,
 * and limit notifications.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { usageApi, authApi } from '../services/api';
import { PlanType, PLANS } from '../constants/config';

// Plan features configuration
export interface PlanFeatures {
  maxAnalysesPerMonth: number;
  maxVideoMinutes: number;
  maxCredits: number;
  chatEnabled: boolean;
  chatMessagesPerVideo: number;
  chatMessagesPerDay: number;
  exportEnabled: boolean;
  exportFormats: ('pdf' | 'markdown' | 'text')[];
  flashcardsEnabled: boolean;
  quizEnabled: boolean;
  mindmapEnabled: boolean;
  playlistsEnabled: boolean;
  maxPlaylistVideos: number;
  factCheckEnabled: boolean;
  webEnrichEnabled: boolean;
  academicSearchEnabled: boolean;
  ttsEnabled: boolean;
  historyDays: number;
  apiAccess: boolean;
}

// Plan configurations
const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: {
    maxAnalysesPerMonth: 3,
    maxVideoMinutes: 10,
    maxCredits: 150,
    chatEnabled: true,
    chatMessagesPerVideo: 5,
    chatMessagesPerDay: 10,
    exportEnabled: false,
    exportFormats: [],
    flashcardsEnabled: false,
    quizEnabled: false,
    mindmapEnabled: false,
    playlistsEnabled: false,
    maxPlaylistVideos: 0,
    factCheckEnabled: false,
    webEnrichEnabled: false,
    academicSearchEnabled: false,
    ttsEnabled: false,
    historyDays: 3,
    apiAccess: false,
  },
  student: {
    maxAnalysesPerMonth: 40,
    maxVideoMinutes: 30,
    maxCredits: 2000,
    chatEnabled: true,
    chatMessagesPerVideo: 20,
    chatMessagesPerDay: 50,
    exportEnabled: true,
    exportFormats: ['markdown', 'text'],
    flashcardsEnabled: true,
    quizEnabled: true,
    mindmapEnabled: true,
    playlistsEnabled: false,
    maxPlaylistVideos: 0,
    factCheckEnabled: false,
    webEnrichEnabled: false,
    academicSearchEnabled: false,
    ttsEnabled: false,
    historyDays: 30,
    apiAccess: false,
  },
  starter: {
    maxAnalysesPerMonth: 60,
    maxVideoMinutes: 120,
    maxCredits: 3000,
    chatEnabled: true,
    chatMessagesPerVideo: 30,
    chatMessagesPerDay: 100,
    exportEnabled: true,
    exportFormats: ['pdf', 'markdown', 'text'],
    flashcardsEnabled: true,
    quizEnabled: true,
    mindmapEnabled: true,
    playlistsEnabled: false,
    maxPlaylistVideos: 0,
    factCheckEnabled: true,
    webEnrichEnabled: false,
    academicSearchEnabled: false,
    ttsEnabled: false,
    historyDays: 60,
    apiAccess: false,
  },
  pro: {
    maxAnalysesPerMonth: 300,
    maxVideoMinutes: 240,
    maxCredits: 15000,
    chatEnabled: true,
    chatMessagesPerVideo: -1, // Unlimited
    chatMessagesPerDay: -1, // Unlimited
    exportEnabled: true,
    exportFormats: ['pdf', 'markdown', 'text'],
    flashcardsEnabled: true,
    quizEnabled: true,
    mindmapEnabled: true,
    playlistsEnabled: true,
    maxPlaylistVideos: 50,
    factCheckEnabled: true,
    webEnrichEnabled: true,
    academicSearchEnabled: true,
    ttsEnabled: true,
    historyDays: 365,
    apiAccess: false,
  },
  team: {
    maxAnalysesPerMonth: 1000,
    maxVideoMinutes: 480,
    maxCredits: 50000,
    chatEnabled: true,
    chatMessagesPerVideo: -1,
    chatMessagesPerDay: -1,
    exportEnabled: true,
    exportFormats: ['pdf', 'markdown', 'text'],
    flashcardsEnabled: true,
    quizEnabled: true,
    mindmapEnabled: true,
    playlistsEnabled: true,
    maxPlaylistVideos: 100,
    factCheckEnabled: true,
    webEnrichEnabled: true,
    academicSearchEnabled: true,
    ttsEnabled: true,
    historyDays: -1, // Unlimited
    apiAccess: true,
  },
};

// Usage stats interface
export interface UsageStats {
  creditsUsed: number;
  creditsRemaining: number;
  creditsTotal: number;
  analysesCount: number;
  chatMessagesCount: number;
  exportsCount: number;
  resetDate: string;
}

// Feature check result
export interface FeatureCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  suggestedPlan?: PlanType;
  currentUsage?: number;
  limit?: number;
}

// Context interface
interface PlanContextType {
  plan: PlanType;
  features: PlanFeatures;
  usage: UsageStats | null;
  isLoading: boolean;
  checkFeature: (feature: keyof PlanFeatures) => FeatureCheckResult;
  checkCredits: (required: number) => FeatureCheckResult;
  checkAnalysisLimit: () => FeatureCheckResult;
  canUseFeature: (feature: keyof PlanFeatures) => boolean;
  refreshUsage: () => Promise<void>;
  getUpgradePlan: () => PlanType | null;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

// Get suggested upgrade plan
function getSuggestedUpgrade(currentPlan: PlanType): PlanType | null {
  const planOrder: PlanType[] = ['free', 'student', 'starter', 'pro', 'team'];
  const currentIndex = planOrder.indexOf(currentPlan);
  if (currentIndex < planOrder.length - 1) {
    return planOrder[currentIndex + 1];
  }
  return null;
}

// Provider component
export const PlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const plan = user?.plan || PLANS.FREE;
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES[PLANS.FREE];

  // Fetch usage stats
  const refreshUsage = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const stats = await usageApi.getStats();
      setUsage({
        creditsUsed: stats.credits_used,
        creditsRemaining: stats.credits_remaining,
        creditsTotal: stats.credits_total,
        analysesCount: stats.analyses_count,
        chatMessagesCount: stats.chat_messages_count,
        exportsCount: stats.exports_count,
        resetDate: stats.reset_date,
      });
    } catch (error) {
      console.error('[PlanContext] Failed to fetch usage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch usage on auth change
  useEffect(() => {
    if (isAuthenticated) {
      refreshUsage();
    } else {
      setUsage(null);
    }
  }, [isAuthenticated, refreshUsage]);

  // Check if a feature is available
  const checkFeature = useCallback((feature: keyof PlanFeatures): FeatureCheckResult => {
    const value = features[feature];

    // Boolean features
    if (typeof value === 'boolean') {
      if (value) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Cette fonctionnalité n\'est pas disponible avec votre forfait actuel.',
        upgradeRequired: true,
        suggestedPlan: getSuggestedUpgrade(plan) || undefined,
      };
    }

    // Number features (limits)
    if (typeof value === 'number') {
      // -1 means unlimited
      if (value === -1) {
        return { allowed: true };
      }
      // 0 means disabled
      if (value === 0) {
        return {
          allowed: false,
          reason: 'Cette fonctionnalité n\'est pas disponible avec votre forfait actuel.',
          upgradeRequired: true,
          suggestedPlan: getSuggestedUpgrade(plan) || undefined,
          limit: value,
        };
      }
      return { allowed: true, limit: value };
    }

    // Array features (e.g., exportFormats)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return {
          allowed: false,
          reason: 'Cette fonctionnalité n\'est pas disponible avec votre forfait actuel.',
          upgradeRequired: true,
          suggestedPlan: getSuggestedUpgrade(plan) || undefined,
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }, [features, plan]);

  // Check if enough credits
  const checkCredits = useCallback((required: number): FeatureCheckResult => {
    if (!usage) {
      return { allowed: true }; // Allow if no usage data yet
    }

    if (usage.creditsRemaining >= required) {
      return {
        allowed: true,
        currentUsage: usage.creditsUsed,
        limit: usage.creditsTotal,
      };
    }

    return {
      allowed: false,
      reason: `Crédits insuffisants. Vous avez ${usage.creditsRemaining} crédits, mais ${required} sont requis.`,
      upgradeRequired: true,
      suggestedPlan: getSuggestedUpgrade(plan) || undefined,
      currentUsage: usage.creditsUsed,
      limit: usage.creditsTotal,
    };
  }, [usage, plan]);

  // Check analysis limit
  const checkAnalysisLimit = useCallback((): FeatureCheckResult => {
    if (!usage) {
      return { allowed: true };
    }

    const limit = features.maxAnalysesPerMonth;
    if (limit === -1) {
      return { allowed: true };
    }

    if (usage.analysesCount < limit) {
      return {
        allowed: true,
        currentUsage: usage.analysesCount,
        limit,
      };
    }

    return {
      allowed: false,
      reason: `Vous avez atteint votre limite de ${limit} analyses ce mois-ci.`,
      upgradeRequired: true,
      suggestedPlan: getSuggestedUpgrade(plan) || undefined,
      currentUsage: usage.analysesCount,
      limit,
    };
  }, [usage, features.maxAnalysesPerMonth, plan]);

  // Simple boolean check for feature
  const canUseFeature = useCallback((feature: keyof PlanFeatures): boolean => {
    return checkFeature(feature).allowed;
  }, [checkFeature]);

  // Get upgrade plan
  const getUpgradePlan = useCallback((): PlanType | null => {
    return getSuggestedUpgrade(plan);
  }, [plan]);

  return (
    <PlanContext.Provider
      value={{
        plan,
        features,
        usage,
        isLoading,
        checkFeature,
        checkCredits,
        checkAnalysisLimit,
        canUseFeature,
        refreshUsage,
        getUpgradePlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
};

// Hook to use plan context
export const usePlan = (): PlanContextType => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used within PlanProvider');
  }
  return context;
};

// Hook for checking a specific feature
export const useFeatureGate = (feature: keyof PlanFeatures) => {
  const { checkFeature, canUseFeature } = usePlan();
  return {
    ...checkFeature(feature),
    canUse: canUseFeature(feature),
  };
};

// Hook for usage stats
export const useUsageStats = () => {
  const { usage, isLoading, refreshUsage } = usePlan();
  return { usage, isLoading, refresh: refreshUsage };
};

export default PlanContext;
