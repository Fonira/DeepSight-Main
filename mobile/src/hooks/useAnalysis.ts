import { useCallback, useRef, useEffect } from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { videoApi } from '../services/api';
import type { AnalysisOptionsV2 } from '../types/v2';

export function useAnalysis() {
  const store = useAnalysisStore();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startAnalysis = useCallback(
    async (url: string, options?: Partial<AnalysisOptionsV2>) => {
      try {
        const mergedOptions = { ...store.options, ...options };
        store.startAnalysis('pending');

        const response = await videoApi.analyze({
          url,
          mode: mergedOptions.mode,
          language: mergedOptions.language,
          model: 'mistral',
          category: 'auto',
        });

        const taskId = response.task_id;
        if (!taskId) throw new Error('No task ID returned');

        store.startAnalysis(taskId);

        // Start polling every 2.5s
        pollingRef.current = setInterval(async () => {
          try {
            const data = await videoApi.getStatus(taskId);

            if (data.status === 'processing') {
              store.setProgress(data.progress || 0);
            } else if (data.status === 'completed') {
              stopPolling();
              store.completeAnalysis();
              if (data.result) {
                store.addSummary(data.result);
              }
            } else if (data.status === 'failed') {
              stopPolling();
              store.failAnalysis(data.error || 'Analysis failed');
            }
          } catch {
            stopPolling();
            store.failAnalysis('Connection lost');
          }
        }, 2500);
      } catch (err: any) {
        store.failAnalysis(err.message || 'Failed to start analysis');
      }
    },
    [store, stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    ...store,
    startAnalysis,
    stopPolling,
  };
}
