import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export default function RoleSelectScreen({ navigation }) {
  const roles = [
    {
      key: 'trabajador',
      icon: 'person',
      title: 'Soy Trabajador',
      subtitle: 'Busco trabajo en fincas y zonas rurales',
      color: COLORS.primary,
    },
    {
      key: 'empleador',
      icon: 'business',
      title: 'Soy Empleador',
      subtitle: 'Tengo una finca o empresa y busco trabajadores',
      color: COLORS.accent,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="leaf" size={50} color={COLORS.primary} />
        <Text style={styles.title}>¿Quién eres?</Text>
        <Text style={styles.subtitle}>Selecciona tu tipo de cuenta</Text>

        <View style={styles.cardsContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.key}
              style={[styles.card, { borderColor: role.color }]}
              onPress={() => navigation.navigate(
                role.key === 'trabajador' ? 'RegisterTrabajador' : 'RegisterEmpleador'
              )}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: role.color }]}>
                <Ionicons name={role.icon} size={40} color={COLORS.white} />
              </View>
              <Text style={styles.cardTitle}>{role.title}</Text>
              <Text style={styles.cardSubtitle}>{role.subtitle}</Text>
              <View style={[styles.selectBtn, { backgroundColor: role.color }]}>
                <Text style={styles.selectBtnText}>Seleccionar</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  cardsContainer: {
    width: '100%',
    gap: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    ...SHADOWS.medium,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  selectBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
