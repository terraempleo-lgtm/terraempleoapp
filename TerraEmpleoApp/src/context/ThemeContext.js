import React, { createContext, useContext, useMemo, useState } from 'react';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

const lightColors = {
  primary: '#008d49',
  primaryDark: '#006635',
  accent: '#c1ff72',
  background: '#FFFFFF',
  surface: '#ffffff',
  card: '#ffffff',
  border: '#d8ece0',
  textPrimary: '#1A1A2E',
  textSecondary: '#334155',
  textMuted: '#64748b',
  success: '#008d49',
  warning: '#f59e0b',
  error: '#dc2626',
  overlay: 'rgba(0,0,0,0.35)',
};

const darkColors = {
  primary: '#3dd08f',
  primaryDark: '#1f9e67',
  accent: '#9ae267',
  background: '#0d1b16',
  surface: '#132620',
  card: '#183129',
  border: '#2a4c41',
  textPrimary: '#ecfdf3',
  textSecondary: '#c4e9d6',
  textMuted: '#8ebaa5',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  overlay: 'rgba(0,0,0,0.55)',
};

const gradients = {
  light: {
    screen: ['#effaf4', '#e8f7ee', '#f8fffb'],
    header: ['#33b878', '#008d49'],
    card: ['#ffffff', '#f6fffb'],
    buttonPrimary: ['#2bb573', '#008d49'],
    buttonSoft: ['#e7f8ee', '#d8f4e5'],
    agroBlobA: 'rgba(0, 141, 73, 0.12)',
    agroBlobB: 'rgba(193, 255, 114, 0.26)',
  },
  dark: {
    screen: ['#0d1b16', '#10231c', '#0d1b16'],
    header: ['#1e5e46', '#123b2f'],
    card: ['#1a322a', '#162b24'],
    buttonPrimary: ['#2fbf7e', '#1f9e67'],
    buttonSoft: ['#264338', '#1d352c'],
    agroBlobA: 'rgba(61, 208, 143, 0.15)',
    agroBlobB: 'rgba(154, 226, 103, 0.17)',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('light');

  const toggleMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const isDark = mode === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const gradientSet = isDark ? gradients.dark : gradients.light;

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [isDark, colors]);

  const value = useMemo(() => ({
    mode,
    isDark,
    toggleMode,
    colors,
    gradients: gradientSet,
    navigationTheme,
  }), [mode, isDark, colors, gradientSet, navigationTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme debe usarse dentro de ThemeProvider');
  return context;
}
