import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI } from '../../../services/api';

export default function JornadasScreen({ navigation }) {
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async (mostrarSpinner = true) => {
    if (mostrarSpinner) setLoading(true);
    try {
      const res = await cuadernoAPI.listarJornadas();
      setJornadas(res.data?.jornadas || []);
    } catch (err) {
      console.error('Error cargando jornadas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Jornadas</Text>
        <TouchableOpacity style={styles.cerrarBtn} onPress={() => navigation.navigate('CerrarJornada')}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.cerrarBtnText}>Cerrar jornada</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={jornadas}
        keyExtractor={(j) => String(j.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(false); }} />}
        ListEmptyComponent={<Text style={styles.empty}>Sin jornadas registradas.</Text>}
        renderItem={({ item: j }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('DetalleJornada', { jornadaId: j.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fecha}>{j.fecha?.slice(0, 10)} {j.titulo ? `· ${j.titulo}` : ''}</Text>
              <Text style={styles.sub}>{j.asistieron || 0}/{j.total_trabajadores || 0} asistieron · {Number(j.total_kg || 0).toFixed(0)} kg · ${Number(j.total_pagado || 0).toLocaleString('es-CO')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg },
  title: { ...FONTS.title, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  cerrarBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, gap: 4 },
  cerrarBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  empty: { color: COLORS.textLight, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  fecha: { fontWeight: '700', color: COLORS.textPrimary },
  sub: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
});
