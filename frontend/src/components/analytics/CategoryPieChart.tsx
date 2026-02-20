/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🥧 CATEGORY PIE CHART — Répartition des catégories analysées                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { PieChart as PieIcon, Folder } from 'lucide-react';

interface CategoryData {
  name: string;
  value: number;
  emoji?: string;
  percentage?: number;
}

interface CategoryPieChartProps {
  data: Record<string, number>;
  title?: string;
  language?: 'fr' | 'en';
  className?: string;
}

// Palette de couleurs harmonieuse
const COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#84cc16', // Lime
  '#f97316', // Orange
];

// Mapping des catégories vers les emojis
const CATEGORY_EMOJIS: Record<string, string> = {
  'auto': '🎯',
  'interview_podcast': '🎙️',
  'tech': '💻',
  'science': '🔬',
  'education': '📚',
  'finance': '💰',
  'gaming': '🎮',
  'culture': '🎨',
  'news': '📰',
  'health': '🏥',
  'Technologie': '💻',
  'Science': '🔬',
  'Éducation': '📚',
  'Finance': '💰',
  'Gaming': '🎮',
  'Culture': '🎨',
  'Actualités': '📰',
  'Santé': '🏥',
  'Autre': '📄',
  'Unknown': '❓',
};

const CustomTooltip = ({ active, payload, language }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2 shadow-lg">
        <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <span>{data.emoji || '📄'}</span>
          <span>{data.name}</span>
        </p>
        <p className="text-xs text-text-secondary mt-1">
          {data.value} {language === 'fr' ? (data.value > 1 ? 'analyses' : 'analyse') : (data.value > 1 ? 'analyses' : 'analysis')}
          <span className="text-text-tertiary ml-1">({data.percentage}%)</span>
        </p>
      </div>
    );
  }
  return null;
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, emoji }: any) => {
  if (percent < 0.08) return null; // Ne pas afficher les labels trop petits
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor="middle" 
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {emoji || '📄'}
    </text>
  );
};

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data,
  title,
  language = 'fr',
  className = ''
}) => {
  // Transformer les données pour le chart
  const chartData: CategoryData[] = React.useMemo(() => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(data)
      .map(([name, value]) => ({
        name,
        value,
        emoji: CATEGORY_EMOJIS[name] || '📄',
        percentage: total > 0 ? Math.round((value / total) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Limiter à 8 catégories max
  }, [data]);
  
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0 || total === 0) {
    return (
      <div className={`card p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <PieIcon className="w-4.5 h-4.5 text-purple-500" />
          </div>
          <h3 className="font-semibold text-text-primary">
            {title || (language === 'fr' ? 'Catégories analysées' : 'Analyzed categories')}
          </h3>
        </div>
        
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <Folder className="w-12 h-12 text-text-tertiary mx-auto mb-2 opacity-50" />
            <p className="text-sm text-text-tertiary">
              {language === 'fr' ? 'Aucune donnée disponible' : 'No data available'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <PieIcon className="w-4.5 h-4.5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">
              {title || (language === 'fr' ? 'Catégories analysées' : 'Analyzed categories')}
            </h3>
            <p className="text-xs text-text-tertiary">
              {total} {language === 'fr' ? 'analyses au total' : 'total analyses'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={80}
              innerRadius={40}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="transition-opacity hover:opacity-80 cursor-pointer"
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip language={language} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <div 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-text-secondary truncate flex items-center gap-1">
              <span>{item.emoji}</span>
              <span className="truncate">{item.name}</span>
            </span>
            <span className="text-text-tertiary ml-auto">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryPieChart;
