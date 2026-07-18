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

const TIPOS_NOTA = [
  { tipo: 'ingreso', label: 'Venta / Ingreso' },
  { tipo: 'nomina', label: 'Nómina (Excel)' },
  { tipo: 'gasto_fijo', label: 'Gasto fijo' },
  { tipo: 'gasto_variable', label: 'Gasto variable' },
  { tipo: 'factura', label: 'Factura' },
];

const keyMov = (conceptoId, semanaId) => `${conceptoId}:${semanaId ?? 'mes'}`;
const onlyNum = (s) => String(s).replace(/[^\d]/g, '');

function parseLineaExcel(linea) {
  const celdas = linea.split('\t').map((c) => c.trim()).filter((c) => c !== '');
  if (celdas.length < 2) return null;
  const monto = Number(celdas[celdas.length - 1].replace(/[^\d]/g, '')) || 0;
  const nombre = celdas[0];
  const medio = celdas.slice(1, -1).filter(Boolean);
  const labor = medio.find((c) => !/^[\d.,]+$/.test(c));
  const kg = medio.find((c) => /^[\d.,]+$/.test(c));
  const etiqueta = [nombre, labor].filter(Boolean).join(' — ') + (kg ? ` (${kg} kg)` : '');
  return { nombre: etiqueta, monto };
}

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

        {!soloLectura && (
          <NotaRapida
            conceptos={conceptos}
            semanas={semanas}
            movimientos={data?.movimientos || []}
            periodo={periodo}
            fincaId={activeFincaId}
            onGuardado={cargarTablero}
          />
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
    <TextInput placeholderTextColor={COLORS.ink400}
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

/**
 * Nota rápida: se escribe "Gasolina guadaña 25000" por línea, se elige el
 * tipo y el sistema crea/reutiliza el concepto y suma el valor a la semana.
 */
function NotaRapida({ conceptos, semanas, movimientos, periodo, fincaId, onGuardado }) {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('gasto_variable');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const items = useMemo(() => {
    return texto.split('\n').map((l) => l.trim()).filter(Boolean).map((linea) => {
      if (linea.includes('\t')) {
        const excel = parseLineaExcel(linea);
        if (excel) return excel;
      }
      const m = linea.match(/([\d.,]{3,})\s*$/);
      if (!m) return { nombre: linea, monto: 0 };
      const monto = Number(m[1].replace(/[.,]/g, '')) || 0;
      return { nombre: linea.slice(0, m.index).replace(/[-–:$]+\s*$/, '').trim(), monto };
    });
  }, [texto]);

  const semanaHoy = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const s = semanas.find((x) => {
      const ini = String(x.fecha_inicio || '').slice(0, 10);
      const fin = String(x.fecha_fin || '').slice(0, 10);
      return ini && fin && ini <= hoy && hoy <= fin;
    });
    return s || semanas[semanas.length - 1] || null;
  }, [semanas]);

  const [semanaElegidaId, setSemanaElegidaId] = useState(null);
  useEffect(() => { setSemanaElegidaId(semanaHoy?.id ?? null); }, [semanaHoy]);
  const semanaActual = semanas.find((s) => s.id === semanaElegidaId) || semanaHoy;

  const guardar = async () => {
    setError(''); setOk('');
    if (items.length === 0) { setError('Escribe qué fue (ej: "Gasolina guadaña 25000").'); return; }
    const sinMonto = items.find((it) => !it.nombre || !it.monto);
    if (sinMonto) { setError(`Cada línea debe terminar con el valor en pesos (revisa: "${sinMonto.nombre || '…'}").`); return; }
    setGuardando(true);
    try {
      const semanaId = tipo === 'factura' ? null : (semanaActual?.id ?? null);
      const acumulado = {};
      for (const { nombre, monto } of items) {
        let concepto = conceptos.find((c) => c.tipo === tipo && c.nombre.trim().toLowerCase() === nombre.toLowerCase());
        if (!concepto) {
          const r = await finanzasAPI.crearConcepto({ finca_id: fincaId, nombre, tipo });
          concepto = { id: r.data?.id || r.data?.concepto?.id, tipo, nombre };
          conceptos.push(concepto);
        }
        if (!concepto?.id) throw new Error('concepto sin id');
        const previo = movimientos.find((m) => m.concepto_id === concepto.id && (m.semana_id ?? null) === semanaId);
        const base = acumulado[concepto.id] ?? (Number(previo?.monto) || 0);
        const total = base + monto;
        acumulado[concepto.id] = total;
        await finanzasAPI.upsertMovimiento({ concepto_id: concepto.id, periodo_id: periodo.id, semana_id: semanaId, monto: total });
      }
      setTexto('');
      setOk(items.length === 1
        ? `Anotado: ${items[0].nombre} — ${formatMoney(items[0].monto)}.`
        : `Anotados ${items.length} ítems.`);
      onGuardado?.();
    } catch (e) {
      console.error('nota rápida:', e);
      setError(e.response?.data?.error || 'No se pudo guardar la nota.');
    } finally { setGuardando(false); }
  };

  return (
    <View style={styles.notaRapidaCard}>
      <View style={styles.rowStart}>
        <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
        <Text style={styles.notaRapidaTitle}>  Nota rápida</Text>
      </View>
      <Text style={styles.notaRapidaHint}>Escribe la factura o el gasto como en el cuaderno; el sistema lo organiza solo.</Text>
      <TextInput placeholderTextColor={COLORS.ink400}
        value={texto} onChangeText={setTexto} multiline
        placeholder={'Una línea por ítem, ej:\nGasolina guadaña 25000\nAbono cafetal 120000'}
        style={styles.notaRapidaInput}
      />
      <Pressable onPress={guardar} disabled={guardando} style={styles.notaRapidaBtn}>
        {guardando ? <ActivityIndicator size="small" color="#fff" /> : (
          <>
            <Ionicons name="sparkles" size={14} color="#fff" />
            <Text style={styles.notaRapidaBtnText}>  Anotar</Text>
          </>
        )}
      </Pressable>
      <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 6, marginTop: 10 }]}>
        {TIPOS_NOTA.map((t) => (
          <Pressable key={t.tipo} onPress={() => setTipo(t.tipo)} style={[styles.tipoNotaChip, tipo === t.tipo && styles.tipoNotaChipActivo]}>
            <Text style={[styles.tipoNotaText, tipo === t.tipo && styles.tipoNotaTextActivo]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tipo !== 'factura' && semanas.length > 0 && (
        <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 6, marginTop: 8 }]}>
          <Text style={styles.semanaLabel}>Semana:</Text>
          {semanas.map((s) => (
            <Pressable key={s.id} onPress={() => setSemanaElegidaId(s.id)} style={[styles.semanaChip, semanaElegidaId === s.id && styles.semanaChipActivo]}>
              <Text style={[styles.semanaChipText, semanaElegidaId === s.id && styles.semanaChipTextActivo]}>Sem {s.numero_semana}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {error ? <Text style={styles.notaError}>{error}</Text> : null}
      {ok ? <Text style={styles.notaOk}>{ok}</Text> : null}
    </View>
  );
}

function NuevoConceptoRow({ onSave, onCancel }) {
  const [nombre, setNombre] = useState('');
  return (
    <View style={styles.nuevoConceptoRow}>
      <TextInput placeholderTextColor={COLORS.ink400} autoFocus value={nombre} onChangeText={setNombre} placeholder="Nombre del concepto (ej. Aguacate)" style={styles.nuevoConceptoInput} onSubmitEditing={() => onSave(nombre)} />
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
  notaRapidaCard: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,141,73,0.3)', backgroundColor: COLORS.primarySoft, borderRadius: 14, padding: 14, marginTop: 14 },
  notaRapidaTitle: { fontWeight: '900', color: COLORS.ink900, fontSize: 13 },
  notaRapidaHint: { fontSize: 11, color: COLORS.ink500, marginTop: 4, marginBottom: 8 },
  notaRapidaInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 10, fontSize: 13, color: COLORS.ink900, minHeight: 70, textAlignVertical: 'top' },
  notaRapidaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 10, marginTop: 8 },
  notaRapidaBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tipoNotaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  tipoNotaChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoNotaText: { fontSize: 11, fontWeight: '700', color: COLORS.ink500 },
  tipoNotaTextActivo: { color: '#fff' },
  semanaLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  semanaChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  semanaChipActivo: { backgroundColor: COLORS.ink900, borderColor: COLORS.ink900 },
  semanaChipText: { fontSize: 11, fontWeight: '700', color: COLORS.ink500 },
  semanaChipTextActivo: { color: '#fff' },
  notaError: { fontSize: 12, color: COLORS.danger, fontWeight: '600', marginTop: 8 },
  notaOk: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 8 },
});
