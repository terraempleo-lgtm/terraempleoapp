import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';
import { useAppTheme } from '../../context/ThemeContext';

const FILTROS = [
  { key: '', label: 'Todas' },
  { key: 'recibido', label: 'Recibidas' },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'resuelto', label: 'Resueltas' },
  { key: 'cerrado', label: 'Cerradas' },
];

const TIPO_COLORS = {
  peticion: '#2196F3',
  queja: '#FF5722',
  reclamo: '#FF9800',
  sugerencia: '#4CAF50',
};

const TIPO_LABELS = {
  peticion: 'Petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
};

const ESTADO_COLORS = {
  recibido: '#2196F3',
  en_proceso: '#FF9800',
  resuelto: '#4CAF50',
  cerrado: '#9E9E9E',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)} días`;
}

export default function AdminPqrsScreen() {
  const { colors } = useAppTheme();
  const [pqrs, setPqrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('recibido');
  const [selected, setSelected] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('en_proceso');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await adminAPI.getPqrs(filtro);
      setPqrs(res.data.pqrs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro]);

  useEffect(() => { setLoading(true); cargar(); }, [cargar]);

  const abrir = (item) => {
    setSelected(item);
    setRespuesta(item.respuesta || '');
    setNuevoEstado(item.estado === 'recibido' ? 'en_proceso' : item.estado);
  };

  const guardar = async () => {
    if (!selected) return;
    try {
      setGuardando(true);
      await adminAPI.responderPqrs(selected.id, { estado: nuevoEstado, respuesta });
      setSelected(null);
      cargar();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setGuardando(false);
    }
  };

  const renderItem = ({ item }) => {
    const color = TIPO_COLORS[item.tipo] || COLORS.primary;
    const estadoColor = ESTADO_COLORS[item.estado] || COLORS.textSecondary;
    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: colors.surface }, SHADOWS.sm]}
        onPress={() => abrir(item)}
        activeOpacity={0.85}
      >
        <View style={[s.cardBar, { backgroundColor: color }]} />
        <View style={s.cardContent}>
          <View style={s.cardTop}>
            <Text style={[s.cardTipo, { color }]}>{TIPO_LABELS[item.tipo] || item.tipo}</Text>
            <View style={{ flex: 1 }} />
            <View style={[s.estadoBadge, { backgroundColor: estadoColor + '22' }]}>
              <Text style={[s.estadoText, { color: estadoColor }]}>{item.estado}</Text>
            </View>
          </View>
          <Text style={[s.cardAsunto, { color: colors.textPrimary }]} numberOfLines={1}>{item.asunto}</Text>
          <Text style={[s.cardUsuario, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.usuario_nombre} · {item.usuario_rol} · {item.usuario_celular}
          </Text>
          <View style={s.cardFooter}>
            <Text style={[s.cardFecha, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
            {item.respuesta ? <Ionicons name="chatbubble-ellipses" size={13} color={COLORS.primary} /> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[s.header, { borderColor: colors.border }]}>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>PQRS</Text>
        <Text style={[s.headerSub, { color: colors.textSecondary }]}>Peticiones, Quejas, Reclamos y Sugerencias</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filtrosRow, { borderColor: colors.border, backgroundColor: colors.surface }]} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8, paddingVertical: SPACING.sm }}>
        {FILTROS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filtroPill, filtro === f.key && s.filtroPillActivo]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[s.filtroText, filtro === f.key && s.filtroTextActivo]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={pqrs}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbox-ellipses-outline" size={48} color={COLORS.disabled} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>No hay solicitudes en esta categoría</Text>
            </View>
          }
        />
      )}

      {/* Modal respuesta */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: colors.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.textPrimary }]}>
                {TIPO_LABELS[selected?.tipo]} — {selected?.asunto}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={[s.modalLabel, { color: colors.textSecondary }]}>Usuario</Text>
              <Text style={[s.modalValue, { color: colors.textPrimary }]}>
                {selected?.usuario_nombre} ({selected?.usuario_rol}) · {selected?.usuario_celular}
              </Text>

              <Text style={[s.modalLabel, { color: colors.textSecondary }]}>Descripción</Text>
              <Text style={[s.modalValue, { color: colors.textPrimary }]}>{selected?.descripcion}</Text>

              <Text style={[s.modalLabel, { color: colors.textSecondary }]}>Estado</Text>
              <View style={s.estadoRow}>
                {['recibido', 'en_proceso', 'resuelto', 'cerrado'].map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[s.estadoChip, { borderColor: ESTADO_COLORS[e], backgroundColor: nuevoEstado === e ? ESTADO_COLORS[e] + '22' : 'transparent' }]}
                    onPress={() => setNuevoEstado(e)}
                  >
                    <Text style={[s.estadoChipText, { color: ESTADO_COLORS[e] }]}>{e.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.modalLabel, { color: colors.textSecondary }]}>Respuesta al usuario</Text>
              <TextInput
                style={[s.textarea, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Escribe la respuesta que verá el usuario..."
                placeholderTextColor={colors.textSecondary}
                value={respuesta}
                onChangeText={setRespuesta}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <TouchableOpacity
              style={[s.btnGuardar, { opacity: guardando ? 0.7 : 1 }]}
              onPress={guardar}
              disabled={guardando}
              activeOpacity={0.85}
            >
              {guardando
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={s.btnGuardarText}>Guardar respuesta</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  filtrosRow: { borderBottomWidth: 1, flexGrow: 0 },
  filtroPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filtroPillActivo: { backgroundColor: COLORS.primarySoft },
  filtroText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filtroTextActivo: { color: COLORS.primary, fontWeight: '700' },
  list: { padding: SPACING.md, gap: 10 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', borderRadius: RADIUS.lg, overflow: 'hidden' },
  cardBar: { width: 4 },
  cardContent: { flex: 1, padding: SPACING.md, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTipo: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  estadoText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  cardAsunto: { fontSize: 15, fontWeight: '600' },
  cardUsuario: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  cardFecha: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, paddingBottom: 32, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  modalLabel: { fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 3, textTransform: 'uppercase' },
  modalValue: { fontSize: 14, lineHeight: 20 },
  estadoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  estadoChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1.5 },
  estadoChipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  textarea: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, fontSize: 14, minHeight: 100, marginTop: 4 },
  btnGuardar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: RADIUS.xl, marginTop: 8 },
  btnGuardarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
