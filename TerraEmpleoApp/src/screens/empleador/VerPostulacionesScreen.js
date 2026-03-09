import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, Image, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI, calificacionesAPI, chatsAPI } from '../../services/api';
import { StarRating, Input } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Publicado hoy';
  if (diff === 1) return 'Publicado hace 1 día';
  return `Publicado hace ${diff} días`;
}

function getMatchColor(pct) {
  if (pct >= 90) return { bg: '#e6f7ee', text: COLORS.primary };
  if (pct >= 75) return { bg: '#FFF8E1', text: '#F57C00' };
  return { bg: '#F5F5F5', text: COLORS.textSecondary };
}

function mapDisponibilidad(d) {
  if (!d) return null;
  const map = {
    inmediata: 'Disponibilidad Inmediata',
    dos_semanas: '2 semanas de aviso',
    un_mes: '1 mes de aviso',
    negociable: 'Negociable',
  };
  return map[d] || d;
}

const TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Nuevos' },
  { key: 'aceptada', label: 'Aceptados' },
  { key: 'rechazada', label: 'Rechazados' },
];

export default function VerPostulacionesScreen({ route, navigation }) {
  const { vacante } = route.params;
  const [postulaciones, setPostulaciones] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('todos');
  const [search, setSearch] = useState('');
  const [calificandoId, setCalificandoId] = useState(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');

  const cargar = async () => {
    try {
      const res = await vacantesAPI.verPostulaciones(vacante.id);
      setPostulaciones(res.data.postulaciones || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const cambiarEstado = async (postId, estado) => {
    try {
      await vacantesAPI.actualizarPostulacion(postId, estado);
      setPostulaciones(prev =>
        prev.map(p => p.id === postId ? { ...p, estado } : p)
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al actualizar');
    }
  };

  const irAlChat = async (item) => {
    try {
      const res = await chatsAPI.chatPorVacanteTrabajador(vacante.id, item.trabajador_id);
      const chatId = res.data.chat_id;
      navigation.navigate('Mensajes', {
        screen: 'ChatDetalle',
        params: {
          chat: {
            id: chatId,
            otro_nombre: item.nombre_completo,
            otro_foto: item.foto_selfie,
            vacante_titulo: vacante.titulo,
          },
        },
      });
    } catch {
      Alert.alert('Error', 'No se encontró el chat para este trabajador');
    }
  };

  const enviarCalificacion = async (trabajadorId) => {
    if (estrellas === 0) return Alert.alert('Error', 'Selecciona las estrellas');
    try {
      await calificacionesAPI.calificar({
        calificado_id: trabajadorId,
        vacante_id: vacante.id,
        estrellas,
        comentario,
      });
      Alert.alert('¡Listo!', 'Calificación enviada');
      setCalificandoId(null);
      setEstrellas(0);
      setComentario('');
    } catch {
      Alert.alert('Error', 'No se pudo calificar');
    }
  };

  // Filtrado por tab y búsqueda
  const filtered = postulaciones
    .filter(p => {
      if (tab === 'pendiente') return p.estado === 'pendiente' || p.estado === 'match_auto';
      if (tab === 'aceptada') return p.estado === 'aceptada';
      if (tab === 'rechazada') return p.estado === 'rechazada';
      return true;
    })
    .filter(p => !search.trim() || p.nombre_completo?.toLowerCase().includes(search.toLowerCase()));

  const pendientesCount = postulaciones.filter(p => p.estado === 'pendiente' || p.estado === 'match_auto').length;

  const renderPostulante = ({ item }) => {
    const matchPct = Math.round(item.puntaje_match || 0);
    const matchStyle = matchPct > 0 ? getMatchColor(matchPct) : null;
    const disponibilidad = mapDisponibilidad(item.disponibilidad);
    const isPendiente = item.estado === 'pendiente' || item.estado === 'match_auto';
    const isAceptada = item.estado === 'aceptada';

    return (
      <View style={styles.card}>
        {/* Foto + nombre + match */}
        <View style={styles.cardTop}>
          <TouchableOpacity
            onPress={() => navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: item.trabajador_id, vacante_id: vacante.id, postulacion_estado: item.estado })}
            activeOpacity={0.85}
          >
            <View style={styles.avatar}>
              {item.foto_selfie ? (
                <Image source={{ uri: item.foto_selfie }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={28} color={COLORS.white} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.candidateInfo}>
            <Text style={styles.candidateName}>{item.nombre_completo}</Text>
            <View style={styles.ratingRow}>
              {item.calificacion_promedio > 0 && (
                <>
                  <Ionicons name="star" size={13} color="#FFB300" />
                  <Text style={styles.ratingText}>{Number(item.calificacion_promedio).toFixed(1)}</Text>
                  <View style={styles.dot} />
                </>
              )}
              {disponibilidad && (
                <Text style={styles.disponibilidadText}>{disponibilidad}</Text>
              )}
            </View>
          </View>

          {matchPct > 0 && (
            <View style={[styles.matchBadge, { backgroundColor: matchStyle.bg }]}>
              <Text style={[styles.matchText, { color: matchStyle.text }]}>
                {matchPct}% MATCH
              </Text>
            </View>
          )}
        </View>

        {/* Info extra */}
        {item.nivel_estudios && (
          <Text style={styles.extraInfo}>
            <Text style={{ fontWeight: '600' }}>Estudios: </Text>{item.nivel_estudios}
          </Text>
        )}

        {/* Separador */}
        <View style={styles.divider} />

        {/* Botones de acción */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnPerfil}
            onPress={() => navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: item.trabajador_id, vacante_id: vacante.id, postulacion_estado: item.estado })}
          >
            <Text style={styles.btnPerfilText}>Ver Perfil</Text>
          </TouchableOpacity>

          {isPendiente && (
            <>
              <TouchableOpacity
                style={styles.btnRechazar}
                onPress={() => cambiarEstado(item.id, 'rechazada')}
              >
                <Text style={styles.btnRechazarText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnAceptar}
                onPress={() => cambiarEstado(item.id, 'aceptada')}
              >
                <Text style={styles.btnAceptarText}>Aceptar</Text>
              </TouchableOpacity>
            </>
          )}

          {isAceptada && calificandoId !== item.trabajador_id && (
            <>
              <TouchableOpacity
                style={styles.btnChat}
                onPress={() => irAlChat(item)}
              >
                <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.primary} />
                <Text style={styles.btnChatText}>Chatear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnAceptar}
                onPress={() => setCalificandoId(item.trabajador_id)}
              >
                <Text style={styles.btnAceptarText}>Calificar</Text>
              </TouchableOpacity>
            </>
          )}

          {item.estado === 'rechazada' && (
            <View style={styles.estadoFinalBadge}>
              <Text style={styles.estadoFinalText}>Rechazado</Text>
            </View>
          )}
        </View>

        {/* Panel de calificación */}
        {calificandoId === item.trabajador_id && (
          <View style={styles.calificarBox}>
            <Text style={styles.calificarTitle}>Calificar a {item.nombre_completo}</Text>
            <StarRating rating={estrellas} onRate={setEstrellas} size={32} />
            <Input
              label="Comentario (opcional)"
              value={comentario}
              onChangeText={setComentario}
              placeholder="¿Cómo fue el trabajo?"
              multiline
              numberOfLines={2}
            />
            <View style={styles.calificarBtns}>
              <TouchableOpacity
                style={styles.btnAceptar}
                onPress={() => enviarCalificacion(item.trabajador_id)}
              >
                <Text style={styles.btnAceptarText}>Enviar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPerfil}
                onPress={() => setCalificandoId(null)}
              >
                <Text style={styles.btnPerfilText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const ListHeader = (
    <View>
      {/* Info de la vacante */}
      <View style={styles.vacanteInfo}>
        <Text style={styles.vacanteTitle}>{vacante.titulo}</Text>
        <Text style={styles.vacanteMeta}>
          {postulaciones.length} candidatos activos  •  {timeAgo(vacante.created_at)}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Buscador */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar candidatos..."
          placeholderTextColor={COLORS.textLight}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.filterIcon}>
          <Ionicons name="options-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header con back */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Postulaciones</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderPostulante}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            <Ionicons name="people-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyText}>
              {search ? 'Sin resultados para tu búsqueda' : 'Aún no hay postulantes'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F4' },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderColor: COLORS.borderLight,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  /* Vacante info */
  vacanteInfo: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  vacanteTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  vacanteMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  /* Tabs */
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1, borderColor: COLORS.borderLight,
  },
  tab: { marginRight: SPACING.lg, paddingVertical: SPACING.sm, position: 'relative' },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: COLORS.primary, borderRadius: 1,
  },

  /* Buscador */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    margin: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: SPACING.sm,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, padding: 0 },
  filterIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Lista */
  list: { paddingHorizontal: SPACING.md, paddingBottom: 24 },

  /* Card postulante */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: '#90A4AE',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: 62, height: 62, borderRadius: 31 },
  candidateInfo: { flex: 1 },
  candidateName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#FFB300' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textLight },
  disponibilidadText: { fontSize: 13, color: COLORS.textSecondary },

  matchBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, alignSelf: 'flex-start',
  },
  matchText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  extraInfo: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },

  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },

  /* Botones */
  actions: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', flexWrap: 'wrap' },
  btnPerfil: {
    flex: 1,
    paddingVertical: 10, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  btnPerfilText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  btnRechazar: {
    flex: 1,
    paddingVertical: 10, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: '#E53935',
    alignItems: 'center',
  },
  btnRechazarText: { fontSize: 13, fontWeight: '700', color: '#E53935' },
  btnAceptar: {
    flex: 1,
    paddingVertical: 10, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  btnAceptarText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  estadoFinalBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  estadoFinalText: { fontSize: 12, fontWeight: '600', color: '#C62828' },
  btnChat: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  btnChatText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* Calificación */
  calificarBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  calificarTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  calificarBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },

  /* Empty */
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
});
