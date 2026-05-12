import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { pqrsAPI } from '../../services/api';

const TIPOS = [
  { key: 'peticion', label: 'Petición', icon: 'hand-left-outline', color: '#2196F3' },
  { key: 'queja', label: 'Queja', icon: 'warning-outline', color: '#FF5722' },
  { key: 'reclamo', label: 'Reclamo', icon: 'alert-circle-outline', color: '#FF9800' },
  { key: 'sugerencia', label: 'Sugerencia', icon: 'bulb-outline', color: '#4CAF50' },
];

const ESTADO_COLORS = {
  recibido: '#2196F3',
  en_proceso: '#FF9800',
  resuelto: '#4CAF50',
  cerrado: '#9E9E9E',
};

const ESTADO_LABELS = {
  recibido: 'Recibido',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)} días`;
}

export default function PqrsScreen({ navigation }) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState('nueva'); // 'nueva' | 'mis'
  const [tipo, setTipo] = useState('');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [misPqrs, setMisPqrs] = useState([]);
  const [loadingPqrs, setLoadingPqrs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [respuestaTextos, setRespuestaTextos] = useState({}); // { [id]: texto }
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(null); // id en proceso

  const cargarMisPqrs = useCallback(async () => {
    try {
      setLoadingPqrs(true);
      const res = await pqrsAPI.misPqrs();
      setMisPqrs(res.data.pqrs || []);
    } catch (e) {
      console.warn('Error cargando PQRS:', e);
    } finally {
      setLoadingPqrs(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'mis') cargarMisPqrs();
  }, [tab, cargarMisPqrs]);

  const enviar = async () => {
    if (!tipo) { Alert.alert('Tipo requerido', 'Selecciona el tipo de solicitud.'); return; }
    if (!asunto.trim() || asunto.trim().length < 5) { Alert.alert('Asunto requerido', 'El asunto debe tener al menos 5 caracteres.'); return; }
    if (!descripcion.trim() || descripcion.trim().length < 10) { Alert.alert('Descripción requerida', 'La descripción debe tener al menos 10 caracteres.'); return; }

    try {
      setEnviando(true);
      await pqrsAPI.enviar({ tipo, asunto: asunto.trim(), descripcion: descripcion.trim() });
      Alert.alert('✅ Enviado', 'Tu solicitud fue recibida. El equipo de TerraEmpleo la revisará y responderá a la brevedad.');
      setTipo('');
      setAsunto('');
      setDescripcion('');
      setTab('mis');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  };

  const enviarRespuestaUsuario = async (pqrsId) => {
    const texto = (respuestaTextos[pqrsId] || '').trim();
    if (texto.length < 2) { Alert.alert('Escribe tu respuesta antes de enviar.'); return; }
    try {
      setEnviandoRespuesta(pqrsId);
      await pqrsAPI.responderUsuario(pqrsId, texto);
      setRespuestaTextos(prev => ({ ...prev, [pqrsId]: '' }));
      await cargarMisPqrs();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo enviar la respuesta.');
    } finally {
      setEnviandoRespuesta(null);
    }
  };

  const tipoInfo = TIPOS.find(t => t.key === tipo);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>PQRS</Text>
          <Text style={[s.headerSub, { color: colors.textSecondary }]}>Peticiones, Quejas, Reclamos y Sugerencias</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[s.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[{ key: 'nueva', label: 'Nueva solicitud' }, { key: 'mis', label: 'Mis solicitudes' }].map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, { color: tab === t.key ? COLORS.primary : colors.textSecondary }, tab === t.key && s.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'nueva' ? (
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Text style={[s.label, { color: colors.textPrimary }]}>Tipo de solicitud</Text>
          <View style={s.tiposGrid}>
            {TIPOS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.tipoCard, { borderColor: tipo === t.key ? t.color : colors.border, backgroundColor: tipo === t.key ? t.color + '15' : colors.surface }]}
                onPress={() => setTipo(t.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={t.icon} size={22} color={tipo === t.key ? t.color : colors.textSecondary} />
                <Text style={[s.tipoLabel, { color: tipo === t.key ? t.color : colors.textSecondary }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.label, { color: colors.textPrimary }]}>Asunto</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Ej: Problema con mi postulación..."
            placeholderTextColor={colors.textSecondary}
            value={asunto}
            onChangeText={setAsunto}
            maxLength={200}
          />

          <Text style={[s.label, { color: colors.textPrimary }]}>Descripción</Text>
          <TextInput
            style={[s.textarea, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Describe con detalle tu solicitud, lo que ocurrió y qué resultado esperas..."
            placeholderTextColor={colors.textSecondary}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[s.btnEnviar, { backgroundColor: tipoInfo ? tipoInfo.color : COLORS.primary, opacity: enviando ? 0.7 : 1 }]}
            onPress={enviar}
            disabled={enviando}
            activeOpacity={0.85}
          >
            {enviando
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={s.btnEnviarText}>Enviar solicitud</Text>
                </>
            }
          </TouchableOpacity>

          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.infoText}>
              Respondemos en un plazo de 1 a 5 días hábiles. Puedes revisar el estado en "Mis solicitudes".
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarMisPqrs(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
        >
          {loadingPqrs ? (
            <View style={s.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
          ) : misPqrs.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="chatbox-ellipses-outline" size={48} color={COLORS.disabled} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>No tienes solicitudes aún</Text>
              <TouchableOpacity onPress={() => setTab('nueva')}>
                <Text style={{ color: COLORS.primary, fontWeight: '700', marginTop: 8 }}>Crear una nueva</Text>
              </TouchableOpacity>
            </View>
          ) : misPqrs.map(item => {
            const t = TIPOS.find(x => x.key === item.tipo);
            const estadoColor = ESTADO_COLORS[item.estado] || COLORS.textSecondary;
            const textoRespuesta = respuestaTextos[item.id] || '';
            const estaEnviando = enviandoRespuesta === item.id;
            return (
              <View key={item.id} style={[s.card, { backgroundColor: colors.surface }, SHADOWS.sm]}>
                <View style={[s.cardBar, { backgroundColor: t?.color || COLORS.primary }]} />
                <View style={s.cardContent}>
                  <View style={s.cardTop}>
                    <Ionicons name={t?.icon || 'help-circle-outline'} size={18} color={t?.color || COLORS.primary} />
                    <Text style={[s.cardTipo, { color: t?.color || COLORS.primary }]}>{t?.label || item.tipo}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={[s.estadoBadge, { backgroundColor: estadoColor + '20' }]}>
                      <Text style={[s.estadoText, { color: estadoColor }]}>{ESTADO_LABELS[item.estado] || item.estado}</Text>
                    </View>
                  </View>
                  <Text style={[s.cardAsunto, { color: colors.textPrimary }]}>{item.asunto}</Text>
                  <Text style={[s.cardFecha, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>

                  {/* Respuesta del admin */}
                  {item.respuesta ? (
                    <View style={[s.respuestaBox, { backgroundColor: COLORS.primarySoft }]}>
                      <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.primary} />
                      <Text style={s.respuestaText}>{item.respuesta}</Text>
                    </View>
                  ) : null}

                  {/* Respuesta previa del usuario */}
                  {item.respuesta_usuario ? (
                    <View style={[s.respuestaBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                      <Ionicons name="person-circle-outline" size={14} color={colors.textSecondary} />
                      <Text style={[s.respuestaText, { color: colors.textPrimary }]}>{item.respuesta_usuario}</Text>
                    </View>
                  ) : null}

                  {/* Input para responder (solo si hay respuesta del admin) */}
                  {item.respuesta ? (
                    <View style={s.replyRow}>
                      <TextInput
                        style={[s.replyInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                        placeholder="Escribe tu respuesta..."
                        placeholderTextColor={colors.textSecondary}
                        value={textoRespuesta}
                        onChangeText={txt => setRespuestaTextos(prev => ({ ...prev, [item.id]: txt }))}
                        multiline
                      />
                      <TouchableOpacity
                        style={[s.replyBtn, { backgroundColor: COLORS.primary, opacity: estaEnviando ? 0.6 : 1 }]}
                        onPress={() => enviarRespuestaUsuario(item.id)}
                        disabled={estaEnviando}
                      >
                        {estaEnviando
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Ionicons name="send" size={16} color="#fff" />}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '500' },
  tabTextActive: { fontWeight: '700' },
  form: { padding: SPACING.lg, gap: 10 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  tiposGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tipoCard: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: RADIUS.md, borderWidth: 2 },
  tipoLabel: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 120 },
  btnEnviar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.xl, marginTop: 8 },
  btnEnviarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#F5F5F5', borderRadius: RADIUS.md, padding: 12, marginTop: 4 },
  infoText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  list: { padding: SPACING.md, gap: 10, flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  card: { flexDirection: 'row', borderRadius: RADIUS.lg, overflow: 'hidden' },
  cardBar: { width: 4 },
  cardContent: { flex: 1, padding: SPACING.md, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardTipo: { fontSize: 13, fontWeight: '700' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  cardAsunto: { fontSize: 15, fontWeight: '600' },
  cardFecha: { fontSize: 12 },
  respuestaBox: { flexDirection: 'row', gap: 6, padding: 10, borderRadius: RADIUS.md, marginTop: 6 },
  respuestaText: { flex: 1, fontSize: 13, color: COLORS.primary, lineHeight: 18 },
  replyRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
  replyInput: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, minHeight: 40, maxHeight: 100 },
  replyBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
