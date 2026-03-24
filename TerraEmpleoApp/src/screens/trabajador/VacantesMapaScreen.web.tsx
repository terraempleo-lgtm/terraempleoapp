/**
 * Web fallback — react-native-maps does not support web.
 * Metro automatically picks this file on platform=web.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import DecorativeBackground from '../../components/ui/DecorativeBackground';

export default function VacantesMapaScreen() {
  const { colors, gradients, isDark } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <DecorativeBackground intensity="strong" />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1f332b' : '#E8F5E9' }]}> 
          <Ionicons name="map-outline" size={52} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Mapa de Vacantes</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}> 
          El mapa interactivo está disponible únicamente en la app móvil (Android / iOS).
        </Text>
        <View style={[styles.hint, { backgroundColor: isDark ? '#1d3a2f' : '#E8F5E9' }]}> 
          <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.primary }]}>Abre TerraEmpleo desde tu celular para ver las vacantes en el mapa.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1F8E9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
    ...SHADOWS.large,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    lineHeight: 20,
  },
});
