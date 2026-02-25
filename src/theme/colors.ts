// ── Light theme colors (default) ──
export const LightColors = {
  // Primary palette — warm & approachable
  primary: '#6C63FF',
  primaryLight: '#A5A0FF',
  primaryDark: '#4A42DB',

  // Secondary / accent
  secondary: '#FF6B9D',
  secondaryLight: '#FF9EC0',
  accent: '#FFB347',
  accentLight: '#FFD699',

  // Warm gradients
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  gradientWarm: ['#f093fb', '#f5576c'] as string[],
  gradientSky: ['#4facfe', '#00f2fe'] as string[],
  gradientSunset: ['#fa709a', '#fee140'] as string[],
  gradientMint: ['#a8edea', '#fed6e3'] as string[],
  gradientPeach: ['#ffecd2', '#fcb69f'] as string[],

  // Status colors
  success: '#4CAF50',
  successLight: '#C8E6C9',
  warning: '#FF9800',
  warningLight: '#FFE0B2',
  danger: '#F44336',
  dangerLight: '#FFCDD2',
  info: '#2196F3',
  infoLight: '#BBDEFB',

  // Mood colors
  moodHappy: '#FFD93D',
  moodCalm: '#6BCB77',
  moodSleepy: '#9B59B6',
  moodFussy: '#FF6B6B',
  moodPlayful: '#4ECDC4',

  // Neutrals
  white: '#FFFFFF',
  background: '#F8F6FF',
  backgroundWarm: '#FFF8F0',
  card: '#FFFFFF',
  cardShadow: 'rgba(108, 99, 255, 0.08)',
  border: '#E8E5F0',
  borderLight: '#F0EEF5',
  textPrimary: '#2D2B3D',
  textSecondary: '#7B7890',
  textMuted: '#A9A6B8',
  textWhite: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.4)',

  // Activity type colors
  meal: '#FF9800',
  nap: '#9B59B6',
  diaper: '#4ECDC4',
  activity: '#6C63FF',
  milestone: '#FFD93D',
  photo: '#FF6B9D',
  note: '#2196F3',
  medication: '#F44336',
  checkin: '#4CAF50',
  checkout: '#FF5722',
  mood: '#FFD93D',
  incident: '#F44336',
};

// ── Dark theme colors ──
export const DarkColors: typeof LightColors = {
  // Primary palette — same hues, slightly adjusted for dark bg
  primary: '#8B83FF',
  primaryLight: '#A5A0FF',
  primaryDark: '#6C63FF',

  // Secondary / accent
  secondary: '#FF6B9D',
  secondaryLight: '#FF9EC0',
  accent: '#FFB347',
  accentLight: '#FFD699',

  // Warm gradients (same — they're decorative)
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  gradientWarm: ['#f093fb', '#f5576c'] as string[],
  gradientSky: ['#4facfe', '#00f2fe'] as string[],
  gradientSunset: ['#fa709a', '#fee140'] as string[],
  gradientMint: ['#a8edea', '#fed6e3'] as string[],
  gradientPeach: ['#ffecd2', '#fcb69f'] as string[],

  // Status colors — brighter variants for dark bg
  success: '#66BB6A',
  successLight: '#1B3A1B',
  warning: '#FFA726',
  warningLight: '#3A2E1B',
  danger: '#EF5350',
  dangerLight: '#3A1B1B',
  info: '#42A5F5',
  infoLight: '#1B2E3A',

  // Mood colors
  moodHappy: '#FFD93D',
  moodCalm: '#6BCB77',
  moodSleepy: '#9B59B6',
  moodFussy: '#FF6B6B',
  moodPlayful: '#4ECDC4',

  // Neutrals — inverted
  white: '#FFFFFF',
  background: '#121118',
  backgroundWarm: '#1A1520',
  card: '#1E1C2E',
  cardShadow: 'rgba(0, 0, 0, 0.3)',
  border: '#2E2C40',
  borderLight: '#252338',
  textPrimary: '#ECEAF5',
  textSecondary: '#A9A6C0',
  textMuted: '#6B6888',
  textWhite: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',

  // Activity type colors — slightly brighter
  meal: '#FFA726',
  nap: '#AB6CC5',
  diaper: '#5ADCD2',
  activity: '#8B83FF',
  milestone: '#FFE066',
  photo: '#FF85AD',
  note: '#42A5F5',
  medication: '#EF5350',
  checkin: '#66BB6A',
  checkout: '#FF7043',
  mood: '#FFE066',
  incident: '#EF5350',
};

// ── Default export: light theme (backward compatible) ──
export const Colors = LightColors;

export const Shadows = {
  small: {
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  large: {
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const DarkShadows: typeof Shadows = {
  small: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  large: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
};
