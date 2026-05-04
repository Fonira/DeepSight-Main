/**
 * SharedAnalysisPage — Public page for viewing shared analyses
 * Route: /s/:shareToken
 * Standalone layout (no sidebar/nav from main app).
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Eye } from "lucide-react";
import { shareApi, SharedAnalysisResponse } from "../services/api";
import { sanitizeTitle } from "../utils/sanitize";
import { DeepSightSpinner } from "../components/ui/DeepSightSpinner";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import DoodleBackground from "../components/DoodleBackground";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "";
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}

function formatDurationISO(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let out = "PT";
  if (h > 0) out += `${h}H`;
  if (m > 0) out += `${m}M`;
  if (s > 0) out += `${s}S`;
  return out === "PT" ? "PT0S" : out;
}

function formatContent(content: string): string {
  if (!content) return "";
  return content
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="text-text-primary font-semibold">$1</strong>',
    )
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-lg font-bold text-text-primary mt-6 mb-2">$1</h3>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-xl font-bold text-accent-primary mt-8 mb-3">$1</h2>',
    )
    .replace(
      /^- (.+)$/gm,
      '<li class="ml-4 text-text-secondary leading-relaxed">$1</li>',
    )
    .replace(
      /\n\n/g,
      '</p><p class="text-text-secondary mb-3 leading-relaxed">',
    )
    .replace(/\n/g, "<br/>");
}

function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SharedAnalysisPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<SharedAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    shareApi
      .getSharedAnalysis(shareToken)
      .then(setData)
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [shareToken]);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <DeepSightSpinner size="lg" />
          <span className="text-text-muted text-sm">
            Chargement de l'analyse...
          </span>
        </div>
      </div>
    );
  }

  // ─── Error / Not Found ───────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4 text-text-muted">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Analyse non disponible
          </h1>
          <p className="text-text-muted mb-6">
            Ce lien de partage est invalide, a expiré ou a été désactivé.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-accent-primary text-gray-900 font-semibold rounded-lg hover:bg-accent-primary-hover transition-colors"
          >
            Découvrir DeepSight
          </Link>
        </div>
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  const analysis = data.analysis;
  const videoId = analysis.video_id || extractVideoId(analysis.video_url || "");
  const thumbnailUrl =
    analysis.video_thumbnail ||
    analysis.thumbnail_url ||
    data.video_thumbnail ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "");
  const youtubeUrl =
    analysis.video_url ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
  const rawTags = analysis.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => String(t).trim()).filter(Boolean)
    : typeof rawTags === "string" && rawTags
      ? rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  const summaryContent =
    analysis.synthesis_markdown || analysis.summary_content || "";
  const channel = analysis.channel || analysis.video_channel || "";
  const duration = analysis.duration_seconds || analysis.video_duration;
  const createdAt = data.created_at || analysis.created_at;
  const description = (data.verdict || summaryContent || "").slice(0, 160);
  const shareUrl = `https://deepsightsynthesis.com/s/${shareToken}`;

  return (
    <div className="min-h-screen bg-bg-primary">
      <DoodleBackground variant="video" />
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{`Analyse DeepSight : ${data.video_title}`}</title>
        <link rel="canonical" href={shareUrl} />
        <meta name="description" content={description} />
        <meta property="og:type" content="article" />
        <meta
          property="og:title"
          content={`Analyse DeepSight : ${data.video_title}`}
        />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={thumbnailUrl} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:site_name" content="DeepSight" />
        <meta property="og:locale" content="fr_FR" />
        {createdAt && (
          <meta
            property="article:published_time"
            content={new Date(createdAt).toISOString()}
          />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={`Analyse DeepSight : ${data.video_title}`}
        />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={thumbnailUrl} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `Analyse DeepSight : ${data.video_title}`,
            description,
            image: thumbnailUrl,
            url: shareUrl,
            ...(createdAt && {
              datePublished: new Date(createdAt).toISOString(),
            }),
            author: {
              "@type": "Organization",
              name: "DeepSight",
              url: "https://www.deepsightsynthesis.com",
            },
            publisher: {
              "@type": "Organization",
              name: "DeepSight",
              logo: {
                "@type": "ImageObject",
                url: "https://www.deepsightsynthesis.com/icons/icon-512x512.png",
              },
            },
            ...(channel && { about: channel }),
            isAccessibleForFree: true,
            inLanguage: "fr",
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: data.video_title,
            description,
            ...(thumbnailUrl && { thumbnailUrl }),
            ...(youtubeUrl && { contentUrl: youtubeUrl }),
            ...(videoId &&
              (analysis.video_url || "").includes("youtu") && {
                embedUrl: `https://www.youtube.com/embed/${videoId}`,
              }),
            ...(duration && { duration: formatDurationISO(duration) }),
            ...(createdAt && {
              uploadDate: new Date(createdAt).toISOString(),
            }),
            ...(channel && {
              creator: { "@type": "Person", name: channel },
            }),
            publisher: {
              "@type": "Organization",
              name: "DeepSight",
              logo: {
                "@type": "ImageObject",
                url: "https://www.deepsightsynthesis.com/icons/icon-512x512.png",
              },
            },
            isFamilyFriendly: true,
            isAccessibleForFree: true,
            inLanguage: "fr",
          })}
        </script>
      </Helmet>
      <BreadcrumbJsonLd path={`/s/${shareToken}`} label={data.video_title} />

      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="group">
            <span className="text-xl font-bold text-accent-primary group-hover:opacity-80 transition-opacity">
              DeepSight
            </span>
          </Link>
          {data.view_count > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-text-muted">
              <Eye className="w-4 h-4" />
              {data.view_count} {data.view_count === 1 ? "vue" : "vues"}
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Hero: Thumbnail */}
        {thumbnailUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative rounded-xl overflow-hidden group mb-6 shadow-lg"
          >
            <img
              src={thumbnailUrl}
              alt={data.video_title || "Video thumbnail"}
              className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <svg
                  className="w-7 h-7 text-white ml-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </a>
        )}

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2 leading-tight">
          {sanitizeTitle(data.video_title)}
        </h1>

        {/* Subtitle metadata */}
        <p className="text-text-muted text-sm sm:text-base mb-6">
          {[
            sanitizeTitle(channel),
            formatDate(createdAt),
            formatDuration(duration),
            analysis.mode ? `Mode ${analysis.mode}` : null,
          ]
            .filter(Boolean)
            .join(" \u2022 ")}
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-accent-primary/10 text-accent-primary rounded-full text-xs font-medium border border-accent-primary/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Verdict */}
        {data.verdict && (
          <div className="bg-bg-surface border border-border-default rounded-xl p-5 mb-6">
            <h2 className="text-xs font-semibold text-accent-primary uppercase tracking-wider mb-2">
              Verdict
            </h2>
            <p className="text-text-primary text-base leading-relaxed">
              {data.verdict}
            </p>
          </div>
        )}

        {/* Full analysis content */}
        <div className="bg-bg-surface border border-border-default rounded-xl p-5 sm:p-6 mb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Analyse complète
          </h2>
          <div
            className="prose prose-invert max-w-none text-text-secondary leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: formatContent(summaryContent),
            }}
          />
        </div>

        {/* CTA Block — Viral primary CTA with UTM tracking */}
        {videoId && (
          <section className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-8 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">
              Analyse cette vidéo à ta façon
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-text-secondary">
              DeepSight a généré cette synthèse en quelques secondes.
              Connecte-toi pour l'analyser avec tes propres paramètres (modes,
              profondeur, fact-check, flashcards, chat, exports…).
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href={`/analyze?video_id=${encodeURIComponent(videoId)}&utm_source=share&utm_medium=cta_primary&utm_campaign=viral`}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
              >
                Analyser cette vidéo
              </a>
              <a
                href="/register?utm_source=share&utm_medium=cta_secondary"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-text-secondary transition hover:bg-white/5"
              >
                Créer un compte gratuit
              </a>
            </div>
            <p className="mt-5 text-xs text-text-muted">
              🇫🇷🇪🇺 IA française · Propulsé par Mistral AI · Vos données restent
              en Europe
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-6 text-center text-text-muted text-xs">
        <p>
          &copy; {new Date().getFullYear()} DeepSight &mdash;
          deepsightsynthesis.com
        </p>
      </footer>
    </div>
  );
}
