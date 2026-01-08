/**
 * 🔮 CLICKABLE QUESTIONS v2.0 — Questions de réflexion interactives
 * ═══════════════════════════════════════════════════════════════════════════════
 * Composant pour parser et rendre cliquables les questions suggérées par l'IA
 * Format attendu: [ask:Question ici]
 * Supporte aussi [[concepts]] pour affichage visuel
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface ClickableQuestionsProps {
  content: string;
  onQuestionClick: (question: string) => void;
  variant?: 'video' | 'playlist';
  disabled?: boolean;
}

/**
 * Parse le contenu et extrait les questions au format [ask:...]
 */
export const parseAskQuestions = (content: string): { beforeQuestions: string; questions: string[] } => {
  const askRegex = /\[ask:([^\]]+)\]/g;
  const questions: string[] = [];
  let match;
  
  while ((match = askRegex.exec(content)) !== null) {
    questions.push(match[1].trim());
  }
  
  // Retirer les questions du contenu original
  const beforeQuestions = content.replace(askRegex, '').trim();
  
  return { beforeQuestions, questions };
};

/**
 * Nettoie les [[concepts]] d'une question pour l'envoi
 */
const cleanWikiFromQuestion = (question: string): string => {
  return question.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, term, display) => display || term);
};

/**
 * Parse et formate le texte de la question avec les [[concepts]] stylisés
 */
const FormatQuestionText: React.FC<{ text: string; isPlaylist: boolean }> = ({ text, isPlaylist }) => {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let idx = 0;
  
  while ((match = regex.exec(text)) !== null) {
    // Texte avant le match
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${idx++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    
    const term = match[1].trim();
    const display = match[2]?.trim() || term;
    
    // Afficher le concept avec style (sans interactivité dans un bouton)
    parts.push(
      <span 
        key={`w-${idx++}`} 
        className={`font-semibold ${isPlaylist ? 'text-purple-200' : 'text-cyan-200'}`}
      >
        {display}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Reste du texte
  if (lastIndex < text.length) {
    parts.push(<span key={`t-${idx++}`}>{text.slice(lastIndex)}</span>);
  }
  
  return <>{parts.length > 0 ? parts : text}</>;
};

/**
 * Composant pour afficher les questions cliquables
 */
export const ClickableQuestionsBlock: React.FC<{
  questions: string[];
  onQuestionClick: (question: string) => void;
  variant?: 'video' | 'playlist';
  disabled?: boolean;
}> = ({ questions, onQuestionClick, variant = 'video', disabled = false }) => {
  if (questions.length === 0) return null;
  
  const isPlaylist = variant === 'playlist';
  
  const handleQuestionClick = (question: string) => {
    // Nettoyer les [[concepts]] avant d'envoyer
    const cleanQuestion = cleanWikiFromQuestion(question);
    onQuestionClick(cleanQuestion);
  };
  
  return (
    <div className="mt-4 pt-3 border-t border-gray-600/30">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPlaylist ? 'bg-purple-500/30' : 'bg-amber-500/30'
        }`}>
          <Sparkles className={`w-3.5 h-3.5 ${isPlaylist ? 'text-purple-300' : 'text-amber-300'}`} />
        </div>
        <span className={`text-xs font-semibold ${isPlaylist ? 'text-purple-300' : 'text-amber-300'}`}>
          Pour aller plus loin
        </span>
      </div>
      
      <div className="space-y-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => !disabled && handleQuestionClick(question)}
            disabled={disabled}
            className={`
              group w-full text-left px-3 py-2.5 rounded-xl text-sm
              transition-all duration-200 ease-out
              border backdrop-blur-sm
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${isPlaylist 
                ? 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-400/50 text-purple-100' 
                : 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-400/50 text-cyan-100'
              }
            `}
            style={{
              boxShadow: disabled ? 'none' : '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <div className="flex items-start gap-2">
              <ArrowRight className={`
                w-4 h-4 mt-0.5 flex-shrink-0 transition-transform duration-200
                ${isPlaylist ? 'text-purple-400' : 'text-cyan-400'}
                ${!disabled && 'group-hover:translate-x-1'}
              `} />
              <span className="flex-1 leading-relaxed break-words whitespace-normal">
                <FormatQuestionText text={question} isPlaylist={isPlaylist} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * HOC pour wrapper le contenu markdown et ajouter les questions cliquables
 */
export const MessageWithClickableQuestions: React.FC<ClickableQuestionsProps> = ({
  content,
  onQuestionClick,
  variant = 'video',
  disabled = false,
}) => {
  const { questions } = parseAskQuestions(content);
  
  return (
    <ClickableQuestionsBlock
      questions={questions}
      onQuestionClick={onQuestionClick}
      variant={variant}
      disabled={disabled}
    />
  );
};

/**
 * Utilitaire pour nettoyer le contenu des marqueurs [ask:]
 */
export const cleanAskMarkers = (content: string): string => {
  return content.replace(/\[ask:([^\]]+)\]/g, '• $1');
};

export default ClickableQuestionsBlock;
