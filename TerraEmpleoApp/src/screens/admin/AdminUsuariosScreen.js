import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  RefreshControl, ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

export default function AdminUsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await adminAPI.getUsuarios();
      setUsuarios(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const toggleActivo = async (id, activo) => {
    try {
      await adminAPI.updateUsuario(id, { activo: !activo });
      load();
    } catch (err) {
      Alert.alert('Error', 'No se pudo actualizar');
    }
  };

  const eliminar = (id) => {
    Alert.alert('Eliminar usuario', '¿Estás seguro? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.deleteUsuario(id);
            load();
          } catch (err) {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const roleColor = (r) => r === 'trabajador' ? COLORS.primary : r === 'empleador' ? COLORS.accent : '#6A1B9A';
  const roleLabel = (r) => r === 'trabajador' ? 'Trabajador' : r === 'empleador' ? 'Empleador' : 'Admin';

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.nombre_completo}</Text>
          <Text style={styles.celular}>{item.celular}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleColor(item.rol) + '18' }]}>
          <Text style={[styles.roleText, { color: roleColor(item.rol) }]}>{roleLabel(item.rol)}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={14} color={COLORS.textLight} />
        <Text style={styles.infoText}>{item.municipio}, {item.departamento}</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.badges}>
          <View style={[styles.statusBadge, { backgroundColor: item.activo ? '#E8F5E9' : '#FFEBEE' }]}>
            <Text style={[styles.statusText, { color: item.activo ? COLORS.primary : COLORS.error }]}>
              {item.activo ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          {item.verificado_sms ? (
            <View style={[styles.statusBadge, { backgroundColor: '#E3F2FD' }]}>
              <Text style={[styles.statusText, { color: '#1565C0' }]}>Verificado</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => toggleActivo(item.id, item.activo)} style={styles.actionBtn}>
            <Ionicons name={item.activo ? 'pause-circle' : 'play-circle'} size={26}
              color={item.activo ? COLORS.accent : COLORS.primary} />
          </TouchableOpacity>
          {item.rol !== 'admin' && (
            <TouchableOpacity onPress={() => eliminar(item.id)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={22} color={COLORS.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={usuarios}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.center}><Text style={styles.empty}>No hay usuarios.</Text></View>
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
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  celular: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  roleBadge: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 3, borderRadius: RADIUS.full },
  roleText: { fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
  infoText: { fontSize: 13, color: COLORS.textLight },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  badges: { flexDirection: 'row', gap: 6 },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: { padding: 4 },
  empty: { fontSize: 16, color: COLORS.textLight },
});
