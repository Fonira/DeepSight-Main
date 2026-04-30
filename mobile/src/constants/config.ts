// API Configuration
export const API_BASE_URL = "https://api.deepsightsynthesis.com";

// Google OAuth Configuration
// Web Client ID (used for Expo Go and web)
export const GOOGLE_CLIENT_ID =
  "763654536492-8hkdd3n31tqeodnhcak6ef8asu4v287j.apps.googleusercontent.com";
// Android Client ID (for standalone builds - create in Google Cloud Console)
export const GOOGLE_ANDROID_CLIENT_ID =
  "763654536492-v1tod4emvrkcrl9j582o6fltpqdg3a6t.apps.googleusercontent.com";
// iOS Client ID (for standalone builds - create in Google Cloud Console)
export const GOOGLE_IOS_CLIENT_ID =
  "763654536492-riumsqb787nj8d3eq1nnhlo29qufc11h.apps.googleusercontent.com";
// Expo Client ID (same as web for Expo Go)
export const GOOGLE_EXPO_CLIENT_ID = GOOGLE_CLIENT_ID;

// App Configuration
export const APP_NAME = "Deep Sight";
export const APP_VERSION = "1.0.0";
export const APP_BUNDLE_ID = "com.deepsight.app";

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  DEFAULT: 30000,
  ANALYSIS: 120000,
  PLAYLIST: 600000,
  FACT_CHECK: 120000,
};

// Query Configuration
export const QUERY_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 30 * 60 * 1000, // 30 minutes
  RETRY_COUNT: 3,
};

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "deepsight_access_token",
  REFRESH_TOKEN: "deepsight_refresh_token",
  USER: "deepsight_user",
  THEME: "deepsight_theme",
  LANGUAGE: "deepsight_language",
  ONBOARDING_COMPLETE: "deepsight_onboarding_complete",
  AMBIENT_LIGHTING_ENABLED: "deepsight_ambient_lighting_enabled",
};

// Plans - matches backend plan IDs (Pricing v2 — 3-plan architecture: free/pro/expert)
//
// Migration v0 → v2 (Avril 2026) :
//   - "plus" v0 (4,99 €) → "pro" v2 (8,99 €/mois, 89,90 €/an)
//   - "pro"  v0 (9,99 €) → "expert" v2 (19,99 €/mois, 199,90 €/an)
//   Mappings legacy gérés par normalize_plan_id côté backend (flag User.is_legacy_pricing
//   pour le grandfathering) et par normalizePlanId côté mobile (config/planPrivileges.ts).
export const PLANS = {
  FREE: "free",
  PRO: "pro",
  EXPERT: "expert",
  // Legacy aliases pour rétrocompatibilité (mappés via normalize_plan_id côté backend) :
  //   - "plus"     → "pro"
  //   - "starter"  → "pro"
  //   - "student" / "étudiant" → "pro"
  //   - "team" / "unlimited"   → "expert"
  PLUS: "pro",
  STUDENT: "pro",
  STARTER: "pro",
  TEAM: "expert",
} as const;

export type PlanType = (typeof PLANS)[keyof typeof PLANS];

// Analysis Modes
export const ANALYSIS_MODES = [
  { id: "synthesis", label: "Synthèse", icon: "file-text" },
  { id: "detailed", label: "Analyse détaillée", icon: "list" },
  { id: "critique", label: "Analyse critique", icon: "alert-circle" },
  { id: "educational", label: "Éducatif", icon: "graduation-cap" },
] as const;

// Analysis Categories
export const ANALYSIS_CATEGORIES = [
  { id: "general", label: "Général" },
  { id: "science", label: "Science" },
  { id: "technology", label: "Technologie" },
  { id: "business", label: "Business" },
  { id: "politics", label: "Politique" },
  { id: "culture", label: "Culture" },
  { id: "health", label: "Santé" },
  { id: "education", label: "Éducation" },
] as const;

// AI Models - Only Mistral models
export const AI_MODELS = [
  { id: "mistral-small", label: "Mistral Small 3.1", provider: "Mistral" },
  { id: "mistral-medium", label: "Mistral Medium 3.1", provider: "Mistral" },
  { id: "mistral-large", label: "Mistral Large 3", provider: "Mistral" },
] as const;

// Supported Languages
export const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
] as const;

export default {
  API_BASE_URL,
  APP_NAME,
  APP_VERSION,
  TIMEOUTS,
  QUERY_CONFIG,
  STORAGE_KEYS,
  PLANS,
  ANALYSIS_MODES,
  ANALYSIS_CATEGORIES,
  AI_MODELS,
  LANGUAGES,
};
