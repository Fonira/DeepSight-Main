/**
 * DEEP SIGHT — MindMap Utilities
 * Functions to convert concept data to React Flow nodes and edges
 */

import type { Node, Edge } from '@xyflow/react';
import type { Concept, ConceptNodeData } from './types';

const SPACING = {
  LEVEL_X: 300,  // Horizontal spacing between levels
  NODE_Y: 120,   // Vertical spacing between nodes at same level
};

interface LayoutOptions {
  centerX?: number;
  centerY?: number;
  animated?: boolean;
}

/**
 * Generate a unique ID for edges
 */
const edgeId = (source: string, target: string) => `e-${source}-${target}`;

/**
 * Sanitize a concept name to use as a node ID
 */
const sanitizeId = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
};

/**
 * Calculate positions for nodes in a radial/tree layout
 */
export function conceptsToFlow(
  concepts: Concept[],
  videoTitle: string,
  options: LayoutOptions = {}
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const { centerX = 0, centerY = 0, animated = true } = options;
  
  const nodes: Node<ConceptNodeData>[] = [];
  const edges: Edge[] = [];
  const nodeMap = new Map<string, string>(); // concept name -> node ID
  
  // Group concepts by type
  const central = concepts.filter(c => c.type === 'central');
  const primary = concepts.filter(c => c.type === 'primary');
  const secondary = concepts.filter(c => c.type === 'secondary');
  const detail = concepts.filter(c => c.type === 'detail');
  
  // If no central concept, use video title
  if (central.length === 0) {
    const rootId = 'root-central';
    nodes.push({
      id: rootId,
      type: 'conceptNode',
      position: { x: centerX, y: centerY },
      data: {
        label: videoTitle,
        description: 'Sujet principal de la vidéo',
        type: 'central',
      },
    });
    nodeMap.set('_root_', rootId);
  }
  
  // Add central nodes
  central.forEach((concept, index) => {
    const nodeId = `central-${sanitizeId(concept.name)}`;
    const yOffset = (index - (central.length - 1) / 2) * SPACING.NODE_Y;
    
    nodes.push({
      id: nodeId,
      type: 'conceptNode',
      position: { x: centerX, y: centerY + yOffset },
      data: {
        label: concept.name,
        description: concept.description,
        type: 'central',
        relatedTo: concept.related_to,
      },
    });
    nodeMap.set(concept.name.toLowerCase(), nodeId);
  });
  
  // Add primary nodes (first ring)
  const primaryAngles = distributeAngles(primary.length, -60, 60);
  primary.forEach((concept, index) => {
    const nodeId = `primary-${sanitizeId(concept.name)}`;
    const angle = primaryAngles[index];
    const distance = SPACING.LEVEL_X;
    
    const x = centerX + distance * Math.cos(toRadians(angle));
    const y = centerY + distance * Math.sin(toRadians(angle));
    
    nodes.push({
      id: nodeId,
      type: 'conceptNode',
      position: { x, y },
      data: {
        label: concept.name,
        description: concept.description,
        type: 'primary',
        relatedTo: concept.related_to,
      },
    });
    nodeMap.set(concept.name.toLowerCase(), nodeId);
    
    // Connect to central or root
    const parentId = findParentId(concept, nodeMap, 'central');
    if (parentId) {
      edges.push({
        id: edgeId(parentId, nodeId),
        source: parentId,
        target: nodeId,
        animated,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
        type: 'smoothstep',
      });
    }
  });
  
  // Add secondary nodes (second ring)
  const secondaryAngles = distributeAngles(secondary.length, -90, 90);
  secondary.forEach((concept, index) => {
    const nodeId = `secondary-${sanitizeId(concept.name)}`;
    const angle = secondaryAngles[index];
    const distance = SPACING.LEVEL_X * 1.8;
    
    const x = centerX + distance * Math.cos(toRadians(angle));
    const y = centerY + distance * Math.sin(toRadians(angle));
    
    nodes.push({
      id: nodeId,
      type: 'conceptNode',
      position: { x, y },
      data: {
        label: concept.name,
        description: concept.description,
        type: 'secondary',
        relatedTo: concept.related_to,
      },
    });
    nodeMap.set(concept.name.toLowerCase(), nodeId);
    
    // Connect to parent (primary or central)
    const parentId = findParentId(concept, nodeMap, 'primary', 'central');
    if (parentId) {
      edges.push({
        id: edgeId(parentId, nodeId),
        source: parentId,
        target: nodeId,
        animated,
        style: { stroke: '#3b82f6', strokeWidth: 1.5 },
        type: 'smoothstep',
      });
    }
  });
  
  // Add detail nodes (third ring)
  const detailAngles = distributeAngles(detail.length, -120, 120);
  detail.forEach((concept, index) => {
    const nodeId = `detail-${sanitizeId(concept.name)}`;
    const angle = detailAngles[index];
    const distance = SPACING.LEVEL_X * 2.5;
    
    const x = centerX + distance * Math.cos(toRadians(angle));
    const y = centerY + distance * Math.sin(toRadians(angle));
    
    nodes.push({
      id: nodeId,
      type: 'conceptNode',
      position: { x, y },
      data: {
        label: concept.name,
        description: concept.description,
        type: 'detail',
        relatedTo: concept.related_to,
      },
    });
    nodeMap.set(concept.name.toLowerCase(), nodeId);
    
    // Connect to parent
    const parentId = findParentId(concept, nodeMap, 'secondary', 'primary', 'central');
    if (parentId) {
      edges.push({
        id: edgeId(parentId, nodeId),
        source: parentId,
        target: nodeId,
        animated: false,
        style: { stroke: '#10b981', strokeWidth: 1 },
        type: 'smoothstep',
      });
    }
  });
  
  return { nodes, edges };
}

/**
 * Find the parent node ID based on related_to or fallback to level
 */
function findParentId(
  concept: Concept, 
  nodeMap: Map<string, string>, 
  ...fallbackLevels: string[]
): string | null {
  // First try to find from related_to
  if (concept.related_to && concept.related_to.length > 0) {
    for (const related of concept.related_to) {
      const relatedId = nodeMap.get(related.toLowerCase());
      if (relatedId) return relatedId;
    }
  }
  
  // Fallback: find any node of the specified levels
  for (const level of fallbackLevels) {
    for (const [, nodeId] of nodeMap) {
      if (nodeId.startsWith(level)) return nodeId;
    }
  }
  
  // Last resort: root node
  return nodeMap.get('_root_') || null;
}

/**
 * Distribute angles evenly across a range
 */
function distributeAngles(count: number, minAngle: number, maxAngle: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [(minAngle + maxAngle) / 2];
  
  const step = (maxAngle - minAngle) / (count - 1);
  return Array.from({ length: count }, (_, i) => minAngle + i * step);
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Export mind map as PNG using canvas
 */
export async function exportToPng(
  svgElement: SVGSVGElement, 
  filename: string = 'mindmap'
): Promise<void> {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas context not available');
  
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${filename}-${Date.now()}.png`;
      link.href = pngUrl;
      link.click();
      
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
}
