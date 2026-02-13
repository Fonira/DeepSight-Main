import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe } from 'lucide-react';

export const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
      className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105"
      style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.1), rgba(212, 175, 55, 0.1))',
        border: '1px solid rgba(212, 175, 55, 0.3)',
      }}
      title={language === 'fr' ? 'Switch to English' : 'Passer en Français'}
      aria-label={language === 'fr' ? 'Switch to English' : 'Passer en Français'}
    >
      <Globe className="w-4 h-4 text-gold-primary" />
      <span className="text-sm font-medium text-cream uppercase tracking-wider">
        {language === 'fr' ? 'FR' : 'EN'}
      </span>

      <div className="flex gap-1">
        <span
          className={`text-xs transition-all ${language === 'fr' ? 'text-gold-primary font-bold' : 'text-cream/40'}`}
        >
          FR
        </span>
        <span className="text-cream/30">/</span>
        <span
          className={`text-xs transition-all ${language === 'en' ? 'text-cyan-400 font-bold' : 'text-cream/40'}`}
        >
          EN
        </span>
      </div>
    </button>
  );
};
