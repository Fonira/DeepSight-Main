/**
 * VisualPanelView — Side Panel "Analyse visuelle"
 *
 * Vue dédiée du sidepanel ouverte par le badge `OPEN_SIDEPANEL_VISUAL` injecté
 * sur YouTube par `extension/src/content/widget.ts` (renderVisualAnalysisBadge).
 *
 * Flow :
 *   1. Le badge "👁️ Analyse visuelle" envoie au background un message
 *      `{type: "OPEN_SIDEPANEL_VISUAL", videoId, feature, plan}`.
 *   2. Le handler `OPEN_SIDEPANEL_VISUAL` (background.ts) stocke
 *      `visualPanelContext` dans `chrome.storage.session` puis ouvre
 *      `sidepanel.html` via `chrome.sidePanel.setOptions + open`.
 *   3. App.tsx monte cette vue après lecture de `visualPanelContext`.
 *   4. Cette vue lit le JWT (chrome.storage.local.accessToken) et fetch
 *      `GET /api/videos/{videoId}` → extrait `visual_analysis` et le rend
 *      en 6 sections (mirror du tab web `frontend/src/components/AnalysisHub/VisualTab.tsx`).
 *
 * Empty states :
 *   - Pas de context → message + bouton "fermer le panneau" (cas peu probable).
 *   - Context mais visual_analysis null → CTA "Réanalyser avec le visuel".
 *   - Loading state pendant fetch.
 *
 * Design conventions extension :
 *   - Dark mode (fond #0a0a0f) — le sidepanel fait ~400px de large.
 *   - Réutilise les classes CSS existantes (.results-view, .video-status-card,
 *     .platform-logos-strip…) et ajoute des styles inline pour les sections
 *     spécifiques (visualisation compacte des 6 panneaux).
 */

import React, { useEffect, useState, useCallback } from "react";
import Browser from "../../utils/browser-polyfill";
import { API_BASE_URL, WEBAPP_URL } from "../../utils/config";
import { getStoredTokens } from "../../utils/storage";
import { ExternalLinkIcon } from "../shared/Icons";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";

// ── Types — alignés avec backend & frontend/types/analysis.ts ─────────────

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

export type VisualQualitativeLevel = "low" | "medium" | "high";

export interface VisualKeyMoment {
  timestamp_s: number;
  description: string;
  type: string;
}

export interface VisualSeoIndicators {
  hook_brightness?: VisualQualitativeLevel;
  face_visible_in_hook?: boolean;
  burned_in_subtitles?: boolean;
  high_motion_intro?: boolean;
  thumbnail_quality_proxy?: VisualQualitativeLevel;
}

export interface VisualAnalysis {
  visual_hook: string;
  visual_structure: VisualStructure | string;
  key_moments: VisualKeyMoment[];
  visible_text: string;
  visual_seo_indicators: VisualSeoIndicators;
  summary_visual: string;
  model_used?: string;
  frames_analyzed?: number;
  frames_downsampled?: boolean;
}

interface VideoSummaryResponse {
  id?: number;
  video_title?: string;
  visual_analysis?: VisualAnalysis | null;
  // Tolerant — d'autres champs peuvent exister, on ne les utilise pas ici.
  [key: string]: unknown;
}

export interface VisualPanelContext {
  videoId: string | null;
  feature?: string | null;
  plan?: "free" | "pro" | "expert" | null;
  source?: string | null;
}

interface VisualPanelViewProps {
  context: VisualPanelContext;
  onClose: () => void;
  onSessionExpired?: () => void;
}

// ── Labels FR (i18n minimal local — cohérent avec mobile/VisualTab) ───────

const STRUCTURE_LABELS: Record<string, string> = {
  talking_head: "Plan parlé",
  b_roll: "B-roll",
  gameplay: "Gameplay",
  slides: "Slides",
  tutorial: "Tutoriel",
  interview: "Interview",
  vlog: "Vlog",
  mixed: "Mixte",
  other: "Autre",
};

const QUALITATIVE_LABELS: Record<VisualQualitativeLevel, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
};

const MOMENT_TYPE_LABELS: Record<string, string> = {
  hook: "Hook",
  transition: "Transition",
  reveal: "Révélation",
  cta: "CTA",
  peak: "Pic",
  demo: "Démo",
  title_card: "Titre",
  infographic: "Info",
};

// ── Utils ─────────────────────────────────────────────────────────────────

/** 3.5 → '00:03', 75.2 → '01:15', 3700 → '01:01:40'. */
function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ── Sous-composants ──────────────────────────────────────────────────────

const SectionTitle: React.FC<{
  icon: string;
  color: string;
  children: React.ReactNode;
}> = ({ icon, color, children }) => (
  <h3
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--text-secondary, #cbd5e1)",
      margin: "0 0 12px 0",
    }}
  >
    <span aria-hidden="true" style={{ color, fontSize: 14 }}>
      {icon}
    </span>
    {children}
  </h3>
);

const QualitativeBadge: React.FC<{
  level: VisualQualitativeLevel | undefined;
}> = ({ level }) => {
  if (!level) {
    return (
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>—</span>
    );
  }
  const colorMap: Record<VisualQualitativeLevel, { bg: string; fg: string }> = {
    low: { bg: "rgba(245, 158, 11, 0.12)", fg: "#fcd34d" },
    medium: { bg: "rgba(59, 130, 246, 0.12)", fg: "#93c5fd" },
    high: { bg: "rgba(16, 185, 129, 0.12)", fg: "#6ee7b7" },
  };
  const c = colorMap[level];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.fg}33`,
      }}
    >
      {QUALITATIVE_LABELS[level]}
    </span>
  );
};

const BooleanBadge: React.FC<{ value: boolean | undefined }> = ({ value }) => {
  if (value === undefined) {
    return (
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>—</span>
    );
  }
  if (value) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: "rgba(16, 185, 129, 0.12)",
          color: "#6ee7b7",
          border: "1px solid rgba(110, 231, 183, 0.2)",
        }}
      >
        Oui
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        background: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      Non
    </span>
  );
};

const IndicatorTile: React.FC<{
  label: string;
  valueNode: React.ReactNode;
}> = ({ label, valueNode }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "10px 12px",
      borderRadius: 10,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <span
      style={{
        fontSize: 12,
        color: "rgba(255,255,255,0.6)",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
    <span style={{ flexShrink: 0 }}>{valueNode}</span>
  </div>
);

// ── Section panneau (carte glassmorphism) ────────────────────────────────

const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      backdropFilter: "blur(12px)",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: 14,
    }}
  >
    {children}
  </div>
);

// ── Composant principal ──────────────────────────────────────────────────

export const VisualPanelView: React.FC<VisualPanelViewProps> = ({
  context,
  onClose,
  onSessionExpired,
}) => {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [visual, setVisual] = useState<VisualAnalysis | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchVisualAnalysis = useCallback(async () => {
    if (!context.videoId) {
      setPhase("error");
      setErrorMsg("Aucune vidéo détectée");
      return;
    }

    setPhase("loading");
    try {
      const { accessToken } = await getStoredTokens();
      if (!accessToken) {
        setPhase("error");
        setErrorMsg("Connectez-vous pour voir l'analyse visuelle");
        return;
      }

      const resp = await fetch(
        `${API_BASE_URL}/videos/${context.videoId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (resp.status === 401) {
        onSessionExpired?.();
        setPhase("error");
        setErrorMsg("Session expirée — reconnectez-vous");
        return;
      }

      if (resp.status === 404) {
        setPhase("ready");
        setVisual(null);
        return;
      }

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as VideoSummaryResponse;
      setVideoTitle(data.video_title ?? null);
      setVisual(data.visual_analysis ?? null);
      setPhase("ready");
    } catch (e) {
      setPhase("error");
      setErrorMsg((e as Error).message || "Impossible de charger l'analyse");
    }
  }, [context.videoId, onSessionExpired]);

  useEffect(() => {
    void fetchVisualAnalysis();
  }, [fetchVisualAnalysis]);

  // ─────────────────────────────────────────────────────────────────────
  // Render — Loading
  // ─────────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="results-view" data-testid="visual-panel-loading">
        <Header title="Analyse visuelle" onClose={onClose} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 12,
          }}
        >
          <DeepSightSpinner size="md" speed="normal" />
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              margin: 0,
            }}
          >
            Chargement de l'analyse visuelle...
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Render — Error
  // ─────────────────────────────────────────────────────────────────────

  if (phase === "error") {
    return (
      <div className="results-view" data-testid="visual-panel-error">
        <Header title="Analyse visuelle" onClose={onClose} />
        <div
          style={{
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 14, color: "#fca5a5", margin: "0 0 16px 0" }}>
            {errorMsg}
          </p>
          <button
            className="analyze-btn"
            onClick={() => void fetchVisualAnalysis()}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Render — Ready (avec ou sans visual_analysis)
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="results-view" data-testid="visual-panel-ready">
      <Header title="Analyse visuelle" onClose={onClose} />

      {/* Title video */}
      {videoTitle && (
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
            padding: "0 16px",
            margin: "4px 0 12px 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {videoTitle}
        </p>
      )}

      {/* Empty state — visual_analysis null */}
      {!visual ? (
        <EmptyVisualState videoId={context.videoId} />
      ) : (
        <VisualSections visual={visual} />
      )}
    </div>
  );
};

// ── Header (titre + close) ───────────────────────────────────────────────

const Header: React.FC<{ title: string; onClose: () => void }> = ({
  title,
  onClose,
}) => (
  <div
    className="results-header"
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        aria-hidden="true"
        style={{ fontSize: 18 }}
        role="img"
        aria-label="Eye"
      >
        {"\u{1F441}"}
      </span>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
    <button
      onClick={onClose}
      aria-label="Fermer"
      style={{
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.6)",
        borderRadius: 6,
        width: 28,
        height: 28,
        cursor: "pointer",
        fontSize: 16,
        lineHeight: 1,
      }}
    >
      {"✕"}
    </button>
  </div>
);

// ── Empty state — visual_analysis = null ─────────────────────────────────

const EmptyVisualState: React.FC<{ videoId: string | null }> = ({
  videoId,
}) => (
  <div
    style={{
      padding: 24,
      textAlign: "center",
    }}
    data-testid="visual-panel-empty"
  >
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 12,
        fontSize: 24,
      }}
      role="img"
      aria-label="Eye"
    >
      {"\u{1F441}"}
    </div>
    <h3
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: "#fff",
        margin: "0 0 8px 0",
      }}
    >
      Pas d'analyse visuelle
    </h3>
    <p
      style={{
        fontSize: 13,
        color: "rgba(255,255,255,0.5)",
        lineHeight: 1.5,
        margin: "0 0 16px 0",
      }}
    >
      Cette vidéo n'a pas encore d'analyse visuelle. Réanalysez-la avec
      l'option visuelle pour voir le hook, la structure, les moments clés et
      les indicateurs SEO.
    </p>
    {/*
     * CTA non câblé pour cette PR : cliquer renvoie vers la page de l'analyse
     * sur le web où l'utilisateur peut relancer avec l'option visuelle. Une
     * future PR pourra envoyer un message au background pour déclencher la
     * réanalyse directement (POST /api/videos/analyze avec
     * include_visual_analysis=true).
     */}
    <button
      className="analyze-btn"
      data-testid="visual-panel-reanalyze-cta"
      onClick={() => {
        const target = videoId
          ? `${WEBAPP_URL}/analyze?v=${encodeURIComponent(videoId)}&visual=1`
          : `${WEBAPP_URL}/analyze`;
        Browser.tabs.create({ url: target });
      }}
    >
      Réanalyser avec le visuel <ExternalLinkIcon size={12} />
    </button>
  </div>
);

// ── Sections visuelles (les 6 panneaux) ──────────────────────────────────

const VisualSections: React.FC<{ visual: VisualAnalysis }> = ({ visual }) => {
  const {
    visual_hook,
    visual_structure,
    key_moments,
    visible_text,
    visual_seo_indicators,
    summary_visual,
    model_used,
    frames_analyzed,
    frames_downsampled,
  } = visual;

  const structureLabel =
    STRUCTURE_LABELS[visual_structure] ?? visual_structure;

  const sortedMoments = [...(key_moments || [])].sort(
    (a, b) => a.timestamp_s - b.timestamp_s,
  );

  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
      data-testid="visual-panel-sections"
    >
      {/* 1 — Hook visuel */}
      <section aria-labelledby="visual-hook-title">
        <SectionTitle icon="\u{1F441}" color="#a5b4fc">
          <span id="visual-hook-title">Hook visuel</span>
        </SectionTitle>
        <Panel>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "#fff",
              margin: 0,
            }}
          >
            {visual_hook || (
              <span
                style={{
                  fontStyle: "italic",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Aucun hook détecté.
              </span>
            )}
          </p>
        </Panel>
      </section>

      {/* 2 — Structure */}
      <section aria-labelledby="visual-structure-title">
        <SectionTitle icon="\u{1F39E}" color="#c4b5fd">
          <span id="visual-structure-title">Structure</span>
        </SectionTitle>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(139, 92, 246, 0.12)",
            color: "#c4b5fd",
            border: "1px solid rgba(196, 181, 253, 0.2)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {structureLabel}
        </span>
      </section>

      {/* 3 — Moments clés */}
      <section aria-labelledby="visual-moments-title">
        <SectionTitle icon="\u{23F1}" color="#67e8f9">
          <span id="visual-moments-title">
            Moments clés{" "}
            {sortedMoments.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                ({sortedMoments.length})
              </span>
            )}
          </span>
        </SectionTitle>
        {sortedMoments.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.4)",
              margin: 0,
            }}
          >
            Aucun moment clé détecté.
          </p>
        ) : (
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {sortedMoments.map((m, idx) => {
              const typeLabel =
                MOMENT_TYPE_LABELS[(m.type || "").toLowerCase().trim()] ??
                m.type;
              return (
                <li
                  key={`${m.timestamp_s}-${idx}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 50,
                      padding: "3px 6px",
                      borderRadius: 6,
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#67e8f9",
                      background: "rgba(34, 211, 238, 0.1)",
                      border: "1px solid rgba(103, 232, 249, 0.2)",
                    }}
                    aria-label={`Timestamp ${formatTimestamp(m.timestamp_s)}`}
                  >
                    {formatTimestamp(m.timestamp_s)}
                  </span>
                  <p
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: "rgba(255,255,255,0.85)",
                      margin: 0,
                    }}
                  >
                    {m.description}
                  </p>
                  {m.type && (
                    <span
                      style={{
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.5)",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {typeLabel}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 4 — Texte visible */}
      <section aria-labelledby="visual-text-title">
        <SectionTitle icon="\u{1F520}" color="#fcd34d">
          <span id="visual-text-title">Texte visible à l'écran</span>
        </SectionTitle>
        <Panel>
          {visible_text && visible_text.trim() ? (
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.85)",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {visible_text}
            </p>
          ) : (
            <p
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.4)",
                margin: 0,
              }}
            >
              Aucun texte détecté
            </p>
          )}
        </Panel>
      </section>

      {/* 5 — Indicateurs SEO */}
      <section aria-labelledby="visual-seo-title">
        <SectionTitle icon="\u{2728}" color="#6ee7b7">
          <span id="visual-seo-title">Indicateurs SEO visuels</span>
        </SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 6,
          }}
        >
          <IndicatorTile
            label="Luminosité du hook"
            valueNode={
              <QualitativeBadge
                level={visual_seo_indicators.hook_brightness}
              />
            }
          />
          <IndicatorTile
            label="Visage dans le hook"
            valueNode={
              <BooleanBadge
                value={visual_seo_indicators.face_visible_in_hook}
              />
            }
          />
          <IndicatorTile
            label="Sous-titres incrustés"
            valueNode={
              <BooleanBadge
                value={visual_seo_indicators.burned_in_subtitles}
              />
            }
          />
          <IndicatorTile
            label="Intro à fort mouvement"
            valueNode={
              <BooleanBadge value={visual_seo_indicators.high_motion_intro} />
            }
          />
          <IndicatorTile
            label="Qualité miniature (proxy)"
            valueNode={
              <QualitativeBadge
                level={visual_seo_indicators.thumbnail_quality_proxy}
              />
            }
          />
        </div>
      </section>

      {/* 6 — Résumé visuel */}
      <section aria-labelledby="visual-summary-title">
        <SectionTitle icon="\u{2139}" color="#93c5fd">
          <span id="visual-summary-title">Résumé visuel</span>
        </SectionTitle>
        <Panel>
          {summary_visual ? (
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.85)",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {summary_visual}
            </p>
          ) : (
            <p
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.4)",
                margin: 0,
              }}
            >
              Aucun résumé visuel généré.
            </p>
          )}
        </Panel>
      </section>

      {/* Footer metadata (discret) */}
      {(model_used || typeof frames_analyzed === "number") && (
        <footer
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: 12,
          }}
        >
          {model_used && (
            <span>
              Modèle :{" "}
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {model_used}
              </span>
            </span>
          )}
          {typeof frames_analyzed === "number" && (
            <span>
              Frames :{" "}
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {frames_analyzed}
              </span>
            </span>
          )}
          {frames_downsampled && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 3,
                background: "rgba(245, 158, 11, 0.1)",
                color: "#fcd34d",
                border: "1px solid rgba(252, 211, 77, 0.2)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Échantillonné
            </span>
          )}
        </footer>
      )}
    </div>
  );
};
