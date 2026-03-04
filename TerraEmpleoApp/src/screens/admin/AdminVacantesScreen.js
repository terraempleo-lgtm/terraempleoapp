import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

export default function AdminVacantesScreen() {
  const [vacantes, setVacantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await adminAPI.getVacantes();
      setVacantes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const eliminar = (id) => {
    Alert.alert('Eliminar vacante', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.deleteVacante(id);
            load();
          } catch (err) {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const estadoColor = (e) => {
    if (e === 'activa') return { bg: '#E8F5E9', fg: COLORS.primary };
    if (e === 'cerrada') return { bg: '#FFEBEE', fg: COLORS.error };
    return { bg: '#FFF3E0', fg: COLORS.accent };
  };

  const renderItem = ({ item }) => {
    const ec = estadoColor(item.estado);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{item.titulo}</Text>
            <Text style={styles.empresa}>{item.nombre_empresa_finca || 'Sin nombre'}</Text>
          </View>
          <View style={[styles.estadoBadge, { backgroundColor: ec.bg }]}>
            <Text style={[styles.estadoText, { color: ec.fg }]}>{item.estado}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.infoText}>{item.municipio}, {item.departamento}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.infoText}>
            ${item.salario_ofrecido ? Number(item.salario_ofrecido).toLocaleString() : 'N/A'} - {item.tipo_pago || 'N/A'}
          </Text>
        </View>

        {item.urgente ? (
          <View style={[styles.urgenteBadge]}>
            <Ionicons name="alert-circle" size={14} color={COLORS.error} />
            <Text style={styles.urgenteText}>Urgente</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.fecha}>
            {new Date(item.fecha_creacion).toLocaleDateString('es-CO')}
          </Text>
          <TouchableOpacity onPress={() => eliminar(item.id)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={vacantes}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.center}><Text style={styles.empty}>No hay vacantes.</Text></View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.small,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  empresa: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  estadoBadge: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 3, borderRadius: RADIUS.full },
  estadoText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs },
  infoText: { fontSize: 13, color: COLORS.textLight },
  urgenteBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: SPACING.sm, backgroundColor: '#FFEBEE',
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  urgenteText: { fontSize: 12, fontWeight: '600', color: COLORS.error },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  fecha: { fontSize: 12, color: COLORS.textLight },
  deleteBtn: { padding: 4 },
  empty: { fontSize: 16, color: COLORS.textLight },
});
