/**
 * Types pour la personnalisation des analyses DeepSight
 */

export enum WritingStyle {
  ACADEMIC = 'academic',
  CONVERSATIONAL = 'conversational',
  PROFESSIONAL = 'professional',
  CREATIVE = 'creative',
  JOURNALISTIC = 'journalistic',
  TECHNICAL = 'technical',
}

export interface AnalysisCustomization {
  writingStyle: WritingStyle;
  antiAIDetection: boolean;
  targetLength: 'short' | 'medium' | 'long';
  includeExamples: boolean;
  formalityLevel: 1 | 2 | 3 | 4 | 5;
  vocabularyComplexity: 'simple' | 'moderate' | 'advanced';
  personalTone: boolean;
}
