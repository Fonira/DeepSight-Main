/**
 * MakePublicToggle — Toggle « Rendre publique » par analyse (Phase 3 sprint
 * Export to AI + GEO).
 *
 * Quand l'utilisateur active le toggle :
 *   1. PATCH /api/v1/summaries/{id}/visibility {is_public: true}
 *   2. Le backend retourne `slug` + `permalink` déterministes (a{hex(id)})
 *   3. Le permalink est copié automatiquement dans le presse-papier
 *   4. Toast de confirmation "Lien copié"
 *
 * Quand le toggle est désactivé : revient privé, future visites de /a/{slug}
 * → 404 (anti-leak).
 *
 * Spec : Vault/01-Projects/DeepSight/Specs/2026-05-07-deepsight-export-to-ai-geo-design.md
 */

import { useState, useCallback } from "react";
import { Globe, Lock, Check, Copy as CopyIcon } from "lucide-react";
import { publicAnalysisApi } from "../../services/api";

export interface MakePublicToggleProps {
  /** ID numérique du summary (PK BDD). */
  summaryId: number;
  /** État initial — passé par le parent depuis l'analyse en cache. */
  initialIsPublic?: boolean;
  /**
   * Slug initial pré-calculé (a{hex(id)}). Optionnel — sinon le composant
   * reçoit le slug du backend après le premier toggle ON.
   */
  initialSlug?: string;
  /** Callback de succès : permet au parent de sync son state. */
  onChange?: (state: { isPublic: boolean; slug: string; permalink: string }) => void;
  language?: "fr" | "en";
  /** Si true, affiche en mode compact (juste le toggle, pas le bloc explicatif). */
  compact?: boolean;
  /** Si true, affiche un toast en cas d'erreur (sinon silence). */
  showErrors?: boolean;
}

const T = {
  fr: {
    title: "Rendre publique",
    description: "Obtenez un lien partageable indexable par les IA.",
    descriptionPublic: "Cette analyse est publique. N'importe qui peut la voir.",
    on: "Public",
    off: "Privée",
    copy: "Copier le lien",
    copied: "Lien copié !",
    error: "Erreur de sauvegarde",
  },
  en: {
    title: "Make public",
    description: "Get a shareable link indexable by AI assistants.",
    descriptionPublic: "This analysis is public. Anyone can view it.",
    on: "Public",
    off: "Private",
    copy: "Copy link",
    copied: "Link copied!",
    error: "Save failed",
  },
} as const;

export const MakePublicToggle: React.FC<MakePublicToggleProps> = ({
  summaryId,
  initialIsPublic = false,
  initialSlug,
  onChange,
  language = "fr",
  compact = false,
  showErrors = true,
}) => {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const t = T[language];

  const permalink = slug ? publicAnalysisApi.buildPermalink(slug) : "";

  const handleToggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const next = !isPublic;
    try {
      const res = await publicAnalysisApi.setVisibility(summaryId, next);
      setIsPublic(res.is_public);
      setSlug(res.slug);
      onChange?.({
        isPublic: res.is_public,
        slug: res.slug,
        permalink: res.permalink,
      });
      // Auto-copy le lien quand on passe à public.
      if (res.is_public && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(res.permalink);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          // ignore clipboard failures
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t.error;
      if (showErrors) setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isPublic, loading, summaryId, onChange, showErrors, t.error]);

  const handleCopy = useCallback(async () => {
    if (!permalink) return;
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  }, [permalink]);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label={t.title}
          aria-busy={loading}
          disabled={loading}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isPublic ? "bg-emerald-500" : "bg-white/10"
          } ${loading ? "opacity-50 cursor-wait" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isPublic ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm text-text-secondary">
          {isPublic ? t.on : t.off}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="flex items-center gap-2 font-semibold text-text-primary">
            {isPublic ? (
              <Globe className="w-4 h-4 text-emerald-400" />
            ) : (
              <Lock className="w-4 h-4 text-text-muted" />
            )}
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {isPublic ? t.descriptionPublic : t.description}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label={t.title}
          aria-busy={loading}
          disabled={loading}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            isPublic ? "bg-emerald-500" : "bg-white/10"
          } ${loading ? "opacity-50 cursor-wait" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isPublic ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Permalink display + copy button */}
      {isPublic && permalink && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-bg-primary/50 px-3 py-2 text-xs">
          <code
            className="flex-1 truncate text-text-secondary"
            title={permalink}
          >
            {permalink}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={t.copy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-muted hover:bg-white/5 hover:text-text-primary transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">{t.copied}</span>
              </>
            ) : (
              <>
                <CopyIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.copy}</span>
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default MakePublicToggle;
