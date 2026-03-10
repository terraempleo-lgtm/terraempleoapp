// Tema TerraEmpleo - Sistema de diseño v2
// Paleta: verde principal #008d49, verde claro #c1ff72, verde medio #55c53e

export const COLORS = {
  // Verdes principales
  primary: '#008d49',
  primaryDark: '#006635',
  primaryLight: '#55c53e',
  primarySoft: '#e6f7ee',
  primaryMuted: '#f0faf4',
  accent: '#c1ff72',
  accentDark: '#a8e660',

  // Neutros
  white: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardHover: '#FAFFFE',

  // Texto
  textPrimary: '#1A1A2E',
  textSecondary: '#1F2937',
  textLight: '#4B5563',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#1A1A2E',

  // Estados
  success: '#008d49',
  error: '#DC2626',
  errorSoft: '#FEF2F2',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',

  // Bordes
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderFocus: '#008d49',

  // Urgente
  urgent: '#DC2626',
  urgentBg: '#FEF2F2',

  // Rating
  star: '#F59E0B',
  starEmpty: '#E5E7EB',

  // Chips
  chipSelected: '#008d49',
  chipUnselected: '#F3F4F6',
  chipTextSelected: '#FFFFFF',
  chipTextUnselected: '#374151',
  chipBorder: '#E5E7EB',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',
  disabled: '#D1D5DB',
  disabledBg: '#F9FAFB',

  // Badge colors
  badgeActive: '#DCFCE7',
  badgeActiveText: '#166534',
  badgeInactive: '#F3F4F6',
  badgeInactiveText: '#6B7280',
  badgeUrgent: '#FEF2F2',
  badgeUrgentText: '#DC2626',
};

export const FONTS = {
  // Sistema tipografico global: legible, profesional y consistente.
  family: {
    regular: 'System',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  size: {
    caption: 13,
    bodySmall: 14,
    body: 15,
    subtitle: 17,
    sectionTitle: 20,
    title: 24,
    titleLarge: 30,
  },
  lineHeight: {
    caption: 18,
    bodySmall: 20,
    body: 22,
    subtitle: 24,
    sectionTitle: 28,
    title: 32,
    titleLarge: 38,
  },

  // Tokens semanticos reutilizables en toda la app.
  regular: { fontFamily: 'System', fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
  bold: { fontFamily: 'System', fontSize: 15, lineHeight: 22, fontWeight: '700', color: COLORS.textPrimary },
  title: { fontFamily: 'System', fontSize: 24, lineHeight: 32, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  titleLarge: { fontFamily: 'System', fontSize: 30, lineHeight: 38, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  subtitle: { fontFamily: 'System', fontSize: 17, lineHeight: 24, fontWeight: '700', color: COLORS.textPrimary },
  caption: { fontFamily: 'System', fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
  small: { fontFamily: 'System', fontSize: 13, lineHeight: 18, color: COLORS.textLight },
  button: { fontFamily: 'System', fontSize: 15, lineHeight: 20, fontWeight: '700', color: COLORS.white },
  buttonSmall: { fontFamily: 'System', fontSize: 14, lineHeight: 18, fontWeight: '700', color: COLORS.white },
  bigButton: { fontFamily: 'System', fontSize: 16, lineHeight: 22, fontWeight: '700', color: COLORS.white },
  input: { fontFamily: 'System', fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
  chip: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  sectionTitle: { fontFamily: 'System', fontSize: 20, lineHeight: 28, fontWeight: '700', color: COLORS.textPrimary },
  label: { fontFamily: 'System', fontSize: 15, lineHeight: 22, fontWeight: '600', color: COLORS.textPrimary },
  body: { fontFamily: 'System', fontSize: 15, lineHeight: 22, color: COLORS.textSecondary },
  bodySmall: { fontFamily: 'System', fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  link: { fontFamily: 'System', fontSize: 15, lineHeight: 22, fontWeight: '600', color: COLORS.primary },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  button: {
    shadowColor: '#008d49',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Constantes de layout globales
export const LAYOUT = {
  maxContentWidth: 480,
  screenPaddingH: 24,
  headerHeight: 56,
  bottomBarHeight: 80,
  inputHeight: 54,
  buttonHeight: 56,
  buttonHeightSmall: 44,
  chipHeight: 42,
};
