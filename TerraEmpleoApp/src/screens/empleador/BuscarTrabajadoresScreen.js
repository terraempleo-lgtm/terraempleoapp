import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, Image, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../components/animated';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { trabajadoresAPI, vacantesAPI, especialistasAPI } from '../../services/api';

const LIME = '#C8F056';
const LIME_TEXT = '#2A5C00';

const ORDEN_TABS = [
  { key: 'match', label: 'Mejor match', icon: 'flash' },
  { key: 'cercanos', label: 'Cercanos', icon: 'location' },
];

const DISPONIBILIDAD_FILTROS = [
  { key: '', label: 'Todos' },
  { key: 'disponible_inmediatamente', label: 'Disponible ahora' },
  { key: 'tiempo_completo', label: 'Tiempo completo' },
  { key: 'por_dias', label: 'Por días' },
  { key: 'temporada_cosecha', label: 'Temporada' },
  { key: 'fines_semana', label: 'Fines de semana' },
];

const DISPONIBILIDAD_LABELS = {
  tiempo_completo: 'Tiempo completo',
  por_dias: 'Por días',
  temporada_cosecha: 'Temporada / Cosecha',
  fines_semana: 'Fines de semana',
  disponible_inmediatamente: 'Disponible ahora',
};

const EXPERIENCIA_LABELS = {
  sin: 'Sin experiencia',
  menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años',
  '3_5': '3 a 5 años',
  '5_10': '5 a 10 años',
  mas_10: '+10 años',
};

const PROXIMIDAD_CONFIG = {
  mismo_municipio: { label: 'Mismo municipio', color: COLORS.primary, icon: 'location' },
  mismo_departamento: { label: 'Mismo dpto.', color: COLORS.info, icon: 'map' },
  lejano: { label: null, color: null, icon: null },
};

const AVATAR_COLORS = [
  '#C8A882', '#A8B8D0', '#B8C8A0', '#D0A8A8', '#A8C8C8',
  '#C8B8A0', '#B0A8C8', '#C8C0A0', '#A0B8A8', '#C0B0B8',
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function StarRating({ value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(value) ? 'star' : 'star-outline'}
          size={11}
          color={i <= Math.round(value) ? COLORS.star : COLORS.starEmpty}
        />
      ))}
    </View>
  );
}

function MatchPill({ matchNum }) {
  if (!matchNum) return null;
  const bg = matchNum >= 80 ? COLORS.primarySoft
    : matchNum >= 65 ? '#EEF8E0'
    : '#F2F4F0';
  const fg = matchNum >= 80 ? COLORS.primary
    : matchNum >= 65 ? '#3F7600'
    : '#666';
  return (
    <View style={[styles.matchPill, { backgroundColor: bg }]}>
      <Ionicons name="flash" size={11} color={fg} />
      <Text style={[styles.matchPillText, { color: fg }]}>{matchNum}%</Text>
    </View>
  );
}

function TrabajadorCard({ item, onPress, onContact, onChat, loadingContacto, estadoContacto, colors, isDark }) {
  const proxConfig = PROXIMIDAD_CONFIG[item.proximidad] || PROXIMIDAD_CONFIG.lejano;
  const dispLabel = DISPONIBILIDAD_LABELS[item.disponibilidad];
  const expLabel = EXPERIENCIA_LABELS[item.anios_experiencia];
  const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ');
  const matchNum = Number(item.puntaje_match || 0);
  const initials = getInitials(item.nombre_completo);
  const avatarBg = getAvatarColor(item.nombre_completo);

  const allSkills = [...(item.cultivos || []), ...(item.habilidades || [])];
  const visibleSkills = allSkills.slice(0, 3);
  const hiddenCount = allSkills.length - visibleSkills.length;

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => onPress(item)}
      scaleValue={0.98}
      haptic={false}
    >
      {/* Card header: avatar + info */}
      <View style={styles.cardTop}>
        <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
          {item.foto_selfie ? (
            <Image source={{ uri: item.foto_selfie }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarInitials}>{initials}</Text>
          )}
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.nombre, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
              {item.nombre_completo}
            </Text>
            <StarRating value={item.calificacion_promedio || 0} />
          </View>
          {ubicacion ? (
            <View style={styles.row}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.ubicacion, { color: colors.textMuted }]} numberOfLines={1}>{ubicacion}</Text>
              {proxConfig.label ? (
                <View style={[styles.regionPill, { backgroundColor: proxConfig.color + '15' }]}>
                  <Text style={[styles.regionPillText, { color: proxConfig.color }]}>{proxConfig.label}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <MatchPill matchNum={matchNum} />
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

      {/* Attr row */}
      <View style={styles.cardMeta}>
        {dispLabel ? (
          <View style={styles.attrItem}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.attrText, { color: colors.textSecondary }]}>{dispLabel}</Text>
          </View>
        ) : null}
        {dispLabel && expLabel ? (
          <View style={[styles.attrDivider, { backgroundColor: colors.border }]} />
        ) : null}
        {expLabel ? (
          <View style={styles.attrItem}>
            <Ionicons name="briefcase-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.attrText, { color: colors.textSecondary }]}>{expLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Skills */}
      {visibleSkills.length > 0 && (
        <View style={styles.skillsRow}>
          {visibleSkills.map((s, i) => (
            <View key={i} style={[styles.skillChip, { backgroundColor: isDark ? colors.border : '#F2F4F0', borderColor: isDark ? colors.border : '#E8EAE6' }]}>
              <Text style={[styles.skillText, { color: colors.textSecondary }]} numberOfLines={1}>{s}</Text>
            </View>
          ))}
          {hiddenCount > 0 && (
            <View style={[styles.skillChip, { backgroundColor: '#1A1A1A', borderColor: 'transparent' }]}>
              <Text style={[styles.skillText, { color: COLORS.white, fontWeight: '700' }]}>+{hiddenCount}</Text>
            </View>
          )}
        </View>
      )}

      {/* CTA */}
      <View style={styles.cardFooter}>
        {estadoContacto === 'aceptada' ? (
          <AnimatedPressable style={[styles.btnContactar, { backgroundColor: COLORS.success }]} onPress={() => onChat(item)} scaleValue={0.96} haptic>
            <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.white} />
            <Text style={styles.btnContactarText}>Ir al chat</Text>
          </AnimatedPressable>
        ) : estadoContacto === 'contacto_solicitado' ? (
          <View style={[styles.btnContactar, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="hourglass-outline" size={14} color={COLORS.white} />
            <Text style={styles.btnContactarText}>En espera</Text>
          </View>
        ) : (
          <AnimatedPressable
            style={[styles.btnContactar, loadingContacto && { opacity: 0.7 }]}
            onPress={() => onContact(item)}
            disabled={loadingContacto}
            scaleValue={0.96}
            haptic
          >
            <Ionicons name={loadingContacto ? 'hourglass-outline' : 'chatbubble-ellipses-outline'} size={14} color={COLORS.white} />
            <Text style={styles.btnContactarText}>{loadingContacto ? 'Enviando...' : 'Contactar'}</Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable style={styles.btnPerfil} onPress={() => onPress(item)} scaleValue={0.96} haptic>
          <Text style={styles.btnPerfilText}>Ver perfil</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </AnimatedPressable>
      </View>
    </AnimatedPressable>
  );
}

const EXPERIENCIA_LABELS_ESP = {
  menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años',
  '3_5': '3 a 5 años',
  '5_10': '5 a 10 años',
  mas_10: '+10 años',
};

const MODALIDAD_LABELS_ESP = {
  por_proyecto: 'Por proyecto',
  por_dias: 'Por días',
  mensual: 'Mensual',
  asesoria_puntual: 'Asesoría puntual',
};

function EspecialistaCard({ item, onPress, onContactar, loadingId, estadoContacto, colors }) {
  const initials = getInitials(item.nombre_completo);
  const avatarBg = getAvatarColor(item.nombre_completo);
  const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ');
  const visibleEsp = (item.especialidades || []).slice(0, 2);
  const hiddenEsp = (item.especialidades || []).length - visibleEsp.length;
  const expLabel = EXPERIENCIA_LABELS_ESP[item.anios_experiencia];
  const modalidadLabel = MODALIDAD_LABELS_ESP[item.modalidad_trabajo];
  const cal = parseFloat(item.calificacion_promedio || 0);
  const estado = estadoContacto || null;
  const isLoading = loadingId === Number(item.id);

  return (
    <AnimatedPressable
      style={[styles.espCardNew, { backgroundColor: colors.surface }]}
      onPress={() => onPress(item)}
      scaleValue={0.98}
      haptic={false}
    >
      {/* Header */}
      <View style={styles.espCardHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: avatarBg, width: 52, height: 52, borderRadius: 26 }]}>
          {item.foto_selfie ? (
            <Image source={{ uri: item.foto_selfie }} style={[styles.avatar, { width: 52, height: 52, borderRadius: 26 }]} />
          ) : (
            <Text style={styles.avatarInitials}>{initials}</Text>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.nombre, { color: colors.textPrimary, flex: 1, fontSize: 15 }]} numberOfLines={1}>
              {item.nombre_completo}
            </Text>
            {item.verificado && <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />}
          </View>
          {ubicacion ? (
            <View style={styles.row}>
              <Ionicons name="location-outline" size={11} color={colors.textMuted} />
              <Text style={[styles.ubicacion, { color: colors.textMuted, fontSize: 12 }]} numberOfLines={1}>{ubicacion}</Text>
            </View>
          ) : null}
          {/* Estrellas */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
            {[1,2,3,4,5].map(i => (
              <Ionicons key={i} name={i <= Math.round(cal) ? 'star' : 'star-outline'} size={11} color="#F59E0B" />
            ))}
            {cal > 0 && <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 2 }}>{cal.toFixed(1)}</Text>}
          </View>
        </View>
      </View>

      {/* Badge + atributos */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm }}>
        <View style={styles.espBadge}>
          <Ionicons name="ribbon-outline" size={11} color={COLORS.primary} />
          <Text style={styles.espBadgeText}>Especialista</Text>
        </View>
        {expLabel && <Text style={[styles.attrText, { color: colors.textMuted, fontSize: 12 }]}>{expLabel}</Text>}
        {modalidadLabel && <Text style={[styles.attrText, { color: colors.textMuted, fontSize: 12 }]}>· {modalidadLabel}</Text>}
      </View>

      {/* Descripción */}
      {item.descripcion_servicio ? (
        <Text style={[styles.espDesc, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.descripcion_servicio}
        </Text>
      ) : null}

      {/* Especialidades chips */}
      {visibleEsp.length > 0 && (
        <View style={[styles.skillsRow, { marginTop: SPACING.sm }]}>
          {visibleEsp.map((e) => (
            <View key={e} style={[styles.skillPill, { backgroundColor: COLORS.primarySoft }]}>
              <Text style={[styles.skillText, { color: COLORS.primary }]}>{e}</Text>
            </View>
          ))}
          {hiddenEsp > 0 && (
            <View style={[styles.skillPill, { backgroundColor: colors.border }]}>
              <Text style={[styles.skillText, { color: colors.textMuted }]}>+{hiddenEsp}</Text>
            </View>
          )}
        </View>
      )}

      {/* Acciones */}
      <View style={[styles.cardActions, { marginTop: SPACING.sm }]}>
        {estado === 'aceptada' ? (
          <AnimatedPressable style={[styles.btnContactar, { backgroundColor: COLORS.success, flex: 1 }]} onPress={() => onContactar(item)} scaleValue={0.96} haptic>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.white} />
            <Text style={styles.btnContactarText}>Ir al chat</Text>
          </AnimatedPressable>
        ) : estado === 'contacto_solicitado' ? (
          <View style={[styles.btnContactar, { backgroundColor: '#F59E0B', flex: 1, opacity: 0.9 }]}>
            <Ionicons name="time-outline" size={14} color={COLORS.white} />
            <Text style={styles.btnContactarText}>En espera</Text>
          </View>
        ) : (
          <AnimatedPressable
            style={[styles.btnContactar, { flex: 1 }, isLoading && { opacity: 0.7 }]}
            onPress={() => onContactar(item)}
            scaleValue={0.96}
            haptic
            disabled={isLoading}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.white} />
            <Text style={styles.btnContactarText}>{isLoading ? 'Enviando...' : 'Contactar'}</Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable style={styles.btnPerfil} onPress={() => onPress(item)} scaleValue={0.96} haptic>
          <Text style={styles.btnPerfilText}>Ver perfil</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </AnimatedPressable>
      </View>
    </AnimatedPressable>
  );
}

export default function BuscarTrabajadoresScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const [trabajadores, setTrabajadores] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enviandoContactoId, setEnviandoContactoId] = useState(null);
  const [contactosEstado, setContactosEstado] = useState({});
  const [vacanteContacto, setVacanteContacto] = useState(null);
  const [orden, setOrden] = useState('match');
  const [disponibilidad, setDisponibilidad] = useState('');
  const [search, setSearch] = useState('');
  const [empleadorTieneUbicacion, setEmpleadorTieneUbicacion] = useState(true);

  const cargar = useCallback(async (ord = orden, disp = disponibilidad) => {
    try {
      const params = { orden: ord };
      if (disp) params.disponibilidad = disp;
      const [resTrab, resEsp] = await Promise.allSettled([
        trabajadoresAPI.listar(params),
        especialistasAPI.listar({ limit: 10 }),
      ]);
      const data = resTrab.status === 'fulfilled' ? resTrab.value.data : {};
      const lista = data?.trabajadores || [];
      const listaEsp = resEsp.status === 'fulfilled' ? (resEsp.value.data?.especialistas || []) : [];
      setTrabajadores(lista);
      setEspecialistas(listaEsp);
      if (typeof data?.empleador_tiene_ubicacion === 'boolean') {
        setEmpleadorTieneUbicacion(data.empleador_tiene_ubicacion);
      }
      const estadosIniciales = {};
      lista.forEach(t => { if (t.estado_contacto) estadosIniciales[t.id] = t.estado_contacto; });
      setContactosEstado(estadosIniciales);
    } catch (err) {
      console.error('Error cargando trabajadores:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orden, disponibilidad]);

  const cargarVacanteContacto = useCallback(async () => {
    try {
      const res = await vacantesAPI.misVacantes();
      const vacantes = res.data?.vacantes || [];
      const activa = vacantes.find((v) => v.estado === 'activa') || vacantes[0] || null;
      setVacanteContacto(activa ? { id: Number(activa.id), titulo: activa.titulo } : null);
    } catch (_) {
      setVacanteContacto(null);
    }
  }, []);

  useEffect(() => {
    cargar();
    cargarVacanteContacto();
  }, []);

  const onOrden = (key) => {
    setOrden(key);
    cargar(key, disponibilidad);
  };

  const onDisponibilidad = (key) => {
    setDisponibilidad(key);
    cargar(orden, key);
  };

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trabajadores;
    return trabajadores.filter((t) =>
      t.nombre_completo?.toLowerCase().includes(q) ||
      t.municipio?.toLowerCase().includes(q) ||
      t.departamento?.toLowerCase().includes(q) ||
      t.habilidades?.some((h) => h.toLowerCase().includes(q)) ||
      t.cultivos?.some((c) => c.toLowerCase().includes(q))
    );
  }, [trabajadores, search]);

  const solicitarContactoEspecialista = async (item) => {
    try {
      setEnviandoContactoId(Number(item.id));
      const res = await especialistasAPI.contactar(item.id, { vacante_id: vacanteContacto?.id });
      const estado = res?.data?.estado;
      const chatId = Number(res?.data?.chat_id || 0);

      if (estado === 'aceptada' && chatId) {
        setContactosEstado(prev => ({ ...prev, [`esp_${item.id}`]: 'aceptada' }));
        Alert.alert('Listo', 'Este especialista ya aceptó contacto. Te llevamos al chat.');
        navigation.navigate('Mensajes', {
          screen: 'ChatDetalle',
          params: { chat: { id: chatId, otro_nombre: item.nombre_completo, otro_foto: item.foto_selfie } },
        });
        return;
      }
      if (estado === 'contacto_solicitado') {
        setContactosEstado(prev => ({ ...prev, [`esp_${item.id}`]: 'contacto_solicitado' }));
        Alert.alert('En espera', `${item.nombre_completo} debe aceptar para habilitar el chat.`);
        return;
      }
      setContactosEstado(prev => ({ ...prev, [`esp_${item.id}`]: 'contacto_solicitado' }));
      Alert.alert('Listo', `Se envió solicitud de contacto a ${item.nombre_completo}.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud de contacto');
    } finally {
      setEnviandoContactoId(null);
    }
  };

  const irPerfil = (item) => {
    navigation.navigate('PerfilPublicoTrabajador', {
      trabajador_id: item.id,
      vacante_id: vacanteContacto?.id,
    });
  };

  const irAlChat = async (item) => {
    try {
      const chatId = item.chat_id;
      if (chatId) {
        navigation.navigate('Mensajes', {
          screen: 'ChatDetalle',
          params: { chat: { id: chatId, otro_nombre: item.nombre_completo, otro_foto: item.foto_selfie, vacante_titulo: vacanteContacto?.titulo } },
        });
      } else {
        const res = await trabajadoresAPI.contactar(item.id, { vacante_id: vacanteContacto?.id });
        if (res?.data?.chat_id) {
          navigation.navigate('Mensajes', {
            screen: 'ChatDetalle',
            params: { chat: { id: res.data.chat_id, otro_nombre: item.nombre_completo, otro_foto: item.foto_selfie, vacante_titulo: vacanteContacto?.titulo } },
          });
        }
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo abrir el chat');
    }
  };

  const solicitarContacto = async (item) => {
    if (!vacanteContacto?.id) {
      Alert.alert('Sin vacante', 'Primero crea o activa una vacante para poder contactar trabajadores.');
      return;
    }
    try {
      setEnviandoContactoId(Number(item.id));
      const res = await trabajadoresAPI.contactar(item.id, { vacante_id: vacanteContacto.id });
      const estado = res?.data?.estado;
      const chatId = Number(res?.data?.chat_id || 0);

      if (estado === 'aceptada' && chatId) {
        setContactosEstado(prev => ({ ...prev, [item.id]: 'aceptada' }));
        Alert.alert('Listo', 'Este trabajador ya aceptó contacto. Te llevamos al chat.');
        navigation.navigate('Mensajes', {
          screen: 'ChatDetalle',
          params: {
            chat: {
              id: chatId,
              otro_nombre: item.nombre_completo,
              otro_foto: item.foto_selfie,
              vacante_titulo: vacanteContacto.titulo,
            },
          },
        });
        return;
      }
      if (estado === 'contacto_solicitado') {
        setContactosEstado(prev => ({ ...prev, [item.id]: 'contacto_solicitado' }));
        Alert.alert('En espera', `${item.nombre_completo} debe aceptar para habilitar el chat.`);
        return;
      }
      setContactosEstado(prev => ({ ...prev, [item.id]: 'contacto_solicitado' }));
      Alert.alert('Listo', `Se envió solicitud de contacto a ${item.nombre_completo}.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud de contacto');
    } finally {
      setEnviandoContactoId(null);
    }
  };

  const ListHeader = (
    <View>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Trabajadores</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.greenDot} />
          <Text style={[styles.subtitleText, { color: COLORS.primary }]}>
            {filtrados.length} disponible{filtrados.length !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.subtitleSep, { color: colors.textMuted }]}> · </Text>
          <Text style={[styles.subtitleMuted, { color: colors.textMuted }]}>Talento cerca de ti</Text>
        </View>
      </View>

      {/* Banner: sin ubicación + filtro cercanos */}
      {orden === 'cercanos' && !empleadorTieneUbicacion && (
        <TouchableOpacity
          style={[styles.noVacanteBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
          onPress={() => navigation.navigate('Perfil')}
          activeOpacity={0.85}
        >
          <View style={[styles.noVacanteIcon, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="location-outline" size={22} color="#1E40AF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.noVacanteTitulo, { color: '#1E3A8A' }]}>Agrega tu ubicación</Text>
            <Text style={[styles.noVacanteTexto, { color: '#1E40AF' }]}>
              Configura tu departamento en tu perfil para ver trabajadores cercanos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#1E40AF" />
        </TouchableOpacity>
      )}

      {/* Banner: sin vacante activa */}
      {!vacanteContacto && (
        <TouchableOpacity
          style={styles.noVacanteBanner}
          onPress={() => navigation.navigate('CrearVacante')}
          activeOpacity={0.85}
        >
          <View style={styles.noVacanteIcon}>
            <Ionicons name="alert-circle-outline" size={22} color="#92400E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.noVacanteTitulo}>Crea una vacante primero</Text>
            <Text style={styles.noVacanteTexto}>
              Necesitas tener una vacante activa para poder contactar trabajadores.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#92400E" />
        </TouchableOpacity>
      )}

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#F5F5F5', borderColor: isDark ? colors.border : '#EBEBEB' }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar talentos o habilidades..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="options-outline" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Sort + map row */}
      <View style={styles.ordenRow}>
        {ORDEN_TABS.map((t) => {
          const active = orden === t.key;
          const isMatch = t.key === 'match';
          return (
            <AnimatedPressable
              key={t.key}
              scaleValue={0.96}
              haptic
              style={[
                styles.ordenTab,
                active && isMatch ? { backgroundColor: LIME, borderColor: LIME } :
                active ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary } :
                { backgroundColor: isDark ? colors.surface : COLORS.white, borderColor: isDark ? colors.border : '#E0E0E0' },
              ]}
              onPress={() => onOrden(t.key)}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={active ? (isMatch ? LIME_TEXT : COLORS.white) : colors.textSecondary}
              />
              <Text style={[
                styles.ordenTabText,
                { color: active ? (isMatch ? LIME_TEXT : COLORS.white) : colors.textSecondary },
              ]}>
                {t.label}
              </Text>
            </AnimatedPressable>
          );
        })}
        <AnimatedPressable
          style={[styles.mapCircleBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => navigation.navigate('TrabajadoresMapa', { search })}
          scaleValue={0.95}
          haptic
        >
          <Ionicons name="map-outline" size={18} color={COLORS.white} />
        </AnimatedPressable>
      </View>

      {/* Especialistas destacados */}
      {especialistas.length > 0 && (
        <View style={styles.espSection}>
          <View style={styles.espHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.espSectionTitle, { color: colors.textPrimary }]}>
                Especialistas agroindustriales
              </Text>
              <Text style={[styles.espSectionSub, { color: colors.textMuted }]}>
                Técnicos y profesionales para tu finca
              </Text>
            </View>
            <View />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.espScroll}>
            {especialistas.slice(0, 5).map((esp) => (
              <EspecialistaCard
                key={esp.id}
                item={esp}
                colors={colors}
                onPress={(item) => navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: item.id, rol: 'especialista' })}
                onContactar={solicitarContactoEspecialista}
                loadingId={enviandoContactoId}
                estadoContacto={contactosEstado[`esp_${esp.id}`] || null}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Disponibilidad chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dispScrollView}
        contentContainerStyle={styles.dispRow}
      >
        {DISPONIBILIDAD_FILTROS.map((f, index) => {
          const active = disponibilidad === f.key;
          return (
            <AnimatedPressable
              key={f.key}
              scaleValue={0.95}
              style={[
                styles.dispChip,
                {
                  backgroundColor: active ? (isDark ? COLORS.primary : COLORS.white) : (isDark ? colors.surface : COLORS.WHITE),
                  borderColor: active ? COLORS.primary : (isDark ? colors.border : '#DEDEDE'),
                  marginLeft: index === 0 ? SPACING.md : 0,
                  marginRight: index === DISPONIBILIDAD_FILTROS.length - 1 ? SPACING.md : 0,
                },
              ]}
              onPress={() => onDisponibilidad(f.key)}
            >
              <Text style={[
                styles.dispChipText,
                { color: active ? COLORS.primary : colors.textSecondary, fontWeight: active ? '700' : '500' },
              ]}>
                {f.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerWrap}>
          <Ionicons name="people-outline" size={40} color={COLORS.primaryLight} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Buscando trabajadores...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        data={filtrados}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TrabajadorCard
            item={item}
            onPress={irPerfil}
            onContact={solicitarContacto}
            onChat={irAlChat}
            loadingContacto={Number(enviandoContactoId) === Number(item.id)}
            estadoContacto={contactosEstado[item.id] || null}
            colors={colors}
            isDark={isDark}
          />
        )}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={44} color={COLORS.primaryLight} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin resultados</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Prueba cambiando los filtros o el orden de búsqueda.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: { fontSize: 15 },

  /* Title */
  titleRow: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 12,
  },
  screenTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 5,
  },
  subtitleText: { fontSize: 13, fontWeight: '600' },
  subtitleSep: { fontSize: 13 },
  subtitleMuted: { fontSize: 13 },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0, height: 20 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Sort row */
  ordenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: 10,
  },
  ordenTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  ordenTabText: { fontSize: 13, fontWeight: '700' },
  mapCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Disponibilidad */
  dispScrollView: { flexGrow: 0, marginBottom: 12 },
  dispRow: {
    gap: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  dispChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  dispChipText: { fontSize: 13 },

  /* List */
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg },

  /* Card */
  card: {
    borderRadius: 18,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EFF1ED',
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarInitials: { fontSize: 18, fontWeight: '700', color: COLORS.white },

  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 4,
  },
  matchPillText: { fontSize: 12, fontWeight: '700' },

  cardInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: { fontSize: 15, fontWeight: '700', lineHeight: 20, letterSpacing: -0.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  ubicacion: { fontSize: 12 },

  regionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  regionPillText: { fontSize: 10.5, fontWeight: '700' },

  cardDivider: { height: 1, marginVertical: 10 },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attrItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attrDivider: { width: 1, height: 12 },
  attrText: { fontSize: 12.5, fontWeight: '500' },

  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  skillChip: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    borderWidth: 1,
  },
  skillText: { fontSize: 12, fontWeight: '600' },

  cardFooter: { marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnContactar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  btnContactarText: { fontSize: 13.5, fontWeight: '700', color: COLORS.white },
  btnPerfil: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  btnPerfilText: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },

  empty: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center' },

  /* Especialistas section */
  espSection: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  espHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  espSectionTitle: { fontSize: 16, fontWeight: '700' },
  espSectionSub: { fontSize: 12, marginTop: 2 },
  espVerTodos: { fontSize: 13, fontWeight: '600' },
  espScroll: { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  espCard: { width: 260, marginRight: 0 },
  espBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4,
  },
  espBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },

  noVacanteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: SPACING.sm + 2,
  },
  noVacanteIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVacanteTitulo: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  noVacanteTexto: { fontSize: 12, color: '#78350F', lineHeight: 16 },

  espCardNew: {
    width: 300,
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EFF1ED',
    ...SHADOWS.card,
  },
  espCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  espDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  skillPill: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
  },
});
