import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { billingApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  normalizePlanId,
  getPlanInfo,
  PLAN_LIMITS,
  PLAN_FEATURES,
  type PlanId,
  type PlanLimits,
} from '../config/planPrivileges';

export interface PlanUsage {
  analyses_this_month: number;
  chat_messages_today: number;
}

interface UsePlanReturn {
  plan: PlanId;
  planName: string;
  planIcon: string;
  planColor: string;
  limits: PlanLimits;
  usage: PlanUsage;
  flashcardsEnabled: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT_USAGE: PlanUsage = {
  analyses_this_month: 0,
  chat_messages_today: 0,
};

export function usePlan(): UsePlanReturn {
  const { user } = useAuth();
  const appStateRef = useRef(AppState.currentState);

  // Derive plan from user as initial fallback
  const fallbackPlan = normalizePlanId(user?.plan);
  const fallbackInfo = getPlanInfo(fallbackPlan);

  const [plan, setPlan] = useState<PlanId>(fallbackPlan);
  const [planName, setPlanName] = useState(fallbackInfo.name.fr);
  const [planIcon, setPlanIcon] = useState(fallbackInfo.icon);
  const [planColor, setPlanColor] = useState(fallbackInfo.color);
  const [limits, setLimits] = useState<PlanLimits>(PLAN_LIMITS[fallbackPlan]);
  const [usage, setUsage] = useState<PlanUsage>(DEFAULT_USAGE);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      const data = await billingApi.getMyPlan();

      const planId = normalizePlanId(data.plan);
      const info = getPlanInfo(planId);
      const planLimits = PLAN_LIMITS[planId];

      // Merge API limits with local config (API is source of truth where available)
      const mergedLimits: PlanLimits = {
        ...planLimits,
        monthlyAnalyses: data.limits?.monthly_analyses ?? planLimits.monthlyAnalyses,
        chatDailyLimit: data.limits?.chat_daily_limit ?? planLimits.chatDailyLimit,
        chatQuestionsPerVideo: data.limits?.chat_questions_per_video ?? planLimits.chatQuestionsPerVideo,
      };

      setPlan(planId);
      setPlanName(data.name || info.name.fr);
      setPlanIcon(info.icon);
      setPlanColor(info.color);
      setLimits(mergedLimits);
      setUsage({
        analyses_this_month: data.usage?.analyses_this_month ?? 0,
        chat_messages_today: data.usage?.chat_messages_today ?? 0,
      });
    } catch (err: any) {
      // On 401 or any error, fall back to local user plan data
      const localPlan = normalizePlanId(user?.plan);
      const info = getPlanInfo(localPlan);

      setPlan(localPlan);
      setPlanName(info.name.fr);
      setPlanIcon(info.icon);
      setPlanColor(info.color);
      setLimits(PLAN_LIMITS[localPlan]);
      setUsage({
        analyses_this_month: (user as any)?.analyses_this_month ?? 0,
        chat_messages_today: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch on mount
  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Refetch when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        fetchPlan();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [fetchPlan]);

  const flashcardsEnabled = PLAN_FEATURES[plan]?.flashcards ?? false;

  return {
    plan,
    planName,
    planIcon,
    planColor,
    limits,
    usage,
    flashcardsEnabled,
    isLoading,
    refetch: fetchPlan,
  };
}
