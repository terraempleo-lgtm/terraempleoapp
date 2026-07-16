import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { muroAPI, chatsAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const FILTROS = [
  { key: 'todo', label: 'Todo' },
  { key: 'venta', label: 'Venden' },
  { key: 'compra', label: 'Compran' },
  { key: 'mias', label: 'Mis publicaciones' },
];

export default function MuroScreen({ navigation }) {
  const { user } = useAuth();
  const [publicaciones, setPublicaciones] = useState([]);
  const [filtro, setFiltro] = useState('todo');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async (mostrarSpinner = true) => {
    if (mostrarSpinner) setLoading(true);
    try {
      const params = {};
      if (filtro === 'venta' || filtro === 'compra') params.tipo = filtro;
      if (filtro === 'mias') params.mias = 1;
      if (busqueda.trim()) params.busqueda = busqueda.trim();
      const res = await muroAPI.listar(params);
      setPublicaciones(res.data?.publicaciones || []);
    } catch (err) {
      console.error('Error cargando muro:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro, busqueda]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const contactar = async (pubId) => {
    try {
      const res = await muroAPI.contactar(pubId);
      const chatId = res.data?.chat_id || res.data?.chatId || res.data?.id;
      if (chatId) navigation.navigate('Mensajes', { screen: 'ChatDetalle', params: { chatId } });
    } catch (err) {
      console.error('Error contactando:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Muro de mercado</Text>
        <TouchableOpacity style={styles.publicarBtn} onPress={() => navigation.navigate('PublicarMuro')}>
          <Ionicons name="add" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Buscar en el muro..."
        value={busqueda}
        onChangeText={setBusqueda}
        onEndEditing={() => cargar()}
      />

      <View style={styles.filtros}>
        {FILTROS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setFiltro(f.key)} style={[styles.filtroChip, filtro === f.key && styles.filtroChipActive]}>
            <Text style={[styles.filtroText, filtro === f.key && styles.filtroTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={publicaciones}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(false); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No hay publicaciones aún.</Text>}
          renderItem={({ item: p }) => (
            <View style={styles.card}>
              {p.foto_url ? <Image source={{ uri: p.foto_url }} style={styles.foto} /> : null}
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.tipoBadge}>{p.tipo === 'venta' ? 'Vende' : 'Compra'}</Text>
                  <Text style={styles.producto}>{p.producto}</Text>
                </View>
                <Text style={styles.precio}>${Number(p.precio || 0).toLocaleString('es-CO')} / {p.unidad}</Text>
                <Text style={styles.cantidad}>{p.cantidad} {p.unidad} · {p.ubicacion}</Text>
                {p.descripcion ? <Text style={styles.desc}>{p.descripcion}</Text> : null}
                <View style={styles.cardFooter}>
                  <Text style={styles.autor}>{p.autor_nombre}</Text>
                  {Number(p.usuario_id) === Number(user?.id) ? (
                    <TouchableOpacity onPress={() => muroAPI.eliminar(p.id).then(() => cargar())}>
                      <Text style={styles.eliminarText}>Eliminar</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.contactarBtn} onPress={() => contactar(p.id)}>
                      <Text style={styles.contactarText}>{p.tipo === 'venta' ? 'Lo quiero' : 'Lo tengo'} · Ir al chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  title: { ...FONTS.title, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  publicarBtn: { backgroundColor: COLORS.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: SPACING.lg, marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, backgroundColor: COLORS.white },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  filtroChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  filtroChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filtroText: { fontSize: 12, color: COLORS.textPrimary },
  filtroTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  empty: { color: COLORS.textLight, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.sm },
  foto: { width: '100%', height: 160, backgroundColor: COLORS.borderLight },
  cardBody: { padding: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipoBadge: { fontSize: 10, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  producto: { fontWeight: '700', color: COLORS.textPrimary },
  precio: { fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  cantidad: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  desc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  autor: { fontSize: 12, color: COLORS.textLight },
  contactarBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill },
  contactarText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  eliminarText: { color: COLORS.error, fontSize: 12, fontWeight: '600' },
});
