/**
 * DOODLE PATHS — Extension subset
 * Selected paths from the website's full doodle library.
 */

// VIDEO
export const ICON_PLAY = 'M5 3l14 9-14 9V3z';
export const ICON_CAMERA = 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z';
export const ICON_HEADPHONES = 'M3 18v-6a9 9 0 0118 0v6';
export const ICON_YOUTUBE = 'M22.54 6.42A2.78 2.78 0 0020.6 4.42C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z';
export const ICON_WAVEFORM = 'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0';

// STUDY
export const ICON_BOOK = 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z';
export const ICON_LIGHTBULB = 'M9 18h6M10 22h4M12 2a6 6 0 00-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 00-6-6z';
export const ICON_BRAIN = 'M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z';
export const ICON_GRADUATION = 'M22 10l-10-5L2 10l10 5zm-16 2v5c0 2 2.7 3 6 3s6-1 6-3v-5';

// AI
export const ICON_SPARKLES = 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6';
export const ICON_LIGHTNING = 'M13 2L3 14h9l-1 8 10-12h-9z';
export const ICON_ROBOT = 'M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z';
export const ICON_SEARCH = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';
export const ICON_GLOBE = 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z';

// CREATIVE
export const ICON_STAR = 'M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z';
export const ICON_HEART = 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z';
export const ICON_SPARKLE_4PT = 'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z';
export const ICON_CROWN = 'M2 17l3-7 4 4 3-9 3 9 4-4 3 7z';
export const ICON_DIAMOND = 'M12 2l10 10-10 10L2 12z';

// TECH
export const ICON_CODE = 'M16 18l6-6-6-6M8 6l-6 6 6 6';
export const ICON_SHIELD = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';

// Map for named access
export const DOODLE_MAP: Record<string, string> = {
  play: ICON_PLAY,
  camera: ICON_CAMERA,
  headphones: ICON_HEADPHONES,
  youtube: ICON_YOUTUBE,
  waveform: ICON_WAVEFORM,
  book: ICON_BOOK,
  lightbulb: ICON_LIGHTBULB,
  brain: ICON_BRAIN,
  graduation: ICON_GRADUATION,
  sparkles: ICON_SPARKLES,
  lightning: ICON_LIGHTNING,
  robot: ICON_ROBOT,
  search: ICON_SEARCH,
  globe: ICON_GLOBE,
  star: ICON_STAR,
  heart: ICON_HEART,
  sparkle4pt: ICON_SPARKLE_4PT,
  crown: ICON_CROWN,
  diamond: ICON_DIAMOND,
  code: ICON_CODE,
  shield: ICON_SHIELD,
};

// All paths as array for random decoration
export const ALL_DOODLE_PATHS = Object.values(DOODLE_MAP);
