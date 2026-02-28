import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, SafeAreaView } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

export default function MisPostulacionesScreen({ navigation }) {
  const [postulaciones, setPostulaciones] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await vacantesAPI.misPostulaciones();
      setPostulaciones(res.data.postulaciones || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation]);

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'aceptada': return COLORS.success;
      case 'rechazada': return COLORS.error;
      case 'match_auto': return COLORS.info;
      default: return COLORS.warning;
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'aceptada': return 'Aceptada';
      case 'rechazada': return 'Rechazada';
      case 'match_auto': return 'Match automático';
      case 'pendiente': return 'Pendiente';
      default: return estado;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Postulaciones</Text>
      </View>
      <FlatList
        data={postulaciones}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.titulo}</Text>
              <View style={[styles.badge, { backgroundColor: getEstadoColor(item.estado) }]}>
                <Text style={styles.badgeText}>{getEstadoLabel(item.estado)}</Text>
              </View>
            </View>
            {item.nombre_empresa_finca && (
              <View style={styles.row}>
                <Ionicons name="business-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.rowText}>{item.nombre_empresa_finca}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Ionicons name="location-outline" size={15} color={COLORS.textSecondary} />
              <Text style={styles.rowText}>{item.municipio}, {item.departamento}</Text>
            </View>
            {item.puntaje_match > 0 && (
              <View style={styles.row}>
                <Ionicons name="flash-outline" size={15} color={COLORS.accent} />
                <Text style={[styles.rowText, { color: COLORS.accent }]}>
                  Match: {Math.round(item.puntaje_match)}%
                </Text>
              </View>
            )}
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('es-CO')}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={50} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No tienes postulaciones aún</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: SPACING.xl },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  list: { padding: SPACING.md, paddingBottom: 100 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.small },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, flex: 1, marginRight: SPACING.sm },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  rowText: { fontSize: 13, color: COLORS.textSecondary },
  date: { fontSize: 12, color: COLORS.textLight, textAlign: 'right', marginTop: SPACING.sm },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl * 2, gap: SPACING.sm },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});
