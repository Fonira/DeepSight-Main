/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 ANALYSIS TYPES — Types pour la personnalisation avancée des analyses           ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Version: 2.0 — Analyse Personnalisée Avancée                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 WRITING STYLE — Styles d'écriture disponibles
// ═══════════════════════════════════════════════════════════════════════════════

export type WritingStyle =
  | 'default'     // Style par défaut (équilibré)
  | 'human'       // Très naturel, comme un humain
  | 'academic'    // Académique, citations, formel
  | 'casual'      // Décontracté, amical
  | 'humorous'    // Avec touches d'humour
  | 'soft';       // Style plus doux et empathique

export const WRITING_STYLE_CONFIG: Record<WritingStyle, {
  label: { fr: string; en: string };
  description: { fr: string; en: string };
  emoji: string;
}> = {
  default: {
    label: { fr: 'Par défaut', en: 'Default' },
    description: { fr: 'Style équilibré et professionnel', en: 'Balanced and professional style' },
    emoji: '⚖️',
  },
  human: {
    label: { fr: 'Humain', en: 'Human' },
    description: { fr: 'Très naturel, comme écrit par un humain', en: 'Very natural, human-written feel' },
    emoji: '🧑',
  },
  academic: {
    label: { fr: 'Académique', en: 'Academic' },
    description: { fr: 'Formel, structuré, citations', en: 'Formal, structured, citations' },
    emoji: '🎓',
  },
  casual: {
    label: { fr: 'Décontracté', en: 'Casual' },
    description: { fr: 'Amical et accessible', en: 'Friendly and approachable' },
    emoji: '😊',
  },
  humorous: {
    label: { fr: 'Humoristique', en: 'Humorous' },
    description: { fr: 'Touches d\'humour et légèreté', en: 'Light and witty touches' },
    emoji: '😄',
  },
  soft: {
    label: { fr: 'Doux', en: 'Soft' },
    description: { fr: 'Empathique et bienveillant', en: 'Empathetic and caring' },
    emoji: '💜',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📏 TARGET LENGTH — Longueur cible de l'analyse
// ═══════════════════════════════════════════════════════════════════════════════

export type TargetLength = 'short' | 'medium' | 'long' | 'auto';

export const TARGET_LENGTH_CONFIG: Record<TargetLength, {
  label: { fr: string; en: string };
  description: { fr: string; en: string };
  wordRange: { fr: string; en: string };
}> = {
  short: {
    label: { fr: 'Court', en: 'Short' },
    description: { fr: 'Résumé concis', en: 'Concise summary' },
    wordRange: { fr: '~300-500 mots', en: '~300-500 words' },
  },
  medium: {
    label: { fr: 'Moyen', en: 'Medium' },
    description: { fr: 'Équilibre détails/concision', en: 'Balance of detail/brevity' },
    wordRange: { fr: '~800-1200 mots', en: '~800-1200 words' },
  },
  long: {
    label: { fr: 'Long', en: 'Long' },
    description: { fr: 'Analyse approfondie', en: 'In-depth analysis' },
    wordRange: { fr: '~1500-2500 mots', en: '~1500-2500 words' },
  },
  auto: {
    label: { fr: 'Auto', en: 'Auto' },
    description: { fr: 'Adapté au contenu', en: 'Adapted to content' },
    wordRange: { fr: 'Variable', en: 'Variable' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️ ANALYSIS CUSTOMIZATION — Configuration complète
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalysisCustomization {
  /** Prompt personnalisé de l'utilisateur (max 2000 caractères) */
  userPrompt: string;

  /** Active l'anti-détection IA (humanisation du texte) */
  antiAIDetection: boolean;

  /** Style d'écriture */
  writingStyle: WritingStyle;

  /** Longueur cible */
  targetLength: TargetLength;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_CUSTOMIZATION: AnalysisCustomization = {
  userPrompt: '',
  antiAIDetection: false,
  writingStyle: 'default',
  targetLength: 'auto',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 API TYPES — Types pour les requêtes/réponses API
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalyzeVideoV2Request {
  url: string;
  category?: string;
  mode?: string;
  model?: string;
  lang?: string;
  deep_research?: boolean;

  // Customization v2
  user_prompt?: string;
  anti_ai_detection?: boolean;
  writing_style?: WritingStyle;
  target_length?: TargetLength;
}

export interface AnalyzeVideoV2Response {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    summary_id?: number;
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convertit AnalysisCustomization en paramètres API (snake_case)
 */
export function customizationToApiParams(customization: AnalysisCustomization): Partial<AnalyzeVideoV2Request> {
  return {
    user_prompt: customization.userPrompt || undefined,
    anti_ai_detection: customization.antiAIDetection,
    writing_style: customization.writingStyle,
    target_length: customization.targetLength,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 LOCAL STORAGE KEY
// ═══════════════════════════════════════════════════════════════════════════════

export const CUSTOMIZATION_STORAGE_KEY = 'deepsight_analysis_customization';
