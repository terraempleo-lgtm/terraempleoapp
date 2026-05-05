import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';
import { useAppTheme } from '../../context/ThemeContext';

const FILTROS = [
  { key: '', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'revisado', label: 'Revisados' },
  { key: 'resuelto', label: 'Resueltos' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)} días`;
}

export default function AdminReportesScreen() {
  const { colors, isDark } = useAppTheme();
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('pendiente');

  const cargar = useCallback(async () => {
    try {
      const res = await adminAPI.getReportes(filtro);
      setReportes(res.data.reportes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro]);

  useEffect(() => { setLoading(true); cargar(); }, [cargar]);

  const resolver = (reporte) => {
    Alert.alert(
      'Gestionar reporte',
      `Reporte de "${reporte.motivo}" contra ${reporte.usuario_reportado_nombre}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar revisado',
          onPress: async () => {
            try {
              await adminAPI.resolverReporte(reporte.id, { estado: 'revisado', accion_tomada: 'Contenido revisado por el equipo' });
              cargar();
            } catch { Alert.alert('Error', 'No se pudo actualizar el reporte'); }
          }
        },
        {
          text: 'Banear usuario',
          style: 'destructive',
          onPress: () => Alert.alert(
            '¿Banear usuario?',
            `¿Deseas banear y desactivar la cuenta de ${reporte.usuario_reportado_nombre}?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Banear', style: 'destructive',
                onPress: async () => {
                  try {
                    await adminAPI.resolverReporte(reporte.id, {
                      estado: 'resuelto',
                      accion_tomada: 'Usuario baneado por violación de términos de uso',
                      banear_usuario: true,
                    });
                    cargar();
                  } catch { Alert.alert('Error', 'No se pudo banear al usuario'); }
                }
              }
            ]
          )
        },
      ]
    );
  };

  const getEstadoColor = (estado) => {
    if (estado === 'pendiente') return COLORS.warning;
    if (estado === 'revisado') return COLORS.info || '#2196F3';
    return COLORS.primary;
  };

  const renderReporte = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }, SHADOWS.sm]}
      onPress={() => resolver(item)}
      activeOpacity={0.85}
    >
      <View style={[styles.estadoBarra, { backgroundColor: getEstadoColor(item.estado) }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.motivo, { color: colors.textPrimary }]}>{item.motivo}</Text>
            <Text style={[styles.nombres, { color: colors.textSecondary }]} numberOfLines={1}>
              <Text style={{ color: COLORS.error }}>Reportado: </Text>{item.usuario_reportado_nombre}
              {item.baneado ? ' 🚫' : ''}
            </Text>
            <Text style={[styles.nombres, { color: colors.textSecondary }]} numberOfLines={1}>
              <Text>Por: </Text>{item.reportado_por_nombre}
            </Text>
            {item.descripcion ? (
              <Text style={[styles.descripcion, { color: colors.textSecondary }]} numberOfLines={2}>{item.descripcion}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(item.estado) + '22' }]}>
              <Text style={[styles.estadoText, { color: getEstadoColor(item.estado) }]}>{item.estado}</Text>
            </View>
            <Text style={[styles.tiempo, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
            {item.mensaje_id && (
              <View style={styles.msgBadge}>
                <Ionicons name="chatbubble-outline" size={11} color={COLORS.textSecondary} />
                <Text style={styles.msgBadgeText}>Mensaje</Text>
              </View>
            )}
          </View>
        </View>
        {item.accion_tomada && (
          <Text style={[styles.accion, { color: colors.textSecondary }]}>
            Acción: {item.accion_tomada}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Reportes</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Gestión de contenido inapropiado</Text>
      </View>

      {/* Filtros */}
      <View style={[styles.filtrosRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        {FILTROS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filtroPill, filtro === f.key && styles.filtroPillActivo]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[styles.filtroText, filtro === f.key && styles.filtroTextActivo]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={reportes}
          keyExtractor={item => String(item.id)}
          renderItem={renderReporte}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.disabled} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {filtro === 'pendiente' ? 'No hay reportes pendientes' : 'No hay reportes en esta categoría'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  filtrosRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 8, borderBottomWidth: 1 },
  filtroPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'transparent' },
  filtroPillActivo: { backgroundColor: COLORS.primarySoft },
  filtroText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filtroTextActivo: { color: COLORS.primary, fontWeight: '700' },
  list: { padding: SPACING.md, gap: 10 },
  card: { flexDirection: 'row', borderRadius: RADIUS.lg, overflow: 'hidden' },
  estadoBarra: { width: 4 },
  cardContent: { flex: 1, padding: SPACING.md, gap: 6 },
  cardTop: { flexDirection: 'row', gap: 12 },
  motivo: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  nombres: { fontSize: 13 },
  descripcion: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  estadoText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  tiempo: { fontSize: 11 },
  msgBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  msgBadgeText: { fontSize: 10, color: COLORS.textSecondary },
  accion: { fontSize: 12, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
