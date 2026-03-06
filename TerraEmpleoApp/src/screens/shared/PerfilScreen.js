import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  Image, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { StarRating } from '../../components/ui';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const LABELS_EXPERIENCIA = {
  sin_experiencia: 'Sin experiencia',
  menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años',
  '3_5': '3 a 5 años',
  '5_10': '5 a 10 años',
  mas_10: 'Más de 10 años',
};

const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo',
  por_dias: 'Por días',
  por_temporada: 'Por temporada / cosecha',
  fines_semana: 'Fines de semana',
  inmediato: 'Disponible inmediatamente',
};

const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios',
  bachiller: 'Bachiller',
  tecnico: 'Técnico / Tecnólogo',
  universitario: 'Universitario',
};

const LABELS_PAGO = {
  jornal: 'Jornal (diario)',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  destajo: 'Por tarea / destajo',
};

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ContactRow({ icon, label, value, action, actionLabel }) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.textLight} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value || 'N/A'}</Text>
      </View>
      {action && (
        <TouchableOpacity style={styles.contactAction} onPress={action}>
          <Text style={styles.contactActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PerfilScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [userData, setUserData] = useState(null);

  const u = userData || user;
  const esTrabajador = u?.rol === 'trabajador';
  const esEmpleador = u?.rol === 'empleador';

  useEffect(() => { loadPerfil(); }, []);

  useEffect(() => {
    if (!user || user.rol === 'admin') return;
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation, user]);

  const loadPerfil = async () => {
    try {
      const res = await authAPI.getPerfil();
      setUserData(res.data.user);
      setPerfil(res.data.perfil);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí, salir', onPress: signOut, style: 'destructive' },
    ]);
  };

  const calificacion = parseFloat(u?.calificacion_promedio || 0);
  const totalCalificaciones = u?.total_calificaciones || 0;

  // Especialidades = habilidades + cultivos
  const especialidades = [
    ...(perfil?.habilidades || []).map(h => h.habilidad),
    ...(perfil?.cultivos || []).map(c => c.cultivo),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Header verde ── */}
        <View style={styles.hero}>
          {/* Botones top */}
          <View style={styles.heroTopBar}>
            <View style={{ width: 38 }} />
            <View style={styles.heroTitles}>
              <Text style={styles.heroTitle}>Mi Perfil</Text>
              <Text style={styles.heroSubtitle}>TerraEmpleo Profesional</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })}
            >
              <Ionicons name="pencil" size={17} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
              <Image source={{ uri: u.foto_selfie }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={52} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name={esTrabajador ? 'briefcase' : 'business'} size={14} color={COLORS.white} />
            </View>
          </View>

          {/* Nombre y ubicación */}
          <Text style={styles.name}>{u?.nombre_completo}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.locationText}>
              {[u?.municipio, u?.departamento].filter(Boolean).join(', ') || 'Colombia'}
            </Text>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>
              {esTrabajador ? 'COSECHAS' : 'VACANTES'}
            </Text>
            <Text style={styles.statValue}>
              {esTrabajador
                ? (perfil?.total_cosechas || perfil?.cultivos?.length || 0)
                : (u?.total_vacantes || 0)}
            </Text>
            <Text style={styles.statSub}>
              {esTrabajador ? 'Finalizadas con éxito' : 'Publicadas'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CALIFICACIÓN</Text>
            <View style={styles.statRating}>
              <Text style={styles.statValue}>
                {calificacion > 0 ? calificacion.toFixed(1) : '—'}
              </Text>
              {calificacion > 0 && (
                <Ionicons name="star" size={18} color="#FFB300" />
              )}
            </View>
            <Text style={styles.statSub}>
              {totalCalificaciones > 0 ? `${totalCalificaciones} Reseñas` : 'Sin reseñas aún'}
            </Text>
          </View>
        </View>

        {/* ══ TRABAJADOR ══ */}
        {esTrabajador && (
          <>
            {/* Especialidades */}
            {especialidades.length > 0 && (
              <View style={styles.section}>
                <SectionHeader icon="flash" title="Especialidades" />
                <View style={styles.chipsWrap}>
                  {especialidades.map((e, i) => (
                    <View key={i} style={styles.chipSolid}>
                      <Text style={styles.chipSolidText}>{e}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Experiencia */}
            {(perfil?.anios_experiencia || perfil?.disponibilidad || perfil?.nivel_estudios) && (
              <View style={styles.section}>
                <SectionHeader icon="briefcase" title="Experiencia" />
                <View style={styles.timelineWrap}>
                  {perfil?.anios_experiencia && (
                    <View style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={styles.timelineLine} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineTitle}>
                          {LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia}
                        </Text>
                        <Text style={styles.timelineSub}>Experiencia en campo</Text>
                        {perfil?.disponibilidad && (
                          <Text style={styles.timelineQuote}>
                            "{LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad}"
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                  {perfil?.nivel_estudios && (
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, styles.timelineDotLight]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineTitle}>
                          {LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios}
                        </Text>
                        <Text style={styles.timelineSub}>
                          {perfil?.titulo_estudio || 'Nivel educativo'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {/* ══ EMPLEADOR ══ */}
        {esEmpleador && (
          <>
            {/* Info de la finca */}
            {perfil && (
              <View style={styles.section}>
                <SectionHeader icon="leaf" title="Mi Finca / Empresa" />
                <View style={styles.infoBlock}>
                  <InfoRow icon="business-outline" label="Nombre" value={perfil.nombre_empresa_finca} />
                  {perfil.tipo_pago && (
                    <InfoRow icon="cash-outline" label="Tipo de pago"
                      value={LABELS_PAGO[perfil.tipo_pago] || perfil.tipo_pago} />
                  )}
                  <InfoRow icon="home-outline" label="Alojamiento"
                    value={perfil.ofrece_alojamiento ? 'Sí ofrece' : 'No ofrece'} />
                  <InfoRow icon="restaurant-outline" label="Alimentación"
                    value={perfil.ofrece_alimentacion ? 'Sí ofrece' : 'No ofrece'} />
                </View>
              </View>
            )}

            {/* Cultivos y labores */}
            {((perfil?.cultivos?.length > 0) || (perfil?.labores?.length > 0)) && (
              <View style={styles.section}>
                <SectionHeader icon="flash" title="Cultivos y Labores" />
                <View style={styles.chipsWrap}>
                  {(perfil?.cultivos || []).map((c, i) => (
                    <View key={i} style={styles.chipSolid}>
                      <Text style={styles.chipSolidText}>{c.cultivo || c}</Text>
                    </View>
                  ))}
                  {(perfil?.labores || []).map((l, i) => (
                    <View key={i} style={styles.chipOutline}>
                      <Text style={styles.chipOutlineText}>{l.labor || l}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Cerrar sesión */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#E53935" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'N/A'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F4' },

  /* Hero */
  hero: {
    backgroundColor: COLORS.primary,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  heroTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  heroTitles: { alignItems: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  editBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Avatar */
  avatarWrap: { position: 'relative', marginBottom: SPACING.md },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#80c9a0',
  },
  avatarFallback: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#80c9a0',
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  name: { fontSize: 24, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: -20,
    borderRadius: RADIUS.lg,
    ...SHADOWS.medium,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1, alignItems: 'center',
    paddingVertical: SPACING.md + 4,
    paddingHorizontal: SPACING.sm,
  },
  statDivider: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.md },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  statRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  /* Sections */
  section: { marginHorizontal: SPACING.md, marginTop: SPACING.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },

  /* Chips */
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipSolid: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  chipSolidText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  chipOutline: {
    borderWidth: 1.5, borderColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  chipOutlineText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },

  /* Timeline */
  timelineWrap: { paddingLeft: SPACING.sm },
  timelineItem: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.primary, marginTop: 4, flexShrink: 0,
  },
  timelineDotLight: { backgroundColor: '#80c9a0' },
  timelineLine: {
    position: 'absolute', left: 6, top: 18,
    width: 2, height: 40, backgroundColor: '#b3dfc7',
  },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  timelineSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  timelineQuote: {
    fontSize: 13, color: COLORS.textSecondary,
    fontStyle: 'italic', marginTop: 6,
    lineHeight: 18,
  },

  /* Info block (empleador) */
  infoBlock: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '500' },
  infoValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600', marginTop: 1 },

  /* Contacto */
  contactCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, ...SHADOWS.small,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md, gap: SPACING.md,
  },
  contactDivider: { height: 1, backgroundColor: COLORS.borderLight },
  contactIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.4 },
  contactValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600', marginTop: 2 },
  contactAction: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  contactActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: '#FFCDD2',
    backgroundColor: '#FFF8F8',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#E53935' },
});
