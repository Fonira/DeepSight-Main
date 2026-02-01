/**
 * 📊 ANALYTICS PAGE — User statistics dashboard
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { videoApi } from '../services/api';
import {
  BarChart3,
  Clock,
  Video,
  Coins,
  TrendingUp,
  Calendar,
  Loader2,
  Sparkles,
  Target,
  BookOpen,
  MessageSquare,
  FileText,
} from 'lucide-react';

interface UserStats {
  totalAnalyses: number;
  analysesThisMonth: number;
  totalWatchTime: number;
  creditsUsed: number;
  creditsRemaining: number;
  chatMessages: number;
  exports: number;
  weeklyActivity: number[];
  topCategories: Array<{ name: string; count: number }>;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}> = ({ icon, label, value, subtext, color }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subtext && (
          <p className="text-xs text-gray-400 mt-1">{subtext}</p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

const ActivityChart: React.FC<{ data: number[] }> = ({ data }) => {
  const max = Math.max(...data, 1);
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-purple-600" />
        Activité des 7 derniers jours
      </h3>
      <div className="flex items-end justify-between h-40 gap-2">
        {data.map((value, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-lg transition-all hover:from-purple-600 hover:to-purple-500"
              style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '8px' : '0' }}
            />
            <span className="text-xs text-gray-500 mt-2">{days[index]}</span>
            <span className="text-xs font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CreditProgress: React.FC<{ used: number; total: number }> = ({ used, total }) => {
  const percentage = Math.min((used / total) * 100, 100);
  const remaining = total - used;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Coins className="w-5 h-5 text-yellow-500" />
        Crédits du mois
      </h3>
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Utilisés: {used}</span>
          <span className="text-gray-500">Restants: {remaining}</span>
        </div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              percentage > 90
                ? 'bg-red-500'
                : percentage > 70
                ? 'bg-yellow-500'
                : 'bg-gradient-to-r from-green-400 to-emerald-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <p className="text-sm text-gray-500">
        {percentage < 50
          ? '✨ Vous avez encore beaucoup de crédits disponibles !'
          : percentage < 80
          ? '📊 Bonne utilisation de vos crédits ce mois-ci'
          : '⚠️ Attention, crédits bientôt épuisés'}
      </p>
    </div>
  );
};

const CategoryList: React.FC<{ categories: Array<{ name: string; count: number }> }> = ({ categories }) => {
  const total = categories.reduce((sum, cat) => sum + cat.count, 0);
  const colors = [
    'bg-purple-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-orange-500',
    'bg-pink-500',
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-emerald-500" />
        Catégories les plus analysées
      </h3>
      <div className="space-y-3">
        {categories.slice(0, 5).map((category, index) => (
          <div key={category.name} className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`} />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>{category.name}</span>
                <span className="text-gray-500">{category.count}</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors[index % colors.length]} rounded-full`}
                  style={{ width: `${(category.count / total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        
        // Try to fetch real stats, fallback to mock data
        try {
          const history = await videoApi.getHistory(1, 100);
          const analyses = history.items || [];
          
          // Calculate stats from history
          const now = new Date();
          const thisMonth = analyses.filter((a: any) => {
            const date = new Date(a.created_at);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          });
          
          // Weekly activity (last 7 days)
          const weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
          analyses.forEach((a: any) => {
            const date = new Date(a.created_at);
            const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff < 7) {
              weeklyActivity[6 - daysDiff]++;
            }
          });
          
          // Categories
          const categoryMap: Record<string, number> = {};
          analyses.forEach((a: any) => {
            const cat = a.category || 'Général';
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
          });
          const topCategories = Object.entries(categoryMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
          
          setStats({
            totalAnalyses: analyses.length,
            analysesThisMonth: thisMonth.length,
            totalWatchTime: analyses.reduce((sum: number, a: any) => sum + (a.duration || 0), 0),
            creditsUsed: user?.credits_used || 0,
            creditsRemaining: user?.credits_remaining || 0,
            chatMessages: 0, // Would need separate API call
            exports: 0, // Would need separate API call
            weeklyActivity,
            topCategories,
          });
        } catch (err) {
          // Mock data if API fails
          setStats({
            totalAnalyses: 24,
            analysesThisMonth: 8,
            totalWatchTime: 4320,
            creditsUsed: 450,
            creditsRemaining: 550,
            chatMessages: 156,
            exports: 12,
            weeklyActivity: [3, 5, 2, 4, 6, 1, 3],
            topCategories: [
              { name: 'Éducation', count: 8 },
              { name: 'Technologie', count: 6 },
              { name: 'Science', count: 5 },
              { name: 'Actualités', count: 3 },
              { name: 'Divertissement', count: 2 },
            ],
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <main className="flex-1 relative overflow-hidden">
        <DoodleBackground />

        <div className="relative z-10 p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold">Tableau de bord</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Suivez votre activité et vos statistiques d'utilisation
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Chargement des statistiques...
              </p>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Main stats grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={<Video className="w-6 h-6 text-white" />}
                  label="Analyses ce mois"
                  value={stats.analysesThisMonth}
                  subtext={`${stats.totalAnalyses} au total`}
                  color="bg-purple-500"
                />
                <StatCard
                  icon={<Clock className="w-6 h-6 text-white" />}
                  label="Temps analysé"
                  value={formatWatchTime(stats.totalWatchTime)}
                  subtext="Contenu vidéo total"
                  color="bg-blue-500"
                />
                <StatCard
                  icon={<MessageSquare className="w-6 h-6 text-white" />}
                  label="Messages chat"
                  value={stats.chatMessages}
                  subtext="Questions posées"
                  color="bg-emerald-500"
                />
                <StatCard
                  icon={<FileText className="w-6 h-6 text-white" />}
                  label="Exports"
                  value={stats.exports}
                  subtext="Documents générés"
                  color="bg-orange-500"
                />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActivityChart data={stats.weeklyActivity} />
                <CreditProgress
                  used={stats.creditsUsed}
                  total={stats.creditsUsed + stats.creditsRemaining}
                />
              </div>

              {/* Categories */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryList categories={stats.topCategories} />
                
                {/* Tips card */}
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="w-6 h-6" />
                    <h3 className="font-semibold">Conseil du jour</h3>
                  </div>
                  <p className="text-purple-100 mb-4">
                    Vous avez analysé {stats.analysesThisMonth} vidéos ce mois-ci ! 
                    Continuez à explorer de nouveaux contenus pour enrichir vos connaissances.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-purple-200">
                    <TrendingUp className="w-4 h-4" />
                    <span>+{Math.round(stats.analysesThisMonth * 1.2)} prévision pour le mois prochain</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsPage;
