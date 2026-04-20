import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

export default function TrabajadoresMapaScreenWeb() {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1f332b' : '#E8F5E9' }]}> 
          <Ionicons name="map-outline" size={50} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Mapa de trabajadores</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>El mapa interactivo para empleadores está disponible en Android y iOS.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  iconWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});