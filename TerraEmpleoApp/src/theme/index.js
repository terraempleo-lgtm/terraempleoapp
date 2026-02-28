// Tema TerraEmpleo - Colores verdes, accesible, rural
export const COLORS = {
  // Verdes principales
  primary: '#2E7D32',
  primaryDark: '#1B5E20',
  primaryLight: '#4CAF50',
  primarySoft: '#E8F5E9',

  // Acentos
  accent: '#FF8F00',
  accentLight: '#FFE082',

  // Neutros
  white: '#FFFFFF',
  background: '#F5F7F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  // Texto
  textPrimary: '#1A1A2E',
  textSecondary: '#555555',
  textLight: '#888888',
  textOnPrimary: '#FFFFFF',

  // Estados
  success: '#2E7D32',
  error: '#D32F2F',
  warning: '#F57C00',
  info: '#1976D2',

  // Bordes
  border: '#E0E0E0',
  borderLight: '#F0F0F0',

  // Urgente
  urgent: '#D32F2F',
  urgentBg: '#FFEBEE',

  // Rating
  star: '#FFB300',
  starEmpty: '#E0E0E0',

  // Chips
  chipSelected: '#2E7D32',
  chipUnselected: '#F5F5F5',
  chipTextSelected: '#FFFFFF',
  chipTextUnselected: '#333333',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  disabled: '#BDBDBD',
};

export const FONTS = {
  regular: { fontSize: 16, color: COLORS.textPrimary },
  bold: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  subtitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  caption: { fontSize: 13, color: COLORS.textSecondary },
  small: { fontSize: 12, color: COLORS.textLight },
  button: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  bigButton: { fontSize: 19, fontWeight: '700', color: COLORS.white },
  input: { fontSize: 16, color: COLORS.textPrimary },
  chip: { fontSize: 15, fontWeight: '500' },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
};
