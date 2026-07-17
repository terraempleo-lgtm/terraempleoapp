import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../../../theme';
import { muroAPI } from '../../../services/api';

const PRODUCTOS = ['Café pergamino', 'Café cereza', 'Plátano', 'Yuca', 'Aguacate', 'Panela', 'Otro'];
const UNIDADES = ['kg', 'arroba', 'carga', 'bulto', 'unidad'];

export default function PublicarMuroScreen({ navigation }) {
  const [tipo, setTipo] = useState('venta');
  const [producto, setProducto] = useState('');
  const [productoOtro, setProductoOtro] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const elegirFoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) setFoto(res.assets[0].uri);
  };

  const publicar = async () => {
    const productoFinal = producto === 'Otro' ? productoOtro : producto;
    if (!productoFinal.trim()) return;
    setGuardando(true);
    try {
      await muroAPI.crear({ tipo, producto: productoFinal.trim(), cantidad, precio, unidad, ubicacion, descripcion }, foto);
      navigation.goBack();
    } catch (err) {
      console.error('Error publicando:', err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Nueva publicación</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.tipoRow}>
          <TouchableOpacity onPress={() => setTipo('venta')} style={[styles.tipoBtn, tipo === 'venta' && styles.tipoBtnActive]}>
            <Text style={[styles.tipoText, tipo === 'venta' && styles.tipoTextActive]}>Vendo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTipo('compra')} style={[styles.tipoBtn, tipo === 'compra' && styles.tipoBtnActive]}>
            <Text style={[styles.tipoText, tipo === 'compra' && styles.tipoTextActive]}>Compro</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Producto</Text>
        <View style={styles.chipsRow}>
          {PRODUCTOS.map(p => (
            <TouchableOpacity key={p} onPress={() => setProducto(p)} style={[styles.chip, producto === p && styles.chipActive]}>
              <Text style={[styles.chipText, producto === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {producto === 'Otro' && (
          <TextInput style={styles.input} placeholder="¿Cuál producto?" value={productoOtro} onChangeText={setProductoOtro} />
        )}

        <Text style={styles.label}>Cantidad</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={cantidad} onChangeText={setCantidad} placeholder="Ej: 10" />

        <Text style={styles.label}>Unidad</Text>
        <View style={styles.chipsRow}>
          {UNIDADES.map(u => (
            <TouchableOpacity key={u} onPress={() => setUnidad(u)} style={[styles.chip, unidad === u && styles.chipActive]}>
              <Text style={[styles.chipText, unidad === u && styles.chipTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Precio (COP)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={precio} onChangeText={setPrecio} placeholder="Ej: 15000" />

        <Text style={styles.label}>Ubicación</Text>
        <TextInput style={styles.input} value={ubicacion} onChangeText={setUbicacion} placeholder="Vereda, municipio" />

        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput style={[styles.input, { minHeight: 70 }]} multiline value={descripcion} onChangeText={setDescripcion} />

        <TouchableOpacity style={styles.fotoBtn} onPress={elegirFoto}>
          {foto ? <Image source={{ uri: foto }} style={styles.fotoPreview} /> : (
            <>
              <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
              <Text style={styles.fotoBtnText}>Agregar foto</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={publicar} disabled={guardando}>
          {guardando ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>Publicar</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 8 },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },
  tipoRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  tipoBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  tipoBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoText: { fontWeight: '600', color: COLORS.textPrimary },
  tipoTextActive: { color: COLORS.white },
  label: { color: COLORS.textPrimary, fontWeight: '600', marginBottom: 6, marginTop: SPACING.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textPrimary },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, color: COLORS.textPrimary, backgroundColor: COLORS.white },
  fotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg },
  fotoBtnText: { color: COLORS.primary, fontWeight: '600' },
  fotoPreview: { width: '100%', height: 160, borderRadius: RADIUS.md },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: SPACING.xl },
  saveText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
