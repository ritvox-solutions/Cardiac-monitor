import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

/**
 * Cardiac Monitor - Healthcare Design System
 * 
 * Design Direction: Soft UI Evolution (accessibility-focused, better contrast than neumorphism)
 * - Colors: Calm cyan/blue primary + health green accent + soft backgrounds
 * - Typography: Figtree (headings) + Noto Sans (body) - medical-grade, highly readable
 * - Motion: Subtle stagger animations (300-450ms), respect reduced-motion
 * - Shadows: Modern soft shadows (softer than flat, clearer than neumorphism)
 * - Border radius: 10-12px consistent
 */

// ============================================================================
// COLOR SYSTEM - Healthcare-focused palette
// ============================================================================

export const Colors = {
  // Primary - Calm cyan/blue (trust, medical professionalism)
  primary: '#0891B2',
  primaryLight: '#22D3EE',
  primaryDark: '#0E7490',
  primaryContainer: '#E0F7FA',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#164E63',

  // Secondary - Soft cyan
  secondary: '#06B6D4',
  secondaryLight: '#67E8F9',
  secondaryDark: '#0891B2',
  secondaryContainer: '#ECFEFF',
  onSecondary: '#0F172A',
  onSecondaryContainer: '#164E63',

  // Accent - Health green (vitals, success, positive indicators)
  accent: '#059669',
  accentLight: '#10B981',
  accentDark: '#047857',
  accentContainer: '#D1FAE5',
  onAccent: '#FFFFFF',
  onAccentContainer: '#064E3B',

  // Legacy aliases used by existing screens
  success: '#059669',
  danger: '#DC2626',

  // Destructive - Medical alert red (emergencies, critical values)
  destructive: '#DC2626',
  destructiveLight: '#EF4444',
  destructiveDark: '#B91C1C',
  destructiveContainer: '#FEF2F2',
  onDestructive: '#FFFFFF',
  onDestructiveContainer: '#7F1D1D',

  // Warning - Amber (caution, elevated values)
  warning: '#D97706',
  warningLight: '#F59E0B',
  warningDark: '#B45309',
  warningContainer: '#FFFBEB',
  onWarning: '#FFFFFF',
  onWarningContainer: '#78350F',

  // Surface & Background
  background: '#ECFEFF',           // Light cyan tint - calm, medical
  backgroundAlt: '#F0FDFA',        // Slightly greener variant
  surface: '#FFFFFF',              // Pure white cards
  surfaceElevated: '#FFFFFF',      // Elevated cards (same white, different shadow)
  surfaceVariant: '#E8F1F6',       // Subtle variant for chips, inputs
  surfaceDisabled: '#F5F5F5',      // Disabled state

  // Text
  text: '#164E63',                 // Dark cyan - high contrast, not pure black
  textSecondary: '#475569',        // Slate 600
  textTertiary: '#94A3B8',         // Slate 400
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  // Border & Dividers
  border: '#A5F3FC',               // Light cyan border
  borderStrong: '#0891B2',         // Strong border for focus states
  divider: '#E0F0F8',              // Subtle divider

  // Status palette (fixed - never reused as generic categorical)
  // 4-tier scale: healthy/moderate/high/critical
  // Always pair with icon + label, never color alone
  status: {
    healthy: '#059669',      // Green - 0-30 DCSI
    moderate: '#D97706',     // Amber - 31-60 DCSI
    high: '#EA580C',         // Orange - 61-80 DCSI
    critical: '#DC2626',     // Red - 81-100 DCSI
  },

  // Chart palette (fixed hue order for multi-series)
  chart: ['#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED'],

  // Sequential blue ramp (light -> dark) for magnitude encodings
  sequentialBlue: ['#E0F7FA', '#B2EBF2', '#4DD0E1', '#0891B2', '#0E7490'],

  // Sequential green ramp for positive trends
  sequentialGreen: ['#D1FAE5', '#A7F3D0', '#6EE7B7', '#059669', '#047857'],

  // Shadow colors (tinted to background hue - no pure black)
  shadowLight: 'rgba(14, 116, 144, 0.08)',
  shadowMedium: 'rgba(14, 116, 144, 0.12)',
  shadowStrong: 'rgba(14, 116, 144, 0.16)',
  shadowElevated: 'rgba(14, 116, 144, 0.20)',

  // Backward compatibility aliases
  error: '#DC2626',
  info: '#0891B2',
};

// ============================================================================
// SPACING SYSTEM
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// ============================================================================
// BORDER RADIUS - Consistent scale (10-12px base)
// ============================================================================

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

// ============================================================================
// TYPOGRAPHY - Figtree (headings) + Noto Sans (body)
// ============================================================================

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
  displayLarge: 44,
};

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Font families - using system fonts (no expo-font dependency required)
// On iOS: SF Pro / San Francisco, on Android: Roboto
// These provide excellent readability for medical/health data
export const FontFamily = {
  // System fonts are highly legible and render natively
  heading: undefined as string | undefined,  // Uses platform default (SF Pro / Roboto)
  body: undefined as string | undefined,     // Uses platform default
  mono: undefined as string | undefined,     // Uses platform default monospace
};

// Line heights
export const LineHeight = {
  tight: 1.1,
  normal: 1.5,
  relaxed: 1.6,
};

// ============================================================================
// SHADOWS - Modern soft shadows (tinted to primary hue)
// ============================================================================

const createShadow = (elevation: number, blur: number, opacity: number) => ({
  shadowColor: Colors.shadowLight.replace('0.08', String(opacity)),
  shadowOffset: { width: 0, height: elevation },
  shadowOpacity: 1,
  shadowRadius: blur,
  elevation: elevation * 2, // Android
});

export const Shadow = {
  none: {},
  xs: createShadow(1, 2, 0.06),
  sm: createShadow(2, 4, 0.08),
  md: createShadow(4, 8, 0.10),
  lg: createShadow(8, 16, 0.12),
  xl: createShadow(12, 24, 0.14),
  // Inner shadow for pressed states
  inner: {
    shadowColor: Colors.shadowLight,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  // Colored shadows for accent elements
  primary: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  accent: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  destructive: {
    shadowColor: Colors.destructive,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
};

// ============================================================================
// ANIMATION TOKENS
// ============================================================================

export const Animation = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
  },
  easing: {
    standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
    decelerate: 'cubic-bezier(0.16, 1, 0.3, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  stagger: {
    item: 60,
    grid: 80,
  },
};

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const ZIndex = {
  base: 0,
  card: 1,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  toast: 40,
  tooltip: 50,
};

// ============================================================================
// BREAKPOINTS (for responsive design)
// ============================================================================

export const Breakpoints = {
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1440,
};

// ============================================================================
// PAPER THEMES (react-native-paper integration)
// ============================================================================

const fontConfig = {
  fontFamily: FontFamily.body,
  // Heading fonts will be applied via style props
};

export const PaperThemeLight = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    primaryContainer: Colors.primaryContainer,
    secondary: Colors.secondary,
    secondaryContainer: Colors.secondaryContainer,
    tertiary: Colors.accent,
    tertiaryContainer: Colors.accentContainer,
    error: Colors.destructive,
    errorContainer: Colors.destructiveContainer,
    background: Colors.background,
    surface: Colors.surface,
    surfaceVariant: Colors.surfaceVariant,
    onPrimary: Colors.onPrimary,
    onPrimaryContainer: Colors.onPrimaryContainer,
    onSecondary: Colors.onSecondary,
    onSecondaryContainer: Colors.onSecondaryContainer,
    onBackground: Colors.text,
    onSurface: Colors.text,
    onSurfaceVariant: Colors.textSecondary,
    outline: Colors.border,
    outlineVariant: Colors.divider,
    inverseSurface: '#164E63',
    inverseOnSurface: '#FFFFFF',
    inversePrimary: Colors.primaryLight,
    shadow: Colors.shadowLight,
    scrim: 'rgba(22, 78, 99, 0.5)',
    surfaceDisabled: Colors.surfaceDisabled,
    onSurfaceDisabled: Colors.textTertiary,
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: BorderRadius.md,
  animation: {
    scale: 1.0,
  },
};

export const PaperThemeDark = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Colors.primaryLight,
    primaryContainer: Colors.primaryDark,
    secondary: Colors.secondaryLight,
    secondaryContainer: Colors.secondaryDark,
    tertiary: Colors.accentLight,
    tertiaryContainer: Colors.accentDark,
    error: Colors.destructiveLight,
    errorContainer: Colors.destructiveDark,
    background: '#0F172A',           // Slate 950
    surface: '#111827',              // Slate 900
    surfaceVariant: '#1E293B',       // Slate 800
    onPrimary: '#0F172A',
    onPrimaryContainer: '#ECFEFF',
    onSecondary: '#0F172A',
    onSecondaryContainer: '#ECFEFF',
    onBackground: '#F1F5F9',
    onSurface: '#F1F5F9',
    onSurfaceVariant: '#94A3B8',
    outline: '#334155',
    outlineVariant: '#1E293B',
    inverseSurface: '#ECFEFF',
    inverseOnSurface: '#164E63',
    inversePrimary: Colors.primary,
    shadow: 'rgba(0, 0, 0, 0.3)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    surfaceDisabled: '#1E293B',
    onSurfaceDisabled: '#64748B',
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: BorderRadius.md,
  animation: {
    scale: 1.0,
  },
};

// ============================================================================
// SEMANTIC COLOR ALIASES (for easier migration)
// ============================================================================

export const SemanticColors = {
  // Legacy aliases
  success: Colors.accent,
  danger: Colors.destructive,
  info: Colors.primary,
  
  // State colors
  online: Colors.status.healthy,
  offline: Colors.textTertiary,
  connecting: Colors.warning,
  error: Colors.destructive,
  
  // Input states
  inputBackground: Colors.surface,
  inputBorder: Colors.border,
  inputBorderFocus: Colors.primary,
  inputBorderError: Colors.destructive,
  inputPlaceholder: Colors.textTertiary,
  
  // Card
  cardBackground: Colors.surface,
  cardBorder: Colors.divider,
  cardShadow: Colors.shadowLight,
};

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// These maintain backward compatibility with existing components
// ============================================================================

/**
 * Legacy Status palette - maps to new Colors.status
 * @deprecated Use Colors.status instead
 */
export const Status = {
  good: Colors.status.healthy,
  warning: Colors.status.moderate,
  serious: Colors.status.high,
  critical: Colors.status.critical,
  neutral: Colors.textTertiary,
};

/**
 * Gridline color for charts
 */
export const Gridline = Colors.divider;

// ============================================================================
// EXPORT ALL
// ============================================================================

export const Theme = {
  Colors,
  Status,
  Gridline,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
  FontFamily,
  LineHeight,
  Shadow,
  Animation,
  ZIndex,
  Breakpoints,
  PaperThemeLight,
  PaperThemeDark,
  SemanticColors,
};

export default Theme;