/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚔️ DEBATE TYPES — Débat IA entre vidéos                                         ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  v1.0 — Types pour la feature Débat IA (confrontation de 2 vidéos)               ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🗡️ DEBATE ARGUMENT — Un argument d'un côté du débat
// ═══════════════════════════════════════════════════════════════════════════════

export interface DebateArgument {
  claim: string;
  evidence: string;
  strength: 'strong' | 'moderate' | 'weak';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ↔️ DIVERGENCE POINT — Point de désaccord entre les 2 vidéos
// ═══════════════════════════════════════════════════════════════════════════════

export interface DivergencePoint {
  topic: string;
  position_a: string;
  position_b: string;
  fact_check_verdict?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ FACT CHECK ITEM — Résultat de vérification factuelle
// ═══════════════════════════════════════════════════════════════════════════════

export interface FactCheckItem {
  claim: string;
  verdict: 'confirmed' | 'nuanced' | 'disputed' | 'unverifiable';
  source: string;
  explanation: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⚔️ DEBATE STATUS — État de progression du débat
// ═══════════════════════════════════════════════════════════════════════════════

export type DebateStatus =
  | 'pending'
  | 'searching'
  | 'analyzing_b'
  | 'comparing'
  | 'fact_checking'
  | 'completed'
  | 'failed';

export type DebateMode = 'auto' | 'manual';

// ═══════════════════════════════════════════════════════════════════════════════
// ⚔️ DEBATE ANALYSIS — Analyse complète d'un débat
// ═══════════════════════════════════════════════════════════════════════════════

export type VideoPlatform = 'youtube' | 'tiktok';

export interface DebateAnalysis {
  id: number;
  video_a_id: string;
  video_b_id: string | null;
  platform_a: VideoPlatform;
  platform_b: VideoPlatform | null;
  video_a_title: string;
  video_b_title: string | null;
  video_a_channel: string | null;
  video_b_channel: string | null;
  video_a_thumbnail: string | null;
  video_b_thumbnail: string | null;
  detected_topic: string | null;
  thesis_a: string | null;
  thesis_b: string | null;
  arguments_a: DebateArgument[];
  arguments_b: DebateArgument[];
  convergence_points: string[];
  divergence_points: DivergencePoint[];
  fact_check_results: FactCheckItem[];
  debate_summary: string | null;
  status: DebateStatus;
  mode: DebateMode;
  lang: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 DEBATE LIST ITEM — Item léger pour l'historique
// ═══════════════════════════════════════════════════════════════════════════════

export interface DebateListItem {
  id: number;
  detected_topic: string | null;
  video_a_title: string | null;
  video_b_title: string | null;
  video_a_thumbnail: string | null;
  video_b_thumbnail: string | null;
  status: DebateStatus;
  created_at: string;
}
