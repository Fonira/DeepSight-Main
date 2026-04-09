/**
 * 🎬 VIDEO PLAYER v1.1 — Multi-plateforme (YouTube + TikTok + Carousel)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Wrapper qui dispatche vers YouTubePlayer, TikTok embed iframe,
 * ou CarouselGallery pour les posts TikTok en mode photo.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { forwardRef } from "react";
import { YouTubePlayer, YouTubePlayerRef } from "./YouTubePlayer";
import { CarouselGallery } from "./CarouselGallery";
import { ExternalLink } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  videoId: string;
  platform?: 'youtube' | 'tiktok';
  contentType?: string;
  carouselImages?: string[];
  videoTitle?: string;
  initialTime?: number;
  onClose?: () => void;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 TIKTOK EMBED PLAYER
// ═══════════════════════════════════════════════════════════════════════════════

const TikTokPlayer: React.FC<{
  videoId: string;
  className?: string;
}> = ({ videoId, className = "" }) => {
  const tiktokUrl = `https://www.tiktok.com/video/${videoId}`;

  return (
    <div className={`relative w-full h-full bg-black flex items-center justify-center ${className}`}>
      {/* TikTok embed iframe */}
      <iframe
        src={`https://www.tiktok.com/embed/v2/${videoId}`}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="TikTok video player"
      />

      {/* Fallback link */}
      <a
        href={tiktokUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs flex items-center gap-1 hover:bg-black/80 transition-colors z-10"
      >
        <ExternalLink className="w-3 h-3" />
        TikTok
      </a>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 VIDEO PLAYER COMPONENT (dispatche YouTube / TikTok)
// ═══════════════════════════════════════════════════════════════════════════════

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoId, platform = 'youtube', contentType, carouselImages, videoTitle, initialTime = 0, onClose, onTimeUpdate, className = "" }, ref) => {
    // TikTok carousel (photo mode) → render gallery instead of embed
    if (platform === 'tiktok' && contentType === 'carousel' && carouselImages && carouselImages.length > 0) {
      return (
        <div className={`w-full ${className}`}>
          <CarouselGallery
            images={carouselImages}
            title={videoTitle}
          />
        </div>
      );
    }

    if (platform === 'tiktok') {
      // TikTok n'a pas de seekTo/play/pause API → pas de ref
      return (
        <TikTokPlayer
          videoId={videoId}
          className={className}
        />
      );
    }

    // YouTube player (avec ref complète)
    return (
      <YouTubePlayer
        ref={ref as React.Ref<YouTubePlayerRef>}
        videoId={videoId}
        initialTime={initialTime}
        onClose={onClose}
        onTimeUpdate={onTimeUpdate}
        className={className}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
