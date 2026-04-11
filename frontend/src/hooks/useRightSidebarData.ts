/**
 * useRightSidebarData — Centralized data fetching for the right sidebar.
 * Fetches Tournesol picks + recent activity with in-memory caching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { tournesolApi } from '../services/api';
import type { VideoCandidate } from '../services/api';

interface RecentAnalysis {
  id: number;
  video_id: string;
  video_title: string;
  platform: string;
  thumbnail_url?: string;
  created_at: string;
}

interface RightSidebarData {
  tournesolPicks: VideoCandidate[];
  recentActivity: RecentAnalysis[];
  isLoadingTournesol: boolean;
  isLoadingActivity: boolean;
  refreshTournesol: () => void;
  refreshActivity: () => void;
}

// Cache durations
const TOURNESOL_CACHE_MS = 10 * 60 * 1000; // 10 min
const ACTIVITY_CACHE_MS = 2 * 60 * 1000;   // 2 min

// Module-level cache to avoid refetch on re-mount
let tournesolCache: { data: VideoCandidate[]; timestamp: number } | null = null;
let activityCache: { data: RecentAnalysis[]; timestamp: number } | null = null;

export function useRightSidebarData(): RightSidebarData {
  const [tournesolPicks, setTournesolPicks] = useState<VideoCandidate[]>(tournesolCache?.data ?? []);
  const [recentActivity, setRecentActivity] = useState<RecentAnalysis[]>(activityCache?.data ?? []);
  const [isLoadingTournesol, setIsLoadingTournesol] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const mounted = useRef(true);

  const fetchTournesol = useCallback(async (force = false) => {
    if (!force && tournesolCache && Date.now() - tournesolCache.timestamp < TOURNESOL_CACHE_MS) {
      setTournesolPicks(tournesolCache.data);
      return;
    }
    setIsLoadingTournesol(true);
    try {
      const data = await tournesolApi.recommendations(6);
      // Pick 3 random from the 6 for variety
      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 3);
      if (mounted.current) {
        tournesolCache = { data: shuffled, timestamp: Date.now() };
        setTournesolPicks(shuffled);
      }
    } catch {
      // Silently fail — sidebar is non-critical
    } finally {
      if (mounted.current) setIsLoadingTournesol(false);
    }
  }, []);

  const fetchActivity = useCallback(async (force = false) => {
    if (!force && activityCache && Date.now() - activityCache.timestamp < ACTIVITY_CACHE_MS) {
      setRecentActivity(activityCache.data);
      return;
    }
    setIsLoadingActivity(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/history/videos?limit=5&offset=0`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const items: RecentAnalysis[] = (json.items || json || []).slice(0, 5).map((s: Record<string, unknown>) => ({
        id: s.id,
        video_id: s.video_id,
        video_title: s.video_title || s.title || 'Sans titre',
        platform: s.platform || 'youtube',
        thumbnail_url: s.thumbnail_url,
        created_at: s.created_at,
      }));
      if (mounted.current) {
        activityCache = { data: items, timestamp: Date.now() };
        setRecentActivity(items);
      }
    } catch {
      // Silently fail
    } finally {
      if (mounted.current) setIsLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchTournesol();
    fetchActivity();
    return () => { mounted.current = false; };
  }, [fetchTournesol, fetchActivity]);

  return {
    tournesolPicks,
    recentActivity,
    isLoadingTournesol,
    isLoadingActivity,
    refreshTournesol: () => fetchTournesol(true),
    refreshActivity: () => fetchActivity(true),
  };
}
