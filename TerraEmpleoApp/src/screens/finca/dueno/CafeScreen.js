import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cafeAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { formatMoney, formatDate } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  info: '#2563eb', infoSoft: '#e0edff',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const num = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const SEV = {
  ok: { label: 'OK', soft: COLORS.primarySoft, color: COLORS.primary },
  revisar: { label: 'Revisar', soft: COLORS.warningSoft, color: COLORS.warning },
  critica: { label: 'Crítica', soft: COLORS.dangerSoft, color: COLORS.danger },
};
const ESTADO_ALERTA = { abierta: 'Abierta', justificada: 'Justificada', cerrada: 'Cerrada' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function infoSemana(desdeStr, hastaStr) {
  if (!desdeStr) return null;
  const desde = new Date(`${desdeStr}T00:00:00`);
  const hasta = hastaStr ? new Date(`${hastaStr}T00:00:00`) : desde;
  if (Number.isNaN(desde.getTime())) return null;
  const semana = Math.ceil(desde.getDate() / 7);
  const mismoMes = desde.getMonth() === hasta.getMonth() && desde.getFullYear() === hasta.getFullYear();
  const mes = MESES[hasta.getMonth()];
  const rango = mismoMes
    ? (desde.getDate() === hasta.getDate() ? `${desde.getDate()}` : `${desde.getDate()} al ${hasta.getDate()}`)
    : `${desde.getDate()} de ${MESES[desde.getMonth()]} al ${hasta.getDate()} de ${mes}`;
  return { texto: `${rango} de ${mes} de ${hasta.getFullYear()}`, semana };
}

function hoyYMD() { return new Date().toISOString().slice(0, 10); }

export default function CafeScreen({ navigation, route }) {
  const { activeFinca, activeFincaId } = useFinca();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openLote, setOpenLote] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const rangoInicial = route.params?.desde && route.params?.hasta ? { desde: route.params.desde, hasta: route.params.hasta } : null;

  useEffect(() => { if (rangoInicial) setNuevo(true); }, []);

  const cargar = useCallback(() => {
    if (!activeFincaId) return;
    setLoading(true);
    cafeAPI.listarLotes({ finca_id: activeFincaId })
      .then((r) => setLotes(r.data?.lotes || []))
      .catch((e) => console.error('lotes:', e))
      .finally(() => setLoading(false));
  }, [activeFincaId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const abiertas = lotes.filter((l) => ['revisar', 'critica'].includes(l.severidad) && l.alerta_estado === 'abierta');
  const criticas = abiertas.filter((l) => l.severidad === 'critica').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <CuadernoTopNav navigation={navigation} activeKey="CafeHome" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.rowBetween}>
          <View style={styles.rowStart}>
            <View style={styles.headerIcon}><Ionicons name="cafe" size={22} color="#fff" /></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.h1}>Café · Conversión</Text>
              <Text style={styles.subtitle}>Cereza → pergamino seco y control antifraude</Text>
            </View>
          </View>
          <Pressable onPress={() => setNuevo(true)} style={styles.btnPrimary}>
            <Ionicons name="add" size={16} color="#fff" /><Text style={styles.btnPrimaryText}>  Nuevo lote</Text>
          </Pressable>
        </View>

        {abiertas.length > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: criticas > 0 ? COLORS.dangerSoft : COLORS.warningSoft }]}>
            <Ionicons name="warning" size={22} color={criticas > 0 ? COLORS.danger : COLORS.warning} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.alertTitle, { color: criticas > 0 ? COLORS.danger : COLORS.warning }]}>
                {abiertas.length} {abiertas.length === 1 ? 'alerta abierta' : 'alertas abiertas'} de conversión
              </Text>
              <Text style={styles.alertSub}>{criticas > 0 ? `${criticas} crítica(s) — posible pérdida o hurto. ` : ''}Revisa los lotes marcados abajo.</Text>
            </View>
          </View>
        )}

        {activeFinca && (
          <View style={[styles.wrapRow, { marginTop: 12, marginBottom: 12 }]}>
            <Text style={styles.factorText}>Factor: <Text style={styles.factorBold}>{num(activeFinca.factor_conversion)} kg cereza = 1 kg pergamino</Text></Text>
            <Text style={styles.factorText}>Arroba: <Text style={styles.factorBold}>{num(activeFinca.kg_por_arroba)} kg</Text></Text>
            <Text style={styles.factorText}>Carga: <Text style={styles.factorBold}>{num(activeFinca.kg_por_carga)} kg</Text></Text>
            <Text style={styles.factorText}>Umbral: <Text style={styles.factorBold}>{num(activeFinca.umbral_merma_pct)}%</Text></Text>
          </View>
        )}

        {activeFinca && <CalculadoraRapida finca={activeFinca} />}

        {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.primary} /> : lotes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cafe-outline" size={32} color={COLORS.ink400} />
            <Text style={styles.emptyText}>Aún no has creado lotes de café.</Text>
            <Text style={styles.emptyHint}>Crea un lote eligiendo un rango de fechas: el sistema suma la cereza recolectada en el Cuaderno y estima el pergamino.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {lotes.map((l) => (
              <LoteCard key={l.id} lote={l} open={openLote === l.id} onToggle={() => setOpenLote(openLote === l.id ? null : l.id)} onChanged={cargar} />
            ))}
          </View>
        )}
      </ScrollView>

      {nuevo && (
        <NuevoLoteModal finca={activeFinca} rangoInicial={rangoInicial} onClose={() => setNuevo(false)} onCreated={() => { setNuevo(false); cargar(); }} />
      )}
    </SafeAreaView>
  );
}

function CalculadoraRapida({ finca }) {
  const [kg, setKg] = useState('');
  const cereza = Number(kg) || 0;
  const factor = Number(finca.factor_conversion) || 5;
  const kgArroba = Number(finca.kg_por_arroba) || 12.5;
  const kgCarga = Number(finca.kg_por_carga) || 125;
  const pergamino = cereza / factor;

  return (
    <View style={styles.calcCard}>
      <Text style={styles.calcTitle}>⚖️ Calculadora cereza → pergamino</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={kg} onChangeText={setKg} placeholder="Kg recogidos en cereza" />
      <View style={styles.calcGrid}>
        <View style={styles.calcBox}><Text style={styles.calcLabel}>Pergamino</Text><Text style={styles.calcValue}>{num(pergamino)} kg</Text></View>
        <View style={styles.calcBox}><Text style={styles.calcLabel}>Arrobas</Text><Text style={styles.calcValue}>{num(pergamino / kgArroba)} @</Text></View>
        <View style={styles.calcBox}><Text style={styles.calcLabel}>Cargas</Text><Text style={styles.calcValue}>{num(pergamino / kgCarga)}</Text></View>
      </View>
    </View>
  );
}

function LoteCard({ lote, open, onToggle, onChanged }) {
  const sev = SEV[lote.severidad] || SEV.ok;
  const tieneReal = Number(lote.reg_reales || 0) > 0;
  const semana = infoSemana(lote.rango_desde || lote.fecha, lote.rango_hasta || lote.fecha);
  return (
    <View style={styles.loteCard}>
      <Pressable onPress={onToggle} style={styles.rowStart}>
        <View style={{ flex: 1 }}>
          <View style={styles.wrapRow}>
            <Text style={styles.loteTitulo}>{lote.descripcion || `Lote del ${formatDate(lote.fecha)}`}</Text>
            {semana && <Text style={styles.semanaTag}>Semana {semana.semana} · {semana.texto}</Text>}
            {tieneReal && (
              <View style={[styles.sevBadge, { backgroundColor: sev.soft }]}>
                <Text style={[styles.sevBadgeText, { color: sev.color }]}>{sev.label}{Number(lote.diferencia_pct) > 0 ? ` · ${num(lote.diferencia_pct)}% merma` : ''}</Text>
              </View>
            )}
          </View>
          <Text style={styles.loteMeta}>
            {num(lote.total_kg_cereza)} kg cereza → {num(lote.kg_pergamino_estimado)} kg pergamino · {num(lote.arrobas_estimadas)} @
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.ink400} />
      </Pressable>
      {open && <LoteDetalle loteId={lote.id} onChanged={onChanged} />}
    </View>
  );
}

function LoteDetalle({ loteId, onChanged }) {
  const { rolFinca } = useFinca();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ kg_pergamino_real: '', destino: 'venta', precio_venta: '', comprador: '' });
  const [just, setJust] = useState({ estado: 'justificada', justificacion: '' });

  const cargar = useCallback(() => {
    cafeAPI.detalleLote(loteId).then((r) => { setData(r.data); setJust((j) => ({ ...j, justificacion: r.data?.alerta?.justificacion || '' })); }).catch((e) => console.error(e));
  }, [loteId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!data) return <ActivityIndicator style={{ marginTop: 12 }} color={COLORS.primary} />;
  const { lote, reales, alerta } = data;
  const sev = SEV[alerta?.severidad] || SEV.ok;

  const agregarReal = async () => {
    if (!(Number(form.kg_pergamino_real) > 0)) return;
    try {
      await cafeAPI.registrarReal(loteId, {
        kg_pergamino_real: Number(form.kg_pergamino_real), destino: form.destino,
        precio_venta: form.precio_venta ? Number(form.precio_venta) : null, comprador: form.comprador || null, fecha: lote.fecha,
      });
      setForm({ kg_pergamino_real: '', destino: 'venta', precio_venta: '', comprador: '' });
      cargar(); onChanged?.();
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo registrar'); }
  };
  const borrarReal = (id) => {
    Alert.alert('¿Eliminar registro?', '', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await cafeAPI.eliminarReal(id); cargar(); onChanged?.(); } catch (e) { console.error(e); } } }]);
  };
  const guardarAlerta = async () => {
    try { await cafeAPI.gestionarAlerta(loteId, just); cargar(); onChanged?.(); } catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar'); }
  };

  return (
    <View style={styles.loteDetalle}>
      <View style={styles.miniGrid}>
        <Mini label="Cereza" value={`${num(lote.total_kg_cereza)} kg`} />
        <Mini label="Pergamino estimado" value={`${num(lote.kg_pergamino_estimado)} kg`} />
        <Mini label="Real registrado" value={`${num(alerta?.real_kg)} kg`} />
        <Mini label="Merma" value={alerta && Number(alerta.real_kg) > 0 ? `${num(alerta.diferencia_pct)}%` : '—'} color={sev.color} />
      </View>

      {alerta && Number(alerta.real_kg) > 0 && alerta.severidad !== 'ok' && (
        <View style={[styles.alertBox, { backgroundColor: sev.soft }]}>
          <Text style={[styles.alertBoxText, { color: sev.color }]}>
            Diferencia significativa. Estimaste {num(alerta.estimado_kg)} kg pergamino y registraste {num(alerta.real_kg)} kg ({num(alerta.diferencia_kg)} kg menos).
          </Text>
        </View>
      )}

      <Text style={styles.miniTitle}>Producción real (báscula)</Text>
      {reales.length === 0 ? <Text style={styles.emptyHint}>Aún no registras lo vendido/almacenado.</Text> : (
        reales.map((r) => (
          <View key={r.id} style={styles.realRow}>
            <Text style={styles.realText}>{num(r.kg_pergamino_real)} kg · {r.destino === 'venta' ? 'Venta' : 'Almacén'}{r.comprador ? ` · ${r.comprador}` : ''}{r.precio_venta ? ` · ${formatMoney(r.precio_venta)}` : ''}</Text>
            <Pressable onPress={() => borrarReal(r.id)}><Ionicons name="trash-outline" size={14} color={COLORS.ink400} /></Pressable>
          </View>
        ))
      )}
      <View style={styles.formRow}>
        <TextInput style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" placeholder="Kg pergamino" value={form.kg_pergamino_real} onChangeText={(v) => setForm((f) => ({ ...f, kg_pergamino_real: v }))} />
        <Pressable onPress={() => setForm((f) => ({ ...f, destino: f.destino === 'venta' ? 'almacen' : 'venta' }))} style={styles.destinoBtn}>
          <Text style={styles.destinoBtnText}>{form.destino === 'venta' ? 'Venta' : 'Almacén'}</Text>
        </Pressable>
      </View>
      <View style={styles.formRow}>
        <TextInput style={[styles.input, { flex: 1 }]} keyboardType="numeric" placeholder="Precio (opc.)" value={form.precio_venta} onChangeText={(v) => setForm((f) => ({ ...f, precio_venta: v }))} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Comprador (opc.)" value={form.comprador} onChangeText={(v) => setForm((f) => ({ ...f, comprador: v }))} />
      </View>
      <Pressable onPress={agregarReal} style={styles.btnPrimarySmall}><Text style={styles.btnPrimarySmallText}>Registrar</Text></Pressable>

      {alerta && rolFinca === 'propietario' && (
        <View style={styles.gestionBox}>
          <Text style={styles.miniTitle}>🛡️ Gestión de alerta</Text>
          <View style={styles.wrapRow}>
            {['abierta', 'justificada', 'cerrada'].map((e) => (
              <Pressable key={e} onPress={() => setJust((j) => ({ ...j, estado: e }))} style={[styles.estadoChip, just.estado === e && styles.estadoChipActivo]}>
                <Text style={[styles.estadoChipText, just.estado === e && styles.estadoChipTextActivo]}>{ESTADO_ALERTA[e]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Justificación (ej. merma por lluvia)" value={just.justificacion} onChangeText={(v) => setJust((j) => ({ ...j, justificacion: v }))} />
          <Pressable onPress={guardarAlerta} style={styles.btnPrimarySmall}><Text style={styles.btnPrimarySmallText}>Guardar</Text></Pressable>
        </View>
      )}
    </View>
  );
}

function Mini({ label, value, color }) {
  return (
    <View style={styles.miniBox}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, color && { color }]}>{value}</Text>
    </View>
  );
}

function NuevoLoteModal({ finca, rangoInicial, onClose, onCreated }) {
  const [form, setForm] = useState({
    fecha: rangoInicial?.hasta || hoyYMD(),
    rango_desde: rangoInicial?.desde || '',
    rango_hasta: rangoInicial?.hasta || '',
    descripcion: rangoInicial ? 'Semana enviada desde Nómina' : '',
  });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!finca || !form.rango_desde || !form.rango_hasta) { setPreview(null); return; }
    let alive = true;
    cafeAPI.preview({ finca_id: finca.id, desde: form.rango_desde, hasta: form.rango_hasta }).then((r) => alive && setPreview(r.data)).catch(() => alive && setPreview(null));
    return () => { alive = false; };
  }, [finca, form.rango_desde, form.rango_hasta]);

  const crear = async () => {
    if (!form.fecha) return;
    setSaving(true);
    try { await cafeAPI.crearLote({ finca_id: finca.id, ...form }); onCreated(); }
    catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo crear el lote'); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <ScrollView>
          <Text style={styles.modalTitle}>Nuevo lote de café</Text>
          <Text style={styles.fieldLabel}>Fecha del lote (AAAA-MM-DD)</Text>
          <TextInput style={styles.input} value={form.fecha} onChangeText={(v) => setForm((f) => ({ ...f, fecha: v }))} />
          <Text style={styles.fieldLabel}>Recolección desde</Text>
          <TextInput style={styles.input} value={form.rango_desde} onChangeText={(v) => setForm((f) => ({ ...f, rango_desde: v }))} placeholder="2026-07-01" />
          <Text style={styles.fieldLabel}>Recolección hasta</Text>
          <TextInput style={styles.input} value={form.rango_hasta} onChangeText={(v) => setForm((f) => ({ ...f, rango_hasta: v }))} placeholder="2026-07-07" />
          <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
          <TextInput style={styles.input} value={form.descripcion} onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))} />

          <View style={styles.previewBox}>
            {preview ? (
              <Text style={styles.previewText}>
                {num(preview.total_kg_cereza)} kg cereza → {num(preview.kg_pergamino_estimado)} kg pergamino · {num(preview.arrobas_estimadas)} @ · {num(preview.cargas_estimadas)} cargas
              </Text>
            ) : (
              <Text style={styles.emptyHint}>Elige un rango de fechas para ver la estimación de pergamino.</Text>
            )}
          </View>

          <View style={[styles.rowStart, { justifyContent: 'flex-end', gap: 8, marginTop: 12 }]}>
            <Pressable onPress={onClose} style={styles.btnGhostSmall}><Text style={styles.btnGhostSmallText}>Cancelar</Text></Pressable>
            <Pressable onPress={crear} disabled={saving || !form.fecha} style={styles.btnPrimarySmall}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimarySmallText}>Crear lote</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 40 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 20, fontWeight: '900', color: COLORS.ink900 },
  subtitle: { fontSize: 12, color: COLORS.ink500 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, marginTop: 14 },
  alertTitle: { fontWeight: '900', fontSize: 13 },
  alertSub: { fontSize: 11, color: COLORS.ink600, marginTop: 2 },
  factorText: { fontSize: 11, color: COLORS.ink500 },
  factorBold: { fontWeight: '700', color: COLORS.ink700 },
  calcCard: { borderWidth: 2, borderColor: 'rgba(0,141,73,0.15)', borderRadius: 14, padding: 14, marginBottom: 14 },
  calcTitle: { fontWeight: '800', fontSize: 13, color: COLORS.ink900, marginBottom: 8 },
  calcGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  calcBox: { flex: 1, backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 10, alignItems: 'center' },
  calcLabel: { fontSize: 9, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  calcValue: { fontSize: 15, fontWeight: '900', color: COLORS.primaryDark },
  emptyCard: { alignItems: 'center', padding: 30 },
  emptyText: { fontSize: 13, color: COLORS.ink500, marginTop: 8 },
  emptyHint: { fontSize: 11, color: COLORS.ink400, textAlign: 'center', marginTop: 4 },
  loteCard: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 14 },
  loteTitulo: { fontWeight: '800', color: COLORS.ink900, fontSize: 13 },
  semanaTag: { fontSize: 10, fontWeight: '700', color: COLORS.info, backgroundColor: COLORS.infoSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  sevBadgeText: { fontSize: 10, fontWeight: '700' },
  loteMeta: { fontSize: 11, color: COLORS.ink500, marginTop: 4 },
  loteDetalle: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: COLORS.line },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  miniBox: { width: '47%', backgroundColor: COLORS.lineLight, borderRadius: 10, padding: 10 },
  miniLabel: { fontSize: 9, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  miniValue: { fontSize: 14, fontWeight: '900', color: COLORS.ink900, marginTop: 2 },
  miniTitle: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  alertBox: { borderRadius: 10, padding: 10, marginBottom: 10 },
  alertBoxText: { fontSize: 12, fontWeight: '600' },
  realRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: COLORS.lineLight },
  realText: { fontSize: 12, color: COLORS.ink700, flex: 1 },
  formRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, backgroundColor: '#fff', marginTop: 6 },
  destinoBtn: { backgroundColor: COLORS.primarySoft, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  destinoBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  btnPrimarySmall: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  btnPrimarySmallText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnGhostSmall: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  btnGhostSmallText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  gestionBox: { marginTop: 10, backgroundColor: COLORS.lineLight, borderRadius: 10, padding: 10 },
  estadoChip: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  estadoChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  estadoChipText: { fontSize: 11, fontWeight: '700', color: COLORS.ink700 },
  estadoChipTextActivo: { color: '#fff' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, maxHeight: '85%' },
  modalTitle: { fontWeight: '900', fontSize: 16, color: COLORS.ink900, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  previewBox: { backgroundColor: COLORS.primarySoft, borderRadius: 10, padding: 10, marginTop: 10 },
  previewText: { fontSize: 12, color: COLORS.ink700 },
});
