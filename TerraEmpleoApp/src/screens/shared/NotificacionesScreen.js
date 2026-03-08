import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { notificacionesAPI } from '../../services/api';

const TIPO_CONFIG = {
  match: { icon: 'flash', color: '#FF8F00', bg: '#FFF8E1' },
  postulacion: { icon: 'person-add', color: '#1565C0', bg: '#E3F2FD' },
  aceptado: { icon: 'checkmark-circle', color: '#2E7D32', bg: '#E8F5E9' },
  rechazado: { icon: 'close-circle', color: '#C62828', bg: '#FFEBEE' },
  calificacion: { icon: 'star', color: '#6A1B9A', bg: '#F3E5F5' },
};

function tiempoRelativo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function NotificacionesScreen({ navigation }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await notificacionesAPI.listar();
      setNotificaciones(res.data.notificaciones || []);
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const marcarLeida = async (item) => {
    if (item.leida) return;
    try {
      await notificacionesAPI.marcarLeida(item.id);
      setNotificaciones(prev =>
        prev.map(n => n.id === item.id ? { ...n, leida: true } : n)
      );
    } catch (err) {
      console.error('Error marcando notificación:', err);
    }
  };

  const marcarTodasLeidas = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas();
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (err) {
      console.error('Error marcando todas:', err);
    }
  };

  const hayNoLeidas = notificaciones.some(n => !n.leida);

  const renderItem = ({ item }) => {
    const config = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.match;
    return (
      <TouchableOpacity
        style={[styles.card, !item.leida && styles.cardNoLeida]}
        onPress={() => marcarLeida(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.titulo, !item.leida && styles.tituloNoLeida]} numberOfLines={1}>
              {item.titulo}
            </Text>
            {!item.leida && <View style={styles.dot} />}
          </View>
          <Text style={styles.mensaje} numberOfLines={2}>{item.mensaje}</Text>
          <Text style={styles.tiempo}>{tiempoRelativo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {hayNoLeidas && (
        <TouchableOpacity style={styles.marcarTodasBtn} onPress={marcarTodasLeidas}>
          <Ionicons name="checkmark-done-outline" size={16} color={COLORS.primary} />
          <Text style={styles.marcarTodasText}>Marcar todas como leídas</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notificaciones}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyText}>No tienes notificaciones</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F4' },
  list: { padding: SPACING.md, paddingBottom: SPACING.xl },

  marcarTodasBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  marcarTodasText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardNoLeida: {
    backgroundColor: '#F0F7F0',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titulo: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  tituloNoLeida: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 6,
    flexShrink: 0,
  },
  mensaje: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  tiempo: {
    fontSize: 11,
    color: COLORS.textLight,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textLight,
  },
});
