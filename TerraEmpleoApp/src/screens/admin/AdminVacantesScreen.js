import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

export default function AdminVacantesScreen({ navigation }) {
  const [vacantes, setVacantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await adminAPI.getVacantes();
      setVacantes(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo cargar la lista de vacantes';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const cambiarEstado = async (item) => {
    const siguienteEstado = item.estado === 'activa' ? 'pausada' : 'activa';
    try {
      await adminAPI.updateVacante(item.id, { estado: siguienteEstado });
      Alert.alert('Listo', `Vacante ${siguienteEstado === 'activa' ? 'activada' : 'pausada'} correctamente`);
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo actualizar el estado de la vacante';
      Alert.alert('Error', msg);
    }
  };

  const verPostulantes = (item) => {
    navigation.navigate('AdminVerPostulantes', { vacante: item });
  };

  const eliminar = (vacante) => {
    Alert.alert('Eliminar vacante', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.eliminarVacante(vacante.id);
            Alert.alert('Listo', 'Vacante eliminada correctamente');
            load();
          } catch (err) {
            const msg = err.response?.data?.error || 'No se pudo eliminar la vacante';
            Alert.alert('Error', msg);
          }
        },
      },
    ]);
  };

  const estadoColor = (e) => {
    if (e === 'activa') return { bg: '#e6f7ee', fg: COLORS.primary };
    if (e === 'cerrada') return { bg: '#FFEBEE', fg: COLORS.error };
    return { bg: '#FFF3E0', fg: COLORS.accent };
  };

  const renderItem = ({ item }) => {
    const ec = estadoColor(item.estado);
    const fechaTexto = item?.created_at
      ? new Date(item.created_at).toLocaleDateString('es-CO')
      : 'Sin fecha';
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
          <Text style={styles.fecha}>{fechaTexto}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => verPostulantes(item)} style={styles.actionBtn}>
              <Ionicons name="people-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.actionText, { color: COLORS.primary }]}>Ver postulantes</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => cambiarEstado(item)} style={styles.actionBtn}>
              <Ionicons
                name={item.estado === 'activa' ? 'pause-circle-outline' : 'play-circle-outline'}
                size={16}
                color={item.estado === 'activa' ? COLORS.accent : COLORS.primary}
              />
              <Text style={[styles.actionText, { color: item.estado === 'activa' ? COLORS.accent : COLORS.primary }]}> 
                {item.estado === 'activa' ? 'Pausar' : 'Activar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => eliminar(item)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
              <Text style={[styles.actionText, { color: COLORS.error }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
  },
  actionText: { fontSize: 11, fontWeight: '600' },
  empty: { fontSize: 16, color: COLORS.textLight },
});
