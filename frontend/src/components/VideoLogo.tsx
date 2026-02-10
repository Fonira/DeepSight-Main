/**
 * 🎬 VIDEO LOGO — Deep Sight
 * Composant vidéo du logo animé avec fallback image
 * Utilisé sur la landing page et pour les chargements
 */

import React, { useRef, useEffect, useState } from 'react';

interface VideoLogoProps {
  /** Taille du conteneur */
  size?: number | string;
  /** Classes CSS additionnelles */
  className?: string;
  /** Afficher avec une ombre/glow */
  withGlow?: boolean;
  /** Priorité de chargement */
  priority?: boolean;
}

export const VideoLogo: React.FC<VideoLogoProps> = ({
  size = 200,
  className = '',
  withGlow = true,
  priority = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Forcer la lecture
    const playVideo = async () => {
      try {
        await video.play();
      } catch (err) {
        console.log('Autoplay prevented, will play on interaction');
      }
    };

    if (video.readyState >= 3) {
      playVideo();
      setIsLoaded(true);
    }

    video.addEventListener('canplay', () => {
      playVideo();
      setIsLoaded(true);
    });

    video.addEventListener('error', () => {
      setHasError(true);
    });
  }, []);

  const sizeStyle = typeof size === 'number' ? `${size}px` : size;

  // Fallback vers l'image si la vidéo ne charge pas
  if (hasError) {
    return (
      <div 
        className={`relative ${className}`}
        style={{ width: sizeStyle, height: sizeStyle }}
      >
        <img
          src="/deepsight-logo-cosmic.png"
          alt="Deep Sight"
          className="w-full h-full object-contain"
          style={withGlow ? {
            filter: 'drop-shadow(0 0 30px rgba(74, 144, 217, 0.4)) drop-shadow(0 0 20px rgba(212, 165, 116, 0.3))'
          } : undefined}
        />
      </div>
    );
  }

  return (
    <div 
      className={`relative ${className}`}
      style={{ width: sizeStyle, height: sizeStyle }}
    >
      {/* Glow effect derrière la vidéo */}
      {withGlow && (
        <div 
          className="absolute inset-0 rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(74, 144, 217, 0.3) 0%, rgba(212, 165, 116, 0.2) 40%, rgba(123, 75, 160, 0.15) 70%, transparent 85%)',
            filter: 'blur(30px)',
            transform: 'scale(1.3)',
          }}
        />
      )}
      
      {/* Vidéo du logo */}
      <video
        ref={videoRef}
        className={`w-full h-full object-contain relative z-10 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        src="/logo-animation.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload={priority ? 'auto' : 'metadata'}
        style={withGlow ? {
          filter: 'drop-shadow(0 0 20px rgba(74, 144, 217, 0.3)) drop-shadow(0 0 15px rgba(212, 165, 116, 0.2))'
        } : undefined}
      />
      
      {/* Placeholder pendant le chargement */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/deepsight-logo-cosmic.png"
            alt="Deep Sight"
            className="w-3/4 h-3/4 object-contain animate-pulse"
          />
        </div>
      )}
    </div>
  );
};

export default VideoLogo;
