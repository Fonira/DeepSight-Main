// Format duration from seconds to human readable string
export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// Format large numbers (e.g., view counts)
export const formatNumber = (num: number): string => {
  if (!num || num < 0) return '0';

  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

// Format date to relative time (e.g., "2 hours ago")
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffWeeks < 4) return `Il y a ${diffWeeks} sem.`;
  if (diffMonths < 12) return `Il y a ${diffMonths} mois`;
  return `Il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
};

// Format date to readable string
export const formatDate = (dateString: string, locale: string = 'fr-FR'): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format date and time
export const formatDateTime = (dateString: string, locale: string = 'fr-FR'): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format credits display
export const formatCredits = (used: number, total: number): string => {
  return `${used}/${total}`;
};

// Format percentage
export const formatPercentage = (value: number, decimals: number = 0): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// URL validation result interface for real-time feedback
export interface URLValidationResult {
  isValid: boolean;
  videoId: string | null;
  urlType: 'watch' | 'youtu.be' | 'embed' | 'v' | 'shorts' | 'direct' | null;
  error?: string;
}

// Extract YouTube video ID from URL (synced with backend patterns)
export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;

  const trimmed = url.trim();

  // Patterns synced with backend (youtube.py)
  const patterns = [
    // Standard watch URL, youtu.be short link, embed, and /v/ format
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    // YouTube Shorts
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Direct video ID (11 characters)
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

// Validate YouTube URL with detailed feedback
export const validateYouTubeUrl = (url: string): URLValidationResult => {
  if (!url || !url.trim()) {
    return { isValid: false, videoId: null, urlType: null };
  }

  const trimmed = url.trim();

  // Check for YouTube Shorts
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) {
    return { isValid: true, videoId: shortsMatch[1], urlType: 'shorts' };
  }

  // Check for standard watch URL
  const watchMatch = trimmed.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) {
    return { isValid: true, videoId: watchMatch[1], urlType: 'watch' };
  }

  // Check for youtu.be short link
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return { isValid: true, videoId: shortMatch[1], urlType: 'youtu.be' };
  }

  // Check for embed URL
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) {
    return { isValid: true, videoId: embedMatch[1], urlType: 'embed' };
  }

  // Check for /v/ URL
  const vMatch = trimmed.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch) {
    return { isValid: true, videoId: vMatch[1], urlType: 'v' };
  }

  // Check for direct video ID
  const directMatch = trimmed.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directMatch) {
    return { isValid: true, videoId: trimmed, urlType: 'direct' };
  }

  // Check if it looks like a URL but isn't valid YouTube
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    return {
      isValid: false,
      videoId: null,
      urlType: null,
      error: 'Invalid YouTube URL format'
    };
  }

  return { isValid: false, videoId: null, urlType: null };
};

// Validate YouTube URL (simple boolean check)
export const isValidYouTubeUrl = (url: string): boolean => {
  return extractYouTubeId(url) !== null;
};

// Get YouTube thumbnail URL
export const getYouTubeThumbnail = (
  videoId: string,
  quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'
): string => {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    maxres: 'maxresdefault',
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
};

// Format word count
export const formatWordCount = (count: number): string => {
  if (count < 1000) return `${count} mots`;
  return `${(count / 1000).toFixed(1)}k mots`;
};

// Capitalize first letter
export const capitalizeFirst = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default {
  formatDuration,
  formatNumber,
  formatRelativeTime,
  formatDate,
  formatDateTime,
  formatCredits,
  formatPercentage,
  formatFileSize,
  truncateText,
  extractYouTubeId,
  validateYouTubeUrl,
  isValidYouTubeUrl,
  getYouTubeThumbnail,
  formatWordCount,
  capitalizeFirst,
};
