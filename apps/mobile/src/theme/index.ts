export const COLORS = {
  // Brand — used everywhere
  primary:          '#E85068',
  primaryDark:      '#C73A55',
  primaryLight:     '#FFE8EC',
  primaryUltraLight:'#FFF5F7',

  // Backgrounds
  background:       '#FFFFFF',
  surface:          '#F8F8F8',
  surfaceElevated:  '#F0F0F0',

  // Text
  text:             '#0A0A0A',
  textSecondary:    '#444444',
  textMuted:        '#9E9E9E',

  // Borders
  border:           '#EBEBEB',

  // Semantic status
  success:          '#22C55E',
  warning:          '#F59E0B',
  error:            '#EF4444',

  // Sport accent colors — subtle use only:
  //   ✅ sport pill border/bg   ✅ sport icon bg   ✅ sport badge   ✅ per-sport progress bar
  //   ❌ buttons  ❌ headers  ❌ CTAs  ❌ navigation
  sports: {
    BADMINTON:  { accent: '#4CAF50', bg: '#F1F8F1' },
    PICKLEBALL: { accent: '#FF9800', bg: '#FFF8F0' },
    TENNIS:     { accent: '#FFC107', bg: '#FFFDF0' },
    BASKETBALL: { accent: '#FF5722', bg: '#FFF3F0' },
    SOCCER:     { accent: '#2196F3', bg: '#F0F5FF' },
    CRICKET:    { accent: '#9C27B0', bg: '#F8F0FF' },
    BOWLING:    { accent: '#00BCD4', bg: '#F0FBFF' },
    GOLF:       { accent: '#8BC34A', bg: '#F5FAF0' },
    VOLLEYBALL: { accent: '#FF9800', bg: '#FFF8F0' },
    HOCKEY:     { accent: '#2196F3', bg: '#F0F5FF' },
    SQUASH:     { accent: '#9C27B0', bg: '#F8F0FF' },
    BASEBALL:   { accent: '#FF5722', bg: '#FFF3F0' },
  },
} as const;

// Convenience alias used by StyleSheet-local C objects
export const C = {
  bg:      COLORS.background,
  surface: COLORS.surface,
  primary: COLORS.primary,
  text:    COLORS.text,
  muted:   COLORS.textMuted,
  border:  COLORS.border,
} as const;
