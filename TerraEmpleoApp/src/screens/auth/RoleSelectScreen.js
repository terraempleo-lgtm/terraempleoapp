import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, TerraFooter } from '../../components/ui';
import { useAppTheme } from '../../context/ThemeContext';
import { useDisenoResponsive } from '../../hooks/useDisenoResponsive';

const ROLES = [
  {
    key: 'trabajador',
    icon: 'tractor-variant',
    iconLib: 'material',
    title: 'Soy Trabajador',
    description: 'Busco oportunidades en el campo',
    screen: 'RegisterTrabajador',
  },
  {
    key: 'empleador',
    icon: 'office-building-outline',
    iconLib: 'material',
    title: 'Soy Empleador',
    description: 'Busco talento para mi finca',
    screen: 'RegisterEmpleador',
  },
];

export default function RoleSelectScreen({ navigation }) {
  const { colors } = useAppTheme();
  const { contenedorMaxAncho } = useDisenoResponsive();
  const [selected, setSelected]= useState(null);

  const handleContinue = () => {
    if (!selected) return;
    const role = ROLES.find(r => r.key === selected);
    navigation.navigate(role.screen);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>¿Cómo quieres usar TerraEmpleo?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Selecciona tu perfil para personalizar tu experiencia en el campo.
          </Text>
        </View>

        {/* Role cards */}
        <View style={styles.cardsContainer}>
          {ROLES.map((role) => {
            const isSelected = selected === role.key;
            return (
              <TouchableOpacity
                key={role.key}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, isSelected && styles.cardSelected]}
                onPress={() => setSelected(role.key)}
                activeOpacity={0.8}
              >
                {/* Icon circle */}
                <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                  <MaterialCommunityIcons
                    name={role.icon}
                    size={30}
                    color={isSelected ? COLORS.white : COLORS.primary}
                  />
                </View>

                {/* Text */}
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }, isSelected && styles.cardTitleSelected]}>
                    {role.title}
                  </Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{role.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom area */}
      <View
        style={[
          styles.bottomArea,
          { backgroundColor: colors.background, maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
        ]}
      >
        <Button
          title="Continuar"
          onPress={handleContinue}
          disabled={!selected}
          size="large"
        />
        <Text style={styles.footerNote}>
          Podrás cambiar tu elección más tarde en la configuración.
        </Text>
        <Text style={styles.termsNote}>
          Al continuar, aceptas nuestros{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://app.terrampleo.com/terminos')}>
            Términos y Condiciones
          </Text>
          {' '}y nuestra{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://app.terrampleo.com/privacidad')}>
            Política de Privacidad
          </Text>
          . No toleramos contenido inapropiado ni comportamiento abusivo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xl + SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primaryMuted,
    ...SHADOWS.medium,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconCircleSelected: {
    backgroundColor: COLORS.primary,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardTitleSelected: {
    color: COLORS.primary,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  bottomArea: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  footerNote: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 18,
  },
  termsNote: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 16,
    paddingHorizontal: SPACING.sm,
  },
  termsLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
