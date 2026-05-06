/**
 * 🔄 BACKGROUND ANALYSIS CONTEXT - Mobile v1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Permet de lancer des analyses qui continuent même si on change d'écran.
 *
 * Features:
 * - Analyses vidéo en arrière-plan
 * - Notifications de progression
 * - Persistance avec AsyncStorage
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { videoApi } from "../services/api";
import {
  posthogAnalytics,
  AnalyticsEvents,
} from "../services/posthog";
import type { AnalysisSummary } from "../types";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VideoAnalysisTask {
  id: string;
  type: "video";
  taskId: string;
  videoUrl: string;
  videoTitle?: string;
  thumbnail?: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  result?: AnalysisSummary;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export type AnalysisTask = VideoAnalysisTask;

/** Callback for task subscription updates */
export type TaskSubscriptionCallback = (task: AnalysisTask) => void;

// Standardized polling interval (2.5 seconds - balanced between responsiveness and API load)
const POLLING_INTERVAL_MS = 2500;

interface BackgroundAnalysisContextType {
  // État
  tasks: AnalysisTask[];
  activeTasksCount: number;

  // Actions vidéo
  startVideoAnalysis: (params: {
    videoUrl: string;
    mode: string;
    category: string;
  }) => Promise<string>;

  // Gestion
  getTask: (taskId: string) => AnalysisTask | undefined;
  removeTask: (taskId: string) => void;
  clearCompleted: () => void;

  // Subscriptions (for AnalysisScreen to use instead of local polling)
  subscribeToTask: (
    taskId: string,
    callback: TaskSubscriptionCallback,
  ) => () => void;

  // Notifications
  hasNewCompletedTask: boolean;
  acknowledgeCompleted: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 PERSISTENCE KEY
// ═══════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = "deepsight_pending_tasks";

const BackgroundAnalysisContext = createContext<
  BackgroundAnalysisContextType | undefined
>(undefined);

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export const BackgroundAnalysisProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [hasNewCompletedTask, setHasNewCompletedTask] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const pollingIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const taskSubscriptions = useRef<Map<string, Set<TaskSubscriptionCallback>>>(
    new Map(),
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔄 POLLING (defined first for hoisting)
  // ═══════════════════════════════════════════════════════════════════════════════

  const startPolling = useCallback((localId: string, apiTaskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await videoApi.getStatus(apiTaskId);

        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== localId) return t;

            const videoTask = t as VideoAnalysisTask;

            if (status.status === "completed") {
              clearInterval(interval);
              pollingIntervals.current.delete(localId);
              setHasNewCompletedTask(true);

              const result = status.result as
                | (AnalysisSummary & {
                    duration?: number;
                    title?: string;
                    thumbnail?: string;
                  })
                | undefined;
              posthogAnalytics.capture(AnalyticsEvents.VIDEO_ANALYZED, {
                video_id: (result as { video_id?: string } | undefined)?.video_id,
                duration_s: (result as { duration?: number } | undefined)?.duration,
                platform: "mobile",
              });

              return {
                ...videoTask,
                status: "completed" as const,
                progress: 100,
                message: "Analyse terminée !",
                result: status.result as unknown as AnalysisSummary | undefined,
                videoTitle:
                  (status.result?.title as string) || videoTask.videoTitle,
                thumbnail:
                  (status.result?.thumbnail as string) || videoTask.thumbnail,
                completedAt: new Date(),
              };
            } else if (status.status === "failed") {
              clearInterval(interval);
              pollingIntervals.current.delete(localId);

              return {
                ...videoTask,
                status: "failed" as const,
                error: status.error || "Échec de l'analyse",
              };
            } else {
              return {
                ...videoTask,
                progress: status.progress || videoTask.progress,
                message: status.message || videoTask.message,
              };
            }
          }),
        );
      } catch (error) {
        if (__DEV__) {
          console.error("Polling error:", error);
        }
      }
    }, POLLING_INTERVAL_MS);

    pollingIntervals.current.set(localId, interval);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 💾 PERSISTENCE: Sauvegarder les tâches en cours
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isRestoring) return;

    const saveTasks = async () => {
      const pendingTasks = tasks.filter(
        (t) => t.status === "pending" || t.status === "processing",
      );

      const tasksToStore = pendingTasks.map((t) => ({
        id: t.id,
        type: t.type,
        taskId: t.taskId,
        videoUrl: (t as VideoAnalysisTask).videoUrl,
        status: t.status,
        progress: t.progress,
        message: t.message,
        startedAt: t.startedAt.toISOString(),
      }));

      try {
        if (tasksToStore.length > 0) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToStore));
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn("[BackgroundAnalysis] Failed to save:", e);
        }
      }
    };

    saveTasks();
  }, [tasks, isRestoring]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 💾 PERSISTENCE: Restaurer les tâches au démarrage
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const restoreTasks = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setIsRestoring(false);
          return;
        }

        const storedTasks = JSON.parse(stored);
        if (__DEV__) {
          console.log(
            "[BackgroundAnalysis] Restoring",
            storedTasks.length,
            "tasks",
          );
        }

        for (const task of storedTasks) {
          if (task.taskId && task.status === "processing") {
            const restoredTask: VideoAnalysisTask = {
              ...task,
              startedAt: new Date(task.startedAt),
            } as VideoAnalysisTask;

            setTasks((prev) => [...prev, restoredTask]);

            setTimeout(() => {
              startPolling(task.id, task.taskId);
            }, 500);
          }
        }

        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        if (__DEV__) {
          console.warn("[BackgroundAnalysis] Failed to restore:", e);
        }
        await AsyncStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreTasks();
  }, [startPolling]);

  // Nettoyer les intervals au démontage
  useEffect(() => {
    return () => {
      pollingIntervals.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  const activeTasksCount = tasks.filter(
    (t) => t.status === "pending" || t.status === "processing",
  ).length;

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎬 VIDEO ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════════

  const startVideoAnalysis = useCallback(
    async (params: {
      videoUrl: string;
      mode: string;
      category: string;
    }): Promise<string> => {
      const taskId = `video-${Date.now()}`;

      const newTask: VideoAnalysisTask = {
        id: taskId,
        type: "video",
        taskId: "",
        videoUrl: params.videoUrl,
        status: "pending",
        progress: 0,
        message: "Démarrage de l'analyse...",
        startedAt: new Date(),
      };

      setTasks((prev) => [...prev, newTask]);

      try {
        const response = await videoApi.analyze({
          url: params.videoUrl,
          mode: params.mode,
          category: params.category === "auto" ? "general" : params.category,
          model: "mistral-small-2603",
          language: "fr",
        });

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  taskId: response.task_id,
                  status: "processing" as const,
                  message: "Analyse en cours...",
                }
              : t,
          ),
        );

        startPolling(taskId, response.task_id);
        return taskId;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Erreur inconnue";
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: "failed" as const, error: errorMessage }
              : t,
          ),
        );
        throw error;
      }
    },
    [startPolling],
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🗑️ GESTION
  // ═══════════════════════════════════════════════════════════════════════════════

  const getTask = useCallback(
    (taskId: string) => {
      return tasks.find((t) => t.id === taskId);
    },
    [tasks],
  );

  const removeTask = useCallback((taskId: string) => {
    const interval = pollingIntervals.current.get(taskId);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.current.delete(taskId);
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) =>
      prev.filter((t) => t.status !== "completed" && t.status !== "failed"),
    );
  }, []);

  const acknowledgeCompleted = useCallback(() => {
    setHasNewCompletedTask(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📡 SUBSCRIPTIONS - Allow AnalysisScreen to subscribe to task updates
  // ═══════════════════════════════════════════════════════════════════════════════

  const subscribeToTask = useCallback(
    (taskId: string, callback: TaskSubscriptionCallback): (() => void) => {
      // Get or create subscription set for this task
      if (!taskSubscriptions.current.has(taskId)) {
        taskSubscriptions.current.set(taskId, new Set());
      }
      taskSubscriptions.current.get(taskId)!.add(callback);

      // Return unsubscribe function
      return () => {
        const subscriptions = taskSubscriptions.current.get(taskId);
        if (subscriptions) {
          subscriptions.delete(callback);
          if (subscriptions.size === 0) {
            taskSubscriptions.current.delete(taskId);
          }
        }
      };
    },
    [],
  );

  // Notify subscribers whenever tasks change
  useEffect(() => {
    tasks.forEach((task) => {
      const subscribers = taskSubscriptions.current.get(task.id);
      if (subscribers) {
        subscribers.forEach((callback) => callback(task));
      }
    });
  }, [tasks]);

  return (
    <BackgroundAnalysisContext.Provider
      value={{
        tasks,
        activeTasksCount,
        startVideoAnalysis,
        getTask,
        removeTask,
        clearCompleted,
        subscribeToTask,
        hasNewCompletedTask,
        acknowledgeCompleted,
      }}
    >
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
    throw new Error(
      "useBackgroundAnalysis must be used within BackgroundAnalysisProvider",
    );
  }
  return context;
};

export default BackgroundAnalysisContext;
