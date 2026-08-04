import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fincaAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import CalendarioModal from '../../../components/ui/CalendarioModal';
import { formatMoney, formatDate } from '../../../utils/fincaFormat';

// Inventario de herramientas, maquinaria y vehículos: UNA sola tabla con
// totales arriba (no una tarjeta por herramienta), como en un cuaderno de
// inventario. Tocar una fila abre su historial de mantenimientos.

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const TIPOS = [
  { key: 'herramienta_manual', label: 'Herramienta' },
  { key: 'maquinaria', label: 'Maquinaria' },
  { key: 'vehiculo', label: 'Vehículo' },
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.key, t.label]));

const gastoMant = (h) => (h.mantenimientos || []).reduce((s, m) => s + (Number(m.costo) || 0), 0);

export default function HerramientasScreen({ navigation }) {
  const { activeFincaId, esCapataz } = useFinca();
  const [herramientas, setHerramientas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'herramienta_manual', fecha_compra: '', costo_compra: '' });
  const [showFecha, setShowFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    if (!activeFincaId) { setLoading(false); return; }
    fincaAPI.listarHerramientas(activeFincaId)
      .then((r) => setHerramientas(r.data?.herramientas || []))
      .catch((e) => console.error('herramientas:', e))
      .finally(() => setLoading(false));
  }, [activeFincaId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const crear = async () => {
    if (!form.nombre.trim()) { Alert.alert('Falta el nombre', 'Escribe el nombre de la herramienta.'); return; }
    setGuardando(true);
    try {
      await fincaAPI.crearHerramienta(activeFincaId, {
        nombre: form.nombre.trim(), tipo: form.tipo,
        fecha_compra: form.fecha_compra || null,
        costo_compra: form.costo_compra ? Number(form.costo_compra) : null,
      });
      setForm({ nombre: '', tipo: 'herramienta_manual', fecha_compra: '', costo_compra: '' });
      setFormOpen(false);
      cargar();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar.');
    } finally { setGuardando(false); }
  };

  const eliminar = (h) => {
    Alert.alert('¿Eliminar del inventario?', `¿Eliminar "${h.nombre}" y su historial de mantenimientos?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await fincaAPI.eliminarHerramienta(h.id); cargar(); } catch (e) { console.error(e); } } },
    ]);
  };

  const totalCompra = herramientas.reduce((s, h) => s + (Number(h.costo_compra) || 0), 0);
  const totalMant = herramientas.reduce((s, h) => s + gastoMant(h), 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {!esCapataz && <CuadernoTopNav navigation={navigation} activeKey="Herramientas" />}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.rowBetween}>
          <View style={styles.rowStart}>
            <View style={styles.headerIcon}><Ionicons name="hammer" size={20} color="#fff" /></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.h1}>Herramientas</Text>
              <Text style={styles.subtitle}>Inventario de la finca en un solo cuadro</Text>
            </View>
          </View>
          <Pressable onPress={() => setFormOpen((o) => !o)} style={styles.btnPrimary}>
            <Ionicons name={formOpen ? 'close' : 'add'} size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>  {formOpen ? 'Cerrar' : 'Agregar'}</Text>
          </Pressable>
        </View>

        {/* Totales del inventario */}
        <View style={styles.totalesRow}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>En inventario</Text>
            <Text style={styles.totalValue}>{herramientas.length}</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Invertido en compra</Text>
            <Text style={styles.totalValue}>{formatMoney(totalCompra)}</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>En mantenimiento</Text>
            <Text style={styles.totalValue}>{formatMoney(totalMant)}</Text>
          </View>
        </View>

        {formOpen && (
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={form.nombre} onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))} placeholder="Ej: Guadaña Stihl" />
            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.wrapRow}>
              {TIPOS.map((t) => (
                <Pressable key={t.key} onPress={() => setForm((f) => ({ ...f, tipo: t.key }))} style={[styles.chip, form.tipo === t.key && styles.chipActivo]}>
                  <Text style={[styles.chipText, form.tipo === t.key && styles.chipTextActivo]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.rowStart, { gap: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Fecha de compra</Text>
                <Pressable style={styles.fechaBtn} onPress={() => setShowFecha(true)}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.fechaBtnText}>  {form.fecha_compra ? formatDate(form.fecha_compra) : 'Elegir (opcional)'}</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Costo de compra</Text>
                <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric" value={form.costo_compra} onChangeText={(v) => setForm((f) => ({ ...f, costo_compra: v.replace(/[^\d]/g, '') }))} placeholder="0" />
              </View>
            </View>
            <Pressable onPress={crear} disabled={guardando} style={[styles.btnPrimary, { alignSelf: 'flex-start', marginTop: 10 }]}>
              {guardando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>Guardar en inventario</Text>}
            </Pressable>
            <CalendarioModal visible={showFecha} fecha={form.fecha_compra} titulo="Fecha de compra" onClose={() => setShowFecha(false)} onSelect={(f) => setForm((x) => ({ ...x, fecha_compra: f }))} />
          </View>
        )}

        {loading ? <ActivityIndicator style={{ marginTop: 30 }} size="large" color={COLORS.primary} /> : herramientas.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="hammer-outline" size={32} color={COLORS.ink400} />
            <Text style={styles.emptyText}>Aún no has agregado herramientas.</Text>
            <Text style={styles.emptyHint}>Con el botón "Agregar" registras guadañas, fumigadoras, despulpadoras, vehículos…</Text>
          </View>
        ) : (
          <ScrollView horizontal style={{ marginTop: 4 }}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 160 }]}>Nombre</Text>
                <Text style={[styles.th, { width: 100 }]}>Tipo</Text>
                <Text style={[styles.th, { width: 90 }]}>Compra</Text>
                <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>Costo</Text>
                <Text style={[styles.th, { width: 110 }]}>Últ. manten.</Text>
                <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>$ Manten.</Text>
                <Text style={[styles.th, { width: 60 }]}> </Text>
              </View>
              {herramientas.map((h) => (
                <View key={h.id}>
                  <Pressable style={styles.tableRow} onPress={() => setAbierta(abierta === h.id ? null : h.id)}>
                    <Text style={[styles.tdName, { width: 160 }]} numberOfLines={1}>{h.nombre}</Text>
                    <Text style={[styles.td, { width: 100 }]}>{TIPO_LABEL[h.tipo] || h.tipo}</Text>
                    <Text style={[styles.td, { width: 90 }]}>{h.fecha_compra ? formatDate(h.fecha_compra) : '—'}</Text>
                    <Text style={[styles.td, { width: 100, textAlign: 'right' }]}>{h.costo_compra ? formatMoney(h.costo_compra) : '—'}</Text>
                    <Text style={[styles.td, { width: 110 }]}>{h.ultimo_mantenimiento_fecha ? formatDate(h.ultimo_mantenimiento_fecha) : '—'}</Text>
                    <Text style={[styles.td, { width: 100, textAlign: 'right' }]}>{gastoMant(h) ? formatMoney(gastoMant(h)) : '—'}</Text>
                    <View style={{ width: 60, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                      <Pressable onPress={() => eliminar(h)} hitSlop={6}><Ionicons name="trash-outline" size={14} color={COLORS.ink400} /></Pressable>
                      <Ionicons name={abierta === h.id ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.ink400} />
                    </View>
                  </Pressable>
                  {abierta === h.id && <MantenimientosRow herramienta={h} onChanged={cargar} />}
                </View>
              ))}
              <View style={[styles.tableRow, styles.tableFooter]}>
                <Text style={[styles.tdBold, { width: 160 }]}>TOTAL</Text>
                <Text style={{ width: 100 }} />
                <Text style={{ width: 90 }} />
                <Text style={[styles.tdBold, { width: 100, textAlign: 'right' }]}>{formatMoney(totalCompra)}</Text>
                <Text style={{ width: 110 }} />
                <Text style={[styles.tdBold, { width: 100, textAlign: 'right' }]}>{formatMoney(totalMant)}</Text>
                <Text style={{ width: 60 }} />
              </View>
            </View>
          </ScrollView>
        )}

        <Text style={styles.footNote}>Toca una fila para ver o anotar sus mantenimientos.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MantenimientosRow({ herramienta, onChanged }) {
  const [fecha, setFecha] = useState('');
  const [costo, setCosto] = useState('');
  const [desc, setDesc] = useState('');
  const [showFecha, setShowFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const agregar = async () => {
    if (!fecha) { Alert.alert('Falta la fecha', 'Elige la fecha del mantenimiento.'); return; }
    setGuardando(true);
    try {
      await fincaAPI.crearMantenimiento(herramienta.id, { fecha, costo: costo ? Number(costo) : null, descripcion: desc || null });
      setFecha(''); setCosto(''); setDesc('');
      onChanged?.();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar.');
    } finally { setGuardando(false); }
  };

  const borrar = (m) => {
    Alert.alert('¿Eliminar mantenimiento?', '', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await fincaAPI.eliminarMantenimiento(herramienta.id, m.id); onChanged?.(); } catch (e) { console.error(e); } } },
    ]);
  };

  return (
    <View style={styles.mantBox}>
      {(herramienta.mantenimientos || []).length === 0 ? (
        <Text style={styles.emptyHint}>Sin mantenimientos anotados.</Text>
      ) : (
        herramienta.mantenimientos.map((m) => (
          <View key={m.id} style={styles.mantRow}>
            <Text style={styles.mantText}>{formatDate(m.fecha)}{m.descripcion ? ` · ${m.descripcion}` : ''}{m.costo ? ` · ${formatMoney(m.costo)}` : ''}</Text>
            <Pressable onPress={() => borrar(m)} hitSlop={6}><Ionicons name="trash-outline" size={13} color={COLORS.ink400} /></Pressable>
          </View>
        ))
      )}
      <View style={[styles.rowStart, { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
        <Pressable style={styles.fechaBtn} onPress={() => setShowFecha(true)}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
          <Text style={styles.fechaBtnText}>  {fecha ? formatDate(fecha) : 'Fecha'}</Text>
        </Pressable>
        <TextInput placeholderTextColor={COLORS.ink400} style={[styles.input, { width: 90 }]} keyboardType="numeric" placeholder="Costo" value={costo} onChangeText={(v) => setCosto(v.replace(/[^\d]/g, ''))} />
        <TextInput placeholderTextColor={COLORS.ink400} style={[styles.input, { flex: 1, minWidth: 120 }]} placeholder="Qué se le hizo" value={desc} onChangeText={setDesc} />
        <Pressable onPress={agregar} disabled={guardando} style={styles.btnSmall}>
          {guardando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnSmallText}>Anotar</Text>}
        </Pressable>
      </View>
      <CalendarioModal visible={showFecha} fecha={fecha} titulo="Fecha del mantenimiento" onClose={() => setShowFecha(false)} onSelect={setFecha} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 120 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 20, fontWeight: '900', color: COLORS.ink900 },
  subtitle: { fontSize: 12, color: COLORS.ink500 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  totalesRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 12 },
  totalCard: { flex: 1, backgroundColor: COLORS.lineLight, borderRadius: 12, padding: 10 },
  totalLabel: { fontSize: 9, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  totalValue: { fontSize: 15, fontWeight: '900', color: COLORS.ink900, marginTop: 2 },
  formCard: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,141,73,0.3)', borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: COLORS.primarySoft },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: COLORS.ink900, backgroundColor: '#fff' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  chipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.ink500 },
  chipTextActivo: { color: '#fff' },
  fechaBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#fff' },
  fechaBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  emptyCard: { alignItems: 'center', padding: 30 },
  emptyText: { fontSize: 13, color: COLORS.ink500, marginTop: 8 },
  emptyHint: { fontSize: 11, color: COLORS.ink400, textAlign: 'center', marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.lineLight, borderBottomWidth: 1, borderColor: COLORS.line, paddingVertical: 8 },
  th: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: COLORS.lineLight },
  tableFooter: { borderTopWidth: 2, borderColor: COLORS.line, backgroundColor: COLORS.lineLight },
  td: { fontSize: 12, color: COLORS.ink700, paddingHorizontal: 6 },
  tdName: { fontSize: 12, fontWeight: '700', color: COLORS.ink900, paddingHorizontal: 6 },
  tdBold: { fontSize: 12, fontWeight: '900', color: COLORS.ink900, paddingHorizontal: 6 },
  mantBox: { backgroundColor: COLORS.lineLight, borderRadius: 10, padding: 10, marginVertical: 4, width: 720 },
  mantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  mantText: { fontSize: 12, color: COLORS.ink700, flex: 1 },
  btnSmall: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  btnSmallText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  footNote: { fontSize: 11, color: COLORS.ink400, marginTop: 10 },
});
