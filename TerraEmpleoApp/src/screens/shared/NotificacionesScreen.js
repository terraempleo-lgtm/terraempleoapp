import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS } from '../../theme';
import { notificacionesAPI, vacantesAPI, chatsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';

const TIPO_CONFIG = {
  match: { icon: 'flash', color: '#F57C00', bg: '#FFF3E0' },
  nuevo_match: { icon: 'flash', color: '#F57C00', bg: '#FFF3E0' },
  oferta_recomendada: { icon: 'briefcase', color: '#008d49', bg: '#e6f7ee' },
  nueva_vacante: { icon: 'briefcase', color: '#008d49', bg: '#e6f7ee' },
  postulacion: { icon: 'person-add', color: '#3B82F6', bg: '#EFF6FF' },
  aceptado: { icon: 'checkmark-circle', color: '#008d49', bg: '#e6f7ee' },
  postulacion_aceptada: { icon: 'checkmark-circle', color: '#008d49', bg: '#e6f7ee' },
  chat_habilitado: { icon: 'chatbubbles', color: '#3B82F6', bg: '#EFF6FF' },
  nuevo_mensaje: { icon: 'chatbubble-ellipses', color: '#3B82F6', bg: '#EFF6FF' },
  rechazado: { icon: 'close-circle', color: '#DC2626', bg: '#FEF2F2' },
  calificacion: { icon: 'star', color: '#7B1FA2', bg: '#F3E5F5' },
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

function normalizarNotificacion(raw) {
  const tipoRaw = String(raw?.type || raw?.tipo || '').toLowerCase();
  const payloadRaw = raw?.data || raw?.payload || {};

  let type = 'UNKNOWN';
  switch (tipoRaw) {
    case 'postulacion_aceptada':
    case 'aceptado':
      type = 'POSTULACION_ACEPTADA';
      break;
    case 'chat_habilitado':
      type = 'CHAT_HABILITADO';
      break;
    case 'nuevo_mensaje':
      type = 'NUEVO_MENSAJE';
      break;
    case 'nuevo_match':
    case 'match':
      type = 'NUEVO_MATCH';
      break;
    case 'oferta_recomendada':
    case 'nueva_vacante':
      type = 'VACANTE_RECOMENDADA';
      break;
    case 'postulacion':
      type = 'POSTULACION_ENVIADA';
      break;
    case 'vacante_editada':
      type = 'VACANTE_EDITADA';
      break;
    case 'vacante_cerrada':
      type = 'VACANTE_CERRADA';
      break;
    case 'vacante_activada':
      type = 'VACANTE_ACTIVADA';
      break;
    default:
      break;
  }

  if (type === 'UNKNOWN') {
    const txt = `${raw?.titulo || ''} ${raw?.mensaje || ''}`.toLowerCase();
    if (txt.includes('postulaci') && txt.includes('acept')) type = 'POSTULACION_ACEPTADA';
    else if (txt.includes('chat') && txt.includes('habilit')) type = 'CHAT_HABILITADO';
    else if (txt.includes('nuevo match') || txt.includes('coincide con la vacante')) type = 'NUEVO_MATCH';
    else if (txt.includes('recomendad')) type = 'VACANTE_RECOMENDADA';
  }

  return {
    id: String(raw?.id || ''),
    type,
    createdAt: raw?.createdAt || raw?.created_at,
    data: {
      vacancyId: payloadRaw.vacancyId || raw?.vacancyId || raw?.vacante_id || null,
      applicationId: payloadRaw.applicationId || raw?.applicationId || raw?.postulacion_id || null,
      matchId: payloadRaw.matchId || raw?.matchId || null,
      chatId: payloadRaw.chatId || raw?.chatId || raw?.conversacion_id || raw?.chat_id || null,
      employerId: payloadRaw.employerId || raw?.employerId || raw?.empleador_id || null,
      workerId: payloadRaw.workerId || raw?.workerId || raw?.trabajador_id || null,
    },
  };
}

export default function NotificacionesScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
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
  const countNoLeidas = notificaciones.filter(n => !n.leida).length;

  const abrirDetalleVacante = async (vacanteId) => {
    if (!vacanteId) return;
    try {
      const res = await vacantesAPI.detalle(vacanteId);
      const vacante = res.data?.vacante || { id: vacanteId };
      if (user?.rol === 'empleador') {
        navigation.navigate('DetalleVacanteEmpleador', { vacante });
        return;
      }
      navigation.navigate('DetalleVacante', { vacante });
      return vacante;
    } catch (err) {
      console.error('Error abriendo detalle de vacante:', err);
      return null;
    }
  };

  const abrirOfertaRecomendada = async (notification) => {
    if (notification?.data?.vacancyId) {
      await abrirDetalleVacante(notification.data.vacancyId);
      return;
    }
    try {
      const matchTitulo = notification?.mensaje?.match(/"([^"]+)"/);
      const titulo = matchTitulo?.[1]?.trim();
      if (!titulo) {
        navigation.navigate('Vacantes');
        return;
      }
      const res = await vacantesAPI.listar();
      const vacantes = res.data?.vacantes || [];
      const vacanteEncontrada = vacantes.find((v) =>
        String(v.titulo || '').toLowerCase() === titulo.toLowerCase()
      ) || vacantes.find((v) =>
        String(v.titulo || '').toLowerCase().includes(titulo.toLowerCase())
      );
      if (vacanteEncontrada?.id) {
        await abrirDetalleVacante(vacanteEncontrada.id);
        return;
      }
    } catch (err) {
      console.error('Error resolviendo oferta recomendada:', err);
    }
    navigation.navigate('Vacantes');
  };

  const abrirPostulaciones = async (vacanteId) => {
    if (user?.rol === 'trabajador') {
      navigation.navigate('Postulaciones', { vacante_id: vacanteId || null });
      return;
    }
    if (user?.rol === 'empleador' && vacanteId) {
      const vacante = await abrirDetalleVacante(vacanteId);
      navigation.navigate('VerPostulaciones', { vacante: vacante || { id: vacanteId, titulo: 'Vacante' } });
      return;
    }
    navigation.navigate('Vacantes');
  };

  const getOrCreateChatId = async ({ chatId, vacancyId, employerId, workerId }) => {
    if (chatId) return Number(chatId);
    try {
      const resolvedChatId = await chatsAPI.getOrCreateChatId({
        vacancyId,
        employerId,
        workerId,
      });
      return resolvedChatId ? Number(resolvedChatId) : null;
    } catch (err) {
      console.warn('[Notificaciones] No se pudo resolver chatId:', err?.message || err);
      return null;
    }
  };

  const abrirChat = async ({ chatId, vacancyId, employerId, workerId }) => {
    const resolvedChatId = await getOrCreateChatId({ chatId, vacancyId, employerId, workerId });
    if (!resolvedChatId) {
      console.warn('[Notificaciones] Falta chatId para navegar al chat');
      navigation.navigate('Mensajes');
      return;
    }
    navigation.navigate('Mensajes', {
      screen: 'ChatsHome',
      params: { abrirChatId: Number(resolvedChatId) },
    });
  };

  const handleNotificacionClick = async (item) => {
    await marcarLeida(item);
    const notification = normalizarNotificacion(item);
    console.log('[Notificaciones] click', notification.type, notification.data);

    switch (notification.type) {
      case 'POSTULACION_ACEPTADA': {
        await abrirChat({
          chatId: notification.data.chatId,
          vacancyId: notification.data.vacancyId,
          employerId: notification.data.employerId,
          workerId: notification.data.workerId,
        });
        break;
      }
      case 'CHAT_HABILITADO':
      case 'NUEVO_MENSAJE': {
        await abrirChat({
          chatId: notification.data.chatId,
          vacancyId: notification.data.vacancyId,
          employerId: notification.data.employerId,
          workerId: notification.data.workerId,
        });
        break;
      }
      case 'NUEVO_MATCH':
      case 'VACANTE_RECOMENDADA': {
        await abrirOfertaRecomendada({
          ...item,
          data: notification.data,
        });
        break;
      }
      case 'POSTULACION_ENVIADA': {
        await abrirPostulaciones(notification.data.vacancyId);
        break;
      }
      case 'VACANTE_EDITADA': {
        if (notification.data.vacancyId && user?.rol === 'empleador') {
          const vacante = await abrirDetalleVacante(notification.data.vacancyId);
          if (vacante) navigation.navigate('EditarVacante', { vacante });
          break;
        }
        await abrirDetalleVacante(notification.data.vacancyId);
        break;
      }
      case 'VACANTE_CERRADA':
      case 'VACANTE_ACTIVADA': {
        await abrirDetalleVacante(notification.data.vacancyId);
        break;
      }
      default:
        if (notification.data.vacancyId) {
          await abrirDetalleVacante(notification.data.vacancyId);
          break;
        }
        if (notification.data.chatId) {
          await abrirChat({ chatId: notification.data.chatId });
          break;
        }
        console.warn('[Notificaciones] Tipo desconocido o data insuficiente:', notification.type, notification.data);
        break;
    }
  };

  const renderItem = ({ item }) => {
    const tipoKey = (item.tipo || '').toLowerCase();
    const config = TIPO_CONFIG[tipoKey] || TIPO_CONFIG.match;
    const isUnread = !item.leida;

    // Adapt icon bg/color for dark mode
    const iconBg = isDark
      ? config.color + '28'
      : config.bg;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isUnread
              ? (isDark ? colors.surface + 'ee' : '#f6fdf9')
              : colors.surface,
            borderColor: isUnread ? colors.primary + '30' : colors.border,
          },
        ]}
        onPress={() => handleNotificacionClick(item)}
        activeOpacity={0.82}
      >
        {/* Unread dot indicator */}
        {isUnread && (
          <View style={styles.unreadDotWrap}>
            <View style={[styles.unreadDot, { backgroundColor: '#22c55e' }]} />
          </View>
        )}

        {/* Icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>

        {/* Text content */}
        <View style={styles.cardBody}>
          <Text
            style={[
              styles.titulo,
              { color: isUnread ? colors.textPrimary : colors.textSecondary },
              isUnread && styles.tituloUnread,
            ]}
            numberOfLines={1}
          >
            {item.titulo}
          </Text>
          <Text style={[styles.mensaje, { color: colors.textMuted }]} numberOfLines={2}>
            {item.mensaje}
          </Text>
        </View>

        {/* Time + chevron column */}
        <View style={styles.rightCol}>
          <Text style={[styles.tiempo, { color: colors.textMuted }]}>
            {tiempoRelativo(item.created_at)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginTop: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="notifications" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notificaciones</Text>
          {countNoLeidas > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.headerBadgeText}>{countNoLeidas}</Text>
            </View>
          )}
        </View>
        {hayNoLeidas && (
          <TouchableOpacity
            style={[styles.markAllBtn, { backgroundColor: colors.primary + '18' }]}
            onPress={marcarTodasLeidas}
          >
            <Ionicons name="checkmark-done" size={15} color={colors.primary} />
            <Text style={[styles.markAllText, { color: colors.primary }]}>Leer todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notificaciones}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, notificaciones.length === 0 && styles.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="notifications-off-outline" size={44} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin notificaciones</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Las actualizaciones de tus vacantes y postulaciones aparecerán aquí
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  markAllText: { fontSize: 13, fontWeight: '600' },

  /* List */
  list: { padding: SPACING.md, paddingBottom: SPACING.xl * 2, gap: SPACING.sm },
  listEmpty: { flex: 1 },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    overflow: 'hidden',
  },

  /* Unread dot */
  unreadDotWrap: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  /* Icon circle */
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
    marginLeft: 6,
  },

  /* Body */
  cardBody: { flex: 1 },
  titulo: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
  },
  tituloUnread: { fontWeight: '700' },
  mensaje: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  /* Right column */
  rightCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  tiempo: { fontSize: 11, fontWeight: '500' },

  /* Empty */
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xl * 3,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs, textAlign: 'center' },
  emptyText: {
    fontSize: 14,
    textAlign: 'center', lineHeight: 20,
  },
});
