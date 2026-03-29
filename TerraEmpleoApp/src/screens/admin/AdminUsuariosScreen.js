import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  RefreshControl, Modal, Image, Platform, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { showAlert } from '../../utils/alertService';
import { useAppTheme } from '../../context/ThemeContext';

const ROLE_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'trabajador', label: 'Trabajadores' },
  { key: 'empleador', label: 'Empleadores' },
  { key: 'admin', label: 'Admin' },
];

export default function AdminUsuariosScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioRevision, setUsuarioRevision] = useState(null);
  const [documentosRevision, setDocumentosRevision] = useState(null);
  const [estadoRevision, setEstadoRevision] = useState('pendiente');
  const [comentarioRevision, setComentarioRevision] = useState('');
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false);
  const [guardandoRevision, setGuardandoRevision] = useState(false);

  const load = async () => {
    try {
      setError(null);
      const res = await adminAPI.getUsuarios();
      setUsuarios(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo conectar al servidor';
      setError(msg);
      console.error('Error cargando usuarios:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const filtered = useMemo(() => {
    let list = usuarios;
    if (roleFilter !== 'todos') list = list.filter(u => u.rol === roleFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u =>
        (u.nombre_completo || '').toLowerCase().includes(q) ||
        (u.celular || '').includes(q)
      );
    }
    return list;
  }, [usuarios, roleFilter, search]);

  const toggleActivo = async (id, activo) => {
    try {
      await adminAPI.updateUsuario(id, { activo: !activo });
      showAlert('Listo', !activo ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente');
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo actualizar el estado del usuario';
      showAlert('Error', msg);
    }
  };

  const eliminar = async (id, nombre) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`¿Eliminar al usuario "${nombre}"?`)
      : await new Promise(resolve => showAlert(
          'Confirmar eliminación',
          `¿Estás seguro de que deseas eliminar al usuario "${nombre}"?`,
          [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
           { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }]
        ));
    if (!ok) return;
    try {
      await adminAPI.eliminarUsuario(id);
      await load();
      showAlert('Listo', 'Usuario eliminado correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo eliminar el usuario';
      showAlert('Error', msg);
    }
  };

  const eliminarFinca = async (item) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`¿Eliminar al empleador "${item.nombre_completo}" y todos sus datos?`)
      : await new Promise(resolve => showAlert(
          'Confirmar eliminación',
          `¿Estás seguro de que deseas eliminar al empleador "${item.nombre_completo}" y todos sus datos?`,
          [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
           { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }]
        ));
    if (!ok) return;
    try {
      await adminAPI.eliminarEmpleador(item.id);
      await load();
      showAlert('Listo', 'Empleador y sus datos eliminados correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo eliminar el empleador';
      showAlert('Error', msg);
    }
  };

  const abrirRevisionDocumentos = async (item) => {
    try {
      setCargandoDocumentos(true);
      setUsuarioRevision(item);
      setModalVisible(true);

      const { data } = await adminAPI.getUsuarioDocumentosIdentidad(item.id);
      if (!data?.tiene_documentos) {
        setDocumentosRevision(null);
        showAlert('Sin documentos', 'Este usuario aún no ha subido fotos para validación interna de identidad.');
        return;
      }

      setDocumentosRevision(data.documentos || null);
      setEstadoRevision(data?.revision?.estado || 'pendiente');
      setComentarioRevision(data?.revision?.comentario || '');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudieron cargar los documentos.';
      setDocumentosRevision(null);
      showAlert('Error', msg);
    } finally {
      setCargandoDocumentos(false);
    }
  };

  const cerrarRevisionDocumentos = () => {
    setModalVisible(false);
    setUsuarioRevision(null);
    setDocumentosRevision(null);
    setEstadoRevision('pendiente');
    setComentarioRevision('');
    setGuardandoRevision(false);
  };

  const guardarRevision = async (nuevoEstado) => {
    if (!usuarioRevision?.id) return;
    try {
      setGuardandoRevision(true);
      await adminAPI.revisarValidacionIdentidad(usuarioRevision.id, nuevoEstado, comentarioRevision);
      setEstadoRevision(nuevoEstado);
      cerrarRevisionDocumentos();
      showAlert('Listo', nuevoEstado === 'aprobada'
        ? 'Validación interna aprobada.'
        : 'Validación interna rechazada.');
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo guardar la revisión.';
      showAlert('Error', msg);
    } finally {
      setGuardandoRevision(false);
    }
  };

  const getRoleBadge = (rol) => {
    if (rol === 'trabajador') return {
      bg: isDark ? 'rgba(61,208,143,0.18)' : COLORS.primarySoft,
      fg: colors.primary,
      label: 'Trabajador',
    };
    if (rol === 'empleador') return {
      bg: isDark ? 'rgba(251,191,36,0.18)' : COLORS.warningSoft,
      fg: colors.warning,
      label: 'Empleador',
    };
    return {
      bg: isDark ? 'rgba(59,130,246,0.18)' : COLORS.infoSoft,
      fg: COLORS.info,
      label: 'Admin',
    };
  };

  const getInitials = (nombre) => {
    if (!nombre) return '?';
    const parts = nombre.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nombre[0].toUpperCase();
  };

  const abrirDetalleUsuario = (item) => {
    navigation.navigate('AdminDetalleUsuario', { usuarioId: item.id });
  };

  const renderItem = ({ item, index }) => {
    const roleBadge = getRoleBadge(item.rol);
    const isActivo = !!item.activo;
    const fechaRegistro = item.created_at
      ? new Date(item.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;

    return (
      <StaggeredItem index={index}>
        <AnimatedPressable
          style={[styles.card, { backgroundColor: colors.surface }, isDark && { borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => abrirDetalleUsuario(item)}
          scaleValue={0.99}
          haptic={false}
        >
          {/* Top row: avatar + name + role badge */}
          <View style={styles.cardTop}>
            <View style={[styles.avatarWrap, { backgroundColor: isDark ? colors.card : '#B0BEC5' }]}>
              {item.foto_selfie ? (
                <Image source={{ uri: item.foto_selfie }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitials}>{getInitials(item.nombre_completo)}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{item.nombre_completo}</Text>
              <Text style={[styles.celular, { color: colors.textMuted }]}>{item.celular}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
              <Text style={[styles.roleText, { color: roleBadge.fg }]}>{roleBadge.label}</Text>
            </View>
          </View>

          {/* Location row */}
          {(item.municipio || item.departamento) ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>{item.municipio}, {item.departamento}</Text>
            </View>
          ) : null}

          {/* Bottom row: status badges + actions */}
          <View style={[styles.statusRow, { borderTopColor: colors.border }]}>
            <View style={styles.badges}>
              <View style={[
                styles.statusBadge,
                isActivo
                  ? { backgroundColor: isDark ? 'rgba(61,208,143,0.18)' : COLORS.primarySoft }
                  : { backgroundColor: isDark ? 'rgba(248,113,113,0.15)' : '#FEE2E2', borderWidth: 1, borderColor: isDark ? 'rgba(248,113,113,0.3)' : '#FECACA' },
              ]}>
                <View style={[styles.statusDot, { backgroundColor: isActivo ? colors.primary : colors.error }]} />
                <Text style={[styles.statusText, { color: isActivo ? colors.primary : colors.error }]}>
                  {isActivo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
              <View style={[styles.statusBadge, getBadgeRevisionStyle(item.validacion_identidad_estado, isDark).badge]}>
                <Text style={[styles.statusText, getBadgeRevisionStyle(item.validacion_identidad_estado, isDark).text]}>
                  ID: {getBadgeRevisionStyle(item.validacion_identidad_estado, isDark).label}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              <AnimatedPressable onPress={() => toggleActivo(item.id, item.activo)} style={styles.actionBtn} scaleValue={0.85} haptic>
                <Ionicons
                  name={item.activo ? 'pause-circle' : 'play-circle'}
                  size={26}
                  color={item.activo ? colors.warning : colors.primary}
                />
              </AnimatedPressable>
              {item.rol !== 'admin' && (
                <AnimatedPressable onPress={() => abrirRevisionDocumentos(item)} style={styles.actionBtn} scaleValue={0.85} haptic>
                  <Ionicons name="id-card-outline" size={22} color={COLORS.info} />
                </AnimatedPressable>
              )}
              {item.rol === 'empleador' && (
                <AnimatedPressable onPress={() => eliminarFinca(item)} style={styles.actionBtn} scaleValue={0.85} haptic>
                  <Ionicons name="business-outline" size={22} color={colors.error} />
                </AnimatedPressable>
              )}
              {item.rol !== 'admin' && (
                <AnimatedPressable onPress={() => eliminar(item.id, item.nombre_completo)} style={styles.actionBtn} scaleValue={0.85} haptic>
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </AnimatedPressable>
              )}
            </View>
          </View>

          {fechaRegistro ? (
            <Text style={[styles.fechaText, { color: colors.textMuted }]}>Registrado: {fechaRegistro}</Text>
          ) : null}
        </AnimatedPressable>
      </StaggeredItem>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <MotiView
          from={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1.1, opacity: 1 }}
          transition={{ loop: true, type: 'timing', duration: 800 }}
        >
          <Ionicons name="leaf" size={48} color={colors.primary} />
        </MotiView>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[styles.center, { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', ...ANIMATION.spring.gentle }}
          >
            <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted} />
          </MotiView>
          <FadeInView delay={100}>
            <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: SPACING.md, textAlign: 'center' }}>{error}</Text>
          </FadeInView>
          <FadeInView delay={200}>
            <AnimatedPressable
              onPress={() => { setLoading(true); load(); }}
              style={{ marginTop: SPACING.lg, backgroundColor: colors.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md }}
              scaleValue={0.95}
              haptic
            >
              <Text style={{ color: COLORS.white, fontWeight: '600' }}>Reintentar</Text>
            </AnimatedPressable>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <FadeInView delay={0}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar por nombre o celular..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch('')} scaleValue={0.9}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          )}
        </View>
      </FadeInView>

      {/* Role filter pills */}
      <FadeInView delay={50}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {ROLE_FILTERS.map(f => {
            const active = roleFilter === f.key;
            return (
              <AnimatedPressable
                key={f.key}
                style={[
                  styles.filterPill,
                  active
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                ]}
                onPress={() => setRoleFilter(f.key)}
                scaleValue={0.93}
              >
                <Text style={[styles.filterPillText, { color: active ? COLORS.white : colors.textMuted }]}>
                  {f.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </FadeInView>

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <FadeInView delay={0}>
            <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
              {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
            </Text>
          </FadeInView>
        }
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin resultados</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              No se encontraron usuarios con ese criterio
            </Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={cerrarRevisionDocumentos}
      >
        <SafeAreaView
          style={[styles.modalContainer, { paddingTop: Math.max(insets.top, SPACING.md), backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Revisión de identidad</Text>
            <AnimatedPressable
              onPress={cerrarRevisionDocumentos}
              style={[styles.modalCloseBtn, { backgroundColor: isDark ? colors.surface : COLORS.cardHover }]}
              scaleValue={0.9}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </AnimatedPressable>
          </View>

          <Text style={[styles.modalUserName, { color: colors.textPrimary }]}>{usuarioRevision?.nombre_completo || 'Usuario'}</Text>
          <Text style={[styles.modalHelpText, { color: colors.textMuted }]}>Verifica que selfie y cédula coincidan visualmente.</Text>
          <View style={[styles.modalEstadoChip, getBadgeRevisionStyle(estadoRevision, isDark).badge]}>
            <Text style={[styles.modalEstadoText, getBadgeRevisionStyle(estadoRevision, isDark).text]}>
              Estado actual: {getBadgeRevisionStyle(estadoRevision, isDark).label}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {cargandoDocumentos ? (
              <View style={styles.modalCenter}>
                <Text style={[styles.modalLoading, { color: colors.textMuted }]}>Cargando documentos...</Text>
              </View>
            ) : (
              <>
                <DocumentoBloque titulo="1. Selfie" uri={documentosRevision?.selfie} placeholder="No hay selfie disponible" colors={colors} />
                <DocumentoBloque titulo="2. Frente de cédula" uri={documentosRevision?.cedula_frente} placeholder="No hay foto de cédula disponible" colors={colors} />
                <DocumentoBloque titulo="3. Selfie con cédula" uri={documentosRevision?.selfie_con_cedula} placeholder="No hay selfie con cédula disponible" colors={colors} />
                <View style={styles.reviewActions}>
                  <AnimatedPressable
                    onPress={() => guardarRevision('rechazada')}
                    style={[styles.reviewBtn, styles.reviewBtnReject, guardandoRevision && styles.reviewBtnDisabled]}
                    scaleValue={0.97}
                    disabled={guardandoRevision}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={COLORS.white} />
                    <Text style={styles.reviewBtnText}>{guardandoRevision ? 'Guardando...' : 'Rechazar'}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => guardarRevision('aprobada')}
                    style={[styles.reviewBtn, styles.reviewBtnApprove, guardandoRevision && styles.reviewBtnDisabled]}
                    scaleValue={0.97}
                    disabled={guardandoRevision}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
                    <Text style={styles.reviewBtnText}>{guardandoRevision ? 'Guardando...' : 'Aprobar'}</Text>
                  </AnimatedPressable>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function DocumentoBloque({ titulo, uri, placeholder, colors }) {
  return (
    <View style={[styles.docBlock, { backgroundColor: colors.surface }]}>
      <Text style={[styles.docTitle, { color: colors.textPrimary }]}>{titulo}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.docImage} resizeMode="cover" />
      ) : (
        <View style={[styles.docPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          <Text style={[styles.docPlaceholderText, { color: colors.textMuted }]}>{placeholder}</Text>
        </View>
      )}
    </View>
  );
}

function getBadgeRevisionStyle(estado, isDark) {
  if (estado === 'aprobada') {
    return {
      label: 'Aprobada',
      badge: { backgroundColor: isDark ? 'rgba(61,208,143,0.18)' : '#DCFCE7' },
      text: { color: isDark ? '#4ade80' : '#166534' },
    };
  }
  if (estado === 'rechazada') {
    return {
      label: 'Rechazada',
      badge: { backgroundColor: isDark ? 'rgba(248,113,113,0.15)' : '#FEF2F2' },
      text: { color: isDark ? '#f87171' : '#B91C1C' },
    };
  }
  return {
    label: 'Pendiente',
    badge: { backgroundColor: isDark ? 'rgba(156,163,175,0.15)' : '#F3F4F6' },
    text: { color: isDark ? '#9CA3AF' : '#4B5563' },
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  filterRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },

  resultsCount: { fontSize: 12, fontWeight: '500', marginBottom: SPACING.xs },

  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: { width: 46, height: 46 },
  avatarInitials: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  name: { fontSize: 15, fontWeight: '700' },
  celular: { fontSize: 13, marginTop: 1 },
  roleBadge: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 4, borderRadius: RADIUS.full },
  roleText: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs, marginLeft: 54 },
  infoText: { fontSize: 12 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: SPACING.xs },
  actionBtn: { padding: 4 },
  fechaText: { fontSize: 11, marginTop: SPACING.xs, marginLeft: 54 },

  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    minHeight: 54,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalUserName: { paddingHorizontal: SPACING.md, marginTop: SPACING.sm, fontSize: 16, fontWeight: '700' },
  modalHelpText: { paddingHorizontal: SPACING.md, marginTop: 4, marginBottom: SPACING.sm, fontSize: 13 },
  modalEstadoChip: {
    marginHorizontal: SPACING.md,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  modalEstadoText: { fontSize: 12, fontWeight: '700' },
  modalScrollContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  modalCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl },
  modalLoading: { fontSize: 15 },

  docBlock: { borderRadius: RADIUS.lg, padding: SPACING.sm, marginBottom: SPACING.md, ...SHADOWS.small },
  docTitle: { fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  docImage: { width: '100%', height: 280, borderRadius: RADIUS.md },
  docPlaceholder: {
    height: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  docPlaceholderText: { fontSize: 13 },

  reviewActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs, marginBottom: SPACING.md },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  reviewBtnReject: { backgroundColor: COLORS.error },
  reviewBtnApprove: { backgroundColor: COLORS.primary },
  reviewBtnDisabled: { opacity: 0.7 },
  reviewBtnText: { color: COLORS.white, fontWeight: '700' },
});
