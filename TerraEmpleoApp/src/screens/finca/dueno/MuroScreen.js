import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { muroAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import Avatar from '../shared/Avatar';
import { useToast } from '../shared/useFincaToast';
import { formatMoney, asText } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primarySoft: '#e5f6ec',
  info: '#2563eb', infoSoft: '#e0edff',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const FILTROS = [
  { key: 'todas', label: 'Todo' },
  { key: 'venta', label: 'Venden' },
  { key: 'compra', label: 'Compran' },
  { key: 'mias', label: 'Mis publicaciones' },
];

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function PublicacionCard({ p, userId, onContactar, onCerrar, onEliminar, contactando }) {
  const esVenta = p.tipo === 'venta';
  const esMia = Number(p.usuario_id) === Number(userId);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar src={p.autor_foto} name={p.autor_nombre} size={36} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.autorNombre} numberOfLines={1}>{asText(p.autor_nombre)}</Text>
          <View style={styles.rowStart}>
            <Text style={styles.metaText}>{formatRelative(p.created_at)}</Text>
            {p.ubicacion ? <Text style={styles.metaText}>  · 📍 {p.ubicacion}</Text> : null}
          </View>
        </View>
        <View style={[styles.tipoBadge, { backgroundColor: esVenta ? COLORS.primarySoft : COLORS.infoSoft }]}>
          <Text style={[styles.tipoBadgeText, { color: esVenta ? COLORS.primary : COLORS.info }]}>{esVenta ? 'Vende' : 'Busca comprar'}</Text>
        </View>
      </View>

      <Text style={styles.producto}>{p.producto}</Text>
      <View style={styles.rowStart}>
        {p.precio != null && <Text style={styles.precio}>{formatMoney(p.precio)}</Text>}
        {p.precio != null && p.unidad ? <Text style={styles.metaText}>  por {p.unidad}</Text> : null}
        {p.cantidad ? <Text style={styles.metaText}>  · {p.cantidad} {p.unidad || ''} disponibles</Text> : null}
      </View>
      {p.descripcion ? <Text style={styles.descripcion}>{p.descripcion}</Text> : null}
      {p.foto_url ? <Image source={{ uri: p.foto_url }} style={styles.foto} /> : null}

      <View style={styles.cardFooter}>
        {esMia ? (
          <>
            <Text style={styles.tuyaText}>Tu publicación</Text>
            <Pressable onPress={() => onCerrar(p)} style={styles.btnOutlineSmall}><Text style={styles.btnOutlineSmallText}>Cerrar</Text></Pressable>
            <Pressable onPress={() => onEliminar(p)} style={{ padding: 8 }}><Ionicons name="trash-outline" size={15} color={COLORS.ink400} /></Pressable>
          </>
        ) : (
          <Pressable onPress={() => onContactar(p)} disabled={contactando === p.id} style={styles.btnPrimary}>
            {contactando === p.id ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={styles.btnPrimaryText}>{esVenta ? '🛒 Comprar · Ir al chat' : '💬 Lo tengo · Ir al chat'}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function MuroScreen({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();
  const [publicaciones, setPublicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [contactando, setContactando] = useState(null);

  const cargar = (pagina = 1, append = false) => {
    if (!append) setLoading(true);
    const params = { page: pagina };
    if (filtro === 'venta' || filtro === 'compra') params.tipo = filtro;
    if (filtro === 'mias') params.mias = '1';
    if (busqueda.trim().length >= 2) params.busqueda = busqueda.trim();
    muroAPI.listar(params)
      .then((r) => {
        const nuevas = r.data?.publicaciones || [];
        setPublicaciones((prev) => (append ? [...prev, ...nuevas] : nuevas));
        setHayMas(!!r.data?.hay_mas);
        setPage(pagina);
      })
      .catch((e) => { console.error(e); if (!append) setPublicaciones([]); })
      .finally(() => setLoading(false));
  };

  useFocusEffect(React.useCallback(() => { cargar(1, false); }, [filtro]));
  useEffect(() => {
    const t = setTimeout(() => cargar(1, false), busqueda ? 350 : 0);
    return () => clearTimeout(t);
  }, [busqueda]);

  const contactar = async (p) => {
    setContactando(p.id);
    try {
      const r = await muroAPI.contactar(p.id);
      const chatId = r.data?.chat_id;
      if (chatId) {
        toast.success('Chat abierto con el vendedor');
        navigation.navigate('Mensajes', { screen: 'ChatDetalle', params: { chatId } });
      } else {
        toast.error('No se pudo abrir el chat');
      }
    } catch (err) { toast.error(err.response?.data?.error || 'No se pudo contactar'); }
    finally { setContactando(null); }
  };

  const cerrarPublicacion = (p) => {
    Alert.alert('Cerrar publicación', '¿Ya se vendió / cerrar esta publicación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar', onPress: async () => { try { await muroAPI.actualizar(p.id, { estado: 'cerrada' }); toast.success('Publicación cerrada'); cargar(1, false); } catch { toast.error('No se pudo cerrar'); } } },
    ]);
  };
  const eliminarPublicacion = (p) => {
    Alert.alert('¿Eliminar publicación?', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await muroAPI.eliminar(p.id); toast.success('Publicación eliminada'); cargar(1, false); } catch { toast.error('No se pudo eliminar'); } } },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.rowStart}>
          <View style={styles.headerIcon}><Ionicons name="storefront" size={20} color="#fff" /></View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.h1}>Mercado</Text>
            <Text style={styles.subtitle}>Compra y vende entre agricultores</Text>
          </View>
        </View>
        <Pressable onPress={() => navigation.navigate('PublicarMuro')} style={styles.publicarBtn}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <TextInput placeholderTextColor={COLORS.ink400} style={styles.search} placeholder="Buscar café, plátano…" value={busqueda} onChangeText={setBusqueda} />
      <View style={styles.filtrosRow}>
        {FILTROS.map((t) => (
          <Pressable key={t.key} onPress={() => setFiltro(t.key)} style={[styles.filtroChip, filtro === t.key && styles.filtroChipActivo]}>
            <Text style={[styles.filtroChipText, filtro === t.key && styles.filtroChipTextActivo]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} /> : publicaciones.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={40} color={COLORS.primary} />
          <Text style={styles.emptyTitle}>{filtro === 'mias' ? 'Aún no has publicado nada' : 'Aún no hay publicaciones'}</Text>
          <Pressable onPress={() => navigation.navigate('PublicarMuro')} style={styles.btnPrimarySmall}>
            <Text style={styles.btnPrimarySmallText}>Publicar lo primero</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={publicaciones}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <PublicacionCard p={item} userId={user?.id} onContactar={contactar} onCerrar={cerrarPublicacion} onEliminar={eliminarPublicacion} contactando={contactando} />
          )}
          ListFooterComponent={hayMas ? (
            <Pressable onPress={() => cargar(page + 1, true)} style={styles.btnOutlineSmall}><Text style={styles.btnOutlineSmallText}>Ver más</Text></Pressable>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 20, fontWeight: '900', color: COLORS.ink900 },
  subtitle: { fontSize: 11, color: COLORS.ink500 },
  publicarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.ink900, backgroundColor: '#fff' },
  filtrosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  filtroChip: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  filtroChipActivo: { backgroundColor: '#c1ff72', borderColor: '#c1ff72' },
  filtroChipText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  filtroChipTextActivo: { color: COLORS.ink900 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontWeight: '700', color: COLORS.ink900, marginTop: 10, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 6 },
  autorNombre: { fontWeight: '700', fontSize: 13, color: COLORS.ink900 },
  metaText: { fontSize: 11, color: COLORS.ink500 },
  tipoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  tipoBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  producto: { fontWeight: '900', color: COLORS.ink900, fontSize: 16, paddingHorizontal: 12, marginTop: 2 },
  precio: { fontSize: 18, fontWeight: '900', color: '#006635', paddingHorizontal: 12, marginTop: 2 },
  descripcion: { fontSize: 13, color: COLORS.ink700, paddingHorizontal: 12, marginTop: 4 },
  foto: { width: '100%', height: 200, marginTop: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderColor: COLORS.line, marginTop: 8 },
  tuyaText: { fontSize: 12, fontWeight: '600', color: COLORS.ink500, flex: 1 },
  btnOutlineSmall: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  btnOutlineSmallText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnPrimarySmall: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  btnPrimarySmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
