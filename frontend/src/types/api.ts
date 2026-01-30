/**
 * Types API DeepSight
 * @description Types partagés pour l'API backend
 */

export interface User {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  plan: 'free' | 'student' | 'starter' | 'pro' | 'expert' | 'team' | 'unlimited';
  credits: number;
  credits_monthly: number;
  credits_remaining?: number;
  analysis_count?: number;
  is_admin: boolean;
  isAdmin?: boolean;
  avatar_url?: string;
  default_lang?: string;
  default_mode?: string;
  default_model?: string;
  total_videos: number;
  total_words: number;
  total_playlists: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}
