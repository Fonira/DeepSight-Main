/**
 * SharedAnalysisPage — Public page for viewing shared analyses
 * Route: /s/:shareToken
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { shareApi, SharedAnalysisResponse } from "../services/api";

const CATEGORY_ICONS: Record<string, string> = {
  tech: "\u{1F4BB}", science: "\u{1F52C}", education: "\u{1F4DA}",
  news: "\u{1F4F0}", entertainment: "\u{1F3AC}", gaming: "\u{1F3AE}",
  music: "\u{1F3B5}", sports: "\u26BD", business: "\u{1F4BC}",
  lifestyle: "\u{1F31F}", other: "\u{1F4CB}",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function formatContent(content: string): string {
  if (!content) return "";
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-text-primary mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-text-primary mt-8 mb-3">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-text-secondary">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-text-secondary mb-3">')
    .replace(/\n/g, "<br/>");
}

export default function SharedAnalysisPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<SharedAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;

    shareApi.getSharedAnalysis(shareToken)
      .then(setData)
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-[#4ecdc4] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#8b949e]">Loading analysis...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold text-[#e6edf3] mb-2">
            Analysis not found
          </h1>
          <p className="text-[#8b949e] mb-6">
            This shared analysis link is invalid or has been removed.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-[#4ecdc4] text-[#0d1117] font-semibold rounded-lg hover:bg-[#45b7b0] transition-colors"
          >
            Go to DeepSight
          </Link>
        </div>
      </div>
    );
  }

  const analysis = data.analysis;
  const score = analysis.reliability_score ?? 0;
  const categoryIcon = CATEGORY_ICONS[analysis.category?.toLowerCase() || "other"] || "\u{1F4CB}";
  const tags = analysis.tags ? analysis.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  const youtubeUrl = analysis.video_url || `https://www.youtube.com/watch?v=${data.video_id}`;

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-[#21262d] bg-[#0d1117]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold text-[#e6edf3] group-hover:text-[#4ecdc4] transition-colors">
              DeepSight
            </span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-[#8b949e]">
            <span>{data.view_count} views</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Video thumbnail + title */}
        <div className="mb-8">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative rounded-xl overflow-hidden group mb-4"
          >
            {analysis.thumbnail_url && (
              <img
                src={analysis.thumbnail_url}
                alt={data.video_title || "Video thumbnail"}
                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </a>

          <h1 className="text-2xl font-bold text-[#e6edf3] mb-2">
            {data.video_title}
          </h1>

          {analysis.video_channel && (
            <p className="text-[#8b949e] mb-4">{analysis.video_channel}</p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-[#21262d] text-[#e6edf3] rounded-full text-sm">
              {categoryIcon} {analysis.category}
            </span>
            <span className={`px-3 py-1 bg-[#21262d] rounded-full text-sm ${getScoreColor(score)}`}>
              {score >= 80 ? "\u{1F7E2}" : score >= 60 ? "\u{1F7E1}" : "\u{1F534}"} Reliability: {score}%
            </span>
            {analysis.mode && (
              <span className="px-3 py-1 bg-[#21262d] text-[#8b949e] rounded-full text-sm">
                {analysis.mode}
              </span>
            )}
          </div>
        </div>

        {/* Verdict */}
        {data.verdict && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-[#4ecdc4] uppercase tracking-wider mb-2">Verdict</h2>
            <p className="text-[#e6edf3] text-lg leading-relaxed">{data.verdict}</p>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-[#4ecdc4]/10 text-[#4ecdc4] rounded-full text-sm border border-[#4ecdc4]/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Full analysis */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-[#8b949e] uppercase tracking-wider mb-4">Full Analysis</h2>
          <div
            className="prose prose-invert max-w-none text-[#c9d1d9] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatContent(analysis.summary_content || "") }}
          />
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#4ecdc4]/10 to-[#3b82f6]/10 border border-[#4ecdc4]/20 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-[#e6edf3] mb-2">
            Analyze your own videos
          </h2>
          <p className="text-[#8b949e] mb-6 max-w-md mx-auto">
            Get AI-powered summaries, fact-checking, and study tools for any YouTube video.
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 bg-[#4ecdc4] text-[#0d1117] font-semibold rounded-lg hover:bg-[#45b7b0] transition-colors text-lg"
          >
            Try DeepSight for free
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#21262d] mt-16 py-8 text-center text-[#8b949e] text-sm">
        <p>Powered by <a href="https://www.deepsightsynthesis.com" className="text-[#4ecdc4] hover:underline">DeepSight</a></p>
      </footer>
    </div>
  );
}
