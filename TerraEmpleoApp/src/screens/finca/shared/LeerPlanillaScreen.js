import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI, fincaAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import Avatar from './Avatar';
import { useToast } from './useFincaToast';

const COLORS = {
  primary: '#008d49', primaryDark: '#1B512D', primarySoft: '#e5f6ec',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

function hoyYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// La planilla trae la fecha en DD/MM/YYYY (o null) — el backend espera YYYY-MM-DD.
function fechaAYMD(fechaDDMMYYYY) {
  if (!fechaDDMMYYYY || typeof fechaDDMMYYYY !== 'string') return hoyYMD();
  const m = fechaDDMMYYYY.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return hoyYMD();
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

let filaSeq = 0;
function nuevaFila(t = {}) {
  filaSeq += 1;
  return {
    key: `fila-${filaSeq}`,
    nombre: t.nombre || '',
    cedula: t.cedula || '',
    kg_cereza: t.kg_cereza != null ? String(t.kg_cereza) : '',
    notas: t.notas || '',
    trabajador_id: t.trabajador_id || null,
    foto: t.foto || null,
  };
}

export default function LeerPlanillaScreen({ navigation }) {
  const { activeFinca, activeFincaId } = useFinca();
  const toast = useToast();
  const [estado, setEstado] = useState('camara'); // camara | cargando | revision | error
  const [errorMsg, setErrorMsg] = useState('');
  const [fecha, setFecha] = useState(hoyYMD());
  const [labor, setLabor] = useState('');
  const [filas, setFilas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { abrirCamara(); }, []);

  const abrirCamara = async () => {
    setErrorMsg('');
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setEstado('error');
      setErrorMsg('Necesitamos permiso de cámara para fotografiar la planilla.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) {
      navigation.goBack();
      return;
    }
    procesarFoto(res.assets[0].base64);
  };

  const procesarFoto = async (base64) => {
    setEstado('cargando');
    try {
      const r = await cuadernoAPI.leerPlanilla(base64);
      const data = r.data;
      setFecha(fechaAYMD(data.fecha));
      setLabor(data.labor || '');
      setFilas((data.trabajadores || []).map(nuevaFila));
      setEstado('revision');
    } catch (e) {
      setErrorMsg(
        e.response?.data?.error ||
        'No pudimos leer la planilla. Asegúrese de tomar la foto con buena luz y que la planilla esté completamente visible.'
      );
      setEstado('error');
    }
  };

  const actualizarFila = (key, campo, valor) => {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)));
  };
  const quitarFila = (key) => setFilas((prev) => prev.filter((f) => f.key !== key));
  const agregarFilaVacia = () => setFilas((prev) => [...prev, nuevaFila()]);

  const confirmarYGuardar = async () => {
    const filasValidas = filas.filter((f) => f.nombre.trim());
    if (filasValidas.length === 0) {
      toast.error('Agrega al menos un trabajador con nombre.');
      return;
    }
    setGuardando(true);
    try {
      const fincas = await fincaAPI.misFincas();
      const fincaNombre = activeFinca?.nombre || fincas.data?.fincas?.[0]?.nombre || null;
      const precioKilo = activeFinca?.precio_kilo_default ? Number(activeFinca.precio_kilo_default) : null;

      const jr = await cuadernoAPI.crearJornada({
        fecha, titulo: labor || 'Jornada (planilla)', finca: fincaNombre,
        tipo_trabajo: labor || null, tipo_pago_default: 'por_kilo',
        precio_kilo: precioKilo, observaciones: 'Cargada desde foto de planilla',
      });
      const jornadaId = jr.data?.id;
      if (!jornadaId) throw new Error('sin id de jornada');

      for (const f of filasValidas) {
        const ar = await cuadernoAPI.agregarAsistencia(jornadaId, f.trabajador_id
          ? { trabajador_id: f.trabajador_id }
          : { manual_nombre: f.nombre.trim() });
        const asisId = ar.data?.id;
        if (!asisId) continue;
        await cuadernoAPI.actualizarAsistencia(asisId, { estado: 'llego' });
        await cuadernoAPI.upsertRegistro(asisId, {
          cantidad_kg: f.kg_cereza ? Number(f.kg_cereza) : null,
          tipo_pago: 'por_kilo',
          precio_kilo: precioKilo,
          estado: 'completo',
          notas: [f.cedula ? `Cédula: ${f.cedula}` : null, f.notas || null].filter(Boolean).join(' · ') || null,
          pagado: 0,
        });
      }

      toast.success('Planilla guardada — revisa los precios en el cuaderno.');
      navigation.replace('DetalleJornada', { jornadaId });
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo guardar la jornada.');
    } finally { setGuardando(false); }
  };

  if (estado === 'cargando') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.cargandoText}>Leyendo la planilla...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (estado === 'error') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centro}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.btnPrimary} onPress={abrirCamara}>
            <Text style={styles.btnPrimaryText}>Intentar de nuevo</Text>
          </Pressable>
          <Pressable style={{ marginTop: 12 }} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelarText}>Cancelar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (estado !== 'revision') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centro}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}><Ionicons name="close" size={24} color={COLORS.ink900} /></Pressable>
        <Text style={styles.headerTitle}>Revisar planilla</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.hint}>Confirma o corrige los datos leídos antes de guardar. Los campos en rojo no se pudieron leer.</Text>

        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Fecha</Text>
            <TextInput placeholderTextColor={COLORS.ink400} style={[styles.input, !fecha && styles.inputError]} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Labor</Text>
            <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={labor} onChangeText={setLabor} placeholder="Ej: Recolección" />
          </View>
        </View>

        {filas.map((f) => (
          <View key={f.key} style={styles.filaCard}>
            <View style={styles.filaHeader}>
              <Avatar src={f.foto} name={f.nombre} size={32} />
              {f.trabajador_id && (
                <View style={styles.vinculadoBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                  <Text style={styles.vinculadoText}>  Vinculado</Text>
                </View>
              )}
              <Pressable onPress={() => quitarFila(f.key)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                <Ionicons name="trash-outline" size={16} color={COLORS.ink400} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput placeholderTextColor={COLORS.ink400}
              style={[styles.input, !f.nombre.trim() && styles.inputError]}
              value={f.nombre} onChangeText={(v) => actualizarFila(f.key, 'nombre', v)} placeholder="Nombre completo"
            />
            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Cédula</Text>
                <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={f.cedula} onChangeText={(v) => actualizarFila(f.key, 'cedula', v)} keyboardType="numeric" placeholder="—" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Kg cereza</Text>
                <TextInput placeholderTextColor={COLORS.ink400}
                  style={[styles.input, !f.kg_cereza && styles.inputError]}
                  value={f.kg_cereza} onChangeText={(v) => actualizarFila(f.key, 'kg_cereza', v)} keyboardType="decimal-pad" placeholder="0"
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Notas</Text>
            <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={f.notas} onChangeText={(v) => actualizarFila(f.key, 'notas', v)} placeholder="Descuentos, anticipos, observaciones…" />
          </View>
        ))}

        <Pressable style={styles.agregarBtn} onPress={agregarFilaVacia}>
          <Ionicons name="add" size={16} color={COLORS.primary} />
          <Text style={styles.agregarText}>  Agregar trabajador</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.btnGhost} onPress={abrirCamara} disabled={guardando}>
          <Ionicons name="camera-outline" size={16} color={COLORS.ink700} />
          <Text style={styles.btnGhostText}>  Volver a tomar</Text>
        </Pressable>
        <Pressable style={styles.btnPrimarySmall} onPress={confirmarYGuardar} disabled={guardando}>
          {guardando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Confirmar y guardar</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cargandoText: { marginTop: 14, fontSize: 15, fontWeight: '700', color: COLORS.ink700 },
  errorText: { marginTop: 12, fontSize: 14, color: COLORS.ink700, textAlign: 'center', lineHeight: 20 },
  cancelarText: { color: COLORS.ink500, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: COLORS.line },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink900 },
  container: { padding: 16, paddingBottom: 24, gap: 4 },
  hint: { fontSize: 12, color: COLORS.ink500, marginBottom: 10, lineHeight: 17 },
  rowGap: { flexDirection: 'row', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.ink900, backgroundColor: '#fff' },
  inputError: { borderColor: COLORS.danger, borderWidth: 1.5 },
  filaCard: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 12, marginTop: 14 },
  filaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vinculadoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  vinculadoText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  agregarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 10, marginTop: 14 },
  agregarText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderColor: COLORS.line },
  btnGhost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 12 },
  btnGhostText: { color: COLORS.ink700, fontWeight: '700', fontSize: 13 },
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  btnPrimarySmall: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
