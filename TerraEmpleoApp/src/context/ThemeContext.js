import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@terraempleo_theme';

// Colores para modo claro
export const lightColors = {
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

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',
  disabled: '#D1D5DB',
  disabledBg: '#F9FAFB',

  // Screen background
  screenBg: '#F5FAF7',
};

// Colores para modo oscuro
export const darkColors = {
  // Verdes principales (más brillantes para oscuro)
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#6EE7B7',
  primarySoft: '#064E3B',
  primaryMuted: '#022C22',
  accent: '#A3E635',
  accentDark: '#84CC16',

  // Neutros oscuros
  white: '#1F2937',
  background: '#111827',
  surface: '#1F2937',
  card: '#1F2937',
  cardHover: '#374151',

  // Texto (invertido para oscuro)
  textPrimary: '#F9FAFB',
  textSecondary: '#E5E7EB',
  textLight: '#9CA3AF',
  textOnPrimary: '#111827',
  textOnAccent: '#111827',

  // Estados
  success: '#10B981',
  error: '#EF4444',
  errorSoft: '#7F1D1D',
  warning: '#FBBF24',
  warningSoft: '#78350F',
  info: '#60A5FA',
  infoSoft: '#1E3A8A',

  // Bordes
  border: '#374151',
  borderLight: '#1F2937',
  borderFocus: '#10B981',

  // Overlay
  overlay: 'rgba(0,0,0,0.7)',
  overlayLight: 'rgba(0,0,0,0.5)',
  disabled: '#4B5563',
  disabledBg: '#1F2937',

  // Screen background
  screenBg: '#0F172A',
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar preferencia guardada
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (error) {
      console.log('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newIsDark = !isDark;
      setIsDark(newIsDark);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newIsDark ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme preference:', error);
    }
  };

  const setTheme = async (theme) => {
    try {
      const newIsDark = theme === 'dark';
      setIsDark(newIsDark);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.log('Error saving theme preference:', error);
    }
  };

  const colors = isDark ? darkColors : lightColors;

  const value = {
    isDark,
    colors,
    toggleTheme,
    setTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
