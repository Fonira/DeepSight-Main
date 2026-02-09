/**
 * 🔄 BACKGROUND ANALYSIS CONTEXT v2.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Permet de lancer des analyses qui continuent même si on change de page
 * 
 * Features:
 * - Analyses vidéo en arrière-plan
 * - Analyses playlist en arrière-plan
 * - Notifications de progression
 * - Persistance dans la session
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { videoApi, playlistApi, Summary } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VideoAnalysisTask {
  id: string;
  type: 'video';
  taskId: string;
  videoUrl: string;
  videoTitle?: string;
  thumbnail?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: Summary;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface PlaylistAnalysisTask {
  id: string;
  type: 'playlist';
  taskId: string;
  playlistUrl: string;
  playlistTitle?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  totalVideos?: number;
  completedVideos?: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export type AnalysisTask = VideoAnalysisTask | PlaylistAnalysisTask;

interface BackgroundAnalysisContextType {
  // État
  tasks: AnalysisTask[];
  activeTasksCount: number;
  
  // Actions vidéo
  startVideoAnalysis: (params: {
    videoUrl: string;
    mode: string;
    category: string;
  }) => Promise<string>; // Retourne l'ID de la tâche
  
  // Actions playlist
  startPlaylistAnalysis: (params: {
    playlistUrl?: string;
    urls?: string[];
    mode: string;
    category: string;
  }) => Promise<string>;
  
  // Gestion
  getTask: (taskId: string) => AnalysisTask | undefined;
  removeTask: (taskId: string) => void;
  clearCompleted: () => void;
  
  // Notifications
  hasNewCompletedTask: boolean;
  acknowledgeCompleted: () => void;
}

const BackgroundAnalysisContext = createContext<BackgroundAnalysisContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 PERSISTENCE KEYS
// ═══════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = 'deepsight_pending_tasks';

export const BackgroundAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [hasNewCompletedTask, setHasNewCompletedTask] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ═══════════════════════════════════════════════════════════════════════════════
  // 💾 PERSISTENCE: Sauvegarder les tâches en cours dans localStorage
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isRestoring) return; // Ne pas sauvegarder pendant la restauration

    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing');

    // Sauvegarder uniquement les infos nécessaires pour reprendre
    const tasksToStore = pendingTasks.map(t => ({
      id: t.id,
      type: t.type,
      taskId: t.taskId,
      videoUrl: t.type === 'video' ? (t as VideoAnalysisTask).videoUrl : undefined,
      playlistUrl: t.type === 'playlist' ? (t as PlaylistAnalysisTask).playlistUrl : undefined,
      status: t.status,
      progress: t.progress,
      message: t.message,
      startedAt: t.startedAt,
    }));

    try {
      if (tasksToStore.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToStore));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[BackgroundAnalysis] Failed to save to localStorage:', e);
    }
  }, [tasks, isRestoring]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 💾 PERSISTENCE: Restaurer les tâches au démarrage
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const restoreTasks = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setIsRestoring(false);
          return;
        }

        const storedTasks = JSON.parse(stored);
        console.log('[BackgroundAnalysis] Restoring', storedTasks.length, 'pending tasks');

        // Restaurer les tâches et reprendre le polling
        for (const task of storedTasks) {
          if (task.taskId && task.status === 'processing') {
            // Recréer la tâche
            const restoredTask: AnalysisTask = task.type === 'video'
              ? {
                  ...task,
                  startedAt: new Date(task.startedAt),
                } as VideoAnalysisTask
              : {
                  ...task,
                  startedAt: new Date(task.startedAt),
                } as PlaylistAnalysisTask;

            setTasks(prev => [...prev, restoredTask]);

            // Reprendre le polling
            setTimeout(() => {
              startPolling(task.id, task.taskId, task.type);
            }, 500);
          }
        }

        // Nettoyer le localStorage après restauration
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn('[BackgroundAnalysis] Failed to restore tasks:', e);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreTasks();
  }, []);

  // Nettoyer les intervals au démontage
  useEffect(() => {
    return () => {
      pollingIntervals.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  // Calculer le nombre de tâches actives
  const activeTasksCount = tasks.filter(t => t.status === 'pending' || t.status === 'processing').length;

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎬 VIDEO ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════════

  const startVideoAnalysis = useCallback(async (params: {
    videoUrl: string;
    mode: string;
    category: string;
  }): Promise<string> => {
    const taskId = `video-${Date.now()}`;
    
    // Créer la tâche
    const newTask: VideoAnalysisTask = {
      id: taskId,
      type: 'video',
      taskId: '',
      videoUrl: params.videoUrl,
      status: 'pending',
      progress: 0,
      message: 'Démarrage de l\'analyse...',
      startedAt: new Date(),
    };
    
    setTasks(prev => [...prev, newTask]);

    try {
      // Lancer l'analyse
      const response = await videoApi.analyze(
        params.videoUrl,
        params.mode,
        params.category === 'auto' ? undefined : params.category
      );

      // Mettre à jour avec l'ID de tâche
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, taskId: response.task_id, status: 'processing' as const, message: 'Analyse en cours...' }
          : t
      ));

      // Démarrer le polling
      startPolling(taskId, response.task_id, 'video');

      return taskId;
    } catch (error: any) {
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'failed' as const, error: error.message || 'Erreur inconnue' }
          : t
      ));
      throw error;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📚 PLAYLIST ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════════

  const startPlaylistAnalysis = useCallback(async (params: {
    playlistUrl?: string;
    urls?: string[];
    mode: string;
    category: string;
  }): Promise<string> => {
    const taskId = `playlist-${Date.now()}`;
    
    const newTask: PlaylistAnalysisTask = {
      id: taskId,
      type: 'playlist',
      taskId: '',
      playlistUrl: params.playlistUrl || 'Corpus personnalisé',
      status: 'pending',
      progress: 0,
      message: 'Démarrage de l\'analyse...',
      startedAt: new Date(),
    };
    
    setTasks(prev => [...prev, newTask]);

    try {
      let response;
      
      if (params.playlistUrl) {
        response = await playlistApi.analyze(
          params.playlistUrl,
          {
            mode: params.mode,
            category: params.category === 'auto' ? undefined : params.category,
          }
        );
      } else if (params.urls) {
        response = await playlistApi.analyzeCorpus(
          params.urls,
          {
            mode: params.mode,
          }
        );
      } else {
        throw new Error('URL de playlist ou corpus requis');
      }

      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, taskId: response.task_id, status: 'processing' as const, message: 'Analyse en cours...' }
          : t
      ));

      startPolling(taskId, response.task_id, 'playlist');

      return taskId;
    } catch (error: any) {
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'failed' as const, error: error.message || 'Erreur inconnue' }
          : t
      ));
      throw error;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔄 POLLING
  // ═══════════════════════════════════════════════════════════════════════════════

  const startPolling = useCallback((localId: string, apiTaskId: string, type: 'video' | 'playlist') => {
    const interval = setInterval(async () => {
      try {
        if (type === 'video') {
          const status = await videoApi.getTaskStatus(apiTaskId);
          
          setTasks(prev => prev.map(t => {
            if (t.id !== localId) return t;
            
            const videoTask = t as VideoAnalysisTask;
            
            if (status.status === 'completed' && status.result) {
              clearInterval(interval);
              pollingIntervals.current.delete(localId);
              setHasNewCompletedTask(true);
              
              return {
                ...videoTask,
                status: 'completed' as const,
                progress: 100,
                message: 'Analyse terminée !',
                result: status.result?.summary,
                videoTitle: status.result?.summary?.video_title || videoTask.videoTitle,
                thumbnail: status.result?.summary?.thumbnail_url || videoTask.thumbnail,
                completedAt: new Date(),
              };
            } else if (status.status === 'failed') {
              clearInterval(interval);
              pollingIntervals.current.delete(localId);

              return {
                ...videoTask,
                status: 'failed' as const,
                error: status.error || 'Échec de l\'analyse',
              };
            } else {
              return {
                ...videoTask,
                progress: status.progress || videoTask.progress,
                message: status.message || videoTask.message,
              };
            }
          }));
        } else {
          const status = await playlistApi.getStatus(apiTaskId);
          
          setTasks(prev => prev.map(t => {
            if (t.id !== localId) return t;
            
            const playlistTask = t as PlaylistAnalysisTask;
            
            if (status.status === 'completed') {
              clearInterval(interval);
              pollingIntervals.current.delete(localId);
              setHasNewCompletedTask(true);
              
              return {
                ...playlistTask,
                status: 'completed' as const,
                progress: 100,
                message: 'Analyse terminée !',
                playlistTitle: status.playlist_title,
                totalVideos: status.total_videos,
                completedVideos: status.completed_videos,
                completedAt: new Date(),
              };
            } else if (status.status === 'failed') {
              clearInterval(interval);
              pollingIntervals.current.delete(localId);

              return {
                ...playlistTask,
                status: 'failed' as const,
                error: status.error || 'Échec de l\'analyse',
              };
            } else {
              return {
                ...playlistTask,
                progress: status.progress || playlistTask.progress,
                message: status.message || playlistTask.message,
                totalVideos: status.total_videos,
                completedVideos: status.completed_videos,
              };
            }
          }));
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    pollingIntervals.current.set(localId, interval);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🗑️ GESTION
  // ═══════════════════════════════════════════════════════════════════════════════

  const getTask = useCallback((taskId: string) => {
    return tasks.find(t => t.id === taskId);
  }, [tasks]);

  const removeTask = useCallback((taskId: string) => {
    const interval = pollingIntervals.current.get(taskId);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.current.delete(taskId);
    }
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
  }, []);

  const acknowledgeCompleted = useCallback(() => {
    setHasNewCompletedTask(false);
  }, []);

  return (
    <BackgroundAnalysisContext.Provider value={{
      tasks,
      activeTasksCount,
      startVideoAnalysis,
      startPlaylistAnalysis,
      getTask,
      removeTask,
      clearCompleted,
      hasNewCompletedTask,
      acknowledgeCompleted,
    }}>
      {children}
    </BackgroundAnalysisContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export const useBackgroundAnalysis = () => {
  const context = useContext(BackgroundAnalysisContext);
  if (!context) {
    throw new Error('useBackgroundAnalysis must be used within BackgroundAnalysisProvider');
  }
  return context;
};

export default BackgroundAnalysisContext;
