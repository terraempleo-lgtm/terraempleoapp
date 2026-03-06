import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

function TerraEmpleoFooter() {
  return (
    <View style={footerStyles.wrap}>
      <View style={footerStyles.iconBox}>
        <Ionicons name="leaf" size={14} color="#9E9E9E" />
      </View>
      <Text style={footerStyles.text}>TerraEmpleo</Text>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

const ROLES = [
  {
    key: 'trabajador',
    icon: 'person',
    title: 'Soy Trabajador',
    description: 'Busco trabajo en fincas y zonas rurales de Colombia',
    screen: 'RegisterTrabajador',
  },
  {
    key: 'empleador',
    icon: 'business',
    title: 'Soy Empleador',
    description: 'Tengo una finca o empresa y necesito contratar personal',
    screen: 'RegisterEmpleador',
  },
];

export default function RoleSelectScreen({ navigation }) {
  const [selected, setSelected] = useState(null);

  const handleContinue = () => {
    if (!selected) return;
    const role = ROLES.find(r => r.key === selected);
    navigation.navigate(role.screen);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Elige tu perfil</Text>
        <Text style={styles.subtitle}>
          Selecciona cómo quieres usar TerraEmpleo
        </Text>

        {/* Role cards */}
        <View style={styles.cardsContainer}>
          {ROLES.map((role) => {
            const isSelected = selected === role.key;
            return (
              <TouchableOpacity
                key={role.key}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(role.key)}
                activeOpacity={0.85}
              >
                {/* Radio button */}
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>

                {/* Icon */}
                <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                  <Ionicons
                    name={role.icon}
                    size={28}
                    color={isSelected ? COLORS.white : '#008d49'}
                  />
                </View>

                {/* Text */}
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {role.title}
                  </Text>
                  <Text style={styles.cardDesc}>{role.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Podrás completar tu perfil después de registrarte
        </Text>
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={selected ? 0.85 : 1}
        >
          <Text style={[styles.continueBtnText, !selected && styles.continueBtnTextDisabled]}>
            Continuar
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={selected ? COLORS.white : '#BDBDBD'}
          />
        </TouchableOpacity>
        <TerraEmpleoFooter />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.small,
  },
  cardSelected: {
    borderColor: '#008d49',
    backgroundColor: '#F0FAF4',
  },
  radio: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#008d49',
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#008d49',
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#e6f7ee',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconCircleSelected: {
    backgroundColor: '#008d49',
  },
  cardText: {
    flex: 1,
    paddingRight: SPACING.xl,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardTitleSelected: {
    color: '#008d49',
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
    lineHeight: 18,
  },
  bottomArea: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
    backgroundColor: COLORS.white,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#008d49',
    paddingVertical: 15,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  continueBtnDisabled: {
    backgroundColor: '#F5F5F5',
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
  },
  continueBtnTextDisabled: {
    color: '#BDBDBD',
  },
});
