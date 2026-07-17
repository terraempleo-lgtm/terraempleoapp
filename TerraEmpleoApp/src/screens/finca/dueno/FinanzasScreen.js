import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { finanzasAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { formatMoney } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primarySoft: '#e5f6ec',
  purple: '#7c3aed', purpleSoft: '#f3e8ff',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  info: '#2563eb', infoSoft: '#e0edff',
  ink900: '#171a15', ink700: '#3f4438', ink600: '#565c4c', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
  yellow: '#fde74c', yellowLine: '#e6d24a', yellowBg: '#fffbe6',
  green: '#15803d', greenBg: '#dcfce7', red: '#b91c1c', redBg: '#fee2e2',
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const SECCIONES = [
  { tipo: 'ingreso', titulo: 'Ventas', color: COLORS.primary, soft: COLORS.primarySoft },
  { tipo: 'nomina', titulo: 'Nómina (manual / migrada)', color: COLORS.purple, soft: COLORS.purpleSoft },
  { tipo: 'gasto_fijo', titulo: 'Gastos fijos', color: COLORS.warning, soft: COLORS.warningSoft },
  { tipo: 'gasto_variable', titulo: 'Gastos variables', color: COLORS.danger, soft: COLORS.dangerSoft },
  { tipo: 'factura', titulo: 'Facturas', color: COLORS.info, soft: COLORS.infoSoft },
];

const keyMov = (conceptoId, semanaId) => `${conceptoId}:${semanaId ?? 'mes'}`;
const onlyNum = (s) => String(s).replace(/[^\d]/g, '');

export default function FinanzasScreen({ navigation }) {
  const { activeFinca, activeFincaId } = useFinca();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [data, setData] = useState(null);
  const [valores, setValores] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nuevoConcepto, setNuevoConcepto] = useState(null);

  const cargarTablero = useCallback(() => {
    if (!activeFincaId) return;
    setLoading(true);
    finanzasAPI.tablero({ finca_id: activeFincaId, anio, mes })
      .then((r) => {
        setData(r.data);
        const map = {};
        for (const m of r.data?.movimientos || []) map[keyMov(m.concepto_id, m.semana_id)] = String(Math.round(Number(m.monto)) || '');
        setValores(map);
      })
      .catch((e) => console.error('tablero:', e))
      .finally(() => setLoading(false));
  }, [activeFincaId, anio, mes]);

  useEffect(() => { cargarTablero(); }, [cargarTablero]);

  const semanas = data?.semanas || [];
  const conceptos = data?.conceptos || [];
  const resumen = data?.resumen || {};
  const periodo = data?.periodo || {};
  const rol = data?.rol_finca;
  const cerrado = periodo.estado === 'cerrado';
  const soloLectura = rol === 'auxiliar' || (cerrado && rol !== 'propietario');

  const porTipo = useMemo(() => {
    const g = { ingreso: [], nomina: [], gasto_fijo: [], gasto_variable: [], factura: [] };
    for (const c of conceptos) (g[c.tipo] || (g[c.tipo] = [])).push(c);
    return g;
  }, [conceptos]);

  const valNum = (conceptoId, semanaId) => Number(onlyNum(valores[keyMov(conceptoId, semanaId)] || 0)) || 0;
  const totalConcepto = (c) => (c.tipo === 'factura' ? valNum(c.id, null) : semanas.reduce((acc, s) => acc + valNum(c.id, s.id), 0));
  const totalSemana = (tipo, semanaId) => (porTipo[tipo] || []).reduce((acc, c) => acc + valNum(c.id, semanaId), 0);
  const totalTipo = (tipo) => (porTipo[tipo] || []).reduce((acc, c) => acc + totalConcepto(c), 0);

  const guardar = async (conceptoId, semanaId) => {
    if (soloLectura) return;
    const monto = Number(onlyNum(valores[keyMov(conceptoId, semanaId)] || 0)) || 0;
    try {
      setSaving(true);
      await finanzasAPI.upsertMovimiento({ concepto_id: conceptoId, periodo_id: periodo.id, semana_id: semanaId, monto });
      cargarTablero();
    } catch (e) { console.error('guardar movimiento:', e); } finally { setSaving(false); }
  };

  const crearConcepto = async (tipo, nombre) => {
    const n = (nombre || '').trim();
    if (!n) { setNuevoConcepto(null); return; }
    try { await finanzasAPI.crearConcepto({ finca_id: activeFincaId, nombre: n, tipo }); setNuevoConcepto(null); cargarTablero(); }
    catch (e) { console.error('crearConcepto:', e); }
  };

  const eliminarConcepto = (id) => {
    Alert.alert('Ocultar concepto', 'Sus movimientos quedan en el historial. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ocultar', style: 'destructive', onPress: async () => { try { await finanzasAPI.eliminarConcepto(id); cargarTablero(); } catch (e) { console.error(e); } } },
    ]);
  };

  const cambiarMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMes(m); setAnio(a);
  };

  const toggleCierre = async () => {
    try { await finanzasAPI.cambiarEstadoPeriodo(periodo.id, { estado: cerrado ? 'abierto' : 'cerrado' }); cargarTablero(); }
    catch (e) { console.error(e); }
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <CuadernoTopNav navigation={navigation} activeKey="FinanzasHome" />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const nominaManual = totalTipo('nomina');
  const nominaTotal = Number(resumen.total_nomina || 0) + nominaManual;
  const totalGastos = Number(resumen.total_gastos || 0) + nominaManual;
  const totalVentas = Number(resumen.total_ventas || 0);
  const diferencia = totalVentas - totalGastos;
  const positivo = diferencia >= 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <CuadernoTopNav navigation={navigation} activeKey="FinanzasHome" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.rowStart}>
          <View style={styles.headerIcon}><Ionicons name="cash" size={22} color="#fff" /></View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.h1}>Finanzas</Text>
            <Text style={styles.subtitle}>{activeFinca?.nombre || 'Finca'} · resumen mensual</Text>
          </View>
        </View>

        <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 8, marginTop: 12 }]}>
          <View style={styles.monthNav}>
            <Pressable onPress={() => cambiarMes(-1)} style={styles.monthBtn}><Ionicons name="chevron-back" size={16} color={COLORS.ink700} /></Pressable>
            <Text style={styles.monthLabel}>{MESES[mes - 1]} {anio}</Text>
            <Pressable onPress={() => cambiarMes(1)} style={styles.monthBtn}><Ionicons name="chevron-forward" size={16} color={COLORS.ink700} /></Pressable>
          </View>
          {rol === 'propietario' && (
            <Pressable onPress={toggleCierre} style={[styles.pillBtn, cerrado && { backgroundColor: COLORS.warningSoft }]}>
              {cerrado ? <Ionicons name="lock-open-outline" size={15} color={COLORS.warning} /> : <Ionicons name="lock-closed-outline" size={15} color={COLORS.ink700} />}
              <Text style={[styles.pillBtnText, cerrado && { color: COLORS.warning }]}>  {cerrado ? 'Reabrir' : 'Cerrar mes'}</Text>
            </Pressable>
          )}
        </View>

        {cerrado && (
          <View style={styles.cerradoBanner}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.warning} />
            <Text style={styles.cerradoText}>  Mes cerrado{rol === 'propietario' ? ' — puedes reabrirlo para editar.' : ' — solo lectura.'}</Text>
          </View>
        )}

        {SECCIONES.map((sec) => {
          const items = porTipo[sec.tipo] || [];
          const esFactura = sec.tipo === 'factura';
          return (
            <View key={sec.tipo} style={styles.seccionCard}>
              <View style={[styles.seccionHeader, { backgroundColor: sec.soft }]}>
                <Text style={[styles.seccionTitulo, { color: sec.color }]}>{sec.titulo}</Text>
                {!soloLectura && (
                  <Pressable onPress={() => setNuevoConcepto(sec.tipo)} style={styles.rowStart}>
                    <Ionicons name="add" size={14} color={sec.color} /><Text style={[styles.addConceptoText, { color: sec.color }]}>  Concepto</Text>
                  </Pressable>
                )}
              </View>

              {items.length === 0 ? (
                <Text style={styles.sinConceptos}>Sin conceptos. Agrega uno con "+ Concepto".</Text>
              ) : (
                <ScrollView horizontal>
                  <View>
                    <View style={styles.tRow}>
                      <Text style={[styles.tHead, { width: 140 }]}>Concepto</Text>
                      {esFactura ? <Text style={[styles.tHead, { width: 100, textAlign: 'right' }]}>Mensual</Text> : (
                        semanas.map((s) => <Text key={s.id} style={[styles.tHead, { width: 90, textAlign: 'right' }]}>Sem {s.numero_semana}</Text>)
                      )}
                      <Text style={[styles.tHead, styles.tHeadTotal, { width: 100, textAlign: 'right' }]}>Total mes</Text>
                    </View>
                    {items.map((c) => (
                      <View key={c.id} style={styles.tRow}>
                        <Text style={[styles.tConcepto, { width: 140 }]} numberOfLines={1}>{c.nombre}</Text>
                        {esFactura ? (
                          <Celda width={100} value={valores[keyMov(c.id, null)] || ''} disabled={soloLectura}
                            onChange={(v) => setValores((p) => ({ ...p, [keyMov(c.id, null)]: v }))} onBlur={() => guardar(c.id, null)} />
                        ) : (
                          semanas.map((s) => (
                            <Celda key={s.id} width={90} value={valores[keyMov(c.id, s.id)] || ''} disabled={soloLectura}
                              onChange={(v) => setValores((p) => ({ ...p, [keyMov(c.id, s.id)]: v }))} onBlur={() => guardar(c.id, s.id)} />
                          ))
                        )}
                        <Text style={[styles.tTotal, { width: 100, textAlign: 'right' }]}>{totalConcepto(c) ? formatMoney(totalConcepto(c)) : '—'}</Text>
                        {!soloLectura && (
                          <Pressable onPress={() => eliminarConcepto(c.id)} style={{ width: 30, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="trash-outline" size={14} color={COLORS.ink400} />
                          </Pressable>
                        )}
                      </View>
                    ))}
                    <View style={[styles.tRow, styles.tFooterRow]}>
                      <Text style={[styles.tFooterLabel, { width: 140 }]}>Total</Text>
                      {esFactura ? (
                        <Text style={[styles.tFooterValue, { width: 100, textAlign: 'right' }]}>{formatMoney(totalTipo(sec.tipo))}</Text>
                      ) : semanas.map((s) => (
                        <Text key={s.id} style={[styles.tFooterValue, { width: 90, textAlign: 'right' }]}>
                          {totalSemana(sec.tipo, s.id) ? formatMoney(totalSemana(sec.tipo, s.id)) : '—'}
                        </Text>
                      ))}
                      <Text style={[styles.tFooterValue, { width: 100, textAlign: 'right', color: sec.color }]}>{formatMoney(totalTipo(sec.tipo))}</Text>
                    </View>
                  </View>
                </ScrollView>
              )}

              {nuevoConcepto === sec.tipo && (
                <NuevoConceptoRow onCancel={() => setNuevoConcepto(null)} onSave={(n) => crearConcepto(sec.tipo, n)} />
              )}
            </View>
          );
        })}

        <View style={styles.resumenCard}>
          <View style={styles.resumenHeader}><Text style={styles.resumenHeaderText}>Resumen — {MESES[mes - 1]}</Text></View>
          <View style={{ padding: 14, gap: 6 }}>
            <Fila label="Nómina" value={nominaTotal} />
            {nominaManual > 0 && <Text style={styles.notaManual}>Incluye {formatMoney(nominaManual)} de nómina manual/migrada.</Text>}
            <Fila label="Gastos fijos" value={resumen.total_gastos_fijos} />
            <Fila label="Gastos variables" value={resumen.total_gastos_variables} />
            <Fila label="Facturas" value={resumen.total_facturas} />
            <View style={styles.sepLine}><Fila label="Total gastos" value={totalGastos} bold /></View>
            <Fila label="Total ventas" value={totalVentas} bold />
            <View style={[styles.diffBox, { backgroundColor: positivo ? COLORS.greenBg : COLORS.redBg }]}>
              <View style={styles.rowStart}>
                <Ionicons name={positivo ? 'trending-up' : 'trending-down'} size={16} color={positivo ? COLORS.green : COLORS.red} />
                <Text style={[styles.diffLabel, { color: positivo ? COLORS.green : COLORS.red }]}>  Diferencia</Text>
              </View>
              <Text style={[styles.diffValue, { color: positivo ? COLORS.green : COLORS.red }]}>{formatMoney(diferencia)}</Text>
            </View>
            <Text style={styles.resumenFoot}>{positivo ? 'Dinero a favor en el mes.' : 'Operando con pérdida este mes.'}</Text>
            <Text style={styles.resumenFootSmall}>La nómina se toma automáticamente del Cuaderno (jornadas de la finca en este mes).</Text>
          </View>
        </View>
        {saving && <Text style={styles.savingText}>Guardando…</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Celda({ value, onChange, onBlur, disabled, width }) {
  return (
    <TextInput
      style={[styles.celda, { width }, disabled && { color: COLORS.ink500 }]}
      keyboardType="numeric"
      editable={!disabled}
      value={value === '' ? '' : Number(value).toLocaleString('es-CO')}
      onChangeText={(v) => onChange(v.replace(/[^\d]/g, ''))}
      onBlur={onBlur}
      placeholder="—"
    />
  );
}

function Fila({ label, value, bold }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={bold ? styles.filaLabelBold : styles.filaLabel}>{label}</Text>
      <Text style={bold ? styles.filaValueBold : styles.filaValue}>{formatMoney(value || 0)}</Text>
    </View>
  );
}

function NuevoConceptoRow({ onSave, onCancel }) {
  const [nombre, setNombre] = useState('');
  return (
    <View style={styles.nuevoConceptoRow}>
      <TextInput autoFocus value={nombre} onChangeText={setNombre} placeholder="Nombre del concepto (ej. Aguacate)" style={styles.nuevoConceptoInput} onSubmitEditing={() => onSave(nombre)} />
      <Pressable onPress={() => onSave(nombre)} style={styles.nuevoConceptoBtnPrimary}><Text style={{ color: '#fff', fontWeight: '700' }}>Agregar</Text></Pressable>
      <Pressable onPress={onCancel} style={styles.nuevoConceptoBtnGhost}><Text style={{ color: COLORS.ink700 }}>Cancelar</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 120 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 24, fontWeight: '900', color: COLORS.ink900 },
  subtitle: { fontSize: 12, color: COLORS.ink500, marginTop: 2 },
  monthNav: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, backgroundColor: '#fff' },
  monthBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  monthLabel: { fontWeight: '700', color: COLORS.ink900, fontSize: 13, minWidth: 110, textAlign: 'center' },
  pillBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  pillBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.ink700 },
  cerradoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12, alignSelf: 'flex-start' },
  cerradoText: { fontSize: 12, fontWeight: '600', color: COLORS.warning },
  seccionCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginTop: 14, borderWidth: 1, borderColor: COLORS.line },
  seccionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  seccionTitulo: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  addConceptoText: { fontSize: 11, fontWeight: '700' },
  sinConceptos: { fontSize: 11, color: COLORS.ink400, padding: 12 },
  tRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.lineLight, paddingVertical: 4, paddingHorizontal: 8 },
  tHead: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  tHeadTotal: { backgroundColor: COLORS.lineLight },
  tConcepto: { fontSize: 12, fontWeight: '600', color: COLORS.ink700 },
  celda: { width: 90, textAlign: 'right', fontSize: 12, color: COLORS.ink900, paddingHorizontal: 6, paddingVertical: 6, backgroundColor: COLORS.lineLight, borderRadius: 6, marginRight: 2 },
  tTotal: { fontSize: 12, fontWeight: '700', color: COLORS.ink900, backgroundColor: COLORS.lineLight, paddingVertical: 6 },
  tFooterRow: { borderTopWidth: 2, borderColor: COLORS.line, backgroundColor: COLORS.lineLight },
  tFooterLabel: { fontSize: 11, fontWeight: '900', color: COLORS.ink900, textTransform: 'uppercase' },
  tFooterValue: { fontSize: 12, fontWeight: '900', color: COLORS.ink900 },
  nuevoConceptoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderTopWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.lineLight },
  nuevoConceptoInput: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: COLORS.ink900, backgroundColor: '#fff' },
  nuevoConceptoBtnPrimary: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  nuevoConceptoBtnGhost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  resumenCard: { borderRadius: 16, borderWidth: 2, borderColor: COLORS.yellowLine, backgroundColor: COLORS.yellowBg, overflow: 'hidden', marginTop: 16 },
  resumenHeader: { backgroundColor: COLORS.yellow, paddingHorizontal: 14, paddingVertical: 10 },
  resumenHeaderText: { fontWeight: '900', fontSize: 13, color: COLORS.ink900, textTransform: 'uppercase' },
  filaLabel: { color: COLORS.ink600, fontSize: 13 },
  filaValue: { fontWeight: '700', color: COLORS.ink700, fontSize: 13 },
  filaLabelBold: { fontWeight: '700', color: COLORS.ink900, fontSize: 13 },
  filaValueBold: { fontWeight: '900', color: COLORS.ink900, fontSize: 13 },
  sepLine: { borderTopWidth: 1, borderColor: COLORS.yellowLine, paddingTop: 6, marginTop: 2 },
  notaManual: { fontSize: 10, color: COLORS.purple, marginTop: -4 },
  diffBox: { marginTop: 8, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diffLabel: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  diffValue: { fontWeight: '900', fontSize: 17 },
  resumenFoot: { fontSize: 11, color: COLORS.ink500, marginTop: 4 },
  resumenFootSmall: { fontSize: 10, color: COLORS.ink400, marginTop: 6, borderTopWidth: 1, borderColor: 'rgba(230,210,74,0.6)', paddingTop: 6 },
  savingText: { fontSize: 11, color: COLORS.ink400, textAlign: 'center', marginTop: 8 },
});
