/**
 * 🎯 SIDEBAR LOGO v5.0 — Logo Deep Sight avec vidéo animée
 * ═══════════════════════════════════════════════════════════════════════════════
 * - Vidéo du logo animé en loop
 * - Halo et particules décoratives
 * - Fallback vers image statique si vidéo non supportée
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export const SidebarLogo: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playVideo = async () => {
      try {
        await video.play();
      } catch {
        // Autoplay bloqué, c'est ok
      }
    };

    video.addEventListener('canplay', playVideo);
    video.addEventListener('error', () => setVideoError(true));
    
    if (video.readyState >= 3) playVideo();

    return () => {
      video.removeEventListener('canplay', playVideo);
    };
  }, []);

  const handleClick = () => {
    navigate("/dashboard");
  };

  return (
    <div className="px-6 py-6 border-b border-border-subtle/30">
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-center group cursor-pointer transition-all duration-300 hover:scale-105"
        title="Retour au tableau de bord"
      >
        <div className="relative">
          {/* Halo animé au hover */}
          <div 
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(circle, rgba(212, 165, 116, 0.4) 0%, rgba(74, 144, 217, 0.3) 40%, rgba(123, 75, 160, 0.2) 70%, transparent 85%)',
              transform: 'scale(1.6)',
              filter: 'blur(15px)',
            }}
          />
          
          {/* Vidéo du logo ou fallback image */}
          {!videoError ? (
            <video
              ref={videoRef}
              className="w-28 h-28 object-contain relative z-10"
              src="/logo-animation.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ 
                filter: 'drop-shadow(0 0 20px rgba(212, 165, 116, 0.4)) drop-shadow(0 0 15px rgba(74, 144, 217, 0.3))',
              }}
            />
          ) : (
            <img
              src="/logo-deep-sight.png?v=4"
              alt="Deep Sight"
              className="w-28 h-28 object-contain relative z-10"
              style={{ 
                filter: 'drop-shadow(0 0 20px rgba(212, 165, 116, 0.4)) drop-shadow(0 0 15px rgba(74, 144, 217, 0.3))',
              }}
            />
          )}
          
          {/* Particules décoratives */}
          <div 
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full opacity-60 group-hover:opacity-100 transition-all duration-500"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(212, 165, 116, 0.9), rgba(180, 130, 80, 0.4))',
              animation: 'float 3s ease-in-out infinite',
              boxShadow: '0 0 10px rgba(212, 165, 116, 0.6)',
            }}
          />
          <div 
            className="absolute -bottom-2 -left-2 w-2 h-2 rounded-full opacity-40 group-hover:opacity-80 transition-all duration-500"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(123, 75, 160, 0.9), rgba(100, 60, 140, 0.4))',
              animation: 'float 4s ease-in-out infinite reverse',
              boxShadow: '0 0 8px rgba(123, 75, 160, 0.6)',
            }}
          />
          <div 
            className="absolute top-1/2 -right-3 w-1.5 h-1.5 rounded-full opacity-30 group-hover:opacity-70 transition-all duration-500"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(74, 144, 217, 0.9), rgba(60, 120, 200, 0.4))',
              animation: 'float 3.5s ease-in-out infinite',
              boxShadow: '0 0 6px rgba(74, 144, 217, 0.6)',
            }}
          />
        </div>
      </button>
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default SidebarLogo;
