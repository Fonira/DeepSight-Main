/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚔️ DEBATE TYPES — Débat IA entre vidéos                                         ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  v2.0 — Sprint Débat IA v2 : layout adaptatif 1+N (jusqu'à 3 perspectives)       ║
 * ║         + relation_type (opposite/complement/nuance) + cols Miro                  ║
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
// 🔀 RELATION TYPE — Nature de la relation entre la vidéo A et la perspective B
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Relation entre la vidéo A (source) et une perspective ajoutée :
 *   - opposite   → débat classique (thèse opposée). Naming UI = "Débat IA".
 *   - complement → angle complémentaire (qui couvre un autre aspect du sujet).
 *   - nuance     → nuance / qualification de la thèse de A.
 *
 * Si toutes les perspectives sont `opposite`, l'UI parle de "Débat IA".
 * Sinon (mix complement / nuance), l'UI parle de "Perspectives IA".
 */
export type RelationType = "opposite" | "complement" | "nuance";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 DEBATE PERSPECTIVE — Une perspective ajoutée à un débat (B1, B2, ...)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Une perspective dans un débat 1+N.
 * `position` indique l'ordre d'ajout (0 = première perspective B1, 1 = B2, 2 = B3, ...).
 * La vidéo A reste hors de ce tableau (champs `video_a_*` au niveau racine).
 */
export interface DebatePerspective {
  id: number;
  /** Index 0..N de la perspective dans le débat (0 = B1, 1 = B2, 2 = B3) */
  position: number;
  video_id: string;
  platform: string;
  video_title: string | null;
  video_channel: string | null;
  video_thumbnail: string | null;
  thesis: string | null;
  arguments: DebateArgument[] | null;
  relation_type: RelationType;
  channel_quality_score: number;
  audience_level: "vulgarisation" | "expert" | "unknown";
  fact_check_results: FactCheckItem[] | null;
  created_at: string;
  /** Date de fraîcheur de la perspective (Wave 3 — visualisations matrix). */
  freshness_date?: string | null;
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
  | "failed"
  | "adding_perspective";

export type DebateMode = "auto" | "manual";

// ═══════════════════════════════════════════════════════════════════════════════
// ⚔️ DEBATE ANALYSIS — Analyse complète d'un débat
// ═══════════════════════════════════════════════════════════════════════════════

export type VideoPlatform = "youtube" | "tiktok";

export interface DebateAnalysis {
  id: number;
  // Vidéo A (source) — toujours présente
  video_a_id: string;
  platform_a: VideoPlatform;
  video_a_title: string;
  video_a_channel: string | null;
  video_a_thumbnail: string | null;
  thesis_a: string | null;
  arguments_a: DebateArgument[];

  // Vidéo B (legacy v1 — backward-compat lecture seule, dérivable depuis perspectives[0])
  video_b_id: string | null;
  platform_b: VideoPlatform | null;
  video_b_title: string | null;
  video_b_channel: string | null;
  video_b_thumbnail: string | null;
  thesis_b: string | null;
  arguments_b: DebateArgument[];

  // Méta
  detected_topic: string | null;
  convergence_points: string[];
  divergence_points: DivergencePoint[];
  fact_check_results: FactCheckItem[];
  debate_summary: string | null;
  status: DebateStatus;
  mode: DebateMode;
  lang: string;
  created_at: string;

  // 🆕 v2 — Layout 1+N adaptatif
  /** 0 à 3 perspectives. Si vide ou absent, l'UI dérive 1 perspective implicite depuis video_b_*. */
  perspectives?: DebatePerspective[];
  /** Relation dominante (calculée backend) — pilote le naming "Débat IA" vs "Perspectives IA". */
  relation_type_dominant?: RelationType | null;
  /** URL Miro Board associé (si généré). Wave 3 F. */
  miro_board_url?: string | null;
  miro_board_id?: string | null;
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
// ⚡ DEBATE V2 — Types complémentaires
// ═══════════════════════════════════════════════════════════════════════════════

/** Niveau d'audience de la chaîne. */
export type AudienceLevel = "vulgarisation" | "expert" | "unknown";

/** Point de convergence enrichi (V2). */
export interface ConvergencePoint {
  topic: string;
  description: string;
  /** Indices des perspectives concernées (-1 = vidéo A). */
  perspective_indices?: number[];
}
