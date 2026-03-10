import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  Image, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { authAPI, vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const HERO_H = 260;

const LABELS_EXPERIENCIA = {
  sin_experiencia: 'Sin experiencia', menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años', '3_5': '3 a 5 años',
  '5_10': '5 a 10 años', mas_10: 'Más de 10 años',
};
const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo', por_dias: 'Por días',
  por_temporada: 'Por temporada / cosecha', fines_semana: 'Fines de semana',
  inmediato: 'Disponible inmediatamente',
};
const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios', bachiller: 'Bachiller',
  tecnico: 'Técnico / Tecnólogo', universitario: 'Universitario',
};
const LABELS_PAGO = {
  jornal: 'Jornal (diario)', semanal: 'Semanal',
  quincenal: 'Quincenal', mensual: 'Mensual', destajo: 'Por tarea / destajo',
};

export default function PerfilScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [userData, setUserData] = useState(null);
  const [fotoFincaPrincipal, setFotoFincaPrincipal] = useState(null);
  const insets = useSafeAreaInsets();

  const u = userData || user;
  const esTrabajador = u?.rol === 'trabajador';
  const esEmpleador = u?.rol === 'empleador';

  useFocusEffect(
    useCallback(() => {
      loadPerfil();
    }, [])
  );
  useEffect(() => {
    if (!user || user.rol === 'admin') return;
    navigation.setOptions({ headerShown: false });
  }, [navigation, user]);

  const loadPerfil = async () => {
    try {
      const res = await authAPI.getPerfil();
      setUserData(res.data.user);
      setPerfil(res.data.perfil);

      if (res.data?.user?.rol === 'empleador') {
        try {
          const vacantesRes = await vacantesAPI.misVacantes();
          const primeraConFoto = (vacantesRes.data?.vacantes || []).find(v => !!v.foto_portada);
          setFotoFincaPrincipal(primeraConFoto?.foto_portada || null);
        } catch (_) {
          setFotoFincaPrincipal(null);
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí, salir', onPress: signOut, style: 'destructive' },
    ]);
  };

  const calificacion = parseFloat(u?.calificacion_promedio || 0);
  const totalCalif = u?.total_calificaciones || 0;
  const habilidades = (perfil?.habilidades || []).map(h => h.habilidad);
  const cultivos = (perfil?.cultivos || []).map(c => c.cultivo);
  const especialidades = [...habilidades, ...cultivos];

  const abrirDocumento = async (url) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('No disponible', 'No se pudo abrir el documento.');
        return;
      }
      await Linking.openURL(url);
    } catch (_) {
      Alert.alert('Error', 'No se pudo abrir el documento.');
    }
  };

  /* ══════════ EMPLEADOR ══════════ */
  if (esEmpleador) {
    const empresa = perfil?.nombre_empresa_finca || u?.nombre_completo || 'Mi Empresa';
    const tipoPago = perfil?.tipo_pago ? (LABELS_PAGO[perfil.tipo_pago] || perfil.tipo_pago) : null;
    const ubicacion = [u?.municipio, u?.departamento].filter(Boolean).join(', ') || null;
    const cultivosEmp = (perfil?.cultivos || []).map(c => c.cultivo || c);
    const labores = (perfil?.labores || []).map(l => l.labor || l);
    const beneficios = [
      perfil?.ofrece_alojamiento && 'Alojamiento incluido',
      perfil?.ofrece_alimentacion && 'Alimentación incluida',
    ].filter(Boolean);
    const acercaDeEmpleador = perfil?.acerca_de?.trim();

    return (
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Hero */}
          <View style={s.heroWrap}>
            {fotoFincaPrincipal ? (
              <Image source={{ uri: fotoFincaPrincipal }} style={s.heroImg} resizeMode="cover" />
            ) : (
              <View style={s.heroPlaceholder}>
                <View style={s.heroLeaf}><Ionicons name="leaf" size={44} color={COLORS.primaryLight} /></View>
                <Text style={s.heroPlaceholderText}>Agrega fotos en tus vacantes para mostrar tu finca aqui.</Text>
              </View>
            )}
            <View style={[s.heroBar, { top: insets.top + 8 }]}>
              <View style={{ width: 40 }} />
              <Text style={s.heroBarTitle}>Perfil del Empleador</Text>
              <TouchableOpacity style={s.heroCircleBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })}>
                <Ionicons name="settings-outline" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.empCard}>
            {/* Avatar centered above card */}
            <View style={s.empAvatarRow}>
              <View style={s.empAvatarWrap}>
                {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
                  <Image source={{ uri: u.foto_selfie }} style={s.empAvatar} />
                ) : (
                  <View style={s.empAvatarFallback}><Ionicons name="person" size={44} color={COLORS.textLight} /></View>
                )}
                <View style={s.empBadge}><Ionicons name="checkmark" size={14} color={COLORS.white} /></View>
              </View>
            </View>

            <Text style={s.empName}>{u?.nombre_completo}</Text>
            <Text style={s.empFinca}>🏠 {empresa}</Text>
            {ubicacion && <Text style={s.empLoc}>📍 {ubicacion}</Text>}

            {/* 3 stats */}
            <View style={s.empStats}>
              <View style={s.empStatItem}>
                <Text style={s.empStatVal}>{calificacion > 0 ? `★ ${calificacion.toFixed(1)}` : '—'}</Text>
                <Text style={s.empStatLabel}>RATING</Text>
              </View>
              <View style={s.empStatDiv} />
              <View style={s.empStatItem}>
                <Text style={s.empStatVal}>{u?.total_vacantes || 0}</Text>
                <Text style={s.empStatLabel}>VACANTES</Text>
              </View>
              <View style={s.empStatDiv} />
              <View style={s.empStatItem}>
                <Text style={[s.empStatVal, { color: COLORS.primary }]}>{u?.verificado_sms ? '✓' : '—'}</Text>
                <Text style={s.empStatLabel}>VERIFICADO</Text>
              </View>
            </View>

            {/* Sobre la finca */}
            {perfil?.nombre_empresa_finca && (
              <View style={s.secWrap}>
                <View style={s.secHead}><View style={s.secIcon}><Ionicons name="leaf-outline" size={16} color={COLORS.primary} /></View><Text style={s.secTitle}>Sobre la Finca</Text></View>
                {acercaDeEmpleador ? (
                  <Text style={s.secText}>{acercaDeEmpleador}</Text>
                ) : (
                  <Text style={s.secTextMuted}>
                    {`Finca ${empresa}`}{ubicacion ? `, ubicada en ${ubicacion}` : ''}.
                    {tipoPago ? ` Modalidad de pago: ${tipoPago}.` : ''}
                    {beneficios.length > 0 ? ` Ofrecemos ${beneficios.join(' y ').toLowerCase()}.` : ''}
                  </Text>
                )}
              </View>
            )}

            {/* Cultivos */}
            {cultivosEmp.length > 0 && (
              <View style={s.secWrap}>
                <Text style={s.secTitle}>Cultivos Principales</Text>
                <View style={s.chipWrap}>
                  {cultivosEmp.map((c, i) => (
                    <View key={i} style={s.chipColor}><Ionicons name="leaf" size={12} color={COLORS.primary} /><Text style={s.chipColorTxt}>{c}</Text></View>
                  ))}
                  {labores.map((l, i) => (
                    <View key={`l${i}`} style={[s.chipColor, { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]}><Text style={[s.chipColorTxt, { color: '#F59E0B' }]}>{l}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {/* Verificación */}
            <View style={s.secWrap}>
              <Text style={s.secTitle}>Información Verificada</Text>
              <View style={s.verList}>
                <View style={s.verItem}>
                  <View style={s.verIcon}><Ionicons name="document-text-outline" size={18} color={COLORS.primary} /></View>
                  <Text style={s.verText}>Registro Empresarial</Text>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                </View>
                <View style={s.verItem}>
                  <View style={s.verIcon}><Ionicons name="call-outline" size={18} color={COLORS.primary} /></View>
                  <Text style={s.verText}>Teléfono Verificado</Text>
                  <Ionicons name={u?.verificado_sms ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={u?.verificado_sms ? COLORS.primary : COLORS.textLight} />
                </View>
                <View style={s.verItem}>
                  <View style={s.verIcon}><Ionicons name="location-outline" size={18} color={COLORS.primary} /></View>
                  <Text style={s.verText}>Ubicación de la Finca</Text>
                  <Ionicons name={ubicacion ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ubicacion ? COLORS.primary : COLORS.textLight} />
                </View>
              </View>
            </View>

            {/* Editar Perfil */}
            <TouchableOpacity style={s.ctaBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} activeOpacity={0.88}>
              <Ionicons name="create-outline" size={20} color={COLORS.white} />
              <Text style={s.ctaBtnTxt}>Editar Perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.logoutRow} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={16} color={COLORS.error} /><Text style={s.logoutTxt}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ══════════ TRABAJADOR ══════════ */
  const disponibilidad = perfil?.disponibilidad ? (LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad) : null;
  const experiencia = perfil?.anios_experiencia ? (LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia) : null;
  const estudios = perfil?.nivel_estudios ? (LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios) : null;
  const ubicacionT = [u?.municipio, u?.departamento].filter(Boolean).join(', ') || null;
  const acercaDeTrabajador = perfil?.acerca_de?.trim();

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Top bar */}
        <View style={s.topBar}>
          <View style={{ width: 40 }} />
          <Text style={s.topBarTitle}>Perfil del Trabajador</Text>
          <TouchableOpacity style={s.shareBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })}>
            <Ionicons name="settings-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={s.profileCenter}>
          <View style={s.avatarWrap}>
            {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
              <Image source={{ uri: u.foto_selfie }} style={s.avatar} />
            ) : (
              <View style={s.avatarFallback}><Ionicons name="person" size={52} color={COLORS.textLight} /></View>
            )}
            <View style={s.verifiedBadge}><Ionicons name="checkmark" size={14} color={COLORS.white} /></View>
          </View>
          <Text style={s.fullName}>{u?.nombre_completo || 'Usuario'}</Text>
          {calificacion > 0 ? (
            <View style={s.ratingRow}>
              <Ionicons name="star" size={16} color="#FFB300" />
              <Text style={s.ratingVal}>{calificacion.toFixed(1)}</Text>
              <Text style={s.ratingCnt}>({totalCalif} reseñas)</Text>
            </View>
          ) : (
            <Text style={s.noRating}>Sin reseñas aún</Text>
          )}
          {u?.verificado_sms && (
            <View style={s.verPill}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} /><Text style={s.verPillTxt}>VERIFICADO</Text>
            </View>
          )}
        </View>

        {/* ACERCA DE */}
        <View style={s.secWrap}>
          <Text style={s.secLabel}>ACERCA DE</Text>
          {acercaDeTrabajador ? (
            <Text style={s.secText}>{acercaDeTrabajador}</Text>
          ) : (
            <Text style={s.secTextMuted}>Aún no has agregado tu sección "Acerca de".</Text>
          )}
        </View>

        {perfil?.hoja_vida_url ? (
          <View style={s.secWrap}>
            <Text style={s.secLabel}>HOJA DE VIDA</Text>
            <TouchableOpacity style={s.cvCard} onPress={() => abrirDocumento(perfil.hoja_vida_url)} activeOpacity={0.85}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.cvCardTitle}>Hoja de vida cargada</Text>
                <Text style={s.cvCardName} numberOfLines={1}>{perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* HABILIDADES */}
        {especialidades.length > 0 && (
          <View style={s.secWrap}>
            <Text style={s.secLabel}>HABILIDADES Y ESPECIALIDADES</Text>
            <View style={s.chipWrap}>
              {especialidades.map((e, i) => (
                <View key={i} style={s.chipOutline}><Text style={s.chipOutlineTxt}>{e}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* EXPERIENCIA */}
        {experiencia && (
          <View style={s.secWrap}>
            <Text style={s.secLabel}>EXPERIENCIA LABORAL</Text>
            <View style={s.timeline}>
              <View style={s.tlItem}>
                <View style={s.tlDotGreen} />
                <View style={s.tlLine} />
                <View style={s.tlContent}>
                  <Text style={s.tlTitle}>Experiencia Agrícola</Text>
                  <Text style={s.tlSub}>{experiencia}</Text>
                  <Text style={s.tlDesc}>Trabajo en campo, cultivos y cosecha</Text>
                </View>
              </View>
              {estudios && (
                <View style={s.tlItem}>
                  <View style={[s.tlDotGreen, { backgroundColor: COLORS.primaryLight }]} />
                  <View style={s.tlContent}>
                    <Text style={s.tlTitle}>Formación</Text>
                    <Text style={s.tlSub}>{estudios}</Text>
                    {perfil?.titulo_estudio && <Text style={s.tlDesc}>{perfil.titulo_estudio}</Text>}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Stat cards */}
        <View style={s.statRow}>
          <View style={s.statCard}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={s.statLabel}>UBICACIÓN</Text>
            <Text style={s.statVal}>{ubicacionT || 'Colombia'}</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="calendar" size={20} color={COLORS.primary} />
            <Text style={s.statLabel}>DISPONIBILIDAD</Text>
            <Text style={s.statVal}>{disponibilidad || 'No indicada'}</Text>
          </View>
        </View>

        {/* DOCUMENTACIÓN */}
        <View style={s.secWrap}>
          <Text style={s.secLabel}>DOCUMENTACIÓN VERIFICADA</Text>
          <View style={s.verList}>
            <View style={s.verItem}>
              <View style={s.verIcon}><Ionicons name="card-outline" size={18} color={COLORS.primary} /></View>
              <Text style={s.verText}>Cédula de Ciudadanía</Text>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
            </View>
            <View style={s.verItem}>
              <View style={s.verIcon}><Ionicons name="call-outline" size={18} color={COLORS.primary} /></View>
              <Text style={s.verText}>Teléfono Verificado</Text>
              <Ionicons name={u?.verificado_sms ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={u?.verificado_sms ? COLORS.primary : COLORS.textLight} />
            </View>
          </View>
        </View>

        {/* Editar Perfil */}
        <View style={s.secWrap}>
          <TouchableOpacity style={s.ctaBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} activeOpacity={0.88}>
            <Ionicons name="create-outline" size={20} color={COLORS.white} /><Text style={s.ctaBtnTxt}>Editar Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.logoutRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={16} color={COLORS.error} /><Text style={s.logoutTxt}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  /* Top bar */
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  shareBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  /* Profile center */
  profileCenter: { alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  avatarWrap: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.primarySoft },
  avatarFallback: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.primarySoft, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white },
  fullName: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  ratingVal: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  ratingCnt: { fontSize: 14, color: COLORS.textSecondary },
  noRating: { fontSize: 14, color: COLORS.textLight, marginBottom: 8 },
  verPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 5 },
  verPillTxt: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },

  /* Sections shared */
  secWrap: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  secLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 1, marginBottom: SPACING.sm },
  secText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  secTextMuted: { fontSize: 14, color: COLORS.textLight, lineHeight: 22 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  secIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  secTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },

  /* Chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipOutline: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8 },
  chipOutlineTxt: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipColor: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: COLORS.primarySoft },
  chipColorTxt: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  /* Timeline */
  timeline: { paddingLeft: 4 },
  tlItem: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  tlDotGreen: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary, marginTop: 4, flexShrink: 0 },
  tlLine: { position: 'absolute', left: 6, top: 20, width: 2, height: 50, backgroundColor: COLORS.primarySoft },
  tlContent: { flex: 1 },
  tlTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  tlSub: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginTop: 2 },
  tlDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },

  /* Stat cards */
  statRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.borderLight },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.8 },
  statVal: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  /* Verified list */
  verList: { gap: SPACING.sm },
  verItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight },
  verIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  verText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },

  /* CV card */
  cvCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  cvCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  cvCardName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  /* CTA */
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.full, ...SHADOWS.button },
  ctaBtnTxt: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  logoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  logoutTxt: { fontSize: 14, fontWeight: '600', color: COLORS.error },

  /* ── EMPLEADOR ── */
  heroWrap: { width: '100%', height: HERO_H, position: 'relative' },
  heroImg: { width: '100%', height: HERO_H },
  heroPlaceholder: { width: '100%', height: HERO_H, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  heroLeaf: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryMuted, justifyContent: 'center', alignItems: 'center' },
  heroPlaceholderText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  heroBar: { position: 'absolute', left: SPACING.md, right: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  heroCircleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },

  empCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -32, paddingHorizontal: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.lg },
  empAvatarRow: { alignItems: 'center', marginTop: -50 },
  empAvatarWrap: { position: 'relative' },
  empAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: COLORS.white },
  empAvatarFallback: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: COLORS.white, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  empBadge: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white },
  empName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginTop: SPACING.sm },
  empFinca: { fontSize: 15, fontWeight: '600', color: COLORS.primary, textAlign: 'center', marginTop: 4 },
  empLoc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: SPACING.md },

  empStats: { flexDirection: 'row', backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACING.lg },
  empStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  empStatVal: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  empStatLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.8 },
  empStatDiv: { width: 1, backgroundColor: COLORS.borderLight },
});
