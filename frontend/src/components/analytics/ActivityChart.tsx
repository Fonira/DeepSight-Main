/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📈 ACTIVITY CHART — Graphique d'activité (7 derniers jours)                       ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Activity } from 'lucide-react';

interface DailyData {
  date: string;
  count: number;
}

interface ActivityChartProps {
  data: DailyData[];
  title?: string;
  language?: 'fr' | 'en';
  className?: string;
}

const ACCENT_COLOR = '#6366f1';  // Indigo
const ACCENT_LIGHT = '#818cf8';

const CustomTooltip = ({ active, payload, label, language }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs text-text-tertiary mb-1">{formatDate(label, language)}</p>
        <p className="text-sm font-semibold text-text-primary">
          {value} {language === 'fr' ? (value > 1 ? 'analyses' : 'analyse') : (value > 1 ? 'analyses' : 'analysis')}
        </p>
      </div>
    );
  }
  return null;
};

const formatDate = (dateStr: string, language: string = 'fr'): string => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    day: 'numeric',
    month: 'short'
  };
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', options);
};

const formatDayShort = (dateStr: string, language: string = 'fr'): string => {
  const date = new Date(dateStr);
  const days = language === 'fr' 
    ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
};

export const ActivityChart: React.FC<ActivityChartProps> = ({
  data,
  title,
  language = 'fr',
  className = ''
}) => {
  // S'assurer qu'on a 7 jours de données
  const processedData = React.useMemo(() => {
    const last7Days: DailyData[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const existing = data.find(d => d.date === dateStr);
      last7Days.push({
        date: dateStr,
        count: existing?.count || 0
      });
    }
    
    return last7Days;
  }, [data]);
  
  const maxCount = Math.max(...processedData.map(d => d.count), 1);
  const totalAnalyses = processedData.reduce((sum, d) => sum + d.count, 0);
  const avgPerDay = (totalAnalyses / 7).toFixed(1);

  return (
    <div className={`card p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Activity className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">
              {title || (language === 'fr' ? 'Activité récente' : 'Recent activity')}
            </h3>
            <p className="text-xs text-text-tertiary">
              {language === 'fr' ? '7 derniers jours' : 'Last 7 days'}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-lg font-bold text-text-primary">{totalAnalyses}</p>
          <p className="text-xs text-text-tertiary">
            ~{avgPerDay}/{language === 'fr' ? 'jour' : 'day'}
          </p>
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={processedData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="currentColor" 
              className="text-border-subtle opacity-30"
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              tickFormatter={(val) => formatDayShort(val, language)}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-text-tertiary"
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-text-tertiary"
              axisLine={false}
              tickLine={false}
              domain={[0, Math.ceil(maxCount * 1.2)]}
            />
            <Tooltip content={<CustomTooltip language={language} />} />
            <Bar 
              dataKey="count" 
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {processedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index === processedData.length - 1 ? ACCENT_LIGHT : ACCENT_COLOR}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Empty state */}
      {totalAnalyses === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/60 rounded-xl">
          <p className="text-sm text-text-tertiary">
            {language === 'fr' ? 'Aucune analyse cette semaine' : 'No analyses this week'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ActivityChart;
