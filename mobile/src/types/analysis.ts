/**
 * Analysis Customization Types
 *
 * Types for analysis customization options including Anti-AI detection,
 * writing styles, custom prompts, and other formatting preferences.
 */

// Writing style options
export enum WritingStyle {
  ACADEMIC = 'academic',
  CONVERSATIONAL = 'conversational',
  PROFESSIONAL = 'professional',
  CREATIVE = 'creative',
  JOURNALISTIC = 'journalistic',
  TECHNICAL = 'technical',
}

// Vocabulary complexity levels
export type VocabularyComplexity = 'simple' | 'moderate' | 'advanced';

// Target length options
export type TargetLength = 'short' | 'medium' | 'long';

// Formality level (1-5 scale)
export type FormalityLevel = 1 | 2 | 3 | 4 | 5;

// Main customization interface
export interface AnalysisCustomization {
  /** Custom user prompt for personalized analysis */
  userPrompt?: string;
  /** Enable Anti-AI Detection (humanize text) */
  antiAIDetection: boolean;
  /** Writing style for the output */
  writingStyle: WritingStyle;
  /** Target length of the analysis */
  targetLength: TargetLength;
  /** Formality level (1 = casual, 5 = very formal) */
  formalityLevel: FormalityLevel;
  /** Vocabulary complexity */
  vocabularyComplexity: VocabularyComplexity;
  /** Include practical examples */
  includeExamples: boolean;
  /** Use personal tone (I/we) */
  personalTone: boolean;
}

// Default customization values
export const DEFAULT_CUSTOMIZATION: AnalysisCustomization = {
  userPrompt: '',
  antiAIDetection: false,
  writingStyle: WritingStyle.PROFESSIONAL,
  targetLength: 'medium',
  formalityLevel: 3,
  vocabularyComplexity: 'moderate',
  includeExamples: true,
  personalTone: false,
};

// V2 Analysis Request with customization options
export interface AnalysisRequestV2 {
  url?: string;
  raw_text?: string;
  title?: string;
  source?: string;
  mode: string;
  category: string;
  language: string;
  model?: string;
  deep_research?: boolean;
  /** Customization options for personalized output */
  customization?: AnalysisCustomization;
}

// AsyncStorage key for saving user preferences
export const CUSTOMIZATION_STORAGE_KEY = '@deepsight_customization_prefs';

// Writing style configuration with labels
export const WRITING_STYLE_CONFIG: Record<WritingStyle, {
  label: { fr: string; en: string };
  description: { fr: string; en: string };
  icon: string;
}> = {
  [WritingStyle.ACADEMIC]: {
    label: { fr: 'Académique', en: 'Academic' },
    description: { fr: 'Formel, citations', en: 'Formal, citations' },
    icon: 'school-outline',
  },
  [WritingStyle.CONVERSATIONAL]: {
    label: { fr: 'Conversationnel', en: 'Conversational' },
    description: { fr: 'Naturel, accessible', en: 'Natural, accessible' },
    icon: 'chatbubbles-outline',
  },
  [WritingStyle.PROFESSIONAL]: {
    label: { fr: 'Professionnel', en: 'Professional' },
    description: { fr: 'Clair, structuré', en: 'Clear, structured' },
    icon: 'briefcase-outline',
  },
  [WritingStyle.CREATIVE]: {
    label: { fr: 'Créatif', en: 'Creative' },
    description: { fr: 'Engageant, original', en: 'Engaging, original' },
    icon: 'sparkles-outline',
  },
  [WritingStyle.JOURNALISTIC]: {
    label: { fr: 'Journalistique', en: 'Journalistic' },
    description: { fr: 'Factuel, accrocheur', en: 'Factual, catchy' },
    icon: 'newspaper-outline',
  },
  [WritingStyle.TECHNICAL]: {
    label: { fr: 'Technique', en: 'Technical' },
    description: { fr: 'Précis, détaillé', en: 'Precise, detailed' },
    icon: 'code-outline',
  },
};

// Vocabulary complexity configuration
export const VOCABULARY_CONFIG: Record<VocabularyComplexity, {
  label: { fr: string; en: string };
  description: { fr: string; en: string };
}> = {
  simple: {
    label: { fr: 'Simple', en: 'Simple' },
    description: { fr: 'Vocabulaire courant, accessible à tous', en: 'Common vocabulary, accessible to all' },
  },
  moderate: {
    label: { fr: 'Modéré', en: 'Moderate' },
    description: { fr: 'Équilibre entre accessibilité et précision', en: 'Balance between accessibility and precision' },
  },
  advanced: {
    label: { fr: 'Avancé', en: 'Advanced' },
    description: { fr: 'Terminologie spécialisée, jargon technique', en: 'Specialized terminology, technical jargon' },
  },
};

// Target length configuration
export const LENGTH_CONFIG: Record<TargetLength, {
  label: { fr: string; en: string };
  description: { fr: string; en: string };
}> = {
  short: {
    label: { fr: 'Court', en: 'Short' },
    description: { fr: '~500 mots', en: '~500 words' },
  },
  medium: {
    label: { fr: 'Moyen', en: 'Medium' },
    description: { fr: '~1000 mots', en: '~1000 words' },
  },
  long: {
    label: { fr: 'Long', en: 'Long' },
    description: { fr: '~2000 mots', en: '~2000 words' },
  },
};
