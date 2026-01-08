/**
 * 🖼️ THUMBNAIL IMAGE COMPONENT
 * Gère intelligemment les thumbnails pour vidéos YouTube et textes bruts
 */

import React, { useState } from 'react';
import { FileText, Microscope, Cpu, Building2, TrendingUp, Heart, BookOpen, Palette, Leaf, GraduationCap, Mic } from 'lucide-react';

interface ThumbnailImageProps {
  thumbnailUrl?: string;
  videoId: string;
  title: string;
  category?: string;
  className?: string;
}

// Couleurs et icônes par catégorie
const categoryStyles: Record<string, { gradient: string; icon: React.ReactNode }> = {
  science: { 
    gradient: 'from-blue-500 to-blue-900', 
    icon: <Microscope className="w-8 h-8 text-white" /> 
  },
  tech: { 
    gradient: 'from-purple-500 to-purple-900', 
    icon: <Cpu className="w-8 h-8 text-white" /> 
  },
  politics: { 
    gradient: 'from-red-500 to-red-900', 
    icon: <Building2 className="w-8 h-8 text-white" /> 
  },
  economy: { 
    gradient: 'from-green-500 to-green-900', 
    icon: <TrendingUp className="w-8 h-8 text-white" /> 
  },
  health: { 
    gradient: 'from-teal-500 to-teal-900', 
    icon: <Heart className="w-8 h-8 text-white" /> 
  },
  education: { 
    gradient: 'from-amber-500 to-amber-900', 
    icon: <GraduationCap className="w-8 h-8 text-white" /> 
  },
  culture: { 
    gradient: 'from-pink-500 to-pink-900', 
    icon: <Palette className="w-8 h-8 text-white" /> 
  },
  environment: { 
    gradient: 'from-emerald-500 to-emerald-900', 
    icon: <Leaf className="w-8 h-8 text-white" /> 
  },
  tutorial: { 
    gradient: 'from-sky-500 to-sky-900', 
    icon: <BookOpen className="w-8 h-8 text-white" /> 
  },
  interview: { 
    gradient: 'from-violet-500 to-violet-900', 
    icon: <Mic className="w-8 h-8 text-white" /> 
  },
};

const defaultStyle = {
  gradient: 'from-indigo-500 to-indigo-900',
  icon: <FileText className="w-8 h-8 text-white" />
};

/**
 * Détermine si c'est un texte brut (pas une vidéo YouTube)
 */
const isRawText = (videoId: string): boolean => {
  return videoId?.startsWith('txt_') || videoId?.startsWith('text_');
};

/**
 * Composant placeholder pour les textes bruts
 */
const TextPlaceholder: React.FC<{ category?: string; title: string; className?: string }> = ({ 
  category, 
  title,
  className = '' 
}) => {
  const style = categoryStyles[category || ''] || defaultStyle;
  
  return (
    <div className={`w-full h-full bg-gradient-to-br ${style.gradient} flex flex-col items-center justify-center ${className}`}>
      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2">
        {style.icon}
      </div>
      <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
        {category || 'Texte'}
      </span>
    </div>
  );
};

/**
 * Composant principal ThumbnailImage
 */
export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  thumbnailUrl,
  videoId,
  title,
  category,
  className = 'w-full h-full object-cover'
}) => {
  const [hasError, setHasError] = useState(false);
  
  // Si c'est un texte brut
  if (isRawText(videoId)) {
    // Si on a une thumbnail (base64 ou URL), l'utiliser
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
    // Sinon, afficher le placeholder
    return <TextPlaceholder category={category} title={title} className={className} />;
  }
  
  // Pour les vidéos YouTube
  const youtubeThumb = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  const src = thumbnailUrl || youtubeThumb;
  
  return (
    <img
      src={hasError ? youtubeThumb : src}
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
 * Retourne l'URL appropriée ou null si placeholder nécessaire
 */
export const getThumbnailUrl = (videoId: string, thumbnailUrl?: string): string | null => {
  if (thumbnailUrl) return thumbnailUrl;
  if (isRawText(videoId)) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
};

/**
 * Vérifie si un video_id correspond à un texte brut
 */
export const isRawTextVideo = isRawText;

export default ThumbnailImage;
