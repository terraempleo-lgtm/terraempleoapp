import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Alert, RefreshControl, Image, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI, calificacionesAPI, chatsAPI } from '../../services/api';
import { StarRating, Input } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alertService';
import { useAppTheme } from '../../context/ThemeContext';
import { AnimatedPressable } from '../../components/animated';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Publicado hoy';
  if (diff === 1) return 'Publicado hace 1 día';
  return `Publicado hace ${diff} días`;
}

function getMatchColor(pct) {
  if (pct >= 90) return { bg: COLORS.primarySoft, text: COLORS.primary, icon: 'flash' };
  if (pct >= 75) return { bg: '#FFF8E1', text: '#F57C00', icon: 'flash' };
  return { bg: '#F3F4F6', text: COLORS.textSecondary, icon: 'flash-outline' };
}

const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo', por_dias: 'Por días',
  temporada_cosecha: 'Por temporada / cosecha', fines_semana: 'Fines de semana',
  disponible_inmediatamente: 'Inmediata', inmediata: 'Inmediata',
};
const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios', primaria_completa: 'Primaria completa', bachiller: 'Bachiller',
  tecnico_tecnologo: 'Técnico / Tecnólogo', universitario: 'Universitario',
};

const TABS = [
  { key: 'todos', label: 'Todos', icon: 'people' },
  { key: 'pendiente', label: 'Nuevos', icon: 'time' },
  { key: 'aceptada', label: 'Aceptados', icon: 'checkmark-circle' },
  { key: 'rechazada', label: 'Rechazados', icon: 'close-circle' },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function VerPostulacionesScreen({ route, navigation }) {
  const { vacante } = route.params;
  const { colors, isDark } = useAppTheme();
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
      showAlert('Error', err.response?.data?.error || 'Error al actualizar');
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
      showAlert('Error', 'No se encontró el chat para este trabajador');
    }
  };

  const enviarCalificacion = async (trabajadorId) => {
    if (estrellas === 0) return showAlert('Error', 'Selecciona las estrellas');
    try {
      await calificacionesAPI.calificar({
        calificado_id: trabajadorId,
        vacante_id: vacante.id,
        estrellas,
        comentario,
      });
      showAlert('¡Listo!', 'Calificación enviada');
      setCalificandoId(null);
      setEstrellas(0);
      setComentario('');
    } catch {
      showAlert('Error', 'No se pudo calificar');
    }
  };

  const filtered = postulaciones
    .filter(p => {
      if (tab === 'pendiente') return p.estado === 'pendiente' || p.estado === 'match_auto';
      if (tab === 'aceptada') return p.estado === 'aceptada';
      if (tab === 'rechazada') return p.estado === 'rechazada';
      return true;
    })
    .filter(p => !search.trim() || p.nombre_completo?.toLowerCase().includes(search.toLowerCase()));

  const pendientesCount = postulaciones.filter(p => p.estado === 'pendiente' || p.estado === 'match_auto').length;
  const aceptadosCount = postulaciones.filter(p => p.estado === 'aceptada').length;

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'aceptada': return { label: 'Aceptado', color: COLORS.primary, bg: COLORS.primarySoft, icon: 'checkmark-circle' };
      case 'rechazada': return { label: 'Rechazado', color: COLORS.error, bg: COLORS.errorSoft, icon: 'close-circle' };
      case 'match_auto': return { label: 'Match', color: COLORS.info, bg: COLORS.infoSoft, icon: 'flash' };
      default: return { label: 'Pendiente', color: COLORS.warning, bg: COLORS.warningSoft, icon: 'time' };
    }
  };

  const renderPostulante = ({ item }) => {
    const matchPct = Math.round(item.puntaje_match || 0);
    const matchStyle = matchPct > 0 ? getMatchColor(matchPct) : null;
    const disponibilidad = LABELS_DISPONIBILIDAD[item.disponibilidad] || item.disponibilidad || null;
    const isPendiente = item.estado === 'pendiente' || item.estado === 'match_auto';
    const isAceptada = item.estado === 'aceptada';
    const estadoBadge = getEstadoBadge(item.estado);
    const initials = getInitials(item.nombre_completo);

    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {/* Left accent bar */}
        <View style={[styles.cardStatusBar, { backgroundColor: estadoBadge.color }]} />

        <View style={styles.cardContent}>
          {/* Top row: avatar + info + match */}
          <View style={styles.cardTop}>
            <AnimatedPressable
              onPress={() => navigation.navigate('PerfilPublicoTrabajador', {
                trabajador_id: item.trabajador_id,
                vacante_id: vacante.id,
                postulacion_estado: item.estado,
              })}
            >
              <View style={[styles.avatar, { backgroundColor: COLORS.primarySoft }]}>
                {item.foto_selfie ? (
                  <Image source={{ uri: item.foto_selfie }} style={styles.avatarImg} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: COLORS.primary }]}>{initials}</Text>
                )}
              </View>
            </AnimatedPressable>

            <View style={styles.candidateInfo}>
              <Text style={[styles.candidateName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.nombre_completo}
              </Text>
              <View style={styles.metaRow}>
                {item.calificacion_promedio > 0 && (
                  <View style={[styles.ratingChip, { backgroundColor: isDark ? '#2a2200' : '#FFF8E1' }]}>
                    <Ionicons name="star" size={12} color="#FFB300" />
                    <Text style={styles.ratingText}>{Number(item.calificacion_promedio).toFixed(1)}</Text>
                  </View>
                )}
                <View style={[styles.estadoChip, { backgroundColor: estadoBadge.bg }]}>
                  <Ionicons name={estadoBadge.icon} size={11} color={estadoBadge.color} />
                  <Text style={[styles.estadoChipText, { color: estadoBadge.color }]}>{estadoBadge.label}</Text>
                </View>
              </View>
            </View>

            {matchPct > 0 && (
              <View style={[styles.matchBadge, { backgroundColor: matchStyle.bg }]}>
                <Ionicons name={matchStyle.icon} size={13} color={matchStyle.text} />
                <Text style={[styles.matchText, { color: matchStyle.text }]}>{matchPct}%</Text>
              </View>
            )}
          </View>

          {/* Info chips row */}
          <View style={styles.infoChipsRow}>
            {disponibilidad && (
              <View style={[styles.infoChip, { backgroundColor: isDark ? colors.surface : COLORS.borderLight, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.infoChipText, { color: colors.textSecondary }]}>{disponibilidad}</Text>
              </View>
            )}
            {item.nivel_estudios && (
              <View style={[styles.infoChip, { backgroundColor: isDark ? colors.surface : COLORS.borderLight, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}>
                <Ionicons name="school-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.infoChipText, { color: colors.textSecondary }]}>{LABELS_ESTUDIOS[item.nivel_estudios] || item.nivel_estudios}</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Action buttons */}
          <View style={styles.actions}>
            <AnimatedPressable
              style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : COLORS.borderLight, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}
              onPress={() => navigation.navigate('PerfilPublicoTrabajador', {
                trabajador_id: item.trabajador_id,
                vacante_id: vacante.id,
                postulacion_estado: item.estado,
              })}
            >
              <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Perfil</Text>
            </AnimatedPressable>

            {isPendiente && (
              <>
                <AnimatedPressable
                  style={styles.btnDanger}
                  onPress={() => cambiarEstado(item.id, 'rechazada')}
                >
                  <Ionicons name="close" size={15} color={COLORS.error} />
                  <Text style={styles.btnDangerText}>Rechazar</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.btnPrimary}
                  onPress={() => cambiarEstado(item.id, 'aceptada')}
                >
                  <Ionicons name="checkmark" size={15} color={COLORS.white} />
                  <Text style={styles.btnPrimaryText}>Aceptar</Text>
                </AnimatedPressable>
              </>
            )}

            {isAceptada && calificandoId !== item.trabajador_id && (
              <>
                <AnimatedPressable
                  style={styles.btnChat}
                  onPress={() => irAlChat(item)}
                >
                  <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.primary} />
                  <Text style={styles.btnChatText}>Chat</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.btnPrimary}
                  onPress={() => setCalificandoId(item.trabajador_id)}
                >
                  <Ionicons name="star-outline" size={14} color={COLORS.white} />
                  <Text style={styles.btnPrimaryText}>Calificar</Text>
                </AnimatedPressable>
              </>
            )}

            {item.estado === 'rechazada' && (
              <View style={styles.rejectedLabel}>
                <Ionicons name="close-circle" size={14} color={COLORS.error} />
                <Text style={styles.rejectedLabelText}>Rechazado</Text>
              </View>
            )}
          </View>

          {/* Rating panel */}
          {calificandoId === item.trabajador_id && (
            <View style={[styles.calificarBox, { backgroundColor: isDark ? '#2a2200' : '#FFF8E1' }]}>
              <View style={styles.calificarHeader}>
                <Ionicons name="star" size={18} color="#FFB300" />
                <Text style={[styles.calificarTitle, { color: colors.textPrimary }]}>
                  Calificar a {item.nombre_completo?.split(' ')[0]}
                </Text>
              </View>
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
                <AnimatedPressable
                  style={styles.btnPrimary}
                  onPress={() => enviarCalificacion(item.trabajador_id)}
                >
                  <Text style={styles.btnPrimaryText}>Enviar</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : COLORS.borderLight, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}
                  onPress={() => setCalificandoId(null)}
                >
                  <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Cancelar</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const ListHeader = (
    <View>
      {/* Vacancy info card */}
      <View style={[styles.vacanteCard, { backgroundColor: colors.surface }]}>
        <View style={styles.vacanteIconWrap}>
          <Ionicons name="briefcase" size={22} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.vacanteTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {vacante.titulo}
          </Text>
          <Text style={[styles.vacanteMeta, { color: colors.textSecondary }]}>{timeAgo(vacante.created_at)}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{postulaciones.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.warning }]}>{pendientesCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Nuevos</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.primary }]}>{aceptadosCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aceptados</Text>
        </View>
      </View>

      {/* Tabs — scrollable pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
        style={styles.tabsContainer}
      >
        {TABS.map(t => {
          const isActive = tab === t.key;
          const count = t.key === 'pendiente'
            ? pendientesCount
            : t.key === 'aceptada'
              ? aceptadosCount
              : t.key === 'rechazada'
                ? postulaciones.filter(p => p.estado === 'rechazada').length
                : postulaciones.length;
          return (
            <AnimatedPressable
              key={t.key}
              style={[
                styles.tabPill,
                { backgroundColor: isActive ? COLORS.primary : colors.surface },
                !isActive && { borderWidth: 1, borderColor: colors.border },
              ]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons name={t.icon} size={14} color={isActive ? COLORS.white : colors.textSecondary} />
              <Text style={[styles.tabPillText, { color: isActive ? COLORS.white : colors.textSecondary }]}>
                {t.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabCount, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : COLORS.primarySoft }]}>
                  <Text style={[styles.tabCountText, { color: isActive ? COLORS.white : COLORS.primary }]}>
                    {count}
                  </Text>
                </View>
              )}
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchInner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar por nombre..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch('')} haptic={false}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </AnimatedPressable>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <AnimatedPressable
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: isDark ? colors.surface : COLORS.borderLight }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </AnimatedPressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            Postulaciones
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {vacante.titulo}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{postulaciones.length}</Text>
        </View>
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
            <View style={[styles.emptyIconWrap, { backgroundColor: COLORS.primarySoft }]}>
              <Ionicons name="people-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {search ? 'Sin resultados' : 'Sin postulantes aún'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {search
                ? 'No se encontraron candidatos con ese nombre'
                : 'Los candidatos aparecerán aquí cuando se postulen'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  headerSub: { fontSize: 12, marginTop: 1 },
  headerBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* Vacante info card */
  vacanteCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.xl,
    padding: SPACING.md, marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  vacanteIconWrap: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  vacanteTitle: { fontSize: 17, fontWeight: '700' },
  vacanteMeta: { fontSize: 12, marginTop: 2 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: SPACING.md, marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  statDivider: { width: 1, marginHorizontal: SPACING.sm },

  /* Tabs — scrollable pills */
  tabsContainer: { marginBottom: SPACING.sm },
  tabsScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  tabPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: RADIUS.full,
    ...SHADOWS.small,
  },
  tabPillText: { fontSize: 13, fontWeight: '600' },
  tabCount: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: RADIUS.full,
    minWidth: 20, alignItems: 'center',
  },
  tabCountText: { fontSize: 11, fontWeight: '700' },

  /* Search */
  searchWrap: { marginBottom: SPACING.md },
  searchInner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingVertical: 11,
    gap: SPACING.sm,
    borderWidth: 1.5,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  /* List */
  list: { padding: SPACING.md, paddingBottom: 100 },

  /* Card */
  card: {
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardStatusBar: { width: 4 },
  cardContent: { flex: 1, padding: SPACING.md },

  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: 54, height: 54, borderRadius: 27 },
  avatarInitials: { fontSize: 18, fontWeight: '800' },
  candidateInfo: { flex: 1 },
  candidateName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ratingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  ratingText: { fontSize: 12, fontWeight: '700', color: '#F57C00' },
  estadoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  estadoChipText: { fontSize: 11, fontWeight: '700' },

  matchBadge: {
    alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  matchText: { fontSize: 13, fontWeight: '800' },

  /* Info chips */
  infoChipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: SPACING.sm },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  infoChipText: { fontSize: 12, fontWeight: '500' },

  divider: { height: 1, marginBottom: SPACING.sm },

  /* Buttons */
  actions: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', flexWrap: 'wrap' },
  btnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600' },
  btnDanger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.errorSoft,
    backgroundColor: COLORS.errorSoft,
  },
  btnDangerText: { fontSize: 13, fontWeight: '700', color: COLORS.error },
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    ...SHADOWS.button,
  },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  btnChat: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  btnChatText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  rejectedLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.errorSoft,
  },
  rejectedLabelText: { fontSize: 12, fontWeight: '600', color: COLORS.error },

  /* Rating */
  calificarBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  calificarHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calificarTitle: { fontSize: 14, fontWeight: '700' },
  calificarBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },

  /* Empty */
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
