// frontend/src/types/conceptImage.ts
//
// Types frontend miroir des schémas Pydantic backend
// (`backend/src/tutor/concepts_router.py` — PR #1 + #2 du sprint 2026-05-18
// « Carrousel concepts illustrés Tuteur »).
//
// API REST :
// - GET  /api/tutor/concepts?limit=20            → TutorConceptsResponse
// - POST /api/tutor/concepts/generate            → GenerateConceptResponse
// - POST /api/tutor/concepts/refresh             → { refreshed: boolean }
//
// Plan requis : Expert (gating backend `_check_expert_gating`).

export type TutorConceptStatus =
  | "ready"
  | "pending"
  | "failed"
  | "throttled"
  | "missing";

export interface TutorConceptItem {
  term: string;
  term_hash: string;
  category?: string | null;
  image_url?: string | null;
  status: TutorConceptStatus;
}

export interface TutorConceptsResponse {
  concepts: TutorConceptItem[];
  total: number;
  ready_count: number;
  pending_count: number;
}

export interface GenerateConceptRequest {
  term: string;
  definition?: string;
  category?: string | null;
}

export interface GenerateConceptResponse {
  term: string;
  term_hash: string;
  status: TutorConceptStatus;
  image_url?: string | null;
  cap_remaining: number;
}
