import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, ScrollView, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { notificacionesAPI, vacantesAPI, chatsAPI, especialistasAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { AnimatedPressable } from '../../components/animated';

const TIPO_CONFIG = {
  match:              { icon: 'flash',              color: '#F57C00', bg: '#FFF3E0' },
  nuevo_match:        { icon: 'flash',              color: '#F57C00', bg: '#FFF3E0' },
  oferta_recomendada: { icon: 'briefcase',          color: COLORS.primary, bg: '#E8F5EC' },
  nueva_vacante:      { icon: 'briefcase',          color: COLORS.primary, bg: '#E8F5EC' },
  postulacion:        { icon: 'person-add',         color: '#3B82F6', bg: '#EFF6FF' },
  aceptado:           { icon: 'checkmark-circle',   color: COLORS.primary, bg: '#E8F5EC' },
  postulacion_aceptada: { icon: 'checkmark-circle', color: COLORS.primary, bg: '#E8F5EC' },
  chat_habilitado:    { icon: 'chatbubbles',        color: '#3B82F6', bg: '#EFF6FF' },
  nuevo_mensaje:      { icon: 'chatbubble-ellipses',color: '#3B82F6', bg: '#EFF6FF' },
  rechazado:          { icon: 'close-circle',       color: '#DC2626', bg: '#FEF2F2' },
  calificacion:       { icon: 'star',               color: '#7B1FA2', bg: '#F3E5F5' },
  contacto:           { icon: 'person-add',         color: '#C0694A', bg: '#FEF3EE' },
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

function getGroup(dateStr) {
  if (!dateStr) return 'Más antiguas';
  const now = new Date();
  const d = new Date(dateStr);
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return 'Esta semana';
  return 'Más antiguas';
}

const GROUP_ORDER = ['Hoy', 'Ayer', 'Esta semana', 'Más antiguas'];

function normalizarNotificacion(raw) {
  const tipoRaw = String(raw?.type || raw?.tipo || '').toLowerCase();
  const payloadRaw = raw?.data || raw?.payload || {};

  let type = 'UNKNOWN';
  switch (tipoRaw) {
    case 'postulacion_aceptada': case 'aceptado': type = 'POSTULACION_ACEPTADA'; break;
    case 'chat_habilitado': type = 'CHAT_HABILITADO'; break;
    case 'nuevo_mensaje': type = 'NUEVO_MENSAJE'; break;
    case 'nuevo_match': case 'match': type = 'NUEVO_MATCH'; break;
    case 'oferta_recomendada': case 'nueva_vacante': type = 'VACANTE_RECOMENDADA'; break;
    case 'postulacion': type = 'POSTULACION_ENVIADA'; break;
    case 'contacto_solicitado': type = 'SOLICITUD_CONTACTO'; break;
    case 'contacto': type = 'CONTACTO_ESPECIALISTA'; break;
    case 'vacante_editada': type = 'VACANTE_EDITADA'; break;
    case 'vacante_cerrada': type = 'VACANTE_CERRADA'; break;
    case 'vacante_activada': type = 'VACANTE_ACTIVADA'; break;
    default: break;
  }

  if (type === 'UNKNOWN') {
    const txt = `${raw?.titulo || ''} ${raw?.mensaje || ''}`.toLowerCase();
    if (txt.includes('postulaci') && txt.includes('acept')) type = 'POSTULACION_ACEPTADA';
    else if (txt.includes('chat') && txt.includes('habilit')) type = 'CHAT_HABILITADO';
    else if (txt.includes('nuevo match') || txt.includes('coincide con la vacante')) type = 'NUEVO_MATCH';
    else if (txt.includes('recomendad')) type = 'VACANTE_RECOMENDADA';
    else if (txt.includes('quiere contactarte')) type = 'CONTACTO_ESPECIALISTA';
    else if (txt.includes('solicitud de contacto')) type = 'SOLICITUD_CONTACTO';
  }

  return {
    id: String(raw?.id || ''),
    type,
    createdAt: raw?.createdAt || raw?.created_at,
    data: {
      vacancyId: payloadRaw.vacancyId || raw?.vacancyId || raw?.vacante_id || null,
      applicationId: payloadRaw.applicationId || raw?.applicationId || raw?.postulacion_id || payloadRaw.postulacion_id || null,
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
  const [filtro, setFiltro] = useState('todas');
  const [solicitudModal, setSolicitudModal] = useState(null); // { notif, postulacionId, vacancyId, titulo }
  const [respondiendo, setRespondiendo] = useState(false);

  const cargar = useCallback(async () => {
    // 1) Cache local SQLite
    try {
      const { notificacionesRepo } = require('../../db/repos');
      const local = await notificacionesRepo.listar();
      if (local?.length) setNotificaciones(local);
    } catch (_) {}

    // 2) Sync incremental con backend
    try {
      const { syncNotificaciones } = require('../../db/sync');
      await syncNotificaciones();
      const { notificacionesRepo } = require('../../db/repos');
      const fresh = await notificacionesRepo.listar();
      if (fresh?.length) setNotificaciones(fresh);
      else {
        const res = await notificacionesAPI.listar();
        const items = res.data.notificaciones || [];
        setNotificaciones(items);
        try { await notificacionesRepo.upsertMany(items); } catch (_) {}
      }
    } catch (err) {
      console.warn('Sync notificaciones (offline?):', err?.message);
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
      setNotificaciones(prev => prev.map(n => n.id === item.id ? { ...n, leida: true } : n));
    } catch (_) {}
  };

  const marcarTodasLeidas = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas();
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (_) {}
  };

  const countNoLeidas = notificaciones.filter(n => !n.leida).length;

  const abrirDetalleVacante = async (vacanteId) => {
    if (!vacanteId) return null;
    try {
      const res = await vacantesAPI.detalle(vacanteId);
      const vacante = res.data?.vacante || { id: vacanteId };
      if (user?.rol === 'empleador') {
        navigation.navigate('DetalleVacanteEmpleador', { vacante });
      } else {
        navigation.navigate('DetalleVacante', { vacante });
      }
      return vacante;
    } catch (_) { return null; }
  };

  const abrirOfertaRecomendada = async (notification) => {
    if (notification?.data?.vacancyId) {
      await abrirDetalleVacante(notification.data.vacancyId);
      return;
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
      const resolvedChatId = await chatsAPI.getOrCreateChatId({ vacancyId, employerId, workerId });
      return resolvedChatId ? Number(resolvedChatId) : null;
    } catch (_) { return null; }
  };

  const abrirChat = async ({ chatId, vacancyId, employerId, workerId }) => {
    const resolvedChatId = await getOrCreateChatId({ chatId, vacancyId, employerId, workerId });
    if (!resolvedChatId) { navigation.navigate('Mensajes'); return; }
    navigation.navigate('Mensajes', {
      screen: 'ChatsHome',
      params: { abrirChatId: Number(resolvedChatId) },
    });
  };

  const handleNotificacionClick = async (item) => {
    await marcarLeida(item);
    const notification = normalizarNotificacion(item);
    switch (notification.type) {
      case 'POSTULACION_ACEPTADA':
      case 'CHAT_HABILITADO':
      case 'NUEVO_MENSAJE':
        await abrirChat({
          chatId: notification.data.chatId,
          vacancyId: notification.data.vacancyId,
          employerId: notification.data.employerId,
          workerId: notification.data.workerId,
        });
        break;
      case 'NUEVO_MATCH':
      case 'VACANTE_RECOMENDADA':
        await abrirOfertaRecomendada({ ...item, data: notification.data });
        break;
      case 'POSTULACION_ENVIADA':
        await abrirPostulaciones(notification.data.vacancyId);
        break;
      case 'CONTACTO_ESPECIALISTA':
        // Navegar a Mis Postulaciones/Solicitudes donde el especialista puede aceptar/rechazar
        navigation.navigate('Postulaciones');
        break;
      case 'SOLICITUD_CONTACTO':
        setSolicitudModal({
          notif: item,
          postulacionId: notification.data.applicationId,
          vacancyId: notification.data.vacancyId,
          titulo: item.titulo || 'Solicitud de contacto',
          mensaje: item.mensaje || '',
        });
        break;
      default:
        if (notification.data.vacancyId) { await abrirDetalleVacante(notification.data.vacancyId); }
        else if (notification.data.chatId) { await abrirChat({ chatId: notification.data.chatId }); }
        break;
    }
  };

  const responderSolicitud = async (accion) => {
    if (!solicitudModal?.postulacionId) {
      Alert.alert('Error', 'No se pudo identificar la solicitud. Busca la vacante en "Mis Postulaciones".');
      return;
    }
    try {
      setRespondiendo(true);
      const res = await vacantesAPI.responderContacto(solicitudModal.postulacionId, accion);
      setSolicitudModal(null);
      cargar();
      if (accion === 'aceptar' && res.data?.chat_id) {
        await abrirChat({ chatId: res.data.chat_id, vacancyId: solicitudModal.vacancyId });
      } else if (accion === 'rechazar') {
        Alert.alert('Solicitud rechazada', 'Le hemos notificado al empleador.');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo procesar la solicitud.');
    } finally {
      setRespondiendo(false);
    }
  };

  // Filtrar
  const filtradas = useMemo(() => {
    if (filtro === 'sin_leer') return notificaciones.filter(n => !n.leida);
    if (filtro === 'postulaciones') return notificaciones.filter(n => {
      const t = (n.tipo || '').toLowerCase();
      return t.includes('postulacion') || t.includes('aceptado') || t === 'contacto';
    });
    if (filtro === 'mensajes') return notificaciones.filter(n => {
      const t = (n.tipo || '').toLowerCase();
      return t.includes('chat') || t.includes('mensaje');
    });
    return notificaciones;
  }, [notificaciones, filtro]);

  // Agrupar por tiempo
  const grouped = useMemo(() => {
    const map = {};
    filtradas.forEach(n => {
      const g = getGroup(n.created_at);
      if (!map[g]) map[g] = [];
      map[g].push(n);
    });
    return map;
  }, [filtradas]);

  // Construir lista plana con separadores de grupo
  const listData = useMemo(() => {
    const result = [];
    GROUP_ORDER.forEach(g => {
      if (grouped[g]?.length) {
        result.push({ type: 'header', group: g, count: grouped[g].length, id: `header-${g}` });
        grouped[g].forEach(n => result.push({ type: 'item', item: n, id: n.id }));
      }
    });
    return result;
  }, [grouped]);

  const CHIPS = [
    { key: 'todas', label: 'Todas', count: notificaciones.length },
    { key: 'sin_leer', label: 'Sin leer', count: countNoLeidas },
    { key: 'postulaciones', label: 'Postulaciones', count: notificaciones.filter(n => { const t=(n.tipo||'').toLowerCase(); return t.includes('postulacion')||t.includes('aceptado')||t==='contacto'; }).length },
    { key: 'mensajes', label: 'Mensajes', count: notificaciones.filter(n => { const t=(n.tipo||'').toLowerCase(); return t.includes('chat')||t.includes('mensaje'); }).length },
  ];

  const renderRow = ({ item: row }) => {
    if (row.type === 'header') {
      return (
        <View style={styles.groupHeader}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{row.group}</Text>
          <View style={[styles.groupRule, { backgroundColor: colors.border }]} />
          <Text style={[styles.groupCount, { color: colors.textMuted }]}>{row.count}</Text>
        </View>
      );
    }

    const item = row.item;
    const tipoKey = (item.tipo || '').toLowerCase();
    const config = TIPO_CONFIG[tipoKey] || TIPO_CONFIG.match;
    const isUnread = !item.leida;
    const iconBg = isDark ? config.color + '28' : config.bg;
    const notification = normalizarNotificacion(item);

    const showChatAction = ['POSTULACION_ACEPTADA', 'CHAT_HABILITADO', 'NUEVO_MENSAJE'].includes(notification.type);
    const showVacanteAction = ['NUEVO_MATCH', 'VACANTE_RECOMENDADA'].includes(notification.type);
    const showPostAction = notification.type === 'POSTULACION_ENVIADA';
    const showContactoAction = notification.type === 'SOLICITUD_CONTACTO';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isUnread ? COLORS.primary + '25' : colors.border,
          },
        ]}
        onPress={() => handleNotificacionClick(item)}
        activeOpacity={0.82}
      >
        {/* Unread left bar */}
        {isUnread && <View style={styles.unreadBar} />}

        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text
                style={[styles.titulo, { color: isUnread ? colors.textPrimary : colors.textSecondary, fontWeight: isUnread ? '700' : '500' }]}
                numberOfLines={1}
              >
                {item.titulo}
              </Text>
              {isUnread && <View style={styles.unreadDot} />}
            </View>
            <Text style={[styles.tiempo, { color: colors.textMuted }]}>{tiempoRelativo(item.created_at)}</Text>
          </View>

          <Text style={[styles.mensaje, { color: colors.textMuted }]} numberOfLines={2}>
            {item.mensaje}
          </Text>

          {(showChatAction || showVacanteAction || showPostAction || showContactoAction) && (
            <View style={styles.actionRow}>
              {showChatAction && (
                <TouchableOpacity style={styles.actionDark} onPress={() => handleNotificacionClick(item)}>
                  <Text style={styles.actionDarkText}>Iniciar chat</Text>
                </TouchableOpacity>
              )}
              {(showVacanteAction || showPostAction) && (
                <TouchableOpacity style={styles.actionGreen} onPress={() => handleNotificacionClick(item)}>
                  <Text style={styles.actionGreenText}>{showPostAction ? 'Ver postulación' : 'Ver vacante'}</Text>
                  <Ionicons name="chevron-forward" size={11} color={COLORS.white} />
                </TouchableOpacity>
              )}
              {showContactoAction && (
                <TouchableOpacity style={styles.actionGreen} onPress={() => handleNotificacionClick(item)}>
                  <Ionicons name="person-add-outline" size={13} color={COLORS.white} />
                  <Text style={styles.actionGreenText}>Aceptar o rechazar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      {/* Top row */}
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? colors.border : '#F2F4F0' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        {countNoLeidas > 0 && (
          <TouchableOpacity onPress={marcarTodasLeidas}>
            <Text style={[styles.markAllText, { color: COLORS.primary }]}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Title + badge */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Notificaciones</Text>
        {countNoLeidas > 0 && (
          <View style={styles.titleBadge}>
            <Text style={styles.titleBadgeText}>{countNoLeidas}</Text>
          </View>
        )}
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleRow}>
        <View style={styles.greenDot} />
        <Text style={[styles.subtitleStrong, { color: colors.textPrimary }]}>{countNoLeidas} sin leer</Text>
        <Text style={[styles.subtitleDim, { color: colors.textMuted }]}> · {notificaciones.length} en total</Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={{ marginTop: 12 }}
      >
        {CHIPS.map((chip, index) => {
          const active = filtro === chip.key;
          return (
            <AnimatedPressable
              key={chip.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? '#c1ff72' : (isDark ? colors.surface : COLORS.white),
                  borderColor: active ? '#c1ff72' : (isDark ? colors.border : '#E8EAE6'),
                  marginLeft: index === 0 ? 0 : 0,
                },
              ]}
              onPress={() => setFiltro(chip.key)}
              scaleValue={0.95}
              haptic
            >
              <View style={[styles.filterDot, { backgroundColor: active ? '#0E1410' : (isDark ? colors.textMuted : COLORS.primary) }]} />
              <Text style={[styles.filterText, { color: active ? '#0E1410' : colors.textSecondary }]}>
                {chip.label}
              </Text>
              {chip.count > 0 && (
                <View style={[styles.countBubble, { backgroundColor: active ? 'rgba(255,255,255,0.18)' : (isDark ? colors.border : '#F2F4F0') }]}>
                  <Text style={[styles.countBubbleText, { color: active ? '#0E1410' : colors.textMuted }]}>
                    {chip.count}
                  </Text>
                </View>
              )}
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#F6F7F4' }]} edges={['top']}>
      <FlatList
        data={listData}
        keyExtractor={row => row.id}
        renderItem={renderRow}
        ListHeaderComponent={ListHeader}
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
            <View style={[styles.emptyIconWrap, { backgroundColor: COLORS.primarySoft }]}>
              <Ionicons name="notifications-off-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin notificaciones</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Las actualizaciones de tus vacantes y postulaciones aparecerán aquí
            </Text>
          </View>
        }
      />

      {/* Modal aceptar/rechazar solicitud de contacto */}
      <Modal visible={!!solicitudModal} transparent animationType="slide" onRequestClose={() => setSolicitudModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={[styles.solicitudCard, { backgroundColor: colors.surface }]}>
            <View style={styles.solicitudHeader}>
              <View style={[styles.solicitudIconWrap, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="person-add" size={28} color="#F57C00" />
              </View>
              <Text style={[styles.solicitudTitulo, { color: colors.textPrimary }]}>Solicitud de contacto</Text>
              <Text style={[styles.solicitudMensaje, { color: colors.textSecondary }]}>
                {solicitudModal?.mensaje || 'Un empleador quiere contactarte para una vacante.'}
              </Text>
            </View>

            <Text style={[styles.solicitudInfo, { color: colors.textSecondary }]}>
              Si aceptas, se habilitará un chat directo con el empleador para coordinar los detalles del trabajo.
            </Text>

            {solicitudModal?.vacancyId && (
              <TouchableOpacity
                style={[styles.btnVerVacante, { borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '10' }]}
                onPress={() => { setSolicitudModal(null); navigation.navigate('DetalleVacante', { vacante: { id: solicitudModal.vacancyId, titulo: solicitudModal.titulo || 'Vacante' } }); }}
                activeOpacity={0.8}
              >
                <Ionicons name="briefcase-outline" size={16} color={COLORS.primary} />
                <Text style={[styles.btnVerVacanteText, { color: COLORS.primary }]}>Ver detalle de la vacante</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.btnAceptar, { opacity: respondiendo ? 0.7 : 1 }]}
              onPress={() => responderSolicitud('aceptar')}
              disabled={respondiendo}
              activeOpacity={0.85}
            >
              {respondiendo
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.btnAceptarText}>Aceptar y abrir chat</Text></>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnRechazar, { borderColor: colors.border, opacity: respondiendo ? 0.5 : 1 }]}
              onPress={() => responderSolicitud('rechazar')}
              disabled={respondiendo}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
              <Text style={styles.btnRechazarText}>Rechazar solicitud</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setSolicitudModal(null)} style={styles.btnCancelar}>
              <Text style={[styles.btnCancelarText, { color: colors.textSecondary }]}>Decidir más tarde</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* Header */
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  markAllText: { fontSize: 13, fontWeight: '600' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  screenTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  titleBadge: {
    minWidth: 28, height: 26, paddingHorizontal: 9,
    borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  titleBadgeText: { fontSize: 12.5, fontWeight: '700', color: COLORS.white },

  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  subtitleStrong: { fontSize: 13.5, fontWeight: '600' },
  subtitleDim: { fontSize: 13.5 },

  chipsRow: { gap: 8, paddingVertical: 4, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 38, paddingHorizontal: 14,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  filterDot: { width: 7, height: 7, borderRadius: 999 },
  filterText: { fontSize: 13.5, fontWeight: '600' },
  countBubble: {
    height: 20, paddingHorizontal: 7,
    borderRadius: 999, alignItems: 'center', justifyContent: 'center',
  },
  countBubbleText: { fontSize: 11.5, fontWeight: '700' },

  /* Group header */
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.lg, paddingVertical: 6,
    marginTop: 8,
  },
  groupLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  groupRule: { flex: 1, height: 1 },
  groupCount: { fontSize: 11, fontWeight: '600' },

  /* List */
  list: { paddingBottom: 100 },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: SPACING.lg,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingLeft: 16,
    position: 'relative',
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  unreadBar: {
    position: 'absolute', left: 0, top: 14, bottom: 14,
    width: 3, borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10,
  },
  titulo: { fontSize: 15, lineHeight: 20, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: COLORS.primary },
  tiempo: { fontSize: 11.5, fontWeight: '500' },
  mensaje: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },

  actionRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  actionDark: {
    height: 30, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: '#c1ff72', alignItems: 'center', justifyContent: 'center',
  },
  actionDarkText: { fontSize: 12.5, fontWeight: '700', color: '#0E1410' },
  actionGreen: {
    height: 30, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: COLORS.primary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  actionGreenText: { fontSize: 12.5, fontWeight: '600', color: COLORS.white },

  /* Empty */
  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  solicitudCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 14 },
  solicitudHeader: { alignItems: 'center', gap: 10 },
  solicitudIconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  solicitudTitulo: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  solicitudMensaje: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  solicitudInfo: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
  btnAceptar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15 },
  btnAceptarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnRechazar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 16, paddingVertical: 13 },
  btnRechazarText: { color: COLORS.error, fontSize: 15, fontWeight: '600' },
  btnCancelar: { alignItems: 'center', paddingVertical: 8 },
  btnVerVacante: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 10 },
  btnVerVacanteText: { flex: 1, fontSize: 14, fontWeight: '600' },
  btnCancelarText: { fontSize: 14 },
});
