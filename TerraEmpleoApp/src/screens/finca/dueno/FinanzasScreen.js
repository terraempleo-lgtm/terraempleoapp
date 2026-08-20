import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { finanzasAPI, fincaAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import { TUTORIALES } from '../../../context/TutorialContext';
import useTutorialPrimeraVez from '../../../hooks/useTutorialPrimeraVez';
import TutorialOverlay from '../../../components/tutorial/TutorialOverlay';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { formatMoney, normalizarTexto } from '../../../utils/fincaFormat';
import { useFechaRef, setMesRef } from '../../../context/periodoStore';

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
  { tipo: 'nomina', titulo: 'Nómina manual · nombre y pago por semana', color: COLORS.purple, soft: COLORS.purpleSoft },
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
const toggleInArray = (arr, val) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

function parseLineaExcel(linea, tipo) {
  const celdas = linea.split('\t').map((c) => c.trim()).filter((c) => c !== '');
  if (celdas.length < 2) return null;
  const monto = Number(celdas[celdas.length - 1].replace(/[^\d]/g, '')) || 0;
  const nombre = celdas[0];
  // Nómina: solo nombre y monto — el detalle de labor/kg hacía la tabla
  // demasiado larga (pedido: "nombre y a pagar por semana, únicamente").
  if (tipo === 'nomina') return { nombre, monto };
  const medio = celdas.slice(1, -1).filter(Boolean);
  const labor = medio.find((c) => !/^[\d.,]+$/.test(c));
  const kg = medio.find((c) => /^[\d.,]+$/.test(c));
  const etiqueta = [nombre, labor].filter(Boolean).join(' — ') + (kg ? ` (${kg} kg)` : '');
  return { nombre: etiqueta, monto };
}

// Los conceptos de nómina viejos quedaron como "Nombre — Labor (kg)" — en la
// tabla se muestra solo el nombre para mantenerla corta.
function nombreCortoConcepto(c) {
  if (c.tipo !== 'nomina') return c.nombre;
  return String(c.nombre).split(' — ')[0].split(' (')[0];
}

export default function FinanzasScreen({ navigation }) {
  const { activeFinca, activeFincaId } = useFinca();
  // Mes/año desde la fecha de referencia global — se conserva al pasar a
  // Jornadas, Nómina o Cuaderno y volver (antes se devolvía al mes actual).
  const fechaRef = useFechaRef();
  const anio = fechaRef.getFullYear();
  const mes = fechaRef.getMonth() + 1;
  const [data, setData] = useState(null);
  const [valores, setValores] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nuevoConcepto, setNuevoConcepto] = useState(null);
  const [lotesFinca, setLotesFinca] = useState([]);

  // Lotes de la finca (parcelas físicas, NO lotes de café/beneficio) para
  // etiquetar gastos/ingresos. Cultivo se deriva de los lotes — mismo
  // criterio que CerrarJornadaScreen/JornadaSemanalScreen — porque no hay
  // un catálogo de cultivos propio en el perfil de la finca.
  useEffect(() => {
    if (!activeFincaId) { setLotesFinca([]); return; }
    fincaAPI.listarLotesFinca(activeFincaId)
      .then((r) => setLotesFinca(r.data?.lotes || []))
      .catch(() => setLotesFinca([]));
  }, [activeFincaId]);
  const cultivosFinca = useMemo(() => [...new Set(lotesFinca.map((l) => l.cultivo).filter(Boolean))], [lotesFinca]);

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

  // Tutorial de primera vez de Finanzas — independiente del de Cuaderno.
  // Solo llega aquí quien tiene acceso a la sección (la navegación del
  // capataz no incluye Finanzas), y solo se abre si nunca lo ha visto.
  const scrollTutorialRef = useRef(null);
  const mesRef = useRef(null);
  const cierreRef = useRef(null);
  const notaRef = useRef(null);
  const ventasRef = useRef(null);
  const resumenRef = useRef(null);
  const [ventasY, setVentasY] = useState(0);
  const [resumenY, setResumenY] = useState(0);
  const { mostrar: mostrarTutorial, finalizar: finalizarTutorial, saltar: saltarTutorial } =
    useTutorialPrimeraVez(TUTORIALES.FINANZAS, { listo: !loading && !!data });

  const pasosTutorial = [
    {
      icon: 'cash', title: '¡Bienvenido a Finanzas!',
      text: 'Aquí llevas las cuentas del mes de tu finca: ventas, nómina, gastos y facturas, organizadas por semanas.',
    },
    {
      targetRef: mesRef, scrollY: 0, icon: 'calendar-outline', title: 'Elige el mes',
      text: 'Con las flechas cambias de mes; cada mes tiene su propio tablero de cuentas.',
    },
    rol === 'propietario' && {
      targetRef: cierreRef, scrollY: 0, icon: 'lock-closed-outline', title: 'Cierra el mes',
      text: 'Cuando termines de anotar, cierra el mes para que las cifras queden protegidas. Puedes reabrirlo cuando quieras.',
    },
    !soloLectura && {
      targetRef: notaRef, icon: 'document-text-outline', title: 'Nota rápida',
      text: 'Escribe el gasto como en el cuaderno físico — por ejemplo "Gasolina guadaña 25000" — elige el tipo y el sistema lo organiza solo.',
    },
    {
      targetRef: ventasRef, scrollY: Math.max(0, ventasY - 80), icon: 'grid-outline', title: 'Tablas por categoría',
      text: 'Ventas, nómina manual, gastos fijos, gastos variables y facturas. Anota los valores por semana; los totales se calculan solos.',
    },
    {
      targetRef: resumenRef, scrollY: Math.max(0, resumenY - 60), icon: 'wallet-outline', title: 'Resumen del mes',
      text: 'El balance final: total de gastos frente a ventas y la diferencia. La nómina de las jornadas del Cuaderno entra automáticamente.',
    },
  ].filter(Boolean);

  const porTipo = useMemo(() => {
    const g = { ingreso: [], nomina: [], gasto_fijo: [], gasto_variable: [], factura: [] };
    for (const c of conceptos) (g[c.tipo] || (g[c.tipo] = [])).push(c);
    return g;
  }, [conceptos]);

  const movimientosMap = useMemo(() => {
    const m = new Map();
    for (const mov of data?.movimientos || []) m.set(keyMov(mov.concepto_id, mov.semana_id), mov);
    return m;
  }, [data]);

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

  // Etiquetar (o quitar la etiqueta de) un movimiento ya guardado con su
  // lote y/o cultivo — reenvía el mismo monto para no perderlo (el PUT es
  // parcial, pero acá SÍ mandamos lote_id/cultivo siempre, con null
  // explícito si el usuario los quitó, porque es una edición deliberada).
  const etiquetarMovimiento = async (movimiento, valor) => {
    if (!movimiento || soloLectura) return;
    try {
      setSaving(true);
      await finanzasAPI.upsertMovimiento({
        concepto_id: movimiento.concepto_id,
        periodo_id: periodo.id,
        semana_id: movimiento.semana_id,
        monto: Number(movimiento.monto) || 0,
        lote_id: valor?.loteId ?? null,
        cultivo: valor?.cultivo ?? null,
      });
      cargarTablero();
    } catch (e) { console.error('etiquetar movimiento:', e); } finally { setSaving(false); }
  };

  const crearConcepto = async (tipo, nombre) => {
    const n = (nombre || '').trim();
    if (!n) { setNuevoConcepto(null); return; }
    try { await finanzasAPI.crearConcepto({ finca_id: activeFincaId, nombre: n, tipo }); setNuevoConcepto(null); cargarTablero(); }
    catch (e) { console.error('crearConcepto:', e); }
  };

  const eliminarConcepto = (id) => {
    Alert.alert(
      '¿Quitar este concepto de la tabla?',
      'El concepto deja de verse aquí, pero los valores que ya anotaste NO se borran: se conservan y siguen sumando en los totales y resúmenes del mes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar de la tabla', style: 'destructive', onPress: async () => { try { await finanzasAPI.eliminarConcepto(id); cargarTablero(); } catch (e) { console.error(e); } } },
      ]
    );
  };

  const cambiarMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMesRef(a, m);
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
      <ScrollView ref={scrollTutorialRef} contentContainerStyle={styles.container}>
        <View style={styles.rowStart}>
          <View style={styles.headerIcon}><Ionicons name="cash" size={22} color="#fff" /></View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.h1}>Finanzas</Text>
            <Text style={styles.subtitle}>{activeFinca?.nombre || 'Finca'} · resumen mensual</Text>
          </View>
        </View>

        <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 8, marginTop: 12 }]}>
          <View ref={mesRef} collapsable={false} style={styles.monthNav}>
            <Pressable onPress={() => cambiarMes(-1)} style={styles.monthBtn}><Ionicons name="chevron-back" size={16} color={COLORS.ink700} /></Pressable>
            <Text style={styles.monthLabel}>{MESES[mes - 1]} {anio}</Text>
            <Pressable onPress={() => cambiarMes(1)} style={styles.monthBtn}><Ionicons name="chevron-forward" size={16} color={COLORS.ink700} /></Pressable>
          </View>
          {rol === 'propietario' && (
            <Pressable ref={cierreRef} onPress={toggleCierre} style={[styles.pillBtn, cerrado && { backgroundColor: COLORS.warningSoft }]}>
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
          <View ref={notaRef} collapsable={false}>
            <NotaRapida
              conceptos={conceptos}
              semanas={semanas}
              movimientos={data?.movimientos || []}
              periodo={periodo}
              fincaId={activeFincaId}
              lotesFinca={lotesFinca}
              cultivosFinca={cultivosFinca}
              onGuardado={cargarTablero}
            />
          </View>
        )}

        {SECCIONES.map((sec) => {
          const items = porTipo[sec.tipo] || [];
          const esFactura = sec.tipo === 'factura';
          const esVentas = sec.tipo === 'ingreso';
          return (
            <View
              key={sec.tipo}
              ref={esVentas ? ventasRef : undefined}
              collapsable={esVentas ? false : undefined}
              onLayout={esVentas ? (e) => setVentasY(e.nativeEvent.layout.y) : undefined}
              style={styles.seccionCard}
            >
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
                        <Text style={[styles.tConcepto, { width: 140 }]} numberOfLines={1}>{nombreCortoConcepto(c)}</Text>
                        {esFactura ? (
                          <>
                            <View style={{ width: 100 }}>
                              <Celda width={100} value={valores[keyMov(c.id, null)] || ''} disabled={soloLectura}
                                onChange={(v) => setValores((p) => ({ ...p, [keyMov(c.id, null)]: v }))} onBlur={() => guardar(c.id, null)} />
                              <EtiquetaMovimiento
                                movimiento={movimientosMap.get(keyMov(c.id, null))} lotes={lotesFinca} cultivos={cultivosFinca}
                                soloLectura={soloLectura} onGuardar={(v) => etiquetarMovimiento(movimientosMap.get(keyMov(c.id, null)), v)}
                              />
                            </View>
                            {!soloLectura && (
                              <FotoFacturaButton movimiento={movimientosMap.get(keyMov(c.id, null))} onSubido={cargarTablero} />
                            )}
                          </>
                        ) : (
                          semanas.map((s) => (
                            <View key={s.id} style={{ width: 90 }}>
                              <Celda width={90} value={valores[keyMov(c.id, s.id)] || ''} disabled={soloLectura}
                                onChange={(v) => setValores((p) => ({ ...p, [keyMov(c.id, s.id)]: v }))} onBlur={() => guardar(c.id, s.id)} />
                              <EtiquetaMovimiento
                                movimiento={movimientosMap.get(keyMov(c.id, s.id))} lotes={lotesFinca} cultivos={cultivosFinca}
                                soloLectura={soloLectura} onGuardar={(v) => etiquetarMovimiento(movimientosMap.get(keyMov(c.id, s.id)), v)}
                              />
                            </View>
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

        <AnalisisLoteCultivo analisis={data?.analisis_lote_cultivo} />

        <View ref={resumenRef} collapsable={false} onLayout={(e) => setResumenY(e.nativeEvent.layout.y)} style={styles.resumenCard}>
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
      <TutorialOverlay
        visible={mostrarTutorial}
        steps={pasosTutorial}
        scrollRef={scrollTutorialRef}
        onFinish={finalizarTutorial}
        onSkip={saltarTutorial}
      />
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

// Foto adjunta a una factura — solo aplica sobre un movimiento YA guardado.
// Flujo con confirmación explícita: elegir imagen -> vista previa -> "Guardar
// foto" (o "Cancelar"); si falla la subida, el error se ve en el mismo modal
// y se puede reintentar sin volver a elegir la imagen.
function FotoFacturaButton({ movimiento, onSubido }) {
  const [uriElegida, setUriElegida] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  if (!movimiento?.id) return <View style={{ width: 30 }} />;

  const elegirFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) { Alert.alert('Permiso necesario', 'Activa el acceso a fotos para adjuntar la factura.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setError('');
    setUriElegida(res.assets[0].uri);
  };

  const confirmarSubida = async () => {
    setSubiendo(true);
    setError('');
    try {
      await finanzasAPI.subirFotoMovimiento(movimiento.id, uriElegida);
      setUriElegida(null);
      onSubido?.();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo subir la foto. Intenta de nuevo.');
    } finally { setSubiendo(false); }
  };

  const eliminarFoto = () => {
    Alert.alert('¿Eliminar foto?', '', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await finanzasAPI.eliminarFotoMovimiento(movimiento.id); onSubido?.(); } catch (e) { console.error(e); } } },
    ]);
  };

  return (
    <>
      <Pressable onPress={movimiento.foto_url ? eliminarFoto : elegirFoto} style={{ width: 30, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={movimiento.foto_url ? 'image' : 'camera-outline'} size={16} color={movimiento.foto_url ? COLORS.primary : COLORS.ink400} />
      </Pressable>

      <Modal visible={!!uriElegida} transparent animationType="fade" onRequestClose={() => !subiendo && setUriElegida(null)}>
        <View style={styles.fotoModalOverlay}>
          <View style={styles.fotoModalCard}>
            <Text style={styles.fotoModalTitle}>Factura</Text>
            {uriElegida && <Image source={{ uri: uriElegida }} style={styles.fotoModalImg} resizeMode="contain" />}
            {!!error && <Text style={styles.fotoModalError}>{error}</Text>}
            <View style={styles.fotoModalRow}>
              <Pressable onPress={() => setUriElegida(null)} disabled={subiendo} style={styles.fotoModalBtnGhost}>
                <Text style={styles.fotoModalBtnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirmarSubida} disabled={subiendo} style={styles.fotoModalBtnPrimary}>
                {subiendo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.fotoModalBtnPrimaryText}>{error ? 'Reintentar' : 'Guardar foto'}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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

// Botón/pastilla genérico reutilizado en Nota rápida y en el selector de
// lote/cultivo de cada movimiento — activo en negro (ink900), igual que la
// pastilla de semana ya existente.
function Chip({ label, icon, activo, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chipTag, activo && styles.chipTagActivo]}>
      {icon && <Ionicons name={icon} size={11} color={activo ? '#fff' : COLORS.ink500} />}
      <Text style={[styles.chipTagText, activo && styles.chipTagTextActivo]}>{icon ? '  ' : ''}{label}</Text>
    </Pressable>
  );
}

// Etiqueta de lote/cultivo de UN movimiento (concepto+semana, o
// concepto+mes en facturas) — insignia si ya tiene una, botón discreto si
// no. Solo aplica sobre un movimiento YA guardado (con id), igual que la
// foto de factura: hay que anotar un valor primero.
function EtiquetaMovimiento({ movimiento, lotes, cultivos, soloLectura, onGuardar }) {
  const [abierto, setAbierto] = useState(false);
  if (lotes.length === 0 && cultivos.length === 0) return null;
  if (!movimiento) return null;

  const cultivosMov = movimiento.cultivo ? movimiento.cultivo.split(',').map((c) => c.trim()).filter(Boolean) : [];
  const loteNombre = movimiento.lote_id ? (lotes.find((l) => l.id === movimiento.lote_id)?.nombre || null) : null;
  const tieneEtiqueta = !!(movimiento.lote_id || cultivosMov.length);

  if (soloLectura) {
    return tieneEtiqueta ? <EtiquetaBadge loteNombre={loteNombre} cultivos={cultivosMov} /> : null;
  }

  return (
    <>
      <Pressable onPress={() => setAbierto(true)} style={styles.etiquetaBtn} hitSlop={6}>
        {tieneEtiqueta ? <EtiquetaBadge loteNombre={loteNombre} cultivos={cultivosMov} /> : (
          <View style={styles.rowStart}>
            <Ionicons name="pricetag-outline" size={9} color={COLORS.ink400} />
            <Text style={styles.etiquetarText}>  Etiquetar</Text>
          </View>
        )}
      </Pressable>
      <SelectorEtiquetaModal
        visible={abierto}
        lotes={lotes}
        cultivos={cultivos}
        loteIdInicial={movimiento.lote_id || null}
        cultivosInicial={cultivosMov}
        onCancelar={() => setAbierto(false)}
        onGuardar={(v) => { onGuardar(v); setAbierto(false); }}
      />
    </>
  );
}

function EtiquetaBadge({ loteNombre, cultivos }) {
  return (
    <View style={[styles.rowStart, { flexWrap: 'wrap' }]}>
      {loteNombre && (
        <View style={styles.badgeLote}>
          <Ionicons name="location" size={8} color={COLORS.info} />
          <Text style={styles.badgeLoteText}> {loteNombre}</Text>
        </View>
      )}
      {cultivos.map((c) => (
        <View key={c} style={styles.badgeCultivo}>
          <Ionicons name="leaf" size={8} color={COLORS.primary} />
          <Text style={styles.badgeCultivoText}> {c}</Text>
        </View>
      ))}
    </View>
  );
}

// Selector de lote (uno solo) y cultivo (varios) de un movimiento —
// reutilizado desde la tabla (re-etiquetar un movimiento ya guardado) y
// desde Nota rápida. Bottom sheet, mismo patrón que HoraField/CalendarioModal.
function SelectorEtiquetaModal({ visible, lotes, cultivos, loteIdInicial, cultivosInicial, onCancelar, onGuardar }) {
  const [loteId, setLoteId] = useState(loteIdInicial);
  const [cultivosSel, setCultivosSel] = useState(cultivosInicial);

  useEffect(() => {
    if (visible) { setLoteId(loteIdInicial); setCultivosSel(cultivosInicial); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const guardar = () => onGuardar({ loteId: loteId || null, cultivo: cultivosSel.length ? cultivosSel.join(', ') : null });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onCancelar} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Lote y cultivo</Text>
            <Pressable onPress={guardar}><Text style={styles.modalListo}>Listo</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
            {lotes.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.smallLabel}>Lote</Text>
                <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 6, marginTop: 6 }]}>
                  <Chip label="Sin lote" activo={!loteId} onPress={() => setLoteId(null)} />
                  {lotes.map((l) => (
                    <Chip key={l.id} label={l.nombre} icon="location-outline" activo={loteId === l.id} onPress={() => setLoteId(l.id)} />
                  ))}
                </View>
              </View>
            )}
            {cultivos.length > 0 && (
              <View>
                <Text style={styles.smallLabel}>Cultivo (puedes elegir varios)</Text>
                <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 6, marginTop: 6 }]}>
                  <Chip label="Sin cultivo" activo={cultivosSel.length === 0} onPress={() => setCultivosSel([])} />
                  {cultivos.map((c) => (
                    <Chip key={c} label={c} icon="leaf-outline" activo={cultivosSel.includes(c)} onPress={() => setCultivosSel(toggleInArray(cultivosSel, c))} />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Cuánto se ha gastado y vendido por lote y por cultivo en el mes — ya viene
// sumado del servidor (analisis_lote_cultivo en GET /finanzas/tablero), acá
// solo se dibuja.
function AnalisisLoteCultivo({ analisis }) {
  const porLote = analisis?.por_lote || [];
  const porCultivo = analisis?.por_cultivo || [];
  return (
    <View style={styles.analisisCard}>
      <View style={styles.analisisHeader}>
        <Ionicons name="pie-chart-outline" size={14} color={COLORS.ink700} />
        <Text style={styles.analisisTitulo}>  Gasto e ingreso por lote y cultivo</Text>
      </View>
      <View style={styles.analisisBody}>
        <AnalisisLista
          titulo="Por lote" icon="location-outline"
          items={porLote.map((l) => ({ key: String(l.lote_id), nombre: l.lote_nombre || 'Lote', gasto: Number(l.gasto) || 0, ingreso: Number(l.ingreso) || 0 }))}
        />
        <AnalisisLista
          titulo="Por cultivo" icon="leaf-outline"
          items={porCultivo.map((c) => ({ key: c.cultivo, nombre: c.cultivo, gasto: Number(c.gasto) || 0, ingreso: Number(c.ingreso) || 0 }))}
        />
      </View>
    </View>
  );
}

function AnalisisLista({ titulo, icon, items }) {
  const max = Math.max(1, ...items.map((i) => i.gasto + i.ingreso));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.rowStart}>
        <Ionicons name={icon} size={12} color={COLORS.ink700} />
        <Text style={styles.analisisListaTitulo}>  {titulo}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.analisisVacio}>Aún no hay conceptos etiquetados.</Text>
      ) : items.map((it) => (
        <View key={it.key} style={{ marginTop: 8 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.analisisItemNombre} numberOfLines={1}>{it.nombre}</Text>
            <View style={styles.rowStart}>
              {it.gasto > 0 && <Text style={styles.analisisItemGasto}>-{formatMoney(it.gasto)}</Text>}
              {it.ingreso > 0 && <Text style={styles.analisisItemIngreso}>  +{formatMoney(it.ingreso)}</Text>}
            </View>
          </View>
          <View style={styles.analisisBarTrack}>
            {it.gasto > 0 && <View style={[styles.analisisBarGasto, { width: `${(it.gasto / max) * 100}%` }]} />}
            {it.ingreso > 0 && <View style={[styles.analisisBarIngreso, { width: `${(it.ingreso / max) * 100}%` }]} />}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Nota rápida: se escribe "Gasolina guadaña 25000" por línea, se elige el
 * tipo y el sistema crea/reutiliza el concepto y suma el valor a la semana.
 */
function NotaRapida({ conceptos, semanas, movimientos, periodo, fincaId, lotesFinca = [], cultivosFinca = [], onGuardado }) {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('gasto_variable');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  // Lote/cultivo de la nota (opcionales): se aplican a todos los ítems que
  // se guarden en esta nota, para poder ver después cuánto se gastó o
  // vendió por lote/cultivo. Cultivo admite varios a la vez.
  const [loteId, setLoteId] = useState(null);
  const [cultivosSel, setCultivosSel] = useState([]);

  const items = useMemo(() => {
    return texto.split('\n').map((l) => l.trim()).filter(Boolean).map((linea) => {
      if (linea.includes('\t')) {
        const excel = parseLineaExcel(linea, tipo);
        if (excel) return excel;
      }
      const m = linea.match(/([\d.,]{3,})\s*$/);
      if (!m) return { nombre: linea, monto: 0 };
      const monto = Number(m[1].replace(/[.,]/g, '')) || 0;
      return { nombre: linea.slice(0, m.index).replace(/[-–:$]+\s*$/, '').trim(), monto };
    });
  }, [texto, tipo]);

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
        // Sin importar tildes/mayúsculas: "Café" reutiliza el concepto "cafe".
        let concepto = conceptos.find((c) => c.tipo === tipo && normalizarTexto(c.nombre) === normalizarTexto(nombre));
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
        // Si se eligió lote y/o cultivo para esta nota, se manda con el
        // movimiento (el PUT es parcial: si no se elige nada, no se manda
        // la llave y no se toca lo que ya estuviera etiquetado).
        const payload = { concepto_id: concepto.id, periodo_id: periodo.id, semana_id: semanaId, monto: total };
        if (loteId) payload.lote_id = loteId;
        if (cultivosSel.length) payload.cultivo = cultivosSel.join(', ');
        await finanzasAPI.upsertMovimiento(payload);
      }
      setTexto('');
      setLoteId(null);
      setCultivosSel([]);
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
      {lotesFinca.length > 0 && (
        <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 6, marginTop: 8 }]}>
          <Text style={styles.semanaLabel}>Lote:</Text>
          <Chip label="Sin lote" activo={!loteId} onPress={() => setLoteId(null)} />
          {lotesFinca.map((l) => (
            <Chip key={l.id} label={l.nombre} icon="location-outline" activo={loteId === l.id} onPress={() => setLoteId(l.id)} />
          ))}
        </View>
      )}
      {cultivosFinca.length > 0 && (
        <View style={[styles.rowStart, { flexWrap: 'wrap', gap: 6, marginTop: 8 }]}>
          <Text style={styles.semanaLabel}>Cultivo:</Text>
          <Chip label="Sin cultivo" activo={cultivosSel.length === 0} onPress={() => setCultivosSel([])} />
          {cultivosFinca.map((c) => (
            <Chip key={c} label={c} icon="leaf-outline" activo={cultivosSel.includes(c)} onPress={() => setCultivosSel(toggleInArray(cultivosSel, c))} />
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
  fotoModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  fotoModalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, maxHeight: '80%' },
  fotoModalTitle: { fontSize: 16, fontWeight: '900', color: COLORS.ink900, marginBottom: 10 },
  fotoModalImg: { width: '100%', height: 260, borderRadius: 10, backgroundColor: COLORS.lineLight },
  fotoModalError: { fontSize: 12, color: COLORS.danger, marginTop: 10, fontWeight: '600' },
  fotoModalRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  fotoModalBtnGhost: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  fotoModalBtnGhostText: { color: COLORS.ink700, fontWeight: '700' },
  fotoModalBtnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  fotoModalBtnPrimaryText: { color: '#fff', fontWeight: '900' },

  // Chip genérico (Nota rápida y selector de lote/cultivo)
  chipTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  chipTagActivo: { backgroundColor: COLORS.ink900, borderColor: COLORS.ink900 },
  chipTagText: { fontSize: 11, fontWeight: '700', color: COLORS.ink500 },
  chipTagTextActivo: { color: '#fff' },

  // Etiqueta de lote/cultivo bajo cada celda de la tabla
  etiquetaBtn: { marginTop: 3, minHeight: 13 },
  etiquetarText: { fontSize: 9, color: COLORS.ink400, fontWeight: '600' },
  badgeLote: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.infoSoft, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, marginRight: 3, marginBottom: 2 },
  badgeLoteText: { fontSize: 9, fontWeight: '700', color: COLORS.info },
  badgeCultivo: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, marginRight: 3, marginBottom: 2 },
  badgeCultivoText: { fontSize: 9, fontWeight: '700', color: COLORS.primary },

  // Modal (bottom sheet) del selector de lote/cultivo
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '78%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.lineLight },
  modalTitle: { fontSize: 15, fontWeight: '900', color: COLORS.ink900 },
  modalListo: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  smallLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },

  // Análisis por lote y cultivo
  analisisCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginTop: 14, borderWidth: 1, borderColor: COLORS.line },
  analisisHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lineLight, paddingHorizontal: 14, paddingVertical: 10 },
  analisisTitulo: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', color: COLORS.ink700 },
  analisisBody: { padding: 14 },
  analisisListaTitulo: { fontWeight: '800', fontSize: 12, color: COLORS.ink700 },
  analisisVacio: { fontSize: 11, color: COLORS.ink400, marginTop: 6 },
  analisisItemNombre: { fontSize: 12, fontWeight: '700', color: COLORS.ink900, flexShrink: 1, marginRight: 6 },
  analisisItemGasto: { fontSize: 11, fontWeight: '700', color: COLORS.danger },
  analisisItemIngreso: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  analisisBarTrack: { flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: COLORS.lineLight, overflow: 'hidden', marginTop: 4 },
  analisisBarGasto: { height: '100%', backgroundColor: COLORS.danger },
  analisisBarIngreso: { height: '100%', backgroundColor: COLORS.primary },
});
