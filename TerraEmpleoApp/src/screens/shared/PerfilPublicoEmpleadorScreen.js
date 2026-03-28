import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI, calificacionesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Input, StarRating } from '../../components/ui';
import { showAlert } from '../../utils/alertService';

function AnimatedPressable({ style, onPress, disabled, children, activeOpacity = 0.85 }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, pressed && { opacity: activeOpacity }]}
    >
      {children}
    </Pressable>
  );
}

function SectionHeader({ icon, title, colors }) {
  return (
    <View style={sh.headerRow}>
      <View style={[sh.iconBox, { backgroundColor: colors.primary + '1A' }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[sh.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

const sh = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  iconBox: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700' },
});

export default function PerfilPublicoEmpleadorScreen({ route, navigation }) {
  const { vacante_id, chat_data } = route.params || {};
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [vacante, setVacante] = useState(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);

  useEffect(() => {
    let mounted = true;

    const cargar = async () => {
      if (!vacante_id) {
        setLoading(false);
        return;
      }
      try {
        const res = await vacantesAPI.detalle(vacante_id);
        if (!mounted) return;
        setVacante(res.data?.vacante || null);
      } catch (_) {
        if (!mounted) return;
        setVacante(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    cargar();
    return () => { mounted = false; };
  }, [vacante_id]);

  const nombreFinca = vacante?.nombre_empresa_finca || chat_data?.otro_nombre || 'Finca';
  const nombrePropietario = vacante?.nombre_empleador || chat_data?.otro_nombre || 'Empleador';
  const empleadorId = Number(route?.params?.empleador_id || chat_data?.otro_usuario_id || vacante?.empleador_id);
  const ubicacion = [vacante?.municipio, vacante?.departamento].filter(Boolean).join(', ');
  const fotoFinca = vacante?.foto_portada || null;

  const beneficios = [
    vacante?.ofrece_alojamiento && 'Alojamiento incluido',
    vacante?.ofrece_alimentacion && 'Alimentación incluida',
    vacante?.beneficios_extra,
  ].filter(Boolean);

  const enviarCalificacion = async () => {
    if (!vacante_id || !empleadorId) {
      showAlert('No disponible', 'No hay contexto suficiente para calificar a este empleador.');
      return;
    }
    if (estrellas < 1 || estrellas > 5) {
      showAlert('Calificación', 'Selecciona de 1 a 5 estrellas.');
      return;
    }

    try {
      setEnviandoCalificacion(true);
      await calificacionesAPI.calificar({
        calificado_id: empleadorId,
        vacante_id,
        estrellas,
        comentario,
      });
      showAlert('Gracias', 'Calificación enviada correctamente.');
      setEstrellas(0);
      setComentario('');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar la calificación.');
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const initials = (nombreFinca || 'F')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* HERO — foto finca o gradiente placeholder */}
        <View style={s.heroWrap}>
          {fotoFinca ? (
            <Image source={{ uri: fotoFinca }} style={s.heroImg} resizeMode="cover" />
          ) : (
            <View style={[s.heroPlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <View style={[s.heroLeafBox, { backgroundColor: colors.primary + '25' }]}>
                <Ionicons name="leaf" size={40} color={colors.primary} />
              </View>
            </View>
          )}
          {/* Back button overlay */}
          <AnimatedPressable
            style={[s.heroBackBtn, { paddingTop: insets.top + 8, backgroundColor: 'rgba(0,0,0,0.28)' }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </AnimatedPressable>
        </View>

        {/* Identity card — floats over hero */}
        <View style={[s.identityCard, { backgroundColor: colors.surface, ...SHADOWS.card }]}>
          {/* Avatar circular */}
          <View style={[s.avatarWrap, { borderColor: colors.surface }]}>
            {fotoFinca ? (
              <Image source={{ uri: fotoFinca }} style={[s.avatar, { borderColor: colors.primary }]} />
            ) : (
              <View style={[s.avatarFallback, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]}>
                <Text style={[s.avatarInitials, { color: colors.primary }]}>{initials}</Text>
              </View>
            )}
          </View>

          <View style={s.identityInfo}>
            <Text style={[s.nombreFinca, { color: colors.textPrimary }]} numberOfLines={2}>
              {nombreFinca}
            </Text>
            <Text style={[s.nombrePropietario, { color: colors.textSecondary }]}>{nombrePropietario}</Text>
            {ubicacion ? (
              <View style={s.metaRow}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={[s.metaText, { color: colors.textMuted }]}>{ubicacion}</Text>
              </View>
            ) : null}
          </View>

          {/* Stats row */}
          <View style={[s.statsRow, { borderTopColor: colors.border }]}>
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>
                {vacante?.activa ? '1' : '0'}
              </Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Vacante{vacante?.activa ? '' : 's'}</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>
                {vacante?.cultivos?.length || 0}
              </Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Cultivos</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>
                {beneficios.length}
              </Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Beneficios</Text>
            </View>
          </View>
        </View>

        {/* Descripción de la vacante */}
        {vacante?.descripcion ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="document-text-outline" title="Descripción" colors={colors} />
            <Text style={[s.bodyText, { color: colors.textSecondary }]}>{vacante.descripcion}</Text>
          </View>
        ) : null}

        {/* Vacante activa — mini card */}
        {vacante ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="briefcase-outline" title="Vacante Publicada" colors={colors} />
            <View style={[s.vacanteCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={s.vacanteCardTop}>
                <View style={s.vacanteTitleRow}>
                  <View style={[s.vacanteDot, { backgroundColor: vacante.activa ? COLORS.badgeActiveText : COLORS.textLight }]} />
                  <Text style={[s.vacanteTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {vacante.titulo || vacante.tipo_labor || 'Vacante agrícola'}
                  </Text>
                </View>
                <View style={[s.vacanteBadge, { backgroundColor: vacante.activa ? COLORS.badgeActive : COLORS.badgeInactive }]}>
                  <Text style={[s.vacanteBadgeTxt, { color: vacante.activa ? COLORS.badgeActiveText : COLORS.badgeInactiveText }]}>
                    {vacante.activa ? 'Activa' : 'Cerrada'}
                  </Text>
                </View>
              </View>
              {vacante.salario_ofrecido ? (
                <View style={s.metaRow}>
                  <Ionicons name="cash-outline" size={14} color={colors.textMuted} />
                  <Text style={[s.metaText, { color: colors.textMuted }]}>
                    {vacante.salario_ofrecido} / {vacante.tipo_pago || 'mes'}
                  </Text>
                </View>
              ) : null}
              {vacante.num_trabajadores ? (
                <View style={s.metaRow}>
                  <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                  <Text style={[s.metaText, { color: colors.textMuted }]}>
                    {vacante.num_trabajadores} trabajador{vacante.num_trabajadores > 1 ? 'es' : ''} requerido{vacante.num_trabajadores > 1 ? 's' : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Beneficios */}
        {beneficios.length > 0 ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="gift-outline" title="Beneficios" colors={colors} />
            <View style={s.chipWrap}>
              {beneficios.map((b, idx) => (
                <View key={idx} style={[s.chipBlue, { backgroundColor: COLORS.infoSoft }]}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.info} />
                  <Text style={[s.chipBlueTxt, { color: COLORS.info }]}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Cultivos */}
        {(vacante?.cultivos || []).length > 0 ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="leaf-outline" title="Cultivos" colors={colors} />
            <View style={s.chipWrap}>
              {vacante.cultivos.map((c, i) => (
                <View key={i} style={[s.chipGreen, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[s.chipGreenTxt, { color: colors.primary }]}>
                    {typeof c === 'string' ? c : c.cultivo}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Calificar empleador (solo trabajador) */}
        {user?.rol === 'trabajador' ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="star-outline" title="Calificar Empleador" colors={colors} />
            <Text style={[s.bodyText, { color: colors.textMuted, marginBottom: SPACING.md }]}>
              ¿Cómo fue tu experiencia trabajando con esta finca?
            </Text>
            <StarRating rating={estrellas} onRate={setEstrellas} size={32} />
            <View style={{ marginTop: SPACING.md }}>
              <Input
                label="Comentario (opcional)"
                value={comentario}
                onChangeText={setComentario}
                placeholder="Describe tu experiencia con este empleador..."
                multiline
                numberOfLines={3}
              />
            </View>
            <AnimatedPressable
              style={[
                s.btnCalificar,
                { backgroundColor: colors.primary, opacity: enviandoCalificacion ? 0.7 : 1 },
              ]}
              onPress={enviarCalificacion}
              disabled={enviandoCalificacion}
            >
              <Ionicons name={enviandoCalificacion ? 'hourglass-outline' : 'star'} size={18} color="#fff" />
              <Text style={s.btnCalificarText}>
                {enviandoCalificacion ? 'Enviando...' : 'Enviar calificación'}
              </Text>
            </AnimatedPressable>
          </View>
        ) : null}

        {/* Volver */}
        <View style={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg }}>
          <AnimatedPressable
            style={[s.btnVolver, { borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back-outline" size={18} color={colors.textSecondary} />
            <Text style={[s.btnVolverText, { color: colors.textSecondary }]}>Volver al chat</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* HERO */
  heroWrap: { width: '100%', height: 220, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  heroLeafBox: {
    width: 88, height: 88, borderRadius: RADIUS.xxl,
    justifyContent: 'center', alignItems: 'center',
  },
  heroBackBtn: {
    position: 'absolute', top: 0, left: 0,
    width: 52, paddingBottom: 8, paddingLeft: 12,
    justifyContent: 'flex-end',
  },

  /* Identity card */
  identityCard: {
    marginHorizontal: SPACING.md,
    marginTop: -36,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    paddingTop: 52,
    marginBottom: SPACING.sm,
  },
  avatarWrap: {
    position: 'absolute',
    top: -36,
    left: SPACING.md,
    borderWidth: 3,
    borderRadius: RADIUS.full,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5 },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2.5,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { fontSize: 22, fontWeight: '800' },
  identityInfo: { gap: 3 },
  nombreFinca: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  nombrePropietario: { fontSize: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 13 },

  /* Stats */
  statsRow: {
    flexDirection: 'row', borderTopWidth: 1,
    marginTop: SPACING.md, paddingTop: SPACING.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, marginVertical: 4 },

  /* Cards */
  card: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    ...SHADOWS.small,
  },
  bodyText: { fontSize: 14, lineHeight: 22 },

  /* Vacante mini-card */
  vacanteCard: {
    borderRadius: RADIUS.lg, borderWidth: 1,
    padding: SPACING.md, gap: SPACING.sm,
  },
  vacanteCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vacanteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  vacanteDot: { width: 8, height: 8, borderRadius: 4 },
  vacanteTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  vacanteBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  vacanteBadgeTxt: { fontSize: 12, fontWeight: '700' },

  /* Chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipGreen: { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  chipGreenTxt: { fontSize: 13, fontWeight: '600' },
  chipBlue: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipBlueTxt: { fontSize: 13, fontWeight: '600' },

  /* Rating */
  btnCalificar: {
    marginTop: SPACING.md, borderRadius: RADIUS.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 14, ...SHADOWS.button,
  },
  btnCalificarText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  /* Volver */
  btnVolver: {
    borderWidth: 1.5, borderRadius: RADIUS.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 14,
  },
  btnVolverText: { fontSize: 15, fontWeight: '600' },
});
