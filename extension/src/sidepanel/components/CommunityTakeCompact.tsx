/**
 * DEEP SIGHT — CommunityTakeCompact (Extension sidepanel)
 *
 * Affichage compact 1-ligne expandable du verdict communauté.
 * Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md §7.3
 *
 * Insertion : `MainView.tsx`, dans le bloc `analysis.phase === "complete"`,
 * APRÈS `<SynthesisView />` et AVANT les cartes d'upgrade.
 *
 * Plan gating extension :
 *  - free   → message discret + CTA web
 *  - pro    → 1-ligne signal + expandable summary + CTA "lire complet"
 *  - expert → idem pro (extension reste compacte ; analyse complète sur web)
 *
 * Pas de tests visuels lourds : l'extension privilégie la conversion vers
 * le web pour la consultation détaillée.
 */

import React, { useState } from "react";
import type { CommunityTake } from "../../types";
import { useTranslation } from "../../i18n/useTranslation";
import { WEBAPP_URL } from "../../utils/config";
import Browser from "../../utils/browser-polyfill";

interface Props {
  take: CommunityTake | null | undefined;
  summaryId: number;
  userPlanId: string;
}

const SIGNAL_EMOJI: Record<CommunityTake["agreement_signal"], string> = {
  agree: "👍",
  disagree: "👎",
  mixed: "⚖️",
  unclear: "❓",
};

export const CommunityTakeCompact: React.FC<Props> = ({
  take,
  summaryId,
  userPlanId,
}) => {
  const { t, language } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Free → CTA discret (pas de spoiler du verdict).
  if (userPlanId === "free") {
    return (
      <button
        type="button"
        className="v3-card"
        onClick={() =>
          Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` })
        }
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          background: "none",
          border: "1px solid rgba(155, 107, 74, 0.3)",
          padding: "10px 12px",
        }}
        data-testid="community-take-compact-free"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ fontSize: 14 }}>
            👥
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.95 }}>
              {t.community.verdictLabel}{" "}
              <span aria-hidden style={{ opacity: 0.6 }}>
                🔒
              </span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
              {t.community.upgradeDescription}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
            {t.community.upgradeCta} →
          </span>
        </div>
      </button>
    );
  }

  // Pas encore généré ou pas applicable → silent.
  if (!take) return null;

  // Disabled ou trop peu de données → carte légère informative.
  if (take.disabled || take.insufficient_data) {
    return (
      <div
        className="v3-card"
        style={{
          padding: "8px 12px",
          fontSize: 11,
          opacity: 0.7,
        }}
        data-testid="community-take-compact-empty"
      >
        <span aria-hidden style={{ marginRight: 6 }}>
          👥
        </span>
        {take.disabled
          ? t.community.disabledNotice
          : t.community.insufficientData}
      </div>
    );
  }

  const emoji = SIGNAL_EMOJI[take.agreement_signal] ?? "❓";
  const signalLabel = t.community.signal[take.agreement_signal];

  return (
    <div className="v3-card" data-testid="community-take-compact">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          textAlign: "left",
          fontSize: 12,
        }}
        aria-expanded={expanded}
        data-testid="community-take-compact-toggle"
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span aria-hidden style={{ fontSize: 14 }}>
            {emoji}
          </span>
          <strong style={{ flexShrink: 0 }}>{t.community.verdictLabel}</strong>
          <span style={{ opacity: 0.75 }}>: {signalLabel}</span>
          <span style={{ opacity: 0.55, fontSize: 11, marginLeft: 4 }}>
            ({take.comments_analyzed} {t.community.commentsAnalyzed})
          </span>
        </span>
        <span aria-hidden style={{ opacity: 0.6, fontSize: 12 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: "0 10px 10px", fontSize: 12 }}>
          <p
            style={{
              margin: "0 0 8px",
              lineHeight: 1.5,
              opacity: 0.9,
            }}
          >
            {take.community_summary}
          </p>
          {take.controversies && take.controversies.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  opacity: 0.6,
                  marginBottom: 4,
                }}
              >
                ⚠️ {t.community.controversies}
              </div>
              {take.controversies.slice(0, 2).map((c, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    opacity: 0.85,
                    paddingLeft: 8,
                    borderLeft: "2px solid rgba(245, 158, 11, 0.4)",
                    marginBottom: 3,
                    lineHeight: 1.4,
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              Browser.tabs.create({
                url: `${WEBAPP_URL}/hub/analysis/${summaryId}`,
              })
            }
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(155, 107, 74, 0.95)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
            }}
            data-testid="community-take-compact-open-web"
          >
            {language === "fr"
              ? "Lire l'analyse complète sur l'app"
              : "Read the full analysis in the app"}{" "}
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default CommunityTakeCompact;
