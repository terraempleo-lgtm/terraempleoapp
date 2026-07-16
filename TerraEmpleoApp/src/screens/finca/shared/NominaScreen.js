import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI } from '../../../services/api';

function inicioSemana(offset = 0) {
  const d = new Date();
  const dia = d.getDay();
  const diff = (dia === 0 ? -6 : 1 - dia) + offset * 7;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}
function fmt(d) { return d.toISOString().slice(0, 10); }
function finDeSemana(lunes) { const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6); return dom; }

const TIPOS = [
  { key: 'bonificacion', label: 'Bono' },
  { key: 'labor_extra', label: 'Labor extra' },
  { key: 'descuento', label: 'Descuento' },
  { key: 'anticipo', label: 'Anticipo' },
];

export default function NominaScreen({ navigation }) {
  const [offset, setOffset] = useState(0);
  const [filas, setFilas] = useState([]);
  const [totales, setTotales] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [modalAjuste, setModalAjuste] = useState(null); // { asisId, nombre }
  const [ajusteTipo, setAjusteTipo] = useState('bonificacion');
  const [ajusteMonto, setAjusteMonto] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');

  const lunes = inicioSemana(offset);
  const domingo = finDeSemana(lunes);
  const desde = fmt(lunes);
  const hasta = fmt(domingo);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cuadernoAPI.nomina({ desde, hasta });
      setFilas(res.data?.filas || []);
      setTotales(res.data?.totales || null);
      const notaRes = await cuadernoAPI.leerNotaNomina({ desde });
      setNota(notaRes.data?.nota || '');
    } catch (err) {
      console.error('Error cargando nómina:', err);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const guardarNota = async (texto) => {
    setNota(texto);
    try {
      await cuadernoAPI.guardarNotaNomina({ desde, hasta, nota: texto });
    } catch (err) {
      console.error('Error guardando nota:', err);
    }
  };

  const toggleFirma = async (fila) => {
    try {
      await cuadernoAPI.marcarFirma(fila.ajuste_target_asistencia_id, { firmado: !fila.firmado });
      cargar();
    } catch (err) {
      console.error('Error firmando:', err);
    }
  };

  const abrirAjuste = (fila) => {
    setModalAjuste({ asisId: fila.ajuste_target_asistencia_id, nombre: fila.nombre });
    setAjusteTipo('bonificacion');
    setAjusteMonto('');
    setAjusteMotivo('');
  };

  const guardarAjuste = async () => {
    if (!ajusteMonto || Number(ajusteMonto) <= 0) return;
    try {
      await cuadernoAPI.agregarAjuste(modalAjuste.asisId, { tipo: ajusteTipo, monto: Number(ajusteMonto), motivo: ajusteMotivo || null });
      setModalAjuste(null);
      cargar();
    } catch (err) {
      console.error('Error agregando ajuste:', err);
    }
  };

  const eliminarAjuste = async (id) => {
    try {
      await cuadernoAPI.eliminarAjuste(id);
      cargar();
    } catch (err) {
      console.error('Error eliminando ajuste:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Nómina</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Precios')} style={styles.preciosBtn}>
          <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setOffset(o => o - 1)}><Ionicons name="chevron-back" size={22} color={COLORS.primary} /></TouchableOpacity>
        <Text style={styles.weekLabel}>{desde} a {hasta}</Text>
        <TouchableOpacity onPress={() => setOffset(o => o + 1)}><Ionicons name="chevron-forward" size={22} color={COLORS.primary} /></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {totales && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Neto total de la semana</Text>
              <Text style={styles.totalValue}>${totales.neto.toLocaleString('es-CO')}</Text>
            </View>
          )}

          {filas.length === 0 && <Text style={styles.empty}>Sin registros esta semana.</Text>}

          {filas.map(f => (
            <View key={f.trabajador_id ?? f.manual_nombre ?? f.nombre} style={styles.filaCard}>
              <View style={styles.filaHeader}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => f.trabajador_id && navigation.navigate('HistorialTrabajador', { trabajadorId: f.trabajador_id })}
                >
                  <Text style={styles.nombre}>{f.nombre}</Text>
                  <Text style={styles.sub}>{f.dias} días · {f.total_kg.toFixed(0)} kg</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleFirma(f)} style={styles.firmaBtn}>
                  <Ionicons name={f.firmado ? 'lock-closed' : 'create-outline'} size={20} color={f.firmado ? COLORS.textLight : COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.montosRow}>
                <Text style={styles.montoLabel}>Base ${f.base.toLocaleString('es-CO')}</Text>
                {f.bonificacion > 0 && <Text style={styles.montoLabel}>Bono ${f.bonificacion.toLocaleString('es-CO')}</Text>}
                {f.labor_extra > 0 && <Text style={styles.montoLabel}>Extra ${f.labor_extra.toLocaleString('es-CO')}</Text>}
                {f.descuento > 0 && <Text style={styles.montoLabelNeg}>Desc -${f.descuento.toLocaleString('es-CO')}</Text>}
                {f.anticipo > 0 && <Text style={styles.montoLabelNeg}>Antic -${f.anticipo.toLocaleString('es-CO')}</Text>}
              </View>

              <View style={styles.netoRow}>
                <Text style={styles.netoValue}>Neto: ${f.neto.toLocaleString('es-CO')}</Text>
                {!f.firmado && (
                  <TouchableOpacity onPress={() => abrirAjuste(f)} style={styles.addAjusteBtn}>
                    <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.addAjusteText}>Ajuste</Text>
                  </TouchableOpacity>
                )}
              </View>

              {f.ajustes?.length > 0 && !f.firmado && (
                <View style={styles.ajustesList}>
                  {f.ajustes.map(aj => (
                    <TouchableOpacity key={aj.id} onPress={() => eliminarAjuste(aj.id)} style={styles.ajusteChip}>
                      <Text style={styles.ajusteChipText}>{aj.tipo}: ${aj.monto.toLocaleString('es-CO')} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          <Text style={styles.sectionTitle}>Nota de la semana</Text>
          <TextInput
            style={styles.notaInput}
            multiline
            maxLength={2000}
            placeholder="Observaciones de esta semana..."
            value={nota}
            onChangeText={setNota}
            onEndEditing={(e) => guardarNota(e.nativeEvent.text)}
          />
        </ScrollView>
      )}

      <Modal visible={!!modalAjuste} transparent animationType="fade" onRequestClose={() => setModalAjuste(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajuste para {modalAjuste?.nombre}</Text>
            <View style={styles.tipoRow}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t.key} onPress={() => setAjusteTipo(t.key)} style={[styles.tipoChip, ajusteTipo === t.key && styles.tipoChipActive]}>
                  <Text style={[styles.tipoChipText, ajusteTipo === t.key && styles.tipoChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="Monto" value={ajusteMonto} onChangeText={setAjusteMonto} />
            <TextInput style={styles.input} placeholder="Motivo (opcional)" value={ajusteMotivo} onChangeText={setAjusteMotivo} />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setModalAjuste(null)} style={styles.modalCancelBtn}><Text>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={guardarAjuste} style={styles.modalSaveBtn}><Text style={{ color: COLORS.white, fontWeight: '700' }}>Guardar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingBottom: 0 },
  title: { ...FONTS.title, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  preciosBtn: { padding: 8, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.pill },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  weekLabel: { fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.xxl },
  totalCard: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.lg, ...SHADOWS.md },
  totalLabel: { color: COLORS.white, opacity: 0.9, fontSize: 13 },
  totalValue: { color: COLORS.white, fontSize: 26, fontWeight: '800', marginTop: 4 },
  empty: { color: COLORS.textLight, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  filaCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  filaHeader: { flexDirection: 'row', alignItems: 'center' },
  nombre: { fontWeight: '700', color: COLORS.textPrimary },
  sub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  firmaBtn: { padding: 6 },
  montosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  montoLabel: { fontSize: 12, color: COLORS.textLight },
  montoLabelNeg: { fontSize: 12, color: COLORS.error },
  netoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  netoValue: { fontWeight: '800', color: COLORS.primary },
  addAjusteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addAjusteText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  ajustesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  ajusteChip: { backgroundColor: COLORS.borderLight, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  ajusteChipText: { fontSize: 11, color: COLORS.textPrimary },
  sectionTitle: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  notaInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, minHeight: 80, backgroundColor: COLORS.white, textAlignVertical: 'top' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: SPACING.md, color: COLORS.textPrimary },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md },
  tipoChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6 },
  tipoChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoChipText: { fontSize: 12, color: COLORS.textPrimary },
  tipoChipTextActive: { color: COLORS.white },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, marginBottom: SPACING.sm },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.sm },
  modalCancelBtn: { padding: 10 },
  modalSaveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.md },
});
