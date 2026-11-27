/**
 * Adaptation de `GET /api/billing/my-plan` au modèle `PlanInfo` du side panel.
 *
 * Le backend renvoie :
 *   { plan, plan_name, limits: {monthly_analyses, monthly_credits,
 *     flashcards_enabled, mindmap_enabled, …}, usage: {analyses_this_month},
 *     platform_features, subscription, voice_quota }
 * alors que l'extension lisait directement `plan_id`, `monthly_analyses`,
 * `analyses_this_month` et `features` — tous absents : la barre de quota
 * affichait « undefined/undefined analyses », toutes les features
 * apparaissaient verrouillées et les promos visaient toujours le plan Free.
 */

import type { PlanInfo, User, VoiceQuotaInfo } from "../types";

/** `monthly_analyses` négatif = illimité (convention backend `-1`). */
export const UNLIMITED_ANALYSES = -1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isEnabled(value: unknown): boolean {
  return value === true;
}

function toVoiceQuota(value: unknown): VoiceQuotaInfo | undefined {
  if (!isRecord(value)) return undefined;
  return {
    trial_used: value.trial_used === true,
    monthly_minutes_used: toNumber(value.monthly_minutes_used, 0),
  };
}

/** Réponse déjà au format PlanInfo (anciens backends / tests). */
function isPlanInfo(value: unknown): value is PlanInfo {
  return (
    isRecord(value) &&
    typeof value.plan_id === "string" &&
    typeof value.monthly_analyses === "number"
  );
}

export function normalizePlanInfo(raw: unknown, user: User | null): PlanInfo {
  if (isPlanInfo(raw)) return raw;

  const data = isRecord(raw) ? raw : {};
  const limits = isRecord(data.limits) ? data.limits : {};
  const usage = isRecord(data.usage) ? data.usage : {};
  const planId =
    (typeof data.plan === "string" && data.plan) || user?.plan || "free";
  // Plan admin (mode privé) : pas de quota d'analyses ni de crédits affichés.
  const unlimited = planId === "unlimited";

  return {
    plan_id: planId as PlanInfo["plan_id"],
    plan_name: typeof data.plan_name === "string" ? data.plan_name : planId,
    monthly_analyses: unlimited
      ? UNLIMITED_ANALYSES
      : toNumber(limits.monthly_analyses, UNLIMITED_ANALYSES),
    analyses_this_month: toNumber(usage.analyses_this_month, 0),
    credits: user?.credits ?? 0,
    credits_monthly: unlimited
      ? 0
      : toNumber(limits.monthly_credits, user?.credits_monthly ?? 0),
    // Features disponibles sur le plan (côté web) : un CTA « ouvrir » au lieu
    // d'« upgrade » quand le plan les inclut.
    features: {
      analysis: true,
      synthesis: true,
      chat: true,
      flashcards: isEnabled(limits.flashcards_enabled),
      mind_maps: isEnabled(limits.mindmap_enabled),
      web_search: isEnabled(limits.web_search_enabled),
      playlists: isEnabled(limits.playlists_enabled),
      exports: isEnabled(limits.export_pdf) || isEnabled(limits.export_markdown),
    },
    voice_quota: toVoiceQuota(data.voice_quota),
  };
}

/** Quota mensuel atteint ? Toujours faux pour un plan illimité. */
export function isAnalysisQuotaExceeded(plan: PlanInfo | null): boolean {
  if (!plan || plan.monthly_analyses <= 0) return false;
  return plan.analyses_this_month >= plan.monthly_analyses;
}
