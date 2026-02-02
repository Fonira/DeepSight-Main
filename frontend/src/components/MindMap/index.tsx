/**
 * DEEP SIGHT — Interactive Mind Map Component
 * Visualizes concepts from video analysis as an interactive mind map
 * 
 * Features:
 * - 🗺️ Interactive pan & zoom
 * - 🎯 Click to view concept details
 * - 📥 Export as PNG
 * - 🎨 Color-coded by concept type
 * - 📱 Responsive design
 */

import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  RefreshCw,
  GitBranch,
  Layers,
  Route,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import ConceptNode from './ConceptNode';
import { conceptsToFlow } from './utils';
import type { MindMapData, Concept } from './types';

// Register custom node types
const nodeTypes: NodeTypes = {
  conceptNode: ConceptNode,
};

interface MindMapProps {
  data: MindMapData;
  videoTitle: string;
  language?: 'fr' | 'en';
  onExport?: () => void;
}

// Texts for i18n
const texts = {
  fr: {
    mindmap: 'Carte conceptuelle',
    concepts: 'Concepts',
    learningPath: 'Parcours',
    zoomIn: 'Zoom +',
    zoomOut: 'Zoom -',
    fitView: 'Ajuster la vue',
    exportPng: 'Exporter PNG',
    reset: 'Réinitialiser',
    loading: 'Génération...',
    depth: 'Profondeur',
    totalConcepts: 'concepts',
    central: 'Central',
    primary: 'Principal',
    secondary: 'Secondaire',
    detail: 'Détail',
    legend: 'Légende',
    noData: 'Aucune donnée de mindmap disponible',
    startHere: 'Commencez ici',
    instructions: 'Utilisez la souris pour naviguer, la molette pour zoomer',
  },
  en: {
    mindmap: 'Concept Map',
    concepts: 'Concepts',
    learningPath: 'Learning Path',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    fitView: 'Fit View',
    exportPng: 'Export PNG',
    reset: 'Reset',
    loading: 'Generating...',
    depth: 'Depth',
    totalConcepts: 'concepts',
    central: 'Central',
    primary: 'Primary',
    secondary: 'Secondary',
    detail: 'Detail',
    legend: 'Legend',
    noData: 'No mindmap data available',
    startHere: 'Start here',
    instructions: 'Use mouse to pan, scroll to zoom',
  },
};

// Inner component with ReactFlow hooks
const MindMapInner: React.FC<MindMapProps> = ({
  data,
  videoTitle,
  language = 'fr',
  onExport,
}) => {
  const t = texts[language];
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, zoomIn, zoomOut, getNodes, getEdges } = useReactFlow();
  
  // State
  const [activeTab, setActiveTab] = useState<'map' | 'concepts' | 'path'>('map');
  const [showLegend, setShowLegend] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  
  // Convert concepts to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data.concepts || data.concepts.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }
    const { nodes, edges } = conceptsToFlow(data.concepts, videoTitle, {
      centerX: 0,
      centerY: 0,
      animated: true,
    });
    return { initialNodes: nodes, initialEdges: edges };
  }, [data.concepts, videoTitle]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Handle node click
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const concept = data.concepts.find(
      c => c.name.toLowerCase() === node.data.label?.toLowerCase()
    );
    setSelectedConcept(concept || null);
  }, [data.concepts]);
  
  // Export to PNG
  const handleExport = useCallback(async () => {
    try {
      // Use html2canvas or similar if needed
      // For now, we'll use the SVG approach
      const svgElement = reactFlowWrapper.current?.querySelector('svg');
      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx?.scale(2, 2);
          ctx!.fillStyle = '#1f2937';
          ctx?.fillRect(0, 0, canvas.width, canvas.height);
          ctx?.drawImage(img, 0, 0);
          
          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `mindmap-${videoTitle.substring(0, 30)}-${Date.now()}.png`;
          link.href = pngUrl;
          link.click();
          
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
      onExport?.();
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [videoTitle, onExport]);
  
  // Reset view
  const handleReset = useCallback(() => {
    fitView({ padding: 0.2, duration: 500 });
  }, [fitView]);
  
  // Get concept type config
  const getConceptTypeConfig = (type: string) => {
    const configs: Record<string, { label: string; color: string; bgColor: string }> = {
      central: { label: t.central, color: 'text-purple-400', bgColor: 'bg-purple-500' },
      primary: { label: t.primary, color: 'text-blue-400', bgColor: 'bg-blue-500' },
      secondary: { label: t.secondary, color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
      detail: { label: t.detail, color: 'text-amber-400', bgColor: 'bg-amber-400' },
    };
    return configs[type] || configs.secondary;
  };

  // No data state
  if (!data.concepts || data.concepts.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-bg-secondary rounded-xl border border-border-subtle">
        <div className="text-center text-text-muted">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{t.noData}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'map'
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <GitBranch className="w-4 h-4 inline mr-2" />
          {t.mindmap}
        </button>
        <button
          onClick={() => setActiveTab('concepts')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'concepts'
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-2" />
          {t.concepts}
          <span className="ml-1 text-xs text-text-muted">({data.total_concepts})</span>
        </button>
        <button
          onClick={() => setActiveTab('path')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'path'
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <Route className="w-4 h-4 inline mr-2" />
          {t.learningPath}
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-text-muted">
            {t.depth}: <strong className="text-text-primary">{data.hierarchy_depth}</strong>
          </span>
          <span className="text-text-muted">
            <strong className="text-text-primary">{data.total_concepts}</strong> {t.totalConcepts}
          </span>
        </div>
        
        {activeTab === 'map' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => zoomOut()}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              title={t.zoomOut}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomIn()}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              title={t.zoomIn}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              title={t.fitView}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-border-subtle mx-1" />
            <button
              onClick={handleExport}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              title={t.exportPng}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Map View */}
      {activeTab === 'map' && (
        <div 
          ref={reactFlowWrapper}
          className="relative bg-gray-900 rounded-xl border border-border-subtle overflow-hidden"
          style={{ height: '500px' }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            className="bg-gray-900"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#374151" gap={20} />
            <MiniMap
              nodeColor={(node) => {
                const type = node.data?.type || 'secondary';
                const colors: Record<string, string> = {
                  central: '#8b5cf6',
                  primary: '#3b82f6',
                  secondary: '#10b981',
                  detail: '#f59e0b',
                };
                return colors[type] || '#6b7280';
              }}
              maskColor="rgba(0, 0, 0, 0.8)"
              className="!bg-gray-800 !border-gray-700"
            />
            
            {/* Legend Panel */}
            {showLegend && (
              <Panel position="top-left" className="!m-2">
                <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-3 border border-gray-700 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-400">{t.legend}</span>
                    <button
                      onClick={() => setShowLegend(false)}
                      className="text-gray-500 hover:text-gray-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {['central', 'primary', 'secondary', 'detail'].map(type => {
                      const config = getConceptTypeConfig(type);
                      return (
                        <div key={type} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${config.bgColor}`} />
                          <span className="text-xs text-gray-300">{config.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
            )}
            
            {!showLegend && (
              <Panel position="top-left" className="!m-2">
                <button
                  onClick={() => setShowLegend(true)}
                  className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-2 border border-gray-700 shadow-lg hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </Panel>
            )}
            
            {/* Instructions */}
            <Panel position="bottom-center" className="!mb-2">
              <div className="bg-gray-800/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-gray-400">
                {t.instructions}
              </div>
            </Panel>
          </ReactFlow>
          
          {/* Selected Concept Details */}
          {selectedConcept && (
            <div className="absolute bottom-4 right-4 bg-gray-800/95 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-xl max-w-xs animate-in slide-in-from-right-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-white">{selectedConcept.name}</h4>
                <button
                  onClick={() => setSelectedConcept(null)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  ×
                </button>
              </div>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${getConceptTypeConfig(selectedConcept.type).bgColor} text-white`}>
                {getConceptTypeConfig(selectedConcept.type).label}
              </span>
              <p className="text-sm text-gray-300">{selectedConcept.description}</p>
              {selectedConcept.related_to && selectedConcept.related_to.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <span className="text-xs text-gray-500">Lié à:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedConcept.related_to.map((rel, i) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">
                        {rel}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Concepts List View */}
      {activeTab === 'concepts' && (
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4 max-h-[500px] overflow-y-auto">
          <div className="space-y-3">
            {data.concepts.map((concept, index) => {
              const config = getConceptTypeConfig(concept.type);
              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border bg-bg-primary border-border-subtle hover:border-accent-primary/50 transition-colors cursor-pointer`}
                  onClick={() => {
                    setSelectedConcept(concept);
                    setActiveTab('map');
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${config.bgColor}`} />
                      <span className="font-medium text-text-primary">{concept.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} text-white`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm mt-2 text-text-secondary">{concept.description}</p>
                  {concept.related_to && concept.related_to.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-text-muted">→</span>
                      {concept.related_to.map((rel, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-bg-hover text-text-muted">
                          {rel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Learning Path View */}
      {activeTab === 'path' && (
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
          <p className="text-sm text-text-secondary mb-4">
            {language === 'fr'
              ? 'Suivez ce parcours pour une compréhension progressive du sujet :'
              : 'Follow this path for progressive understanding of the topic:'}
          </p>

          <div className="relative">
            {/* Line connecting steps */}
            <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gradient-to-b from-accent-primary via-purple-500 to-green-500" />

            <div className="space-y-4">
              {data.learning_path.map((step, index) => (
                <div key={index} className="flex items-start gap-4 relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 font-bold ${
                      index === 0
                        ? 'bg-accent-primary text-white'
                        : index === data.learning_path.length - 1
                        ? 'bg-green-500 text-white'
                        : 'bg-purple-500 text-white'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 pt-2">
                    <p
                      className={`font-medium ${
                        index === 0 ? 'text-accent-primary' : 'text-text-primary'
                      }`}
                    >
                      {step}
                    </p>
                    {index === 0 && (
                      <span className="text-xs text-accent-primary mt-1 inline-block">
                        ⬅️ {t.startHere}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main component wrapped with ReactFlowProvider
export const MindMap: React.FC<MindMapProps> = (props) => {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  );
};

export default MindMap;
export type { MindMapData, Concept };
