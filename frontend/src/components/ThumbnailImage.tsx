/**
 * ThumbnailImage — Unified thumbnail component
 * Handles YouTube, TikTok, text, and R2-persisted thumbnails
 */

import React, { useState } from "react";
import {
  FileText,
  Microscope,
  Cpu,
  Building2,
  TrendingUp,
  Heart,
  BookOpen,
  Palette,
  Leaf,
  GraduationCap,
  Mic,
  Music,
} from "lucide-react";

interface ThumbnailImageProps {
  thumbnailUrl?: string;
  videoId: string;
  title: string;
  category?: string;
  platform?: "youtube" | "tiktok" | "text";
  className?: string;
}

// Couleurs et icones par categorie
const categoryStyles: Record<
  string,
  { gradient: string; icon: React.ReactNode }
> = {
  science: {
    gradient: "from-blue-500 to-blue-900",
    icon: <Microscope className="w-8 h-8 text-white" />,
  },
  tech: {
    gradient: "from-purple-500 to-purple-900",
    icon: <Cpu className="w-8 h-8 text-white" />,
  },
  politics: {
    gradient: "from-red-500 to-red-900",
    icon: <Building2 className="w-8 h-8 text-white" />,
  },
  economy: {
    gradient: "from-green-500 to-green-900",
    icon: <TrendingUp className="w-8 h-8 text-white" />,
  },
  health: {
    gradient: "from-teal-500 to-teal-900",
    icon: <Heart className="w-8 h-8 text-white" />,
  },
  education: {
    gradient: "from-amber-500 to-amber-900",
    icon: <GraduationCap className="w-8 h-8 text-white" />,
  },
  culture: {
    gradient: "from-pink-500 to-pink-900",
    icon: <Palette className="w-8 h-8 text-white" />,
  },
  environment: {
    gradient: "from-emerald-500 to-emerald-900",
    icon: <Leaf className="w-8 h-8 text-white" />,
  },
  tutorial: {
    gradient: "from-sky-500 to-sky-900",
    icon: <BookOpen className="w-8 h-8 text-white" />,
  },
  interview: {
    gradient: "from-violet-500 to-violet-900",
    icon: <Mic className="w-8 h-8 text-white" />,
  },
};

const defaultStyle = {
  gradient: "from-indigo-500 to-indigo-900",
  icon: <FileText className="w-8 h-8 text-white" />,
};

/**
 * Determine si c'est un texte brut (pas une video)
 */
const isRawText = (videoId: string, platform?: string): boolean => {
  if (platform === "text") return true;
  return videoId?.startsWith("txt_") || videoId?.startsWith("text_");
};

/**
 * Determine si une URL pointe vers R2 (persistee)
 */
const isR2Url = (url?: string): boolean => {
  if (!url) return false;
  return url.includes(".r2.dev") || url.includes("r2.cloudflarestorage.com");
};

/**
 * Placeholder pour les textes bruts
 */
const TextPlaceholder: React.FC<{
  category?: string;
  title: string;
  className?: string;
}> = ({ category, className = "" }) => {
  const style = categoryStyles[category || ""] || defaultStyle;

  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${style.gradient} flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2">
        {style.icon}
      </div>
      <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
        {category || "Texte"}
      </span>
    </div>
  );
};

/**
 * Placeholder pour TikTok sans thumbnail
 */
const TikTokPlaceholder: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <div
    className={`w-full h-full bg-gradient-to-br from-pink-500/20 via-black/40 to-cyan-500/20 flex flex-col items-center justify-center ${className}`}
  >
    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-1">
      <Music className="w-6 h-6 text-white" />
    </div>
    <span className="text-white/60 text-xs font-medium">TikTok</span>
  </div>
);

/**
 * Composant principal ThumbnailImage
 */
export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  thumbnailUrl,
  videoId,
  title,
  category,
  platform,
  className = "w-full h-full object-cover",
}) => {
  const [hasError, setHasError] = useState(false);

  const effectivePlatform =
    platform || (isRawText(videoId) ? "text" : undefined);

  // Si c'est un texte brut
  if (effectivePlatform === "text" || isRawText(videoId, platform)) {
    // Si on a une thumbnail (R2 URL, base64, ou autre), l'utiliser
    if (thumbnailUrl && !hasError) {
      return (
        <img
          src={thumbnailUrl}
          alt={title}
          className={className}
          onError={() => setHasError(true)}
        />
      );
    }
    return (
      <TextPlaceholder
        category={category}
        title={title}
        className={className}
      />
    );
  }

  // TikTok
  if (effectivePlatform === "tiktok") {
    if (thumbnailUrl && !hasError) {
      return (
        <img
          src={thumbnailUrl}
          alt={title}
          className={className}
          onError={() => setHasError(true)}
        />
      );
    }
    return <TikTokPlaceholder className={className} />;
  }

  // YouTube (ou autre plateforme)
  // Si l'URL est une R2 URL, ne pas fallback vers YouTube CDN
  if (isR2Url(thumbnailUrl)) {
    if (!hasError) {
      return (
        <img
          src={thumbnailUrl}
          alt={title}
          className={className}
          onError={() => setHasError(true)}
        />
      );
    }
    // R2 failed — fallback to YouTube CDN
  }

  const youtubeThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const src = thumbnailUrl && !hasError ? thumbnailUrl : youtubeThumb;

  return (
    <img
      src={src}
      alt={title}
      className={className}
      onError={() => {
        if (!hasError) setHasError(true);
      }}
    />
  );
};

/**
 * Helper function pour utilisation dans les templates existants
 * Retourne l'URL appropriee ou null si placeholder necessaire
 */
export const getThumbnailUrl = (
  videoId: string,
  thumbnailUrl?: string,
  platform?: string,
): string | null => {
  if (thumbnailUrl) return thumbnailUrl;
  if (isRawText(videoId, platform)) return null;
  if (platform === "tiktok") return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

/**
 * Verifie si un video_id correspond a un texte brut
 */
export const isRawTextVideo = (videoId: string, platform?: string): boolean =>
  isRawText(videoId, platform);

export default ThumbnailImage;
