import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '../../../theme';
import CuadernoTopNav from './CuadernoTopNav';

export default function EnConstruccion({ titulo, icono = 'construct-outline', mensaje, navigation, activeKey }) {
  return (
    <SafeAreaView style={styles.container} edges={navigation ? ['top'] : undefined}>
      {navigation && <CuadernoTopNav navigation={navigation} activeKey={activeKey} />}
      <View style={styles.body}>
        <Ionicons name={icono} size={48} color={COLORS.primary} />
        <Text style={styles.title}>{titulo}</Text>
        <Text style={styles.msg}>{mensaje || 'Esta sección se habilita en la próxima fase.'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginTop: SPACING.md },
  msg: { color: COLORS.textLight, textAlign: 'center', marginTop: SPACING.sm },
});
