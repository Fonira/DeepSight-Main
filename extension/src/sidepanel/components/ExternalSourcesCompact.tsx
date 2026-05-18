/**
 * DEEP SIGHT — ExternalSourcesCompact (Extension sidepanel)
 *
 * Affichage compact des pages externes citées dans la description de la
 * vidéo (chips horizontales avec le host extrait, max 3 visibles, CTA web
 * si plus de 3).
 *
 * Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §9.4
 *
 * Insertion : `MainView.tsx`, dans le bloc `analysis.phase === "complete"`,
 * APRÈS `<CommunityTakeCompact />`.
 *
 * Plan gating extension :
 *  - free   → CTA discret (cohérent avec CommunityTakeCompact ; pas de spoil)
 *  - pro    → chips + CTA web
 *  - expert → idem pro
 *
 * Différence vs web/mobile : on filtre `status === "ok"` pour ne montrer
 * que les pages effectivement résumées (pas les paywall / non_html /
 * timeout / etc.). L'extension reste compacte — la consultation des
 * mini-résumés se fait sur l'app web.
 */

import React from "react";
import type {
  ExternalPagesData,
  ExternalPageCitation,
} from "../../types";
import { useTranslation } from "../../i18n/useTranslation";
import { WEBAPP_URL } from "../../utils/config";
import Browser from "../../utils/browser-polyfill";

interface Props {
  data: ExternalPagesData | null | undefined;
  summaryId: number;
  userPlanId: string;
}

/** Extrait le host d'une URL (sans `www.`). Retourne null si parsing KO. */
function safeHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const ExternalSourcesCompact: React.FC<Props> = ({
  data,
  summaryId,
  userPlanId,
}) => {
  const { t } = useTranslation();

  // Free → CTA discret (pas de spoiler des sources).
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
          border: "1px solid rgba(99, 102, 241, 0.3)",
          padding: "10px 12px",
        }}
        data-testid="external-sources-compact-free"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ fontSize: 14 }}>
            🔗
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.95 }}>
              {t.externalSources.upgradeRequired}{" "}
              <span aria-hidden style={{ opacity: 0.6 }}>
                🔒
              </span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
              {t.externalSources.upgradeDescription}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
            {t.externalSources.upgradeCta} →
          </span>
        </div>
      </button>
    );
  }

  // Pas encore généré ou aucune page → silent.
  if (!data || data.pages.length === 0) return null;

  const okPages: ExternalPageCitation[] = data.pages.filter(
    (p) => p.status === "ok",
  );
  // Aucune page "ok" → on n'affiche rien (les paywall/errors restent
  // visibles en version full sur l'app web).
  if (okPages.length === 0) return null;

  const visible = okPages.slice(0, 3);
  const hasMore = data.pages.length > 3;

  // Pluriel/singulier sur la base des chips visibles.
  const label =
    visible.length === 1
      ? t.externalSources.labelSingular
      : t.externalSources.label;

  return (
    <div
      className="v3-card"
      data-testid="external-sources-compact"
      style={{
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          fontSize: 12,
        }}
      >
        <span aria-hidden style={{ fontSize: 13 }}>
          🔗
        </span>
        <span style={{ fontWeight: 600, opacity: 0.95 }}>
          {visible.length} {label}
          {hasMore ? ` (+${data.pages.length - visible.length})` : ""}:
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            alignItems: "center",
          }}
        >
          {visible.map((p) => {
            const host = safeHost(p.final_url || p.url);
            if (!host) return null;
            return (
              <a
                key={p.final_url || p.url}
                href={p.final_url || p.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                title={p.title || host}
                aria-label={t.externalSources.openExternalAriaLabel.replace(
                  "{host}",
                  host,
                )}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 10,
                  border: "1px solid rgba(99, 102, 241, 0.35)",
                  background: "rgba(99, 102, 241, 0.08)",
                  color: "rgba(165, 180, 252, 0.95)",
                  textDecoration: "none",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                data-testid="external-sources-compact-chip"
              >
                {host}
              </a>
            );
          })}
        </div>
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() =>
            Browser.tabs.create({
              url: `${WEBAPP_URL}/hub/analysis/${summaryId}`,
            })
          }
          style={{
            alignSelf: "flex-start",
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(165, 180, 252, 0.95)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textDecoration: "underline",
          }}
          data-testid="external-sources-compact-open-web"
        >
          {t.externalSources.viewAllOnWeb} →
        </button>
      )}
    </div>
  );
};

export default ExternalSourcesCompact;
