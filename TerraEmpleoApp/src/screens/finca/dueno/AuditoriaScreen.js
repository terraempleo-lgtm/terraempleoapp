import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { fincaAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';

export default function AuditoriaScreen({ navigation }) {
  const { activeFinca } = useFinca();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!activeFinca) return;
    try {
      const res = await fincaAPI.auditoria(activeFinca.id);
      setRegistros(res.data?.registros || []);
    } catch (err) {
      console.error('Error cargando auditoría:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFinca]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Auditoría de la finca</Text>
      </View>
      <FlatList
        data={registros}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Sin registros de auditoría.</Text>}
        renderItem={({ item: r }) => (
          <View style={styles.row}>
            <Text style={styles.desc}>{r.descripcion || `${r.accion} en ${r.entidad}`}</Text>
            <Text style={styles.meta}>{r.usuario || 'Sistema'} · {r.created_at?.slice(0, 16).replace('T', ' ')}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 8 },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  empty: { color: COLORS.textLight, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  row: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  desc: { color: COLORS.textPrimary, fontWeight: '600' },
  meta: { color: COLORS.textLight, fontSize: 11, marginTop: 4 },
});
