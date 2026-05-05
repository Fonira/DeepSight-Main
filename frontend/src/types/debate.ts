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
  strength: "strong" | "moderate" | "weak";
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
  verdict: "confirmed" | "nuanced" | "disputed" | "unverifiable";
  source: string;
  explanation: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⚔️ DEBATE STATUS — État de progression du débat
// ═══════════════════════════════════════════════════════════════════════════════

export type DebateStatus =
  | "pending"
  | "searching"
  | "analyzing_b"
  | "comparing"
  | "fact_checking"
  | "completed"
  | "failed";

export type DebateMode = "auto" | "manual";

// ═══════════════════════════════════════════════════════════════════════════════
// ⚔️ DEBATE ANALYSIS — Analyse complète d'un débat
// ═══════════════════════════════════════════════════════════════════════════════

export type VideoPlatform = "youtube" | "tiktok";

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

// ═══════════════════════════════════════════════════════════════════════════════
// ⚡ DEBATE V2 — Stubs pour layout 1+N adaptatif (Wave 3 — sera unifié au merge)
// ═══════════════════════════════════════════════════════════════════════════════

/** Type de relation d'une perspective B vers la vidéo A. */
export type RelationType = "opposite" | "complement" | "nuance";

/** Niveau d'audience de la chaîne. */
export type AudienceLevel = "vulgarisation" | "expert" | "unknown";

/**
 * Une perspective additionnelle (B1, B2, ...) confrontée à la vidéo A.
 * Stub minimal — sera enrichi par Sub-agent D au merge final.
 */
export interface DebatePerspective {
  id: number;
  position: number;
  video_id?: string | null;
  video_title: string | null;
  video_channel: string | null;
  video_thumbnail?: string | null;
  thesis: string | null;
  arguments: DebateArgument[] | null;
  relation_type: RelationType;
  channel_quality_score?: number;
  audience_level?: AudienceLevel;
  freshness_date?: string | null;
}

/** Point de convergence enrichi (V2). */
export interface ConvergencePoint {
  topic: string;
  description: string;
  /** Indices des perspectives concernées (-1 = vidéo A). */
  perspective_indices?: number[];
}
