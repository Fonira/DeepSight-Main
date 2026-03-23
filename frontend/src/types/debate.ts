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
  source_video: 'a' | 'b';
  verdict: 'confirmed' | 'nuanced' | 'disputed' | 'unverifiable';
  explanation: string;
  sources: string[];
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

export interface DebateAnalysis {
  id: number;
  video_a_id: string;
  video_b_id: string | null;
  video_a_title: string;
  video_b_title: string;
  video_a_channel: string;
  video_b_channel: string;
  video_a_thumbnail: string;
  video_b_thumbnail: string;
  detected_topic: string;
  thesis_a: string;
  thesis_b: string;
  arguments_a: DebateArgument[];
  arguments_b: DebateArgument[];
  convergence_points: string[];
  divergence_points: DivergencePoint[];
  fact_check_results: FactCheckItem[];
  debate_summary: string;
  status: DebateStatus;
  mode: DebateMode;
  lang: string;
  created_at: string;
}
