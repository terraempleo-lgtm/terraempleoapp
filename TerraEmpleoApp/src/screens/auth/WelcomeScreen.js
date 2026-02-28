import React from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, StatusBar } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <Ionicons name="leaf" size={80} color={COLORS.white} />
          <Text style={styles.appName}>TerraEmpleo</Text>
          <Text style={styles.tagline}>Conectamos el campo colombiano</Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.welcomeTitle}>¡Bienvenido!</Text>
        <Text style={styles.welcomeText}>
          Encuentra trabajo rural o los mejores trabajadores para tu finca.
        </Text>

        <View style={styles.buttonsContainer}>
          <Button
            title="Iniciar Sesión"
            onPress={() => navigation.navigate('Login')}
            variant="primary"
            size="large"
          />
          <Button
            title="Crear Cuenta"
            onPress={() => navigation.navigate('RoleSelect')}
            variant="outline"
            size="large"
            style={{ marginTop: SPACING.md }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xxl,
  },
  logoContainer: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: SPACING.md,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: SPACING.sm,
    fontWeight: '500',
  },
  bottomSection: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl + 8,
    borderTopRightRadius: RADIUS.xl + 8,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    ...SHADOWS.large,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    lineHeight: 24,
  },
  buttonsContainer: {
    gap: SPACING.sm,
  },
});
