/**
 * DEEP SIGHT — MindMap Types
 * Types for the interactive mind map visualization
 */

export interface Concept {
  name: string;
  type: 'central' | 'primary' | 'secondary' | 'detail';
  description: string;
  related_to?: string[];
}

export interface MindMapData {
  concepts: Concept[];
  mermaid_code?: string;
  hierarchy_depth: number;
  total_concepts: number;
  learning_path: string[];
  generated_at?: string;
  source_video?: string;
}

export interface ConceptNodeData {
  label: string;
  description: string;
  type: 'central' | 'primary' | 'secondary' | 'detail';
  relatedTo?: string[];
  [key: string]: unknown;
}

export type NodeType = 'central' | 'primary' | 'secondary' | 'detail';

export const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  central: { 
    bg: 'bg-gradient-to-br from-purple-500 to-purple-700', 
    border: 'border-purple-400',
    text: 'text-white'
  },
  primary: { 
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600', 
    border: 'border-blue-400',
    text: 'text-white'
  },
  secondary: { 
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', 
    border: 'border-emerald-400',
    text: 'text-white'
  },
  detail: { 
    bg: 'bg-gradient-to-br from-amber-400 to-amber-500', 
    border: 'border-amber-300',
    text: 'text-gray-900'
  },
};

export const NODE_SIZES: Record<NodeType, { width: number; height: number }> = {
  central: { width: 200, height: 80 },
  primary: { width: 160, height: 60 },
  secondary: { width: 140, height: 50 },
  detail: { width: 120, height: 40 },
};
