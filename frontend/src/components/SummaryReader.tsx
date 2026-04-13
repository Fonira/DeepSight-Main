/**
 * 📖 SUMMARY READER v1.0 — Optimized Reading Experience
 * ═══════════════════════════════════════════════════════════════════════════════
 * Affichage optimisé pour la lecture des résumés
 * Typographie soignée, chapitres cliquables, design épuré
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Clock,
  Tag,
  ChevronDown,
  ChevronRight,
  Play,
  Lightbulb,
  Users,
  Building2,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Globe,
} from "lucide-react";
import { EnrichedMarkdown } from "./EnrichedMarkdown";
import { ThumbnailImage } from "./ThumbnailImage";
import { sanitizeTitle } from "../utils/sanitize";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Chapter {
  timestamp: string;
  seconds: number;
  title: string;
}

interface Insight {
  text: string;
  type: "key" | "takeaway" | "trend";
}

interface SummaryReaderProps {
  summary: {
    id: number;
    video_id: string;
    video_title: string;
    video_channel: string;
    video_duration: number;
    video_url: string;
    thumbnail_url: string;
    category: string;
    mode: string;
    summary_content: string;
    word_count: number;
    reliability_score?: number;
    entities?: Record<string, string[]>;
    created_at: string;
    // 🔬 Deep Research
    deep_research?: boolean;
    enrichment_sources?: string; // JSON string
  };
  language?: "fr" | "en";
  onTimestampClick?: (seconds: number) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILS
// ═══════════════════════════════════════════════════════════════════════════════

const parseTimestamp = (ts: string): number => {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

const formatReadingTime = (wordCount: number): string => {
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min`;
};

const getCategoryInfo = (cat: string) => {
  const categories: Record<string, { emoji: string; color: string }> = {
    tech: { emoji: "💻", color: "#00ffff" },
    science: { emoji: "🔬", color: "#8b5cf6" },
    education: { emoji: "📚", color: "#10b981" },
    finance: { emoji: "💰", color: "#f59e0b" },
    gaming: { emoji: "🎮", color: "#ec4899" },
    culture: { emoji: "🎨", color: "#f97316" },
    news: { emoji: "📰", color: "#ef4444" },
    health: { emoji: "🏥", color: "#22c55e" },
    sport: { emoji: "⚽", color: "#3b82f6" },
    crypto: { emoji: "₿", color: "#f59e0b" },
    interview_podcast: { emoji: "🎙️", color: "#8b5cf6" },
    general: { emoji: "📄", color: "#6b7280" },
  };
  return categories[cat] || categories.general;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const SummaryReader: React.FC<SummaryReaderProps> = ({
  summary,
  language = "fr",
  onTimestampClick,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["summary"]),
  );
  const [copied, setCopied] = useState(false);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Parse chapters from summary content
  const chapters = useMemo((): Chapter[] => {
    if (!summary.summary_content) return [];
    const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+?)(?=\n|$)/g;
    const result: Chapter[] = [];
    let match;
    while ((match = regex.exec(summary.summary_content)) !== null) {
      result.push({
        timestamp: match[1],
        seconds: parseTimestamp(match[1]),
        title: match[2].trim(),
      });
    }
    return result;
  }, [summary.summary_content]);

  // Parse insights/key points
  const insights = useMemo((): Insight[] => {
    if (!summary.summary_content) return [];
    const lines = summary.summary_content.split("\n");
    const result: Insight[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("•") ||
        trimmed.startsWith("-") ||
        trimmed.startsWith("*")
      ) {
        const text = trimmed.slice(1).trim();
        if (text.length > 20 && text.length < 200) {
          result.push({ text, type: "key" });
        }
      }
    });

    return result.slice(0, 5);
  }, [summary.summary_content]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(summary.summary_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openVideo = (seconds?: number) => {
    const url = seconds
      ? `https://youtube.com/watch?v=${summary.video_id}&t=${seconds}`
      : `https://youtube.com/watch?v=${summary.video_id}`;
    window.open(url, "_blank");
  };

  const handleTimestampClick = (seconds: number) => {
    if (onTimestampClick) {
      onTimestampClick(seconds);
    } else {
      openVideo(seconds);
    }
  };

  const categoryInfo = getCategoryInfo(summary.category);

  const t = {
    fr: {
      summary: "Synthèse",
      chapters: "Chapitres",
      insights: "Points clés",
      entities: "Entités",
      readingTime: "Temps de lecture",
      videoDuration: "Durée vidéo",
      reliability: "Fiabilité",
      watchVideo: "Voir la vidéo",
      copy: "Copier",
      copied: "Copié !",
      persons: "Personnes",
      concepts: "Concepts",
      organizations: "Organisations",
    },
    en: {
      summary: "Summary",
      chapters: "Chapters",
      insights: "Key Insights",
      entities: "Entities",
      readingTime: "Reading time",
      videoDuration: "Video duration",
      reliability: "Reliability",
      watchVideo: "Watch video",
      copy: "Copy",
      copied: "Copied!",
      persons: "People",
      concepts: "Concepts",
      organizations: "Organizations",
    },
  }[language];

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(13, 59, 68, 0.6) 0%, rgba(10, 26, 31, 0.8) 100%)",
          border: "1px solid rgba(212, 168, 83, 0.2)",
        }}
      >
        {/* Thumbnail with overlay */}
        <div className="relative aspect-video sm:aspect-[21/9]">
          <ThumbnailImage
            thumbnailUrl={summary.thumbnail_url}
            videoId={summary.video_id}
            title={summary.video_title}
            category={summary.category}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(10, 26, 31, 0.95) 0%, rgba(10, 26, 31, 0.3) 50%, transparent 100%)",
            }}
          />

          {/* Play button */}
          <button
            onClick={() => openVideo()}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
              style={{
                background: "rgba(212, 168, 83, 0.9)",
                boxShadow: "0 4px 20px rgba(212, 168, 83, 0.4)",
              }}
            >
              <Play
                className="w-7 h-7 text-[#0a1a1f] ml-1"
                fill="currentColor"
              />
            </div>
          </button>

          {/* Video info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-start gap-3 mb-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                style={{
                  background: `${categoryInfo.color}20`,
                  color: categoryInfo.color,
                  border: `1px solid ${categoryInfo.color}40`,
                }}
              >
                {categoryInfo.emoji} {summary.category}
              </span>

              {summary.reliability_score !== undefined && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
                  style={{
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#10b981",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <Shield className="w-3 h-3" />
                  {summary.reliability_score}/10
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#e8dcc4] mb-2 line-clamp-2">
              {sanitizeTitle(summary.video_title)}
            </h1>

            <p className="text-[#e8dcc4]/60 text-sm mb-4">
              {sanitizeTitle(summary.video_channel)}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#e8dcc4]/50">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t.videoDuration}: {formatDuration(summary.video_duration)}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {t.readingTime}: {formatReadingTime(summary.word_count)}
              </span>
              <span className="flex items-center gap-1">
                {summary.word_count} mots
              </span>
            </div>
          </div>
        </div>

        {/* Actions bar */}
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{
            background: "rgba(13, 42, 48, 0.5)",
            borderTop: "1px solid rgba(212, 168, 83, 0.1)",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => openVideo()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: "linear-gradient(135deg, #d4a853 0%, #b8923f 100%)",
                color: "#0a1a1f",
              }}
            >
              <ExternalLink className="w-4 h-4" />
              {t.watchVideo}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#e8dcc4]/70 hover:text-[#e8dcc4] hover:bg-white/5 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? t.copied : t.copy}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* CHAPTERS */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {chapters.length > 0 && (
        <Section
          id="chapters"
          title={t.chapters}
          icon={<Clock className="w-4 h-4" />}
          isExpanded={expandedSections.has("chapters")}
          onToggle={() => toggleSection("chapters")}
          badge={chapters.length}
        >
          <div className="grid gap-2">
            {chapters.map((chapter, i) => (
              <button
                key={i}
                onClick={() => handleTimestampClick(chapter.seconds)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group"
                style={{
                  background: "rgba(0, 255, 255, 0.03)",
                  border: "1px solid rgba(0, 255, 255, 0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0, 255, 255, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(0, 255, 255, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0, 255, 255, 0.03)";
                  e.currentTarget.style.borderColor = "rgba(0, 255, 255, 0.1)";
                }}
              >
                <span
                  className="flex-shrink-0 px-2 py-1 rounded-md text-xs font-mono font-bold"
                  style={{
                    background: "rgba(0, 255, 255, 0.1)",
                    color: "#00ffff",
                  }}
                >
                  {chapter.timestamp}
                </span>
                <span className="text-sm text-[#e8dcc4] group-hover:text-[#00ffff] transition-colors">
                  {chapter.title}
                </span>
                <Play className="w-4 h-4 text-[#00ffff] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SUMMARY CONTENT */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Section
        id="summary"
        title={t.summary}
        icon={<BookOpen className="w-4 h-4" />}
        isExpanded={expandedSections.has("summary")}
        onToggle={() => toggleSection("summary")}
      >
        <div
          className="prose prose-lg max-w-none"
          style={
            {
              "--tw-prose-body": "#e8dcc4",
              "--tw-prose-headings": "#d4a853",
              "--tw-prose-links": "#00ffff",
              "--tw-prose-bold": "#e8dcc4",
              "--tw-prose-bullets": "#d4a853",
              "--tw-prose-quotes": "#e8dcc4",
              "--tw-prose-quote-borders": "#d4a853",
            } as React.CSSProperties
          }
        >
          <div className="text-[#e8dcc4] leading-relaxed space-y-4">
            <EnrichedMarkdown
              language={language}
              onTimecodeClick={onTimestampClick}
              className="prose prose-lg max-w-none
                prose-headings:text-[#d4a853] prose-headings:font-bold
                prose-h1:text-xl prose-h1:mt-6 prose-h1:mb-3 prose-h1:pb-2 prose-h1:border-b prose-h1:border-[#d4a853]/20
                prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2
                prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-[#d4a853]/90
                prose-p:text-[#e8dcc4]/90 prose-p:leading-7 prose-p:my-3
                prose-ul:space-y-2 prose-ul:my-4 prose-ul:ml-4
                prose-li:text-[#e8dcc4]/85
                prose-strong:font-bold prose-strong:text-[#e8dcc4]
                prose-blockquote:pl-4 prose-blockquote:my-4 prose-blockquote:italic prose-blockquote:text-[#e8dcc4]/70 prose-blockquote:border-l-[3px] prose-blockquote:border-[#d4a853]
                prose-a:text-[#00ffff] hover:prose-a:underline"
            >
              {summary.summary_content}
            </EnrichedMarkdown>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* KEY INSIGHTS */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {insights.length > 0 && (
        <Section
          id="insights"
          title={t.insights}
          icon={<Lightbulb className="w-4 h-4" />}
          isExpanded={expandedSections.has("insights")}
          onToggle={() => toggleSection("insights")}
          badge={insights.length}
        >
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(212, 168, 83, 0.05)",
                  border: "1px solid rgba(212, 168, 83, 0.15)",
                }}
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#d4a853]/20 flex items-center justify-center text-xs font-bold text-[#d4a853]">
                  {i + 1}
                </span>
                <p className="text-sm text-[#e8dcc4]/90 leading-relaxed">
                  {insight.text}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* ENTITIES */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {summary.entities && Object.keys(summary.entities).length > 0 && (
        <Section
          id="entities"
          title={t.entities}
          icon={<Tag className="w-4 h-4" />}
          isExpanded={expandedSections.has("entities")}
          onToggle={() => toggleSection("entities")}
        >
          <div className="space-y-4">
            {Object.entries(summary.entities).map(([type, items]) => {
              if (!items || items.length === 0) return null;

              const typeInfo: Record<
                string,
                { icon: React.ReactNode; label: string; color: string }
              > = {
                persons: {
                  icon: <Users className="w-4 h-4" />,
                  label: t.persons,
                  color: "#8b5cf6",
                },
                personnes: {
                  icon: <Users className="w-4 h-4" />,
                  label: t.persons,
                  color: "#8b5cf6",
                },
                concepts: {
                  icon: <Lightbulb className="w-4 h-4" />,
                  label: t.concepts,
                  color: "#00ffff",
                },
                organizations: {
                  icon: <Building2 className="w-4 h-4" />,
                  label: t.organizations,
                  color: "#f59e0b",
                },
                organisations: {
                  icon: <Building2 className="w-4 h-4" />,
                  label: t.organizations,
                  color: "#f59e0b",
                },
              };

              const info = typeInfo[type.toLowerCase()] || {
                icon: <Tag className="w-4 h-4" />,
                label: type,
                color: "#6b7280",
              };

              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: info.color }}>{info.icon}</span>
                    <span className="text-sm font-medium text-[#e8dcc4]/70">
                      {info.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item: string, i: number) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{
                          background: `${info.color}15`,
                          color: info.color,
                          border: `1px solid ${info.color}30`,
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: number;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  badge,
  children,
}) => {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background:
          "linear-gradient(135deg, rgba(13, 59, 68, 0.4) 0%, rgba(10, 26, 31, 0.6) 100%)",
        border: "1px solid rgba(212, 168, 83, 0.15)",
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#d4a853]">{icon}</span>
          <span className="text-sm font-bold text-[#d4a853] uppercase tracking-wider">
            {title}
          </span>
          {badge !== undefined && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: "rgba(0, 255, 255, 0.1)",
                color: "#00ffff",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <span className="text-[#e8dcc4]/50">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div
          className="px-5 pb-5"
          style={{
            borderTop: "1px solid rgba(212, 168, 83, 0.1)",
          }}
        >
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔬 SOURCES CROISÉES — Affiché quand deep_research = true
// ═══════════════════════════════════════════════════════════════════════════════

interface EnrichmentSource {
  title: string;
  url: string;
  snippet: string;
  category?: string;
}

export const DeepResearchSources: React.FC<{
  enrichmentSources?: string;
  language?: "fr" | "en";
}> = ({ enrichmentSources, language = "fr" }) => {
  const sources: EnrichmentSource[] = useMemo(() => {
    if (!enrichmentSources) return [];
    try {
      return JSON.parse(enrichmentSources);
    } catch {
      return [];
    }
  }, [enrichmentSources]);

  if (sources.length === 0) return null;

  return (
    <div
      className="mt-6 rounded-xl overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(6, 182, 212, 0.05))",
        border: "1px solid rgba(139, 92, 246, 0.15)",
      }}
    >
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(139, 92, 246, 0.1)" }}
      >
        <Globe className="w-5 h-5 text-purple-400" />
        <span className="text-sm font-bold text-purple-300 uppercase tracking-wider">
          {language === "fr"
            ? `Sources croisées (${sources.length})`
            : `Cross-referenced Sources (${sources.length})`}
        </span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
          🔬 Deep Research
        </span>
      </div>
      <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
        {sources.map((src, i) => (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-lg transition-all hover:bg-white/5 group"
            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-start gap-2">
              <span className="text-xs text-purple-400/60 font-mono mt-0.5">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-purple-200 group-hover:text-purple-100 line-clamp-1">
                  {src.title || src.url}
                </span>
                {src.snippet && (
                  <p className="text-xs text-[#e8dcc4]/50 mt-1 line-clamp-2">
                    {src.snippet}
                  </p>
                )}
                <span className="text-[10px] text-[#e8dcc4]/30 mt-1 block truncate">
                  {src.url}
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-purple-400/40 group-hover:text-purple-400 flex-shrink-0 mt-0.5" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default SummaryReader;
