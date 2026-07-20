import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fincaAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { useToast } from '../shared/useFincaToast';
import { formatMoney, formatDate } from '../../../utils/fincaFormat';

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

export default function BalanceFincaScreen({ navigation }) {
  const { activeFincaId } = useFinca();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalTipo, setModalTipo] = useState(null);

  const cargar = React.useCallback(() => {
    if (!activeFincaId) return;
    fincaAPI.balance(activeFincaId)
      .then((r) => setData(r.data))
      .catch((e) => console.error('balance:', e))
      .finally(() => setLoading(false));
  }, [activeFincaId]);

  useFocusEffect(React.useCallback(() => { cargar(); }, [cargar]));

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

        <Text style={styles.sectionTitle}>Historial</Text>
        {(data.historial || []).length === 0 ? (
          <Text style={styles.emptyText}>Aún no hay movimientos manuales registrados.</Text>
        ) : (
          data.historial.map((m) => {
            const esIngreso = m.monto >= 0;
            return (
              <View key={m.id} style={styles.movRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.movCategoria}>{m.categoria}</Text>
                  <Text style={styles.movMeta}>{formatDate(m.fecha)}{m.descripcion ? ` · ${m.descripcion}` : ''}</Text>
                  <Text style={styles.movSaldo}>Saldo: {formatMoney(m.saldo_despues)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.movMonto, { color: esIngreso ? COLORS.primary : COLORS.danger }]}>
                    {esIngreso ? '+' : ''}{formatMoney(m.monto)}
                  </Text>
                  <Pressable onPress={() => eliminarMovimiento(m)} hitSlop={8} style={{ marginTop: 4 }}>
                    <Ionicons name="trash-outline" size={14} color={COLORS.ink400} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <MovimientoModal visible={!!modalTipo} tipo={modalTipo} onClose={() => setModalTipo(null)} onGuardado={cargar} />
    </SafeAreaView>
  );
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
  totalesGrid: { gap: 10, marginBottom: 20 },
  totalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  totalTitulo: { fontSize: 12, fontWeight: '800', color: COLORS.ink500, textTransform: 'uppercase', marginBottom: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: COLORS.ink700 },
  totalValor: { fontSize: 13, fontWeight: '700', color: COLORS.ink900 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink900, marginBottom: 10 },
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
