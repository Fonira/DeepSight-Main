/**
 * DEEP SIGHT — ConceptNode Component
 * Custom React Flow node for displaying concepts in the mind map
 */

import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Info, ExternalLink } from 'lucide-react';
import type { ConceptNodeData } from './types';

const nodeColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  central: { 
    bg: 'bg-gradient-to-br from-purple-500 to-purple-700', 
    border: 'border-purple-300',
    text: 'text-white',
    glow: 'shadow-purple-500/50'
  },
  primary: { 
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600', 
    border: 'border-blue-300',
    text: 'text-white',
    glow: 'shadow-blue-500/50'
  },
  secondary: { 
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', 
    border: 'border-emerald-300',
    text: 'text-white',
    glow: 'shadow-emerald-500/50'
  },
  detail: { 
    bg: 'bg-gradient-to-br from-amber-400 to-amber-500', 
    border: 'border-amber-200',
    text: 'text-gray-900',
    glow: 'shadow-amber-400/50'
  },
};

const typeLabels: Record<string, { fr: string; en: string }> = {
  central: { fr: 'Central', en: 'Central' },
  primary: { fr: 'Principal', en: 'Primary' },
  secondary: { fr: 'Secondaire', en: 'Secondary' },
  detail: { fr: 'Détail', en: 'Detail' },
};

interface ConceptNodeProps extends NodeProps<ConceptNodeData> {}

const ConceptNode: React.FC<ConceptNodeProps> = ({ data, selected }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = nodeColors[data.type] || nodeColors.secondary;
  const typeLabel = typeLabels[data.type]?.fr || data.type;
  
  const handleWikipediaClick = () => {
    const searchTerm = encodeURIComponent(data.label);
    window.open(`https://fr.wikipedia.org/wiki/${searchTerm}`, '_blank');
  };

  return (
    <div className="relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />
      
      {/* Node Container */}
      <div
        className={`
          relative rounded-xl border-2 px-4 py-2
          ${colors.bg} ${colors.border} ${colors.text}
          ${selected ? `ring-2 ring-white ring-offset-2 ring-offset-gray-900 shadow-lg ${colors.glow}` : 'shadow-md'}
          transition-all duration-200 cursor-pointer
          hover:scale-105 hover:shadow-lg
          min-w-[100px] max-w-[200px]
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Type Badge */}
        <div className={`
          absolute -top-2 -right-2 
          text-[10px] font-semibold px-1.5 py-0.5 rounded-full
          bg-white/90 text-gray-700 shadow-sm
        `}>
          {typeLabel}
        </div>
        
        {/* Label */}
        <div className="text-center">
          <span className={`
            font-semibold text-sm leading-tight
            ${data.type === 'central' ? 'text-base' : ''}
            ${data.type === 'detail' ? 'text-xs' : ''}
          `}>
            {data.label}
          </span>
        </div>
        
        {/* Info Icon */}
        {data.description && (
          <div className="absolute -bottom-1 -right-1">
            <Info className="w-3 h-3 opacity-60" />
          </div>
        )}
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />
      
      {/* Tooltip / Details Popup */}
      {showTooltip && data.description && (
        <div 
          className={`
            absolute z-50 left-full ml-2 top-1/2 -translate-y-1/2
            bg-gray-900 text-white rounded-lg shadow-xl
            p-3 min-w-[200px] max-w-[280px]
            border border-gray-700
            animate-in fade-in slide-in-from-left-2 duration-200
          `}
        >
          {/* Arrow */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 
            border-t-8 border-t-transparent 
            border-r-8 border-r-gray-900 
            border-b-8 border-b-transparent"
          />
          
          {/* Content */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-2">
              {data.label}
              <span className={`
                text-[10px] px-1.5 py-0.5 rounded-full
                ${colors.bg}
              `}>
                {typeLabel}
              </span>
            </h4>
            
            <p className="text-xs text-gray-300 leading-relaxed">
              {data.description}
            </p>
            
            {data.relatedTo && data.relatedTo.length > 0 && (
              <div className="pt-1 border-t border-gray-700">
                <span className="text-[10px] text-gray-500 uppercase">Lié à :</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.relatedTo.map((rel, i) => (
                    <span 
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded-full text-gray-400"
                    >
                      {rel}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Wikipedia Link */}
            <button
              onClick={handleWikipediaClick}
              className="w-full mt-2 flex items-center justify-center gap-1.5 
                text-xs text-blue-400 hover:text-blue-300 
                py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20
                transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              En savoir plus
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ConceptNode);
