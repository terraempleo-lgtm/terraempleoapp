import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '../../../theme';

export default function EnConstruccion({ titulo, icono = 'construct-outline', mensaje }) {
  return (
    <SafeAreaView style={styles.container}>
      <Ionicons name={icono} size={48} color={COLORS.primary} />
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.msg}>{mensaje || 'Esta sección se habilita en la próxima fase.'}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.background },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginTop: SPACING.md },
  msg: { color: COLORS.textLight, textAlign: 'center', marginTop: SPACING.sm },
});
