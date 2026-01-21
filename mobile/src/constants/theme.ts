export const Colors = {
  // Backgrounds
  bgPrimary: '#0a0a0b',
  bgSecondary: '#111113',
  bgTertiary: '#181819',
  bgElevated: '#1f1f23',
  bgHover: '#272a2a',
  bgCard: '#16161a',

  // Text
  textPrimary: '#FAFAF9',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  textMuted: '#52525B',

  // Accent
  accentPrimary: '#6366F1',
  accentPrimaryLight: '#818CF8',
  accentSecondary: '#F59E0B',
  accentSuccess: '#10B981',
  accentError: '#EF4444',
  accentWarning: '#F59E0B',
  accentInfo: '#3B82F6',

  // Borders
  border: '#27272A',
  borderLight: '#3F3F46',

  // Gradients
  gradientPrimary: ['#6366F1', '#8B5CF6'] as const,
  gradientSecondary: ['#F59E0B', '#EF4444'] as const,
  gradientDark: ['#0a0a0b', '#111113'] as const,

  // Light theme (for reference)
  light: {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F4F4F5',
    bgTertiary: '#E4E4E7',
    textPrimary: '#18181B',
    textSecondary: '#52525B',
    border: '#E4E4E7',
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

export const Typography = {
  // Font families
  fontFamily: {
    display: 'Cormorant-Bold',
    body: 'DMSans-Regular',
    bodyMedium: 'DMSans-Medium',
    bodySemiBold: 'DMSans-SemiBold',
    bodyBold: 'DMSans-Bold',
    mono: 'JetBrainsMono-Regular',
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
};

export const Animation = {
  fast: 150,
  base: 200,
  slow: 300,
  slower: 500,
};

export default {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
  Animation,
};
