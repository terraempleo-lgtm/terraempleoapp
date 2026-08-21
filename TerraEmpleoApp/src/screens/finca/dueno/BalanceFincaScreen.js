import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Modal, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fincaAPI, finanzasAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { useToast } from '../shared/useFincaToast';
import { formatMoney, formatDate } from '../../../utils/fincaFormat';
import { useFechaRef, setFechaRef } from '../../../context/periodoStore';

const COLORS = {
  primary: '#008d49', primaryDark: '#1B512D', accent: '#C1FF72',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const CATEGORIAS_APORTE = ['Capital propio', 'Préstamo', 'Otro ingreso'];
const CATEGORIAS_RETIRO = ['Retiro personal', 'Compra de activo', 'Deuda', 'Otro egreso'];

function hoyYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Balance discriminado por período ────────────────────────────────────────
const MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PERIODOS = [
  { key: 'mes', label: 'Mensual', meses: 1 },
  { key: 'trimestre', label: 'Trimestral', meses: 3 },
  { key: 'semestre', label: 'Semestral', meses: 6 },
  { key: 'anio', label: 'Anual', meses: 12 },
];
const pad2 = (n) => String(n).padStart(2, '0');
const ymdStr = (a, m, d) => `${a}-${pad2(m)}-${pad2(d)}`;
const ultimoDia = (a, m) => new Date(a, m, 0).getDate();

// Rango [desde, hasta] del período que contiene `ref` (alineado al año:
// trimestres ene-mar/abr-jun/…, semestres ene-jun/jul-dic).
function rangoPeriodo(ref, meses) {
  const a = ref.getFullYear();
  const m0 = Math.floor(ref.getMonth() / meses) * meses; // 0-based mes inicial
  const mIni = m0 + 1;
  const mFin = m0 + meses;
  return {
    desde: ymdStr(a, mIni, 1),
    hasta: ymdStr(a, mFin, ultimoDia(a, mFin)),
    etiqueta: meses === 1 ? `${MESES_L[m0]} ${a}`
      : meses === 12 ? `Año ${a}`
      : meses === 3 ? `Trimestre ${m0 / 3 + 1} · ${a}`
      : `Semestre ${m0 / 6 + 1} · ${a}`,
  };
}

const TIPO_META = {
  ingreso: { label: 'Ventas', color: '#008d49' },
  nomina: { label: 'Nómina manual', color: '#7c3aed' },
  gasto_fijo: { label: 'Gastos fijos', color: '#d97706' },
  gasto_variable: { label: 'Gastos variables', color: '#dc2626' },
  factura: { label: 'Facturas', color: '#2563eb' },
};

// El período (periodoKey/rango) y los datos de resumenRango viven en el
// padre (BalanceFincaScreen) — no acá — porque el historial de movimientos
// de abajo se filtra por el mismo período elegido acá, para que ambos
// cambien juntos.
function BalanceDiscriminado({ periodoKey, onPeriodoKeyChange, rango, onMover, data, cargando }) {
  const conceptos = data?.conceptos || [];
  const totales = data?.totales || {};
  const gastos = conceptos.filter((c) => c.tipo !== 'ingreso');
  const ventas = conceptos.filter((c) => c.tipo === 'ingreso');
  const maxGasto = Math.max(1, ...gastos.map((c) => c.total), Number(totales.nomina_cuaderno) || 0);
  const maxVenta = Math.max(1, ...ventas.map((c) => c.total));
  const totalGastos = (Number(totales.nomina) || 0) + (Number(totales.gasto_fijo) || 0) + (Number(totales.gasto_variable) || 0) + (Number(totales.factura) || 0);
  const totalVentas = Number(totales.ventas) || 0;
  const dif = totalVentas - totalGastos;

  const Barra = ({ nombre, valor, max, color, sub }) => (
    <View style={{ marginTop: 8 }}>
      <View style={styles.rowBetweenD}>
        <Text style={styles.dLabel} numberOfLines={1}>{nombre}{sub ? <Text style={styles.dSub}>  ({sub})</Text> : null}</Text>
        <Text style={styles.dValor}>{formatMoney(valor)}</Text>
      </View>
      <View style={styles.dTrack}>
        <View style={[styles.dFill, { width: `${Math.min(100, Math.round((valor / max) * 100))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );

  return (
    <View style={styles.discCard}>
      <Text style={styles.sectionTitle}>Balance discriminado</Text>
      <Text style={styles.discHint}>En qué se fue la plata, por período: mes, trimestre, semestre o año.</Text>

      <View style={styles.discChips}>
        {PERIODOS.map((p) => (
          <Pressable key={p.key} onPress={() => onPeriodoKeyChange(p.key)} style={[styles.discChip, periodoKey === p.key && styles.discChipActivo]}>
            <Text style={[styles.discChipText, periodoKey === p.key && styles.discChipTextActivo]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.discNav}>
        <Pressable onPress={() => onMover(-1)} style={styles.discNavBtn}><Ionicons name="chevron-back" size={16} color={COLORS.ink700} /></Pressable>
        <Text style={styles.discNavLabel}>{rango.etiqueta}</Text>
        <Pressable onPress={() => onMover(1)} style={styles.discNavBtn}><Ionicons name="chevron-forward" size={16} color={COLORS.ink700} /></Pressable>
      </View>

      {cargando && !data ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : (
        <>
          <Text style={styles.discGrupo}>Gastos · {formatMoney(totalGastos)}</Text>
          {Number(totales.nomina_cuaderno) > 0 && (
            <Barra nombre="Nómina (Cuaderno)" valor={Number(totales.nomina_cuaderno)} max={maxGasto} color={TIPO_META.nomina.color} />
          )}
          {gastos.length === 0 && !(Number(totales.nomina_cuaderno) > 0) ? (
            <Text style={styles.emptyText}>Sin gastos registrados en este período.</Text>
          ) : (
            gastos.map((c) => (
              <Barra key={c.id} nombre={c.nombre} valor={c.total} max={maxGasto} color={TIPO_META[c.tipo]?.color || COLORS.danger} sub={TIPO_META[c.tipo]?.label} />
            ))
          )}

          <Text style={[styles.discGrupo, { marginTop: 14 }]}>Ventas · {formatMoney(totalVentas)}</Text>
          {ventas.length === 0 ? (
            <Text style={styles.emptyText}>Sin ventas registradas en este período.</Text>
          ) : (
            ventas.map((c) => (
              <Barra key={c.id} nombre={c.nombre} valor={c.total} max={maxVenta} color={TIPO_META.ingreso.color} />
            ))
          )}

          <View style={[styles.discDif, { backgroundColor: dif >= 0 ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={[styles.discDifLabel, { color: dif >= 0 ? '#15803d' : '#b91c1c' }]}>
              {dif >= 0 ? 'Quedó a favor' : 'Quedó en contra'}
            </Text>
            <Text style={[styles.discDifValor, { color: dif >= 0 ? '#15803d' : '#b91c1c' }]}>{formatMoney(dif)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function MovimientoModal({ visible, tipo, onClose, onGuardado }) {
  const { activeFincaId } = useFinca();
  const toast = useToast();
  const categorias = tipo === 'aporte' ? CATEGORIAS_APORTE : CATEGORIAS_RETIRO;
  const [categoria, setCategoria] = useState(categorias[0]);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyYMD());
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  React.useEffect(() => {
    if (visible) { setCategoria(categorias[0]); setMonto(''); setFecha(hoyYMD()); setNota(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tipo]);

  const guardar = async () => {
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) { toast.error('Ingresa un monto válido'); return; }
    setGuardando(true);
    try {
      await fincaAPI.crearMovimientoBalance(activeFincaId, {
        tipo, categoria, monto: montoNum, fecha, descripcion: nota || null,
      });
      toast.success(tipo === 'aporte' ? 'Aporte registrado' : 'Retiro registrado');
      onGuardado();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo guardar el movimiento');
    } finally { setGuardando(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{tipo === 'aporte' ? 'Nuevo aporte' : 'Nuevo retiro'}</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={COLORS.ink700} /></Pressable>
          </View>
          <Text style={styles.fieldLabel}>Categoría</Text>
          <View style={styles.wrapRow}>
            {categorias.map((c) => (
              <Pressable key={c} onPress={() => setCategoria(c)} style={[styles.chip, categoria === c && styles.chipActivo]}>
                <Text style={[styles.chipText, categoria === c && styles.chipTextActivo]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Monto (COP)</Text>
          <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric"
            value={monto} onChangeText={setMonto} placeholder="Ej: 500000" />
          <Text style={styles.fieldLabel}>Fecha (AAAA-MM-DD)</Text>
          <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={fecha} onChangeText={setFecha} placeholder="2026-07-19" />
          <Text style={styles.fieldLabel}>Nota (opcional)</Text>
          <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={nota} onChangeText={setNota} placeholder="Ej: para insumos" />
          <Pressable onPress={guardar} disabled={guardando} style={[styles.btnPrimary, tipo === 'retiro' && { backgroundColor: COLORS.danger }]}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Guardar {tipo === 'aporte' ? 'aporte' : 'retiro'}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const MOV_TIPOS_BORRABLES = ['aporte', 'retiro', 'otro_ingreso', 'otro_egreso'];

export default function BalanceFincaScreen({ navigation }) {
  const { activeFinca, activeFincaId } = useFinca();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalTipo, setModalTipo] = useState(null);

  // Período de "Balance discriminado" — vive acá (no dentro del
  // componente) porque el historial de movimientos de abajo se filtra por
  // el mismo período/mes elegido ahí, para que ambos cambien juntos.
  const fechaRefGlobal = useFechaRef();
  const [periodoKey, setPeriodoKey] = useState('mes');
  const meses = PERIODOS.find((p) => p.key === periodoKey)?.meses || 1;
  const rango = React.useMemo(() => rangoPeriodo(fechaRefGlobal, meses), [fechaRefGlobal, meses]);
  const moverPeriodo = (delta) => {
    const d = new Date(fechaRefGlobal);
    d.setDate(1);
    d.setMonth(d.getMonth() + delta * meses);
    setFechaRef(d);
  };

  const [discData, setDiscData] = useState(null);
  const [discCargando, setDiscCargando] = useState(false);
  React.useEffect(() => {
    if (!activeFincaId) return;
    let vivo = true;
    setDiscCargando(true);
    finanzasAPI.resumenRango({ finca_id: activeFincaId, desde: rango.desde, hasta: rango.hasta })
      .then((r) => { if (vivo) setDiscData(r.data); })
      .catch((e) => console.error('resumenRango:', e))
      .finally(() => { if (vivo) setDiscCargando(false); });
    return () => { vivo = false; };
  }, [activeFincaId, rango.desde, rango.hasta]);

  const cargar = React.useCallback(() => {
    if (!activeFincaId) return;
    fincaAPI.balance(activeFincaId)
      .then((r) => setData(r.data))
      .catch((e) => console.error('balance:', e))
      .finally(() => setLoading(false));
  }, [activeFincaId]);

  useFocusEffect(React.useCallback(() => { cargar(); }, [cargar]));

  // Movimientos del período elegido en "Balance discriminado" — se
  // muestran de a 20, con botón para ir viendo más del mismo período.
  const historialDelPeriodo = React.useMemo(
    () => (data?.historial || []).filter((h) => {
      const f = String(h.fecha || '').slice(0, 10);
      return f && f >= rango.desde && f <= rango.hasta;
    }),
    [data, rango.desde, rango.hasta]
  );
  const [mostrarHasta, setMostrarHasta] = useState(20);
  React.useEffect(() => { setMostrarHasta(20); }, [rango.desde, rango.hasta]);
  const historialVisible = historialDelPeriodo.slice(0, mostrarHasta);

  // Compartir: ingresos/egresos totales (histórico completo), el balance
  // discriminado del período elegido y los movimientos de los últimos 3
  // meses — aparte de lo que se ve en pantalla, que solo trae el período
  // actual paginado. Texto plano (sin expo-print/expo-sharing: son módulos
  // nativos que no llegan por OTA a celulares con la app ya instalada).
  const compartir = async () => {
    const hace3Meses = new Date();
    hace3Meses.setMonth(hace3Meses.getMonth() - 3);
    const desde3Meses = hace3Meses.toISOString().slice(0, 10);
    const movimientos3m = (data?.historial || []).filter((h) => String(h.fecha || '').slice(0, 10) >= desde3Meses);
    const texto = buildBalanceTexto({
      finca: activeFinca?.nombre || 'Finca',
      saldo: Number(data?.saldo_actual || 0),
      ingresos: data?.ingresos_totales || {},
      egresos: data?.egresos_totales || {},
      discriminado: { etiqueta: rango.etiqueta, conceptos: discData?.conceptos || [], totales: discData?.totales || {} },
      movimientos3m,
    });
    try { await Share.share({ message: texto }); } catch (e) { console.error('compartir balance:', e); }
  };

  const eliminarMovimiento = (mov) => {
    Alert.alert('¿Eliminar movimiento?', `¿Eliminar "${mov.categoria}" de ${formatMoney(Math.abs(mov.monto))}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await fincaAPI.eliminarMovimientoBalance(activeFincaId, mov.id); cargar(); }
          catch (e) { toast.error('No se pudo eliminar'); }
        },
      },
    ]);
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <CuadernoTopNav navigation={navigation} activeKey="BalanceFincaHome" />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const positivo = Number(data.saldo_actual) >= 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <CuadernoTopNav navigation={navigation} activeKey="BalanceFincaHome" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>Balance de la finca</Text>

        <View style={styles.saldoCard}>
          <Text style={styles.saldoLabel}>Saldo actual</Text>
          <Text style={[styles.saldoValor, !positivo && { color: '#FF8A80' }]}>{formatMoney(data.saldo_actual)}</Text>
        </View>

        <View style={styles.rowStart2}>
          <Pressable onPress={() => setModalTipo('aporte')} style={styles.btnAporte}>
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={styles.btnAporteText}>  Aporte</Text>
          </Pressable>
          <Pressable onPress={() => setModalTipo('retiro')} style={styles.btnRetiro}>
            <Ionicons name="remove-circle-outline" size={16} color={COLORS.danger} />
            <Text style={styles.btnRetiroText}>  Retiro</Text>
          </Pressable>
          <Pressable onPress={compartir} style={styles.btnCompartir}>
            <Ionicons name="share-outline" size={16} color={COLORS.ink700} />
          </Pressable>
        </View>

        <View style={styles.totalesGrid}>
          <View style={styles.totalCard}>
            <Text style={styles.totalTitulo}>Ingresos totales</Text>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Ventas</Text><Text style={styles.totalValor}>{formatMoney(data.ingresos_totales?.ventas)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Aportes</Text><Text style={styles.totalValor}>{formatMoney(data.ingresos_totales?.aportes)}</Text></View>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalTitulo}>Egresos totales</Text>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Nómina</Text><Text style={styles.totalValor}>{formatMoney(data.egresos_totales?.nomina)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Gastos</Text><Text style={styles.totalValor}>{formatMoney(data.egresos_totales?.gastos)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Retiros</Text><Text style={styles.totalValor}>{formatMoney(data.egresos_totales?.retiros)}</Text></View>
          </View>
        </View>

        <BalanceDiscriminado
          periodoKey={periodoKey}
          onPeriodoKeyChange={setPeriodoKey}
          rango={rango}
          onMover={moverPeriodo}
          data={discData}
          cargando={discCargando}
        />

        <Text style={styles.sectionTitle}>Historial de movimientos</Text>
        <Text style={styles.discHint}>{rango.etiqueta} — mismo período elegido arriba en "Balance discriminado".</Text>
        {historialDelPeriodo.length === 0 ? (
          <Text style={styles.emptyText}>Sin movimientos en este período.</Text>
        ) : (
          historialVisible.map((m) => {
            const esIngreso = m.monto >= 0;
            const borrable = MOV_TIPOS_BORRABLES.includes(m.tipo);
            return (
              <View key={`${m.tipo}-${m.id}`} style={styles.movRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.movCategoria}>{m.categoria || m.descripcion || '—'}</Text>
                  <Text style={styles.movMeta}>{formatDate(m.fecha)}{m.categoria && m.descripcion ? ` · ${m.descripcion}` : ''}</Text>
                  <Text style={styles.movSaldo}>Saldo: {formatMoney(m.saldo_despues)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.movMonto, { color: esIngreso ? COLORS.primary : COLORS.danger }]}>
                    {esIngreso ? '+' : ''}{formatMoney(m.monto)}
                  </Text>
                  {borrable && (
                    <Pressable onPress={() => eliminarMovimiento(m)} hitSlop={8} style={{ marginTop: 4 }}>
                      <Ionicons name="trash-outline" size={14} color={COLORS.ink400} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
        {historialDelPeriodo.length > historialVisible.length && (
          <Pressable onPress={() => setMostrarHasta((n) => n + 20)} style={styles.verMasBtn}>
            <Text style={styles.verMasText}>Ver más movimientos ({historialDelPeriodo.length - historialVisible.length} más)</Text>
          </Pressable>
        )}
      </ScrollView>

      <MovimientoModal visible={!!modalTipo} tipo={modalTipo} onClose={() => setModalTipo(null)} onGuardado={cargar} />
    </SafeAreaView>
  );
}

// Reporte en texto plano (para compartir por WhatsApp, correo, etc.) con
// ingresos/egresos totales, el balance discriminado del período elegido y
// los movimientos de los últimos 3 meses — mismo contenido que
// buildBalanceHTML de la web, en texto porque acá no hay expo-print.
function buildBalanceTexto({ finca, saldo, ingresos, egresos, discriminado, movimientos3m }) {
  const totalIngresos = Object.values(ingresos).reduce((a, b) => a + (Number(b) || 0), 0);
  const totalEgresos = Object.values(egresos).reduce((a, b) => a + (Number(b) || 0), 0);
  const gastosDisc = (discriminado.conceptos || []).filter((c) => c.tipo !== 'ingreso');
  const ventasDisc = (discriminado.conceptos || []).filter((c) => c.tipo === 'ingreso');
  const totales = discriminado.totales || {};
  const totalGastosDisc = (Number(totales.nomina) || 0) + (Number(totales.gasto_fijo) || 0) + (Number(totales.gasto_variable) || 0) + (Number(totales.factura) || 0);
  const totalVentasDisc = Number(totales.ventas) || 0;

  const lineas = [];
  lineas.push(`BALANCE — ${finca}`);
  lineas.push(`Generado el ${new Date().toLocaleDateString('es-CO')}`);
  lineas.push('');
  lineas.push(`SALDO ACTUAL DE LA FINCA: ${formatMoney(saldo)}`);
  lineas.push('');
  lineas.push('INGRESOS TOTALES');
  lineas.push(`  Ventas: ${formatMoney(ingresos.ventas)}`);
  lineas.push(`  Aportes de capital: ${formatMoney(ingresos.aportes)}`);
  lineas.push(`  Total: ${formatMoney(totalIngresos)}`);
  lineas.push('');
  lineas.push('EGRESOS TOTALES');
  lineas.push(`  Nómina: ${formatMoney(egresos.nomina)}`);
  lineas.push(`  Gastos: ${formatMoney(egresos.gastos)}`);
  lineas.push(`  Retiros: ${formatMoney(egresos.retiros)}`);
  lineas.push(`  Total: ${formatMoney(totalEgresos)}`);
  lineas.push('');
  lineas.push(`BALANCE DISCRIMINADO — ${discriminado.etiqueta}`);
  if (gastosDisc.length === 0 && ventasDisc.length === 0) {
    lineas.push('  Sin movimientos en este período.');
  } else {
    if (gastosDisc.length) {
      lineas.push('  Gastos:');
      for (const c of gastosDisc) lineas.push(`    ${c.nombre}: ${formatMoney(c.total)}`);
    }
    if (ventasDisc.length) {
      lineas.push('  Ventas:');
      for (const c of ventasDisc) lineas.push(`    ${c.nombre}: ${formatMoney(c.total)}`);
    }
  }
  lineas.push(`  Total gastos: ${formatMoney(totalGastosDisc)}`);
  lineas.push(`  Total ventas: ${formatMoney(totalVentasDisc)}`);
  lineas.push('');
  lineas.push('MOVIMIENTOS — últimos 3 meses');
  if (movimientos3m.length === 0) {
    lineas.push('  Sin movimientos en los últimos 3 meses.');
  } else {
    for (const h of movimientos3m) {
      const fecha = String(h.fecha || '').slice(0, 10);
      const nombre = h.categoria || h.descripcion || '—';
      const signo = Number(h.monto) >= 0 ? '+' : '';
      lineas.push(`  ${fecha} · ${nombre} · ${signo}${formatMoney(h.monto)} · saldo: ${formatMoney(h.saldo_despues)}`);
    }
  }
  return lineas.join('\n');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 120 },
  h1: { fontSize: 24, fontWeight: '900', color: COLORS.ink900, marginBottom: 14 },
  saldoCard: { backgroundColor: COLORS.primaryDark, borderRadius: 18, padding: 20, marginBottom: 14 },
  saldoLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' },
  saldoValor: { fontSize: 30, fontWeight: '900', color: COLORS.accent, marginTop: 6 },
  rowStart2: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btnAporte: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12 },
  btnAporteText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnRetiro: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dangerSoft, borderRadius: 12, paddingVertical: 12 },
  btnRetiroText: { color: COLORS.danger, fontWeight: '800', fontSize: 14 },
  btnCompartir: { width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  verMasBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center' },
  verMasText: { fontSize: 13, fontWeight: '700', color: COLORS.ink500 },
  totalesGrid: { gap: 10, marginBottom: 20 },
  totalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  totalTitulo: { fontSize: 12, fontWeight: '800', color: COLORS.ink500, textTransform: 'uppercase', marginBottom: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: COLORS.ink700 },
  totalValor: { fontSize: 13, fontWeight: '700', color: COLORS.ink900 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink900, marginBottom: 10 },
  discCard: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 14, marginBottom: 20 },
  discHint: { fontSize: 11, color: COLORS.ink500, marginTop: -6, marginBottom: 10 },
  discChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  discChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  discChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  discChipText: { fontSize: 12, fontWeight: '700', color: COLORS.ink500 },
  discChipTextActivo: { color: '#fff' },
  discNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 4 },
  discNavBtn: { padding: 8, borderRadius: 10, backgroundColor: COLORS.lineLight },
  discNavLabel: { fontWeight: '800', color: COLORS.ink900, fontSize: 13, minWidth: 150, textAlign: 'center' },
  discGrupo: { fontSize: 11, fontWeight: '800', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 10 },
  rowBetweenD: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dLabel: { fontSize: 12, fontWeight: '600', color: COLORS.ink700, flex: 1, marginRight: 8 },
  dSub: { fontSize: 10, color: COLORS.ink400, fontWeight: '400' },
  dValor: { fontSize: 12, fontWeight: '800', color: COLORS.ink900 },
  dTrack: { height: 7, borderRadius: 999, backgroundColor: COLORS.lineLight, overflow: 'hidden', marginTop: 3 },
  dFill: { height: '100%', borderRadius: 999 },
  discDif: { marginTop: 14, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  discDifLabel: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  discDifValor: { fontWeight: '900', fontSize: 16 },
  emptyText: { fontSize: 13, color: COLORS.ink500 },
  movRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: COLORS.line },
  movCategoria: { fontWeight: '700', color: COLORS.ink900, fontSize: 13 },
  movMeta: { fontSize: 11, color: COLORS.ink500, marginTop: 2 },
  movSaldo: { fontSize: 10, color: COLORS.ink400, marginTop: 2 },
  movMonto: { fontWeight: '900', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink900 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.ink500, marginBottom: 6, marginTop: 10 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.lineLight },
  chipActivo: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  chipTextActivo: { color: '#fff' },
  input: { borderWidth: 1.5, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink900, backgroundColor: '#F9FAFB' },
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
