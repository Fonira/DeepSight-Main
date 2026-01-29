import { useState } from 'react';
import { WritingStyle, AnalysisCustomization } from '../../types/analysis';

interface CustomizationPanelProps {
  onCustomizationChange: (customization: AnalysisCustomization) => void;
  initialCustomization?: Partial<AnalysisCustomization>;
}

const defaultCustomization: AnalysisCustomization = {
  writingStyle: WritingStyle.PROFESSIONAL,
  antiAIDetection: false,
  targetLength: 'medium',
  includeExamples: true,
  formalityLevel: 3,
  vocabularyComplexity: 'moderate',
  personalTone: false,
};

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  onCustomizationChange,
  initialCustomization = {},
}) => {
  const [customization, setCustomization] = useState<AnalysisCustomization>({
    ...defaultCustomization,
    ...initialCustomization,
  });

  const updateCustomization = (updates: Partial<AnalysisCustomization>) => {
    const newCustomization = { ...customization, ...updates };
    setCustomization(newCustomization);
    onCustomizationChange(newCustomization);
  };

  const toggleAntiAIDetection = () => {
    updateCustomization({ antiAIDetection: !customization.antiAIDetection });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Personnalisation de l'analyse
      </h2>

      {/* Bouton Anti-Détection IA */}
      <div className="flex flex-col items-center space-y-3">
        <button
          onClick={toggleAntiAIDetection}
          className={`
            w-full py-4 px-6 rounded-xl font-bold text-lg
            transition-all duration-300 transform hover:scale-105
            shadow-lg hover:shadow-xl
            ${
              customization.antiAIDetection
                ? 'bg-green-500 hover:bg-green-600 text-white ring-4 ring-green-300'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }
          `}
        >
          <div className="flex items-center justify-center space-x-3">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>
              {customization.antiAIDetection
                ? '✓ Anti-Détection IA Activé'
                : 'Anti-Détection IA'}
            </span>
          </div>
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Humanise le texte pour éviter la détection par les outils anti-IA
        </p>
      </div>

      {/* Style d'écriture */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Style d'écriture
        </label>
        <select
          value={customization.writingStyle}
          onChange={(e) =>
            updateCustomization({ writingStyle: e.target.value as WritingStyle })
          }
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value={WritingStyle.ACADEMIC}>Académique</option>
          <option value={WritingStyle.CONVERSATIONAL}>Conversationnel</option>
          <option value={WritingStyle.PROFESSIONAL}>Professionnel</option>
          <option value={WritingStyle.CREATIVE}>Créatif</option>
          <option value={WritingStyle.JOURNALISTIC}>Journalistique</option>
          <option value={WritingStyle.TECHNICAL}>Technique</option>
        </select>
      </div>

      {/* Longueur cible */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Longueur cible
        </label>
        <div className="flex space-x-2">
          {(['short', 'medium', 'long'] as const).map((length) => (
            <button
              key={length}
              onClick={() => updateCustomization({ targetLength: length })}
              className={`
                flex-1 py-2 px-4 rounded-lg font-medium transition-colors
                ${
                  customization.targetLength === length
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              {length === 'short' ? 'Court' : length === 'medium' ? 'Moyen' : 'Long'}
            </button>
          ))}
        </div>
      </div>

      {/* Niveau de formalité */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Niveau de formalité: {customization.formalityLevel}/5
        </label>
        <input
          type="range"
          min="1"
          max="5"
          value={customization.formalityLevel}
          onChange={(e) =>
            updateCustomization({
              formalityLevel: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5,
            })
          }
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
      </div>

      {/* Options supplémentaires */}
      <div className="space-y-3">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customization.includeExamples}
            onChange={(e) =>
              updateCustomization({ includeExamples: e.target.checked })
            }
            className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
          />
          <span className="text-gray-700 dark:text-gray-300">
            Inclure des exemples
          </span>
        </label>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customization.personalTone}
            onChange={(e) =>
              updateCustomization({ personalTone: e.target.checked })
            }
            className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
          />
          <span className="text-gray-700 dark:text-gray-300">
            Ton personnel
          </span>
        </label>
      </div>
    </div>
  );
};

export default CustomizationPanel;
