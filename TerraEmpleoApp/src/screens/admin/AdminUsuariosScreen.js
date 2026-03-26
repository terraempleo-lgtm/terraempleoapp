import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  RefreshControl, Alert, Modal, Image, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';

export default function AdminUsuariosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
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

  const toggleActivo = async (id, activo) => {
    try {
      await adminAPI.updateUsuario(id, { activo: !activo });
      Alert.alert('Listo', !activo ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente');
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo actualizar el estado del usuario';
      Alert.alert('Error', msg);
    }
  };

  const eliminar = async (id, nombre) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`¿Eliminar al usuario "${nombre}"?`)
      : await new Promise(resolve => Alert.alert(
          'Confirmar eliminación',
          `¿Estás seguro de que deseas eliminar al usuario "${nombre}"?`,
          [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
           { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }]
        ));
    if (!ok) return;
    try {
      await adminAPI.eliminarUsuario(id);
      await load();
      Alert.alert('Listo', 'Usuario eliminado correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo eliminar el usuario';
      Alert.alert('Error', msg);
    }
  };

  const eliminarFinca = async (item) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`¿Eliminar al empleador "${item.nombre_completo}" y todos sus datos?`)
      : await new Promise(resolve => Alert.alert(
          'Confirmar eliminación',
          `¿Estás seguro de que deseas eliminar al empleador "${item.nombre_completo}" y todos sus datos?`,
          [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
           { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }]
        ));
    if (!ok) return;
    try {
      await adminAPI.eliminarEmpleador(item.id);
      await load();
      Alert.alert('Listo', 'Empleador y sus datos eliminados correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo eliminar el empleador';
      Alert.alert('Error', msg);
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
        Alert.alert('Sin documentos', 'Este usuario aún no ha subido fotos para validación interna de identidad.');
        return;
      }

      setDocumentosRevision(data.documentos || null);
      setEstadoRevision(data?.revision?.estado || 'pendiente');
      setComentarioRevision(data?.revision?.comentario || '');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudieron cargar los documentos.';
      setDocumentosRevision(null);
      Alert.alert('Error', msg);
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
      Alert.alert('Listo', nuevoEstado === 'aprobada'
        ? 'Validación interna aprobada.'
        : 'Validación interna rechazada.');
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo guardar la revisión.';
      Alert.alert('Error', msg);
    } finally {
      setGuardandoRevision(false);
    }
  };

  const roleColor = (r) => r === 'trabajador' ? COLORS.primary : r === 'empleador' ? COLORS.accent : '#6A1B9A';
  const roleLabel = (r) => r === 'trabajador' ? 'Trabajador' : r === 'empleador' ? 'Empleador' : 'Admin';

  const abrirDetalleUsuario = (item) => {
    navigation.navigate('AdminDetalleUsuario', { usuarioId: item.id });
  };

  const renderItem = ({ item, index }) => (
    <StaggeredItem index={index}>
      <AnimatedPressable style={styles.card} onPress={() => abrirDetalleUsuario(item)} scaleValue={0.99} haptic={false}>
        <View style={styles.cardTop}>
          <View style={styles.avatarWrap}>
            {item.foto_selfie ? (
              <Image source={{ uri: item.foto_selfie }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={18} color={COLORS.white} />
              </View>
            )}
          </View>
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
            <View style={[styles.statusBadge, { backgroundColor: item.activo ? '#e6f7ee' : '#FFEBEE' }]}>
              <Text style={[styles.statusText, { color: item.activo ? COLORS.primary : COLORS.error }]}>
                {item.activo ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.verificado_sms ? '#E3F2FD' : '#F3E5F5' }]}>
              <Text style={[styles.statusText, { color: item.verificado_sms ? '#1565C0' : '#7B1FA2' }]}>
                SMS: {item.verificado_sms ? 'Sí' : 'No'}
              </Text>
            </View>
            <View style={[styles.statusBadge, getBadgeRevisionStyle(item.validacion_identidad_estado).badge]}>
              <Text style={[styles.statusText, getBadgeRevisionStyle(item.validacion_identidad_estado).text]}>
                ID: {getBadgeRevisionStyle(item.validacion_identidad_estado).label}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <AnimatedPressable onPress={() => toggleActivo(item.id, item.activo)} style={styles.actionBtn} scaleValue={0.85} haptic>
              <Ionicons name={item.activo ? 'pause-circle' : 'play-circle'} size={26}
                color={item.activo ? COLORS.accent : COLORS.primary} />
            </AnimatedPressable>
            {item.rol !== 'admin' && (
              <AnimatedPressable onPress={() => abrirRevisionDocumentos(item)} style={styles.actionBtn} scaleValue={0.85} haptic>
                <Ionicons name="id-card-outline" size={22} color={COLORS.info} />
              </AnimatedPressable>
            )}
            {item.rol === 'empleador' && (
              <AnimatedPressable onPress={() => eliminarFinca(item)} style={styles.actionBtn} scaleValue={0.85} haptic>
                <Ionicons name="business-outline" size={22} color={COLORS.error} />
              </AnimatedPressable>
            )}
            {item.rol !== 'admin' && (
              <AnimatedPressable onPress={() => eliminar(item.id, item.nombre_completo)} style={styles.actionBtn} scaleValue={0.85} haptic>
                <Ionicons name="trash-outline" size={22} color={COLORS.error} />
              </AnimatedPressable>
            )}
          </View>
        </View>
      </AnimatedPressable>
    </StaggeredItem>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <MotiView
          from={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1.1, opacity: 1 }}
          transition={{ loop: true, type: 'timing', duration: 800 }}
        >
          <Ionicons name="leaf" size={48} color={COLORS.primary} />
        </MotiView>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.center, { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', ...ANIMATION.spring.gentle }}
          >
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textLight} />
          </MotiView>
          <FadeInView delay={100}>
            <Text style={{ fontSize: 16, color: COLORS.textLight, marginTop: SPACING.md, textAlign: 'center' }}>{error}</Text>
          </FadeInView>
          <FadeInView delay={200}>
            <AnimatedPressable onPress={() => { setLoading(true); load(); }} style={{ marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md }} scaleValue={0.95} haptic>
              <Text style={{ color: COLORS.white, fontWeight: '600' }}>Reintentar</Text>
            </AnimatedPressable>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
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
          <View style={styles.center}>
            <FadeInView delay={0}>
              <Text style={styles.empty}>No hay usuarios.</Text>
            </FadeInView>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={cerrarRevisionDocumentos}
      >
        <SafeAreaView style={[styles.modalContainer, { paddingTop: Math.max(insets.top, SPACING.md) }]} edges={['bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Revisión manual de identidad</Text>
            <AnimatedPressable onPress={cerrarRevisionDocumentos} style={styles.modalCloseBtn} scaleValue={0.9} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </AnimatedPressable>
          </View>

          <Text style={styles.modalUserName}>{usuarioRevision?.nombre_completo || 'Usuario'}</Text>
          <Text style={styles.modalHelpText}>Verifica que selfie y cédula coincidan visualmente.</Text>
          <View style={[styles.modalEstadoChip, getBadgeRevisionStyle(estadoRevision).badge]}>
            <Text style={[styles.modalEstadoText, getBadgeRevisionStyle(estadoRevision).text]}>
              Estado actual: {getBadgeRevisionStyle(estadoRevision).label}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {cargandoDocumentos ? (
              <View style={styles.modalCenter}>
                <Text style={styles.modalLoading}>Cargando documentos...</Text>
              </View>
            ) : (
              <>
                <DocumentoBloque
                  titulo="1. Selfie"
                  uri={documentosRevision?.selfie}
                  placeholder="No hay selfie disponible"
                />
                <DocumentoBloque
                  titulo="2. Frente de cédula"
                  uri={documentosRevision?.cedula_frente}
                  placeholder="No hay foto de cédula disponible"
                />
                <DocumentoBloque
                  titulo="3. Selfie con cédula"
                  uri={documentosRevision?.selfie_con_cedula}
                  placeholder="No hay selfie con cédula disponible"
                />
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

function DocumentoBloque({ titulo, uri, placeholder }) {
  return (
    <View style={styles.docBlock}>
      <Text style={styles.docTitle}>{titulo}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.docImage} resizeMode="cover" />
      ) : (
        <View style={styles.docPlaceholder}>
          <Ionicons name="image-outline" size={28} color={COLORS.textLight} />
          <Text style={styles.docPlaceholderText}>{placeholder}</Text>
        </View>
      )}
    </View>
  );
}

function getBadgeRevisionStyle(estado) {
  if (estado === 'aprobada') {
    return {
      label: 'Aprobada',
      badge: { backgroundColor: '#DCFCE7' },
      text: { color: '#166534' },
    };
  }

  if (estado === 'rechazada') {
    return {
      label: 'Rechazada',
      badge: { backgroundColor: '#FEF2F2' },
      text: { color: '#B91C1C' },
    };
  }

  return {
    label: 'Pendiente',
    badge: { backgroundColor: '#F3F4F6' },
    text: { color: '#4B5563' },
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.small,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  avatarWrap: {
    width: 42, height: 42, borderRadius: 21, overflow: 'hidden', backgroundColor: '#B0BEC5', flexShrink: 0,
  },
  avatarImg: { width: 42, height: 42 },
  avatarFallback: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
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
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    minHeight: 54,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardHover,
  },
  modalUserName: {
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalHelpText: {
    paddingHorizontal: SPACING.md,
    marginTop: 4,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  modalEstadoChip: {
    marginHorizontal: SPACING.md,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  modalEstadoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalScrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  modalCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  modalLoading: {
    color: COLORS.textLight,
    fontSize: 15,
  },
  docBlock: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  docImage: {
    width: '100%',
    height: 280,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  docPlaceholder: {
    height: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.cardHover,
  },
  docPlaceholderText: {
    color: COLORS.textLight,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  reviewBtnReject: {
    backgroundColor: COLORS.error,
  },
  reviewBtnApprove: {
    backgroundColor: COLORS.primary,
  },
  reviewBtnDisabled: {
    opacity: 0.7,
  },
  reviewBtnText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
