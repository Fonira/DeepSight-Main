// API Configuration
export const API_BASE_URL = 'https://deep-sight-backend-v3-production.up.railway.app';

// App Configuration
export const APP_NAME = 'Deep Sight';
export const APP_VERSION = '1.0.0';
export const APP_BUNDLE_ID = 'com.deepsight.app';

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
  ACCESS_TOKEN: 'deepsight_access_token',
  REFRESH_TOKEN: 'deepsight_refresh_token',
  USER: 'deepsight_user',
  THEME: 'deepsight_theme',
  LANGUAGE: 'deepsight_language',
  ONBOARDING_COMPLETE: 'deepsight_onboarding_complete',
};

// Plans
export const PLANS = {
  FREE: 'free',
  STUDENT: 'student',
  STARTER: 'starter',
  PRO: 'pro',
  EXPERT: 'expert',
} as const;

export type PlanType = typeof PLANS[keyof typeof PLANS];

// Analysis Modes
export const ANALYSIS_MODES = [
  { id: 'synthesis', label: 'Synthèse', icon: 'file-text' },
  { id: 'detailed', label: 'Analyse détaillée', icon: 'list' },
  { id: 'critique', label: 'Analyse critique', icon: 'alert-circle' },
  { id: 'educational', label: 'Éducatif', icon: 'graduation-cap' },
] as const;

// Analysis Categories
export const ANALYSIS_CATEGORIES = [
  { id: 'general', label: 'Général' },
  { id: 'science', label: 'Science' },
  { id: 'technology', label: 'Technologie' },
  { id: 'business', label: 'Business' },
  { id: 'politics', label: 'Politique' },
  { id: 'culture', label: 'Culture' },
  { id: 'health', label: 'Santé' },
  { id: 'education', label: 'Éducation' },
] as const;

// AI Models
export const AI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { id: 'claude-3-haiku', label: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'mistral-small', label: 'Mistral Small', provider: 'Mistral' },
  { id: 'mistral-large', label: 'Mistral Large', provider: 'Mistral' },
] as const;

// Supported Languages
export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
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
