import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Image, Alert, ActivityIndicator, Modal, Pressable, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { serviciosAPI } from '../../services/api';
import { CULTIVOS } from '../../data/options';

const W = Dimensions.get('window').width;

const MODALIDADES = ['Por proyecto', 'Por visita', 'Por mes', 'Por hora', 'Negociable'];

export default function MisServiciosScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cultivos, setCultivos] = useState([]);
  const [precioDesde, setPrecioDesde] = useState('');
  const [precioHasta, setPrecioHasta] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [fotos, setFotos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  useFocusEffect(useCallback(() => { cargar(); }, []));

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await serviciosAPI.misServicios();
      Alert.alert('Debug', `Status: ${res.status} | Servicios: ${res.data?.servicios?.length ?? 'null'} | Data: ${JSON.stringify(res.data).slice(0,200)}`);
      setServicios(res.data.servicios || []);
    } catch (e) {
      const d = e?.response?.data;
      const msg = `${e?.response?.status} - ${d?.error || e?.message} | ${d?.detail || ''} | code: ${d?.code || ''}`;
      Alert.alert('Error cargando servicios', msg);
    } finally {
      setCargando(false);
    }
  };

  const abrirNuevo = () => {
    setTitulo(''); setDescripcion(''); setCultivos([]); setPrecioDesde('');
    setPrecioHasta(''); setModalidad(''); setFotos([]); setEditandoId(null);
    setModal(true);
  };

  const abrirEditar = (s) => {
    setTitulo(s.titulo); setDescripcion(s.descripcion || '');
    setCultivos(s.cultivos || []); setPrecioDesde(s.precio_desde ? String(s.precio_desde) : '');
    setPrecioHasta(s.precio_hasta ? String(s.precio_hasta) : '');
    setModalidad(s.modalidad || ''); setFotos([]); setEditandoId(s.id);
    setModal(true);
  };

  const agregarFoto = async () => {
    if (fotos.length >= 4) { Alert.alert('Máximo 4 fotos'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) {
      setFotos(prev => [...prev, res.assets[0]]);
    }
  };

  const guardar = async () => {
    if (!titulo.trim()) { Alert.alert('Falta el título del servicio'); return; }
    try {
      setGuardando(true);
      if (editandoId) {
        await serviciosAPI.editar(editandoId, {
          titulo, descripcion, cultivos,
          precio_desde: precioDesde || null, precio_hasta: precioHasta || null, modalidad,
        });
        for (const f of fotos) {
          await serviciosAPI.agregarFoto(editandoId, f.uri);
        }
      } else {
        const r = await serviciosAPI.crear(
          { titulo, descripcion, cultivos, precio_desde: precioDesde, precio_hasta: precioHasta, modalidad },
          fotos
        );
        Alert.alert('Debug crear', `Status: ${r?.status} | id: ${r?.data?.id} | servicio.id: ${r?.data?.servicio?.id} | msg: ${r?.data?.message}`);
      }
      setModal(false);
      cargar();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo guardar el servicio';
      Alert.alert('Error', msg);
    } finally {
      setGuardando(false);
    }
  };

  const archivar = (item) => {
    const nuevaAction = item.activo ? 'archivar' : 'activar';
    Alert.alert(
      item.activo ? 'Archivar servicio' : 'Activar servicio',
      item.activo
        ? 'El servicio dejará de aparecer en el feed. Puedes reactivarlo cuando quieras.'
        : '¿Activar este servicio para que aparezca en el feed de empleadores?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: item.activo ? 'Archivar' : 'Activar', onPress: async () => {
          await serviciosAPI.archivar(item.id, item.activo ? 0 : 1);
          cargar();
        }},
      ]
    );
  };

  const eliminar = (id) => {
    Alert.alert('Eliminar servicio', '¿Estás seguro? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await serviciosAPI.eliminar(id);
          cargar();
        } catch (e) {
          Alert.alert('Error', e?.response?.data?.error || 'No se pudo eliminar');
        }
      }},
    ]);
  };

  const toggleCultivo = (c) => {
    setCultivos(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  return (
    <SafeAreaView style={[st.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header */}
      <View style={[st.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Mis Servicios</Text>
        <TouchableOpacity onPress={abrirNuevo} style={[st.addBtn, { backgroundColor: COLORS.primary }]} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={st.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : servicios.length === 0 ? (
        <View style={st.centered}>
          <LinearGradient colors={[COLORS.primary + '20', COLORS.primary + '05']} style={st.emptyIcon}>
            <Ionicons name="briefcase-outline" size={44} color={COLORS.primary} />
          </LinearGradient>
          <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sin servicios aún</Text>
          <Text style={[st.emptySub, { color: colors.textMuted }]}>Publica tu primer servicio para que los empleadores te encuentren</Text>
          <TouchableOpacity onPress={abrirNuevo} style={[st.emptyBtn, { backgroundColor: COLORS.primary }]} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={st.emptyBtnTxt}>Crear servicio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={servicios}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: SPACING.md, gap: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[st.card, { backgroundColor: colors.surface, opacity: item.activo ? 1 : 0.72 }]}>
              {/* Badge activo/archivado */}
              {!item.activo && (
                <View style={st.archivadoBadge}>
                  <Ionicons name="archive-outline" size={12} color="#6B7280" />
                  <Text style={st.archivadoBadgeTxt}>Archivado</Text>
                </View>
              )}
              {item.fotos?.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.fotosScroll}>
                  {item.fotos.map((f, i) => (
                    <Image key={i} source={{ uri: f.url }} style={st.fotoThumb} />
                  ))}
                </ScrollView>
              )}
              <View style={st.cardBody}>
                <Text style={[st.cardTitulo, { color: colors.textPrimary }]}>{item.titulo}</Text>
                {item.cultivos?.length > 0 && (
                  <View style={st.chips}>
                    {item.cultivos.map((c, i) => (
                      <View key={i} style={[st.chip, { backgroundColor: COLORS.primary + '18' }]}>
                        <Text style={[st.chipTxt, { color: COLORS.primary }]}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {item.descripcion ? (
                  <Text style={[st.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>{item.descripcion}</Text>
                ) : null}
                {(item.precio_desde || item.precio_hasta) && (
                  <Text style={[st.cardPrecio, { color: COLORS.primary }]}>
                    {item.precio_desde ? `Desde $${Number(item.precio_desde).toLocaleString()}` : ''}
                    {item.precio_hasta ? ` – $${Number(item.precio_hasta).toLocaleString()}` : ''} COP
                  </Text>
                )}
                {item.modalidad ? (
                  <View style={[st.chip, { backgroundColor: '#E0F2FE', alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[st.chipTxt, { color: '#0284C7' }]}>{item.modalidad}</Text>
                  </View>
                ) : null}
              </View>
              <View style={[st.cardActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity onPress={() => abrirEditar(item)} style={st.actionBtn} activeOpacity={0.7}>
                  <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                  <Text style={[st.actionTxt, { color: COLORS.primary }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => archivar(item)} style={st.actionBtn} activeOpacity={0.7}>
                  <Ionicons name={item.activo ? 'archive-outline' : 'eye-outline'} size={16} color="#6B7280" />
                  <Text style={[st.actionTxt, { color: '#6B7280' }]}>{item.activo ? 'Archivar' : 'Activar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => eliminar(item.id)} style={st.actionBtn} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={[st.actionTxt, { color: '#EF4444' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal crear/editar */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <View style={[st.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[st.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModal(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[st.modalTitle, { color: colors.textPrimary }]}>{editandoId ? 'Editar servicio' : 'Nuevo servicio'}</Text>
            <TouchableOpacity onPress={guardar} disabled={guardando} activeOpacity={0.85}
              style={[st.saveBtn, { backgroundColor: COLORS.primary }]}>
              {guardando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.saveBtnTxt}>Guardar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={st.modalScroll} contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60, gap: 16 }}>
            {/* Título */}
            <View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Nombre del servicio *</Text>
              <TextInput
                style={[st.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
                value={titulo} onChangeText={setTitulo}
                placeholder="Ej: Asesoría en café de especialidad"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Descripción */}
            <View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Descripción del trabajo</Text>
              <TextInput
                style={[st.input, st.textArea, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
                value={descripcion} onChangeText={setDescripcion}
                placeholder="Describe qué incluye tu servicio, qué haces y cómo trabajas..."
                placeholderTextColor={colors.textMuted}
                multiline numberOfLines={4}
              />
            </View>

            {/* Cultivos */}
            <View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Cultivos / Áreas relacionadas</Text>
              <View style={st.chipsWrap}>
                {CULTIVOS.map((c) => (
                  <TouchableOpacity key={c} onPress={() => toggleCultivo(c)} activeOpacity={0.7}
                    style={[st.chipSel, { backgroundColor: cultivos.includes(c) ? COLORS.primary : colors.surface, borderColor: cultivos.includes(c) ? COLORS.primary : colors.border }]}>
                    <Text style={[st.chipSelTxt, { color: cultivos.includes(c) ? '#fff' : colors.textSecondary }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Modalidad */}
            <View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Modalidad de cobro</Text>
              <View style={st.chipsWrap}>
                {MODALIDADES.map((m) => (
                  <TouchableOpacity key={m} onPress={() => setModalidad(modalidad === m ? '' : m)} activeOpacity={0.7}
                    style={[st.chipSel, { backgroundColor: modalidad === m ? '#0284C7' : colors.surface, borderColor: modalidad === m ? '#0284C7' : colors.border }]}>
                    <Text style={[st.chipSelTxt, { color: modalidad === m ? '#fff' : colors.textSecondary }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Precio */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: colors.textSecondary }]}>Precio desde (COP)</Text>
                <TextInput
                  style={[st.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
                  value={precioDesde} onChangeText={setPrecioDesde}
                  placeholder="Opcional" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.label, { color: colors.textSecondary }]}>Precio hasta (COP)</Text>
                <TextInput
                  style={[st.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
                  value={precioHasta} onChangeText={setPrecioHasta}
                  placeholder="Opcional" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
            </View>

            {/* Fotos */}
            <View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Fotos del trabajo (máx. 4)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {fotos.map((f, i) => (
                    <View key={i} style={st.fotoPreviewWrap}>
                      <Image source={{ uri: f.uri }} style={st.fotoPreview} />
                      <TouchableOpacity style={st.fotoRemove} onPress={() => setFotos(prev => prev.filter((_, j) => j !== i))}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {fotos.length < 4 && (
                    <TouchableOpacity onPress={agregarFoto} style={[st.fotoAdd, { borderColor: colors.border, backgroundColor: colors.surface }]} activeOpacity={0.8}>
                      <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                      <Text style={[st.fotoAddTxt, { color: COLORS.primary }]}>Agregar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 12, gap: 10, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { borderRadius: 16, overflow: 'hidden', ...SHADOWS.medium, position: 'relative' },
  archivadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, position: 'absolute', top: 10, right: 10, zIndex: 2, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  archivadoBadgeTxt: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  fotosScroll: { height: 140 },
  fotoThumb: { width: 160, height: 140, resizeMode: 'cover' },
  cardBody: { padding: SPACING.md, gap: 6 },
  cardTitulo: { fontSize: 17, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  cardDesc: { fontSize: 13, lineHeight: 19 },
  cardPrecio: { fontSize: 13, fontWeight: '700' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionTxt: { fontSize: 14, fontWeight: '600' },
  // Modal
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12, borderBottomWidth: 1 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalScroll: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 11 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipSel: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipSelTxt: { fontSize: 13, fontWeight: '600' },
  fotoPreviewWrap: { position: 'relative' },
  fotoPreview: { width: 90, height: 90, borderRadius: 12 },
  fotoRemove: { position: 'absolute', top: -6, right: -6 },
  fotoAdd: { width: 90, height: 90, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  fotoAddTxt: { fontSize: 11, fontWeight: '600' },
});
