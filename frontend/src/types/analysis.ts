/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 ANALYSIS TYPES v4 — Refonte personnalisation (Focus + Ton + Langue)            ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  v4.0 — Fusion Mode/Style → Ton (4 opts), ajout Focus (4 opts), langue sortie     ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 ANALYSIS FOCUS — Angle/objectif de l'analyse
// ═══════════════════════════════════════════════════════════════════════════════

export type AnalysisFocus = "summary" | "critical" | "study" | "action";

export const ANALYSIS_FOCUS_CONFIG: Record<
  AnalysisFocus,
  {
    label: { fr: string; en: string };
    description: { fr: string; en: string };
    emoji: string;
    promptPrefix: { fr: string; en: string };
  }
> = {
  summary: {
    label: { fr: "Résumé", en: "Summary" },
    description: {
      fr: "Synthèse factuelle des points clés",
      en: "Factual synthesis of key points",
    },
    emoji: "📋",
    promptPrefix: {
      fr: "Produis une synthèse factuelle et structurée des points clés.",
      en: "Produce a factual, structured synthesis of the key points.",
    },
  },
  critical: {
    label: { fr: "Analyse critique", en: "Critical Analysis" },
    description: {
      fr: "Évalue les arguments, biais et fiabilité",
      en: "Evaluate arguments, biases and reliability",
    },
    emoji: "🔍",
    promptPrefix: {
      fr: "Produis une analyse critique : évalue la fiabilité des arguments, identifie les biais, vérifie les sources.",
      en: "Produce a critical analysis: evaluate argument reliability, identify biases, verify sources.",
    },
  },
  study: {
    label: { fr: "Fiches d'étude", en: "Study Notes" },
    description: {
      fr: "Concepts clés, définitions et points de révision",
      en: "Key concepts, definitions and review points",
    },
    emoji: "🎓",
    promptPrefix: {
      fr: "Produis des fiches d'étude : concepts clés, définitions, points de révision structurés pour mémorisation.",
      en: "Produce study notes: key concepts, definitions, structured review points for memorization.",
    },
  },
  action: {
    label: { fr: "Points d'action", en: "Action Items" },
    description: {
      fr: "Conseils pratiques et étapes concrètes à appliquer",
      en: "Practical advice and concrete steps to apply",
    },
    emoji: "⚡",
    promptPrefix: {
      fr: "Extrais les conseils pratiques et étapes concrètes à appliquer immédiatement.",
      en: "Extract practical advice and concrete steps to apply immediately.",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✍️ WRITING TONE — Ton d'écriture (fusion ancien Mode + Style)
// ═══════════════════════════════════════════════════════════════════════════════

export type WritingTone = "standard" | "academic" | "casual" | "human";

/** Mapping interne: WritingTone → anciens paramètres API (mode + writing_style) */
export const TONE_TO_API_MAP: Record<
  WritingTone,
  { mode: string; writingStyle: string }
> = {
  standard: { mode: "standard", writingStyle: "default" },
  academic: { mode: "expert", writingStyle: "academic" },
  casual: { mode: "accessible", writingStyle: "casual" },
  human: { mode: "standard", writingStyle: "human" },
};

export const WRITING_TONE_CONFIG: Record<
  WritingTone,
  {
    label: { fr: string; en: string };
    description: { fr: string; en: string };
    emoji: string;
  }
> = {
  standard: {
    label: { fr: "Standard", en: "Standard" },
    description: {
      fr: "Équilibré et professionnel, adapté à tous",
      en: "Balanced and professional, suitable for everyone",
    },
    emoji: "⚖️",
  },
  academic: {
    label: { fr: "Académique", en: "Academic" },
    description: {
      fr: "Formel, structuré, vocabulaire technique",
      en: "Formal, structured, technical vocabulary",
    },
    emoji: "🎓",
  },
  casual: {
    label: { fr: "Décontracté", en: "Casual" },
    description: {
      fr: "Simple et accessible, langage courant",
      en: "Simple and accessible, everyday language",
    },
    emoji: "😊",
  },
  human: {
    label: { fr: "Humain", en: "Human" },
    description: {
      fr: "Naturel, comme écrit par une vraie personne",
      en: "Natural, as if written by a real person",
    },
    emoji: "🧑",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📏 TARGET LENGTH — Longueur cible de l'analyse
// ═══════════════════════════════════════════════════════════════════════════════

export type TargetLength = "short" | "medium" | "long" | "auto";

export const TARGET_LENGTH_CONFIG: Record<
  TargetLength,
  {
    label: { fr: string; en: string };
    description: { fr: string; en: string };
    wordRange: { fr: string; en: string };
  }
> = {
  short: {
    label: { fr: "Court", en: "Short" },
    description: { fr: "Résumé concis", en: "Concise summary" },
    wordRange: { fr: "~300-500 mots", en: "~300-500 words" },
  },
  medium: {
    label: { fr: "Moyen", en: "Medium" },
    description: {
      fr: "Équilibre détails/concision",
      en: "Balance of detail/brevity",
    },
    wordRange: { fr: "~800-1200 mots", en: "~800-1200 words" },
  },
  long: {
    label: { fr: "Long", en: "Long" },
    description: { fr: "Analyse approfondie", en: "In-depth analysis" },
    wordRange: { fr: "~1500-2500 mots", en: "~1500-2500 words" },
  },
  auto: {
    label: { fr: "Auto", en: "Auto" },
    description: { fr: "Adapté au contenu", en: "Adapted to content" },
    wordRange: { fr: "Variable", en: "Variable" },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 OUTPUT LANGUAGE — Langue de sortie
// ═══════════════════════════════════════════════════════════════════════════════

export type OutputLanguage = "auto" | "fr" | "en" | "es" | "de" | "it" | "pt";

export const OUTPUT_LANGUAGE_CONFIG: Record<
  OutputLanguage,
  {
    label: { fr: string; en: string };
    flag: string;
  }
> = {
  auto: { label: { fr: "Auto-détection", en: "Auto-detect" }, flag: "🌐" },
  fr: { label: { fr: "Français", en: "French" }, flag: "🇫🇷" },
  en: { label: { fr: "Anglais", en: "English" }, flag: "🇬🇧" },
  es: { label: { fr: "Espagnol", en: "Spanish" }, flag: "🇪🇸" },
  de: { label: { fr: "Allemand", en: "German" }, flag: "🇩🇪" },
  it: { label: { fr: "Italien", en: "Italian" }, flag: "🇮🇹" },
  pt: { label: { fr: "Portugais", en: "Portuguese" }, flag: "🇵🇹" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️ ANALYSIS CUSTOMIZATION — Configuration complète v4
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalysisCustomization {
  /** Angle/objectif de l'analyse */
  analysisFocus: AnalysisFocus;

  /** Ton d'écriture (fusion ancien mode + style) */
  writingTone: WritingTone;

  /** Longueur cible */
  targetLength: TargetLength;

  /** Langue de sortie */
  outputLanguage: OutputLanguage;

  /** Active l'anti-détection IA (humanisation du texte) */
  antiAIDetection: boolean;

  /** Prompt personnalisé de l'utilisateur (max 2000 caractères) */
  userPrompt: string;

  // ─── Legacy fields (kept for backward compat during migration) ───
  /** @deprecated Use writingTone instead */
  writingStyle?: WritingStyle;
}

/** @deprecated Use WritingTone instead — kept for API backward compat */
export type WritingStyle =
  | "default"
  | "human"
  | "academic"
  | "casual"
  | "humorous"
  | "soft";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_CUSTOMIZATION: AnalysisCustomization = {
  analysisFocus: "summary",
  writingTone: "standard",
  targetLength: "auto",
  outputLanguage: "auto",
  antiAIDetection: false,
  userPrompt: "",
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

  // Customization v2 (kept for API compat)
  user_prompt?: string;
  anti_ai_detection?: boolean;
  writing_style?: WritingStyle;
  target_length?: TargetLength;
}

export interface AnalyzeVideoV2Response {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: {
    summary_id?: number;
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convertit AnalysisCustomization v4 en paramètres API v2 (backward compat)
 * - Focus → injecté dans user_prompt
 * - WritingTone → dérivé en mode + writing_style
 */
export function customizationToApiParams(
  customization: AnalysisCustomization,
  interfaceLang: "fr" | "en" = "fr",
): Partial<AnalyzeVideoV2Request> & { mode: string; lang: string } {
  const toneMap = TONE_TO_API_MAP[customization.writingTone];
  const focusConfig = ANALYSIS_FOCUS_CONFIG[customization.analysisFocus];

  // Construire le user_prompt final: focus prefix + user instructions
  let finalPrompt = "";
  if (customization.analysisFocus !== "summary") {
    // summary est le comportement par défaut, pas besoin de prefix
    finalPrompt = focusConfig.promptPrefix[interfaceLang];
  }
  if (customization.userPrompt) {
    finalPrompt = finalPrompt
      ? `${finalPrompt}\n\nInstructions supplémentaires : ${customization.userPrompt}`
      : customization.userPrompt;
  }

  // Résoudre la langue
  const lang =
    customization.outputLanguage === "auto"
      ? interfaceLang
      : customization.outputLanguage;

  return {
    mode: toneMap.mode,
    writing_style: toneMap.writingStyle as WritingStyle,
    target_length: customization.targetLength,
    anti_ai_detection: customization.antiAIDetection,
    user_prompt: finalPrompt || undefined,
    lang,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MIGRATION — Convertir ancien format localStorage vers v4
// ═══════════════════════════════════════════════════════════════════════════════

interface LegacyCustomization {
  writingStyle?: string;
  antiAIDetection?: boolean;
  targetLength?: string;
  userPrompt?: string;
}

/** Migre les anciennes prefs (v2/v3) vers v4 */
export function migrateCustomization(
  legacy: LegacyCustomization,
): AnalysisCustomization {
  let writingTone: WritingTone = "standard";

  // Map ancien writingStyle → nouveau writingTone
  switch (legacy.writingStyle) {
    case "academic":
      writingTone = "academic";
      break;
    case "casual":
      writingTone = "casual";
      break;
    case "human":
      writingTone = "human";
      break;
    case "humorous":
      writingTone = "casual";
      break; // humorous → casual
    case "soft":
      writingTone = "human";
      break; // soft → human
    default:
      writingTone = "standard";
      break;
  }

  return {
    analysisFocus: "summary",
    writingTone,
    targetLength: (legacy.targetLength as TargetLength) || "auto",
    outputLanguage: "auto",
    antiAIDetection: legacy.antiAIDetection || false,
    userPrompt: legacy.userPrompt || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 LOCAL STORAGE KEY
// ═══════════════════════════════════════════════════════════════════════════════

export const CUSTOMIZATION_STORAGE_KEY = "deepsight_analysis_customization";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 LEGACY RE-EXPORTS (pour les imports existants)
// ═══════════════════════════════════════════════════════════════════════════════

/** @deprecated Use WRITING_TONE_CONFIG */
export const WRITING_STYLE_CONFIG = WRITING_TONE_CONFIG as unknown as Record<
  string,
  {
    label: { fr: string; en: string };
    description: { fr: string; en: string };
    emoji: string;
  }
>;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 VISUAL ANALYSIS — Phase 2 (Mistral Vision sur storyboards YouTube)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type de structure visuelle détectée dans la vidéo.
 * Aligné avec le backend (`backend/src/videos/visual_analysis.py`).
 */
export type VisualStructure =
  | "talking_head"
  | "b_roll"
  | "gameplay"
  | "slides"
  | "tutorial"
  | "interview"
  | "vlog"
  | "mixed"
  | "other";

/**
 * Niveau qualitatif utilisé par les indicateurs SEO visuels.
 */
export type VisualQualitativeLevel = "low" | "medium" | "high";

/**
 * Un moment clé identifié visuellement dans la vidéo.
 */
export interface VisualKeyMoment {
  /** Timestamp en secondes depuis le début de la vidéo. */
  timestamp_s: number;
  /** Description courte (FR) de ce qui est visible. */
  description: string;
  /** Catégorie libre (ex : "title_card", "cta", "infographic"). */
  type: string;
}

/**
 * Indicateurs SEO visuels — destinés à éclairer le potentiel de rétention
 * et de citation dans les moteurs IA. Tous les champs sont optionnels car
 * le backend peut renvoyer un sous-ensemble selon le modèle utilisé.
 */
export interface VisualSeoIndicators {
  /** Luminosité du hook d'intro (perçue par Mistral Vision). */
  hook_brightness?: VisualQualitativeLevel;
  /** Vrai si un visage est visible dans les ~3 premières secondes. */
  face_visible_in_hook?: boolean;
  /** Vrai si des sous-titres "burned-in" (incrustés) sont détectés. */
  burned_in_subtitles?: boolean;
  /** Vrai si l'intro contient des mouvements de caméra/zoom rapides. */
  high_motion_intro?: boolean;
  /** Estimation qualitative du soin apporté à la miniature/branding. */
  thumbnail_quality_proxy?: VisualQualitativeLevel;
}

/**
 * Payload Visual Analysis renvoyé par /api/videos/analyze quand Phase 2
 * est activée. Embarqué dans l'objet `analysis` (réponse `Summary`) sous
 * la clé `visual_analysis`. Peut être null si l'analyse n'a pas été lancée
 * ou a échoué silencieusement (le tab UI affichera alors un empty state).
 */
export interface VisualAnalysis {
  /** Hook visuel — ce qu'on voit dans les 3 premières secondes. */
  visual_hook: string;
  /** Type de structure visuelle dominante. */
  visual_structure: VisualStructure;
  /** Liste de moments visuels remarquables (1-10 typiquement). */
  key_moments: VisualKeyMoment[];
  /** Texte visible à l'écran (titres, sous-titres incrustés, CTA). */
  visible_text: string;
  /** Heuristiques de SEO/rétention dérivées de l'analyse visuelle. */
  visual_seo_indicators: VisualSeoIndicators;
  /** Résumé en prose de la couche visuelle. */
  summary_visual: string;
  /** Modèle Mistral Vision utilisé (ex: "pixtral-12b-2409"). */
  model_used: string;
  /** Nombre de frames extraites du storyboard analysées. */
  frames_analyzed: number;
  /** Vrai si le storyboard a été sous-échantillonné (cap budget). */
  frames_downsampled: boolean;
}
