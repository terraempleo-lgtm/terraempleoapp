import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, Modal,
  ActivityIndicator, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import Avatar from './Avatar';
import CuadernoTopNav from './CuadernoTopNav';
import { formatMoney } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  purple: '#7c3aed', purpleSoft: '#f3e8ff',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080', ink300: '#c7cabc',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const num1 = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });

const TIPOS = [
  { v: 'bonificacion', label: 'Bonificación', signo: '+', color: COLORS.primary },
  { v: 'labor_extra', label: 'Labor extra', signo: '+', color: COLORS.primary },
  { v: 'descuento', label: 'Descuento', signo: '-', color: COLORS.danger },
  { v: 'anticipo', label: 'Anticipo', signo: '-', color: COLORS.danger },
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.v, t.label]));

function pad(n) { return String(n).padStart(2, '0'); }
function toYMD(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function lunesDe(ref) {
  const d = new Date(ref); d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}
function fechaCorta(ymd) {
  if (!ymd) return '';
  const [a, m, dd] = String(ymd).slice(0, 10).split('-');
  return `${dd}/${m}/${a.slice(2)}`;
}

async function leerJSON(key, fallback) {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
async function guardarJSON(key, data) { try { await AsyncStorage.setItem(key, JSON.stringify(data)); } catch { /* no-op */ } }

const OBS_KEY = (desde) => `nomina_observaciones_${desde}`;
const NOTA_SEMANA_KEY = (desde) => `nomina_nota_semana_${desde}`;

export default function NominaScreen({ navigation }) {
  const { esCapataz, activeFinca } = useFinca();
  const [refMonday, setRefMonday] = useState(() => lunesDe(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ajusteFor, setAjusteFor] = useState(null);

  const factorConversion = Number(activeFinca?.factor_conversion) || 5;
  const kgPorArroba = Number(activeFinca?.kg_por_arroba) || 12.5;
  const aPergamino = (kgCereza) => Number(kgCereza || 0) / factorConversion;
  const aArrobas = (kgPergamino) => kgPergamino / kgPorArroba;

  const desde = useMemo(() => toYMD(refMonday), [refMonday]);
  const hasta = useMemo(() => { const d = new Date(refMonday); d.setDate(d.getDate() + 6); return toYMD(d); }, [refMonday]);

  const cargar = useCallback(() => {
    setLoading(true);
    cuadernoAPI.nomina({ desde, hasta })
      .then((r) => setData(r.data))
      .catch((e) => console.error('nomina:', e))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const filas = data?.filas || [];
  const totales = data?.totales || {};

  const moverSemana = (delta) => { const d = new Date(refMonday); d.setDate(d.getDate() + delta * 7); setRefMonday(d); };

  const guardarAjuste = async (asisId, payload) => {
    try { await cuadernoAPI.agregarAjuste(asisId, payload); setAjusteFor(null); cargar(); }
    catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo agregar el ajuste'); }
  };
  const borrarAjuste = async (id) => { try { await cuadernoAPI.eliminarAjuste(id); cargar(); } catch (e) { console.error(e); } };

  // Observaciones por fila (persisten localmente aun después de firmar)
  const [obsFor, setObsFor] = useState(null);
  const [observaciones, setObservaciones] = useState({});
  useEffect(() => { leerJSON(OBS_KEY(desde), {}).then(setObservaciones); }, [desde]);
  const guardarObservacion = async (texto) => {
    const fila = obsFor;
    if (!fila) return;
    const next = { ...observaciones };
    if (texto.trim()) next[fila.ajuste_target_asistencia_id] = texto.trim();
    else delete next[fila.ajuste_target_asistencia_id];
    await guardarJSON(OBS_KEY(desde), next);
    setObservaciones(next);
    setObsFor(null);
  };

  // Nota general de la semana (backend con fallback local)
  const [notaSemana, setNotaSemana] = useState('');
  const [notaGuardada, setNotaGuardada] = useState(true);
  const [notaCargando, setNotaCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    setNotaCargando(true);
    cuadernoAPI.leerNotaNomina({ desde, hasta })
      .then((r) => { if (vivo) setNotaSemana(r.data?.nota ?? ''); })
      .catch(async () => { if (vivo) setNotaSemana(await leerJSON(NOTA_SEMANA_KEY(desde), '')); })
      .finally(() => { if (vivo) { setNotaGuardada(true); setNotaCargando(false); } });
    return () => { vivo = false; };
  }, [desde, hasta]);
  const cambiarNotaSemana = (texto) => { setNotaSemana(texto); setNotaGuardada(false); };
  const guardarNotaSemana = async () => {
    await guardarJSON(NOTA_SEMANA_KEY(desde), notaSemana);
    try { await cuadernoAPI.guardarNotaNomina({ desde, hasta, nota: notaSemana }); }
    catch (e) { console.error('guardarNotaNomina:', e); }
    finally { setNotaGuardada(true); }
  };

  // Firma: por ahora un toggle firmado/no-firmado (confirmación en pantalla).
  // La firma dibujada a mano requiere una librería nativa (react-native-signature-canvas)
  // que obligaría a un build nuevo — queda pendiente para cuando se agregue esa dependencia.
  const [firmaFor, setFirmaFor] = useState(null);

  const toggleFirma = (fila) => {
    if (!fila.ajuste_target_asistencia_id) return;
    if (!fila.firmado) { setFirmaFor(fila); return; }
    Alert.alert('Quitar firma', '¿Quitar la firma de este trabajador?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive', onPress: async () => {
          try { await cuadernoAPI.marcarFirma(fila.ajuste_target_asistencia_id, { firmado: false }); cargar(); }
          catch (e) { console.error(e); }
        },
      },
    ]);
  };

  const confirmarFirma = async () => {
    const fila = firmaFor;
    if (!fila) return;
    try {
      await cuadernoAPI.marcarFirma(fila.ajuste_target_asistencia_id, { firmado: true });
      setFirmaFor(null);
      cargar();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar la firma');
    }
  };

  const compartirPlanilla = async () => {
    const lineas = [
      `Planilla de jornales · ${activeFinca?.nombre || 'Finca'}`,
      `Semana del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`,
      '',
      ...filas.map((f) => `${f.nombre} — ${f.dias} días · Neto ${formatMoney(f.neto)}${f.firmado ? ' (firmado)' : ''}`),
      '',
      `TOTAL: ${formatMoney(totales.neto)}`,
    ];
    try { await Share.share({ message: lineas.join('\n') }); }
    catch (e) { console.error(e); }
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {!esCapataz && <CuadernoTopNav navigation={navigation} activeKey="NominaHome" />}
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {!esCapataz && <CuadernoTopNav navigation={navigation} activeKey="NominaHome" />}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.rowStart}>
            <View style={styles.headerIcon}><Ionicons name="clipboard" size={22} color="#fff" /></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.h1}>Nómina</Text>
              <Text style={styles.subtitle}>Planilla semanal · jornal, kilos, bonos, descuentos, anticipos</Text>
            </View>
          </View>
          {esCapataz && (
            <Pressable onPress={() => navigation.navigate('Precios')} style={styles.preciosBtnCapataz}>
              <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} />
            </Pressable>
          )}
        </View>

        <View style={styles.weekNav}>
          <Pressable onPress={() => moverSemana(-1)} style={styles.weekBtn}><Ionicons name="chevron-back" size={16} color={COLORS.ink700} /></Pressable>
          <View style={styles.rowStart}><Ionicons name="calendar" size={14} color={COLORS.primary} /><Text style={styles.weekLabel}>  {fechaCorta(desde)} – {fechaCorta(hasta)}</Text></View>
          <Pressable onPress={() => moverSemana(1)} style={styles.weekBtn}><Ionicons name="chevron-forward" size={16} color={COLORS.ink700} /></Pressable>
        </View>

        <View style={[styles.rowStart, { gap: 8, marginTop: 10 }]}>
          <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('CafeHome', { desde, hasta })}>
            <Ionicons name="cafe-outline" size={16} color={COLORS.primary} />
            <Text style={styles.btnOutlineText}>  Enviar semana a Café</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={compartirPlanilla}>
            <Ionicons name="share-outline" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>  Compartir planilla</Text>
          </Pressable>
        </View>

        {filas.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="clipboard-outline" size={32} color={COLORS.ink300} />
            <Text style={styles.emptyText}>No hay jornadas registradas en esta semana.</Text>
          </View>
        ) : (
          <ScrollView horizontal style={{ marginTop: 16 }}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 150 }]}>Trabajador</Text>
                <Text style={[styles.th, { width: 50 }]}>Días</Text>
                <Text style={[styles.th, { width: 70 }]}>Kg cereza</Text>
                <Text style={[styles.th, styles.thPurple, { width: 80 }]}>Pergamino</Text>
                <Text style={[styles.th, styles.thPurple, { width: 70 }]}>Arrobas</Text>
                <Text style={[styles.th, { width: 90 }]}>Base</Text>
                <Text style={[styles.th, { width: 90 }]}>Bonos</Text>
                <Text style={[styles.th, { width: 80 }]}>Desc.</Text>
                <Text style={[styles.th, { width: 90 }]}>Anticipo</Text>
                <Text style={[styles.th, styles.thNeto, { width: 100 }]}>Neto</Text>
                <Text style={[styles.th, { width: 70 }]}>Firma</Text>
                <Text style={[styles.th, { width: 60 }]}> </Text>
              </View>

              {filas.map((f) => (
                <View key={f.key} style={styles.tableRow}>
                  <View style={{ width: 150, flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar src={f.foto} name={f.nombre} size={28} />
                    <View style={{ marginLeft: 6, flex: 1 }}>
                      <Text style={styles.tdName} numberOfLines={1}>{f.nombre}</Text>
                      {f.ajustes.length > 0 && (
                        <View style={styles.ajustesWrap}>
                          {f.ajustes.map((a) => (
                            <View key={a.id} style={styles.ajusteTag}>
                              <Text style={styles.ajusteTagText}>{TIPO_LABEL[a.tipo]} {formatMoney(a.monto)}</Text>
                              {!f.firmado && (
                                <Pressable onPress={() => borrarAjuste(a.id)} hitSlop={6}><Ionicons name="trash-outline" size={10} color={COLORS.ink400} /></Pressable>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                      {observaciones[f.ajuste_target_asistencia_id] && (
                        <Text style={styles.obsInline} numberOfLines={1}>{observaciones[f.ajuste_target_asistencia_id]}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.td, { width: 50, textAlign: 'center' }]}>{f.dias}</Text>
                  <Text style={[styles.td, { width: 70, textAlign: 'right' }]}>{f.total_kg ? Number(f.total_kg).toLocaleString('es-CO') : '—'}</Text>
                  <Text style={[styles.td, styles.tdPurple, { width: 80, textAlign: 'right' }]}>{f.total_kg ? num1(aPergamino(f.total_kg)) : '—'}</Text>
                  <Text style={[styles.td, styles.tdPurple, { width: 70, textAlign: 'right' }]}>{f.total_kg ? num1(aArrobas(aPergamino(f.total_kg))) : '—'}</Text>
                  <Text style={[styles.td, { width: 90, textAlign: 'right' }]}>{formatMoney(f.base)}</Text>
                  <Text style={[styles.td, { width: 90, textAlign: 'right', color: COLORS.primary }]}>{(f.bonificacion + f.labor_extra) ? formatMoney(f.bonificacion + f.labor_extra) : '—'}</Text>
                  <Text style={[styles.td, { width: 80, textAlign: 'right', color: COLORS.danger }]}>{f.descuento ? formatMoney(f.descuento) : '—'}</Text>
                  <Text style={[styles.td, { width: 90, textAlign: 'right', color: COLORS.danger }]}>{f.anticipo ? formatMoney(f.anticipo) : '—'}</Text>
                  <Text style={[styles.td, styles.tdNeto, { width: 100, textAlign: 'right' }]}>{formatMoney(f.neto)}</Text>
                  <View style={{ width: 70, alignItems: 'center' }}>
                    <Pressable onPress={() => toggleFirma(f)} style={[styles.firmaBtn, f.firmado && { backgroundColor: COLORS.primary }]}>
                      {f.firmado ? <Ionicons name="checkmark-circle" size={15} color="#fff" /> : <Ionicons name="create-outline" size={15} color={COLORS.ink400} />}
                    </Pressable>
                  </View>
                  <View style={{ width: 60, flexDirection: 'row', gap: 4, justifyContent: 'center' }}>
                    {f.firmado ? (
                      <View style={styles.lockBtn}><Ionicons name="lock-closed-outline" size={13} color={COLORS.ink300} /></View>
                    ) : (
                      <Pressable onPress={() => setAjusteFor(f)} style={styles.smallBtn}><Ionicons name="add" size={15} color={COLORS.ink500} /></Pressable>
                    )}
                    <Pressable
                      onPress={() => setObsFor(f)}
                      style={[styles.smallBtn, observaciones[f.ajuste_target_asistencia_id] && { borderColor: COLORS.warning, backgroundColor: COLORS.warningSoft }]}
                    >
                      <Ionicons name="chatbox-ellipses-outline" size={14} color={observaciones[f.ajuste_target_asistencia_id] ? COLORS.warning : COLORS.ink500} />
                    </Pressable>
                  </View>
                </View>
              ))}

              <View style={[styles.tableRow, styles.tableFooter]}>
                <Text style={[styles.tdBold, { width: 150 }]}>TOTALES</Text>
                <Text style={{ width: 50 }} />
                <Text style={[styles.tdBold, { width: 70, textAlign: 'right' }]}>{Number(totales.kg || 0).toLocaleString('es-CO')}</Text>
                <Text style={[styles.tdBold, styles.tdPurple, { width: 80, textAlign: 'right' }]}>{num1(aPergamino(totales.kg))}</Text>
                <Text style={[styles.tdBold, styles.tdPurple, { width: 70, textAlign: 'right' }]}>{num1(aArrobas(aPergamino(totales.kg)))}</Text>
                <Text style={[styles.tdBold, { width: 90, textAlign: 'right' }]}>{formatMoney(totales.base)}</Text>
                <Text style={[styles.tdBold, { width: 90, textAlign: 'right', color: COLORS.primary }]}>{formatMoney((totales.bonificacion || 0) + (totales.labor_extra || 0))}</Text>
                <Text style={[styles.tdBold, { width: 80, textAlign: 'right', color: COLORS.danger }]}>{formatMoney(totales.descuento)}</Text>
                <Text style={[styles.tdBold, { width: 90, textAlign: 'right', color: COLORS.danger }]}>{formatMoney(totales.anticipo)}</Text>
                <Text style={[styles.tdBold, styles.tdNeto, { width: 100, textAlign: 'right' }]}>{formatMoney(totales.neto)}</Text>
                <Text style={{ width: 130 }} />
              </View>
            </View>
          </ScrollView>
        )}

        <Text style={styles.footNote}>
          El Base proviene del Cuaderno (kilos/jornal de la semana). El Neto = Base + Bonos − Descuentos − Anticipos.
          Los ajustes se anclan a la última jornada del trabajador en la semana.
        </Text>

        <View style={styles.notaBox}>
          <View style={styles.rowStart}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.warning} />
            <Text style={styles.notaTitle}>  Notas de esta nómina ({fechaCorta(desde)} – {fechaCorta(hasta)})</Text>
          </View>
          <TextInput
            value={notaSemana}
            onChangeText={cambiarNotaSemana}
            onBlur={guardarNotaSemana}
            multiline
            maxLength={2000}
            editable={!notaCargando}
            placeholder={notaCargando ? 'Cargando…' : 'Ej: esta semana se descontó el préstamo a Juan…'}
            style={styles.notaInput}
          />
          <View style={styles.rowBetween}>
            <Text style={styles.notaHint}>Esta nota la ven dueño y capataz de la finca.</Text>
            {!notaGuardada && <Pressable onPress={guardarNotaSemana}><Text style={styles.notaSave}>Guardar nota</Text></Pressable>}
          </View>
        </View>
      </ScrollView>

      {ajusteFor && (
        <AjusteModal fila={ajusteFor} onClose={() => setAjusteFor(null)} onSave={(payload) => guardarAjuste(ajusteFor.ajuste_target_asistencia_id, payload)} />
      )}

      {firmaFor && (
        <FirmaModal nombre={firmaFor.nombre} neto={firmaFor.neto} onClose={() => setFirmaFor(null)} onConfirm={confirmarFirma} />
      )}

      {obsFor && (
        <ObservacionModal
          fila={obsFor}
          valorActual={observaciones[obsFor.ajuste_target_asistencia_id]}
          onClose={() => setObsFor(null)}
          onSave={guardarObservacion}
        />
      )}
    </SafeAreaView>
  );
}

function ObservacionModal({ fila, valorActual, onClose, onSave }) {
  const [texto, setTexto] = useState(valorActual || '');
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Observación – {fila.nombre}</Text>
          <Text style={styles.modalText}>
            El pago de este trabajador ya no se puede editar{fila.firmado ? ' porque ya firmó' : ''}.
            Si algo quedó mal, déjalo anotado aquí para revisarlo después.
          </Text>
          <TextInput autoFocus value={texto} onChangeText={setTexto} multiline style={styles.modalTextarea} placeholder="Ej: se le pagó de más…" />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalBtnGhost}><Text style={styles.modalBtnGhostText}>Cancelar</Text></Pressable>
            <Pressable onPress={() => onSave(texto)} style={styles.modalBtnPrimary}><Text style={styles.modalBtnPrimaryText}>Guardar</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Confirmación de pago entregado. La firma dibujada a mano (canvas táctil)
// requiere react-native-signature-canvas — dependencia nativa pendiente de
// build; por ahora se confirma con un botón (equivalente a firma verbal).
function FirmaModal({ nombre, neto, onClose, onConfirm }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Firma – {nombre}</Text>
          <Text style={styles.modalText}>
            Entrego conforme <Text style={{ fontWeight: '900' }}>{formatMoney(neto)}</Text>. Confirma con el trabajador
            antes de marcar como firmado.
          </Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalBtnGhost}><Text style={styles.modalBtnGhostText}>Cancelar</Text></Pressable>
            <Pressable onPress={onConfirm} style={styles.modalBtnPrimary}><Text style={styles.modalBtnPrimaryText}>Confirmar firma</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AjusteModal({ fila, onClose, onSave }) {
  const [tipo, setTipo] = useState('bonificacion');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const valido = Number(monto) > 0 && fila.ajuste_target_asistencia_id;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Ajuste – {fila.nombre}</Text>
          {!fila.ajuste_target_asistencia_id && (
            <Text style={{ color: COLORS.danger, fontSize: 13 }}>Este trabajador no tiene una asistencia en la semana para anclar el ajuste.</Text>
          )}
          <Text style={styles.fieldLabel}>Tipo de ajuste</Text>
          <View style={styles.grid2}>
            {TIPOS.map((t) => (
              <Pressable key={t.v} onPress={() => setTipo(t.v)} style={[styles.tipoBtn, tipo === t.v && styles.tipoBtnActivo]}>
                <Text style={[styles.tipoBtnText, { color: t.color }]}>{t.signo} {t.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Monto</Text>
          <TextInput keyboardType="numeric" value={monto} onChangeText={(v) => setMonto(v.replace(/[^\d]/g, ''))} placeholder="120000" style={styles.input} />
          <Text style={styles.fieldLabel}>Motivo (opcional)</Text>
          <TextInput value={motivo} onChangeText={setMotivo} placeholder="Ej. guadañando, vale, premio" style={styles.input} />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalBtnGhost}><Text style={styles.modalBtnGhostText}>Cancelar</Text></Pressable>
            <Pressable disabled={!valido} onPress={() => onSave({ tipo, monto: Number(monto), motivo })} style={[styles.modalBtnPrimary, !valido && { opacity: 0.5 }]}>
              <Text style={styles.modalBtnPrimaryText}>Agregar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 40 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRow: { marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  preciosBtnCapataz: { padding: 8, backgroundColor: COLORS.primarySoft, borderRadius: 999 },
  h1: { fontSize: 24, fontWeight: '900', color: COLORS.ink900 },
  subtitle: { fontSize: 12, color: COLORS.ink500, marginTop: 2 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  weekBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  weekLabel: { fontWeight: '700', color: COLORS.ink900, fontSize: 13 },
  btnOutline: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  btnOutlineText: { fontWeight: '700', color: COLORS.ink700, fontSize: 13 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  emptyCard: { alignItems: 'center', padding: 24, marginTop: 12 },
  emptyText: { fontSize: 13, color: COLORS.ink500, marginTop: 8, textAlign: 'center' },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.lineLight, borderBottomWidth: 1, borderColor: COLORS.line, paddingVertical: 8 },
  th: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', paddingHorizontal: 4 },
  thPurple: { backgroundColor: COLORS.purpleSoft },
  thNeto: { backgroundColor: COLORS.primarySoft },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.lineLight },
  tableFooter: { borderTopWidth: 2, borderColor: COLORS.line, backgroundColor: COLORS.lineLight },
  td: { fontSize: 12, color: COLORS.ink700, paddingHorizontal: 4 },
  tdBold: { fontSize: 12, fontWeight: '900', color: COLORS.ink900, paddingHorizontal: 4 },
  tdPurple: { color: COLORS.purple },
  tdName: { fontWeight: '600', color: COLORS.ink900, fontSize: 12 },
  tdNeto: { fontWeight: '900', color: COLORS.ink900 },
  ajustesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  ajusteTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.lineLight, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  ajusteTagText: { fontSize: 9, color: COLORS.ink700 },
  obsInline: { fontSize: 10, color: COLORS.warning, fontStyle: 'italic' },
  firmaBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.lineLight, alignItems: 'center', justifyContent: 'center' },
  lockBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  smallBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  footNote: { fontSize: 11, color: COLORS.ink400, marginTop: 12 },
  notaBox: { marginTop: 16, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(217,119,6,0.3)', backgroundColor: COLORS.warningSoft, padding: 14 },
  notaTitle: { fontWeight: '700', color: COLORS.ink900, fontSize: 13 },
  notaInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, padding: 10, fontSize: 13, minHeight: 70, marginTop: 8, textAlignVertical: 'top' },
  notaHint: { fontSize: 11, color: COLORS.ink500, marginTop: 6, flex: 1 },
  notaSave: { fontSize: 12, fontWeight: '700', color: COLORS.warning },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  modalTitle: { fontWeight: '900', fontSize: 16, color: COLORS.ink900, marginBottom: 6 },
  modalText: { fontSize: 13, color: COLORS.ink700, marginBottom: 10 },
  modalTextarea: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, padding: 10, minHeight: 80, textAlignVertical: 'top', fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  modalBtnGhost: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  modalBtnGhostText: { fontWeight: '700', color: COLORS.ink700 },
  modalBtnPrimary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '900' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoBtn: { width: '47%', borderWidth: 2, borderColor: COLORS.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  tipoBtnActivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  tipoBtnText: { fontWeight: '700', fontSize: 13 },
});
