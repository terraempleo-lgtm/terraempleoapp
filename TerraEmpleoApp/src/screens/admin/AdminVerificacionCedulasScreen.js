import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Image,
  Alert, TouchableOpacity, Modal, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { AnimatedPressable } from '../../components/animated';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alertService';
import { useAppTheme } from '../../context/ThemeContext';

function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return parsed.toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Tab Cédulas ──────────────────────────────────────────────────────────────

function TabCedulas({ navigation, colors, isDark, onZoom }) {
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await adminAPI.getCedulasPendientes();
      setPendientes(data?.pendientes || []);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudieron cargar las cédulas pendientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const revisar = (item, estado) => {
    Alert.alert(
      estado === 'aprobada' ? 'Aprobar identidad' : 'Rechazar identidad',
      `¿${estado === 'aprobada' ? 'Aprobar' : 'Rechazar'} la cédula de ${item.nombre_completo}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: estado === 'aprobada' ? 'Aprobar' : 'Rechazar',
          style: estado === 'aprobada' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setProcesandoId(item.id);
              await adminAPI.revisarValidacionIdentidad(item.id, estado, null);
              setPendientes((prev) => prev.filter((p) => p.id !== item.id));
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'No se pudo guardar la revisión');
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <FlatList
      data={pendientes}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      ListEmptyComponent={!loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.primary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin cédulas pendientes</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Todas las verificaciones fueron atendidas</Text>
        </View>
      ) : null}
      renderItem={({ item }) => {
        const enProceso = procesandoId === item.id;
        return (
          <AnimatedPressable style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('AdminVerificacionDetalle', { item })} scaleValue={0.98}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nombre, { color: colors.textPrimary }]}>{item.nombre_completo}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>Cédula: {item.cedula || 'Sin dato'}</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>Enviado: {formatearFecha(item.enviado_at)}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: isDark ? colors.border : '#F3F4F6', borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>Pendiente</Text>
              </View>
            </View>

            {item.foto_cedula
              ? <TouchableOpacity onPress={() => onZoom(item.foto_cedula)} activeOpacity={0.85}>
                  <Image source={{ uri: item.foto_cedula }} style={styles.docImg} resizeMode="cover" />
                  <View style={styles.zoomHint}><Ionicons name="expand-outline" size={14} color="#FFF" /><Text style={styles.zoomHintTxt}>Toca para ampliar</Text></View>
                </TouchableOpacity>
              : <View style={styles.placeholder}><Ionicons name="image-outline" size={28} color={COLORS.textLight} /><Text style={styles.placeholderText}>Sin foto</Text></View>}

            <View style={styles.actions}>
              <AnimatedPressable onPress={() => revisar(item, 'rechazada')}
                style={[styles.actionBtn, styles.rejectBtn, enProceso && styles.disabledBtn]} scaleValue={0.97} disabled={enProceso}>
                <Ionicons name="close-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionText}>{enProceso ? 'Guardando...' : 'Rechazar'}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => revisar(item, 'aprobada')}
                style={[styles.actionBtn, styles.approveBtn, enProceso && styles.disabledBtn]} scaleValue={0.97} disabled={enProceso}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionText}>{enProceso ? 'Guardando...' : 'Aprobar'}</Text>
              </AnimatedPressable>
            </View>
          </AnimatedPressable>
        );
      }}
    />
  );
}

// ─── Tab Fincas ───────────────────────────────────────────────────────────────

function TabFincas({ colors, isDark, onZoom }) {
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);
  const [comentario, setComentario] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await adminAPI.getEmpresasPendientes();
      setPendientes(data?.pendientes || []);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudieron cargar las fincas pendientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const revisar = (item, estado) => {
    Alert.alert(
      estado === 'aprobada' ? 'Verificar finca' : 'Rechazar verificación',
      estado === 'aprobada'
        ? `¿Verificar la finca "${item.nombre_empresa_finca}" de ${item.nombre_completo}?`
        : `¿Rechazar la verificación de "${item.nombre_empresa_finca}"? (Opcional: agrega un motivo)`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: estado === 'aprobada' ? 'Verificar' : 'Rechazar',
          style: estado === 'aprobada' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setProcesandoId(item.usuario_id);
              await adminAPI.revisarVerificacionEmpresa(item.usuario_id, estado, comentario || null);
              setPendientes((prev) => prev.filter((p) => p.usuario_id !== item.usuario_id));
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'No se pudo guardar la revisión');
            } finally {
              setProcesandoId(null);
              setComentario('');
            }
          },
        },
      ]
    );
  };

  return (
    <FlatList
      data={pendientes}
      keyExtractor={(item) => String(item.usuario_id)}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      ListEmptyComponent={!loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color={COLORS.primary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin fincas pendientes</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Todas las fincas fueron revisadas</Text>
        </View>
      ) : null}
      renderItem={({ item }) => {
        const enProceso = procesandoId === item.usuario_id;
        return (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nombre, { color: colors.textPrimary }]}>{item.nombre_empresa_finca}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>Empleador: {item.nombre_completo}</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>Enviado: {formatearFecha(item.verificacion_empresa_revisado_at || item.created_at)}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <Text style={[styles.chipText, { color: '#B45309' }]}>Pendiente</Text>
              </View>
            </View>

            {/* Foto de la finca */}
            <Text style={[styles.docLabel, { color: colors.textSecondary }]}>Foto de la finca:</Text>
            {item.foto_finca_fachada
              ? <TouchableOpacity onPress={() => onZoom(item.foto_finca_fachada)} activeOpacity={0.85}>
                  <Image source={{ uri: item.foto_finca_fachada }} style={styles.docImg} resizeMode="cover" />
                  <View style={styles.zoomHint}><Ionicons name="expand-outline" size={14} color="#FFF" /><Text style={styles.zoomHintTxt}>Toca para ampliar</Text></View>
                </TouchableOpacity>
              : <View style={styles.placeholder}><Ionicons name="image-outline" size={28} color={COLORS.textLight} /><Text style={styles.placeholderText}>Sin foto de finca</Text></View>}

            {/* Documento de verificación */}
            <Text style={[styles.docLabel, { color: colors.textSecondary, marginTop: 12 }]}>Registro empresarial (RUT / RNT / Servicios públicos):</Text>
            {item.doc_verificacion_url
              ? <TouchableOpacity onPress={() => onZoom(item.doc_verificacion_url)} activeOpacity={0.85}>
                  <Image source={{ uri: item.doc_verificacion_url }} style={styles.docImg} resizeMode="contain" />
                  <View style={styles.zoomHint}><Ionicons name="expand-outline" size={14} color="#FFF" /><Text style={styles.zoomHintTxt}>Toca para ampliar</Text></View>
                </TouchableOpacity>
              : <View style={styles.placeholder}><Ionicons name="document-outline" size={28} color={COLORS.textLight} /><Text style={styles.placeholderText}>Sin documento</Text></View>}

            <View style={styles.actions}>
              <AnimatedPressable onPress={() => revisar(item, 'rechazada')}
                style={[styles.actionBtn, styles.rejectBtn, enProceso && styles.disabledBtn]} scaleValue={0.97} disabled={enProceso}>
                <Ionicons name="close-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionText}>{enProceso ? 'Guardando...' : 'Rechazar'}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => revisar(item, 'aprobada')}
                style={[styles.actionBtn, styles.approveBtn, enProceso && styles.disabledBtn]} scaleValue={0.97} disabled={enProceso}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionText}>{enProceso ? 'Guardando...' : 'Verificar'}</Text>
              </AnimatedPressable>
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminVerificacionCedulasScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const [tab, setTab] = useState('cedulas');
  const [fotoZoom, setFotoZoom] = useState(null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Modal zoom foto */}
      <Modal visible={!!fotoZoom} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFotoZoom(null)}>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity onPress={() => setFotoZoom(null)} style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}>
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          {fotoZoom && <Image source={{ uri: fotoZoom }} style={{ flex: 1 }} resizeMode="contain" />}
        </View>
      </Modal>
      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'cedulas' && styles.tabBtnActive]}
          onPress={() => setTab('cedulas')}
          activeOpacity={0.8}
        >
          <Ionicons name="card-outline" size={16} color={tab === 'cedulas' ? COLORS.primary : colors.textMuted} />
          <Text style={[styles.tabLabel, { color: tab === 'cedulas' ? COLORS.primary : colors.textMuted }]}>Cédulas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'fincas' && styles.tabBtnActive]}
          onPress={() => setTab('fincas')}
          activeOpacity={0.8}
        >
          <Ionicons name="business-outline" size={16} color={tab === 'fincas' ? COLORS.primary : colors.textMuted} />
          <Text style={[styles.tabLabel, { color: tab === 'fincas' ? COLORS.primary : colors.textMuted }]}>Fincas</Text>
        </TouchableOpacity>
      </View>

      {tab === 'cedulas'
        ? <TabCedulas navigation={navigation} colors={colors} isDark={isDark} onZoom={setFotoZoom} />
        : <TabFincas colors={colors} isDark={isDark} onZoom={setFotoZoom} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 14, fontWeight: '700' },

  listContent: { padding: SPACING.md, paddingBottom: 60 },
  card: {
    borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  nombre: { fontSize: 16, fontWeight: '700' },
  sub: { marginTop: 2, fontSize: 13 },
  chip: {
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm,
    paddingVertical: 4, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  docLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  docImg: {
    width: '100%', height: 220, borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  placeholder: {
    height: 120, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, alignItems: 'center',
    justifyContent: 'center', gap: 6, backgroundColor: '#F9FAFB',
  },
  placeholderText: { color: COLORS.textLight, fontSize: 13 },
  actions: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
  },
  rejectBtn: { backgroundColor: COLORS.error },
  approveBtn: { backgroundColor: COLORS.primary },
  disabledBtn: { opacity: 0.7 },
  actionText: { color: '#FFF', fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  zoomHint: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  zoomHintTxt: { color: '#FFF', fontSize: 11, fontWeight: '600' },
});
