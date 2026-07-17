import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI, vacantesAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import { getLaboresCustom, addLaborCustom, getWeeklyCache, setWeeklyCache } from '../../../utils/cuadernoCache';
import { saveDraft, loadDraft, clearDraft } from '../../../utils/formDrafts';
import ProgressBar from '../../../components/ui/ProgressBar';

const LABORES_BASE = ['Recolección', 'Desyerba/Guadaña', 'Fumigación', 'Fertilización', 'Poda', 'Siembra'];
const TIPOS_PAGO = [
  { key: 'jornal', label: 'Jornal' },
  { key: 'por_kilo', label: 'Por kilo' },
  { key: 'mixto', label: 'Mixto' },
];
const STEP_LABELS = ['Datos del día', 'Precios', 'Trabajadores', 'Costos y cierre'];
const DRAFT_KEY = 'cerrar_jornada';

function hoyStr() { return new Date().toISOString().slice(0, 10); }
function uid() { return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function calcPago({ tipo_pago, kg, precio_jornal, precio_kilo }) {
  const pj = Number(precio_jornal) || 0;
  const pk = Number(precio_kilo) || 0;
  const k = Number(kg) || 0;
  if (tipo_pago === 'por_kilo') return k * pk;
  if (tipo_pago === 'mixto') return pj + k * pk;
  return pj;
}

export default function CerrarJornadaScreen({ route, navigation }) {
  const { activeFinca } = useFinca();
  const [step, setStep] = useState(1);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Paso 1
  const [fecha] = useState(route.params?.fecha || hoyStr());
  const [vacanteId, setVacanteId] = useState(null);
  const [vacanteTitulo, setVacanteTitulo] = useState('');
  const [misVacantes, setMisVacantes] = useState([]);
  const [mostrarVacantes, setMostrarVacantes] = useState(false);
  const [fincaLabel, setFincaLabel] = useState('');
  const [laborGeneral, setLaborGeneral] = useState([]);
  const [laboresCustom, setLaboresCustom] = useState([]);
  const [nuevaLaborTexto, setNuevaLaborTexto] = useState('');

  // Paso 2 — precios del día
  const [precioJornal, setPrecioJornal] = useState('');
  const [precioKilo, setPrecioKilo] = useState('');
  const [precioAlimentacion, setPrecioAlimentacion] = useState('');
  const [preciosAbiertos, setPreciosAbiertos] = useState(false);

  // Paso 3 — trabajadores
  const [trabajadores, setTrabajadores] = useState([]);
  const [sugeridos, setSugeridos] = useState([]);
  const [buscarTexto, setBuscarTexto] = useState('');
  const [modalExterno, setModalExterno] = useState(false);
  const [externoNombre, setExternoNombre] = useState('');
  const [externoTelefono, setExternoTelefono] = useState('');
  const [editando, setEditando] = useState(null); // key del trabajador en edición

  // Paso 4
  const [costosGenerales, setCostosGenerales] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // ── Precarga: caché semanal + config de precios de la finca + borrador ──
  useEffect(() => {
    (async () => {
      const cache = await getWeeklyCache();
      const custom = await getLaboresCustom();
      setLaboresCustom(custom);

      if (activeFinca) {
        setPrecioJornal(cache.precio_jornal ?? (activeFinca.precio_jornal_default != null ? String(activeFinca.precio_jornal_default) : ''));
        setPrecioKilo(cache.precio_kilo ?? (activeFinca.precio_kilo_default != null ? String(activeFinca.precio_kilo_default) : ''));
        setPrecioAlimentacion(cache.precio_alimentacion ?? (activeFinca.precio_alimentacion != null ? String(activeFinca.precio_alimentacion) : ''));
        setFincaLabel(cache.finca_label ?? activeFinca.nombre ?? '');
      }
      if (cache.labor_general) setLaborGeneral(cache.labor_general);

      try {
        const res = await cuadernoAPI.misTrabajadores();
        setSugeridos(res.data?.trabajadores || []);
      } catch (_) {}

      try {
        const res = await vacantesAPI.misVacantes();
        setMisVacantes((res.data?.vacantes || []).filter(v => v.estado !== 'cerrada'));
      } catch (_) {}

      const draft = await loadDraft(DRAFT_KEY);
      if (draft?.data && draft.data.fecha === (route.params?.fecha || hoyStr())) {
        const d = draft.data;
        if (d.vacanteId) setVacanteId(d.vacanteId);
        if (d.vacanteTitulo) setVacanteTitulo(d.vacanteTitulo);
        if (d.fincaLabel) setFincaLabel(d.fincaLabel);
        if (d.laborGeneral) setLaborGeneral(d.laborGeneral);
        if (d.precioJornal) setPrecioJornal(d.precioJornal);
        if (d.precioKilo) setPrecioKilo(d.precioKilo);
        if (d.precioAlimentacion) setPrecioAlimentacion(d.precioAlimentacion);
        if (d.trabajadores) setTrabajadores(d.trabajadores);
        if (d.costosGenerales) setCostosGenerales(d.costosGenerales);
        if (d.observaciones) setObservaciones(d.observaciones);
      }
      setDraftLoaded(true);
    })();
  }, [activeFinca]);

  // ── Autoguardado del borrador ──
  useEffect(() => {
    if (!draftLoaded) return;
    saveDraft(DRAFT_KEY, {
      fecha, vacanteId, vacanteTitulo, fincaLabel, laborGeneral,
      precioJornal, precioKilo, precioAlimentacion, trabajadores,
      costosGenerales, observaciones,
    }, { ttlDays: 1 });
  }, [draftLoaded, vacanteId, vacanteTitulo, fincaLabel, laborGeneral, precioJornal, precioKilo, precioAlimentacion, trabajadores, costosGenerales, observaciones]);

  const seleccionarVacante = async (v) => {
    setVacanteId(v.id);
    setVacanteTitulo(v.titulo);
    setMostrarVacantes(false);
    try {
      const res = await cuadernoAPI.postulantesVacante(v.id);
      const postulantes = (res.data?.postulantes || []).filter(p => p.postulacion_estado === 'aceptada');
      setSugeridos(prev => {
        const existentesIds = new Set(prev.map(s => s.trabajador_id));
        const nuevos = postulantes
          .filter(p => !existentesIds.has(p.trabajador_id))
          .map(p => ({ trabajador_id: p.trabajador_id, nombre: p.nombre_completo, foto: p.foto_selfie, telefono: p.celular }));
        return [...nuevos, ...prev];
      });
    } catch (_) {}
  };

  const toggleLaborGeneral = (labor) => {
    setLaborGeneral(prev => prev.includes(labor) ? prev.filter(l => l !== labor) : [...prev, labor]);
  };

  const agregarLaborCustom = async () => {
    const val = nuevaLaborTexto.trim();
    if (!val) return;
    await addLaborCustom(val);
    setLaboresCustom(prev => prev.includes(val) ? prev : [...prev, val]);
    setLaborGeneral(prev => [...prev, val]);
    setNuevaLaborTexto('');
  };

  const agregarTrabajador = (fuente) => {
    const key = fuente.trabajador_id ? `u:${fuente.trabajador_id}` : fuente.trabajador_externo_id ? `e:${fuente.trabajador_externo_id}` : uid();
    if (trabajadores.some(t => t.key === key)) return;
    setTrabajadores(prev => [...prev, {
      key,
      trabajador_id: fuente.trabajador_id || null,
      trabajador_externo_id: fuente.trabajador_externo_id || null,
      manual_nombre: fuente.trabajador_id || fuente.trabajador_externo_id ? null : fuente.nombre,
      manual_telefono: fuente.telefono || null,
      nombre: fuente.nombre,
      labores: [...laborGeneral],
      tipo_pago: 'jornal',
      hora_entrada: '', hora_salida: '',
      cantidad_kg: '',
      alimentacion: false,
      deuda_otro_monto: '', deuda_otro_concepto: '',
      notas: '',
    }]);
    setEditando(key);
  };

  const agregarExterno = () => {
    if (!externoNombre.trim()) return;
    agregarTrabajador({ nombre: externoNombre.trim(), telefono: externoTelefono.trim() || null });
    setExternoNombre(''); setExternoTelefono('');
    setModalExterno(false);
  };

  const actualizarTrabajador = (key, patch) => {
    setTrabajadores(prev => prev.map(t => t.key === key ? { ...t, ...patch } : t));
  };

  const quitarTrabajador = (key) => {
    setTrabajadores(prev => prev.filter(t => t.key !== key));
    if (editando === key) setEditando(null);
  };

  const calcularFila = (t) => {
    const bruto = calcPago({ tipo_pago: t.tipo_pago, kg: t.cantidad_kg, precio_jornal: precioJornal, precio_kilo: precioKilo });
    const deuda = (t.alimentacion ? Number(precioAlimentacion) || 0 : 0) + (Number(t.deuda_otro_monto) || 0);
    const neto = Math.max(0, bruto - deuda);
    return { bruto, deuda, neto };
  };

  const totales = useMemo(() => trabajadores.reduce((acc, t) => {
    const { bruto, deuda } = calcularFila(t);
    return { bruto: acc.bruto + bruto, deuda: acc.deuda + deuda };
  }, { bruto: 0, deuda: 0 }), [trabajadores, precioJornal, precioKilo, precioAlimentacion]);

  const sugeridosFiltrados = sugeridos.filter(s =>
    !buscarTexto.trim() || s.nombre?.toLowerCase().includes(buscarTexto.trim().toLowerCase())
  );

  const puedeAvanzar = () => {
    if (step === 3) return trabajadores.length > 0;
    return true;
  };

  const confirmarCierre = async () => {
    setGuardando(true);
    try {
      await setWeeklyCache({
        finca_label: fincaLabel, labor_general: laborGeneral,
        precio_jornal: precioJornal, precio_kilo: precioKilo, precio_alimentacion: precioAlimentacion,
      });

      const jornadaRes = await cuadernoAPI.crearJornada({
        fecha,
        titulo: vacanteTitulo || null,
        finca: fincaLabel || null,
        tipo_trabajo: laborGeneral.join(', ') || null,
        vacante_id: vacanteId || null,
        tipo_pago_default: 'jornal',
        precio_jornal: precioJornal ? Number(precioJornal) : null,
        precio_kilo: precioKilo ? Number(precioKilo) : null,
        costos_generales: costosGenerales ? Number(costosGenerales) : null,
        observaciones: observaciones || null,
      });
      const jornadaId = jornadaRes.data?.id;

      for (const t of trabajadores) {
        const asisRes = await cuadernoAPI.agregarAsistencia(jornadaId, {
          trabajador_id: t.trabajador_id || undefined,
          trabajador_externo_id: t.trabajador_externo_id || undefined,
          manual_nombre: t.manual_nombre || undefined,
          manual_telefono: t.manual_telefono || undefined,
          estado: 'llego',
        });
        const asisId = asisRes.data?.id;
        await cuadernoAPI.upsertRegistro(asisId, {
          cantidad_kg: t.cantidad_kg ? Number(t.cantidad_kg) : null,
          tipo_pago: t.tipo_pago,
          precio_jornal: precioJornal ? Number(precioJornal) : null,
          precio_kilo: precioKilo ? Number(precioKilo) : null,
          estado: 'completo',
          notas: [t.labores.join(', '), t.notas].filter(Boolean).join(' — ') || null,
          descuento_alimentacion: t.alimentacion ? Number(precioAlimentacion) || 0 : 0,
          descuento_otro: Number(t.deuda_otro_monto) || 0,
          descuento_nota: t.deuda_otro_concepto || null,
        });
        if (t.hora_entrada || t.hora_salida) {
          await cuadernoAPI.actualizarAsistencia(asisId, {
            hora_llegada: t.hora_entrada || null,
            hora_salida: t.hora_salida || null,
          }).catch(() => {});
        }
      }

      await clearDraft(DRAFT_KEY);
      navigation.replace('DetalleJornada', { jornadaId });
    } catch (err) {
      console.error('Error cerrando jornada:', err);
    } finally {
      setGuardando(false);
    }
  };

  const trabajadorEnEdicion = trabajadores.find(t => t.key === editando);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Cerrar jornada</Text>
      </View>
      <ProgressBar currentStep={step} totalSteps={4} labels={STEP_LABELS} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View>
              <Text style={styles.sectionTitle}>Fecha</Text>
              <Text style={styles.fechaLabel}>{fecha}</Text>

              <Text style={styles.sectionTitle}>Vacante asociada (opcional)</Text>
              <TouchableOpacity style={styles.selectBox} onPress={() => setMostrarVacantes(true)}>
                <Text style={vacanteTitulo ? styles.selectText : styles.selectPlaceholder}>
                  {vacanteTitulo || 'Ninguna — seleccionar vacante'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Finca / sector</Text>
              <TextInput style={styles.input} value={fincaLabel} onChangeText={setFincaLabel} placeholder="Ej: Finca La Esperanza" />

              <Text style={styles.sectionTitle}>Labor general del día</Text>
              <View style={styles.chipsRow}>
                {[...LABORES_BASE, ...laboresCustom].map(l => (
                  <TouchableOpacity key={l} onPress={() => toggleLaborGeneral(l)} style={[styles.chip, laborGeneral.includes(l) && styles.chipActive]}>
                    <Text style={[styles.chipText, laborGeneral.includes(l) && styles.chipTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.customLaborRow}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="+ Otra labor" value={nuevaLaborTexto} onChangeText={setNuevaLaborTexto} onSubmitEditing={agregarLaborCustom} />
                <TouchableOpacity onPress={agregarLaborCustom} style={styles.addSmallBtn}><Ionicons name="add" size={18} color={COLORS.white} /></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.hint}>Precargados de tu configuración. Puedes ajustarlos solo para hoy.</Text>
              <Text style={styles.sectionTitle}>Precio jornal</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={precioJornal} onChangeText={setPrecioJornal} placeholder="Ej: 60000" />
              <Text style={styles.sectionTitle}>Precio por kilo</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={precioKilo} onChangeText={setPrecioKilo} placeholder="Ej: 1500" />
              <Text style={styles.sectionTitle}>Precio alimentación</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={precioAlimentacion} onChangeText={setPrecioAlimentacion} placeholder="Ej: 8000" />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.sectionTitle}>Agregar trabajadores</Text>
              <TextInput style={styles.input} placeholder="Buscar en tus trabajadores..." value={buscarTexto} onChangeText={setBuscarTexto} />
              <View style={styles.chipsRow}>
                {sugeridosFiltrados.slice(0, 12).map(s => {
                  const key = s.trabajador_id ? `u:${s.trabajador_id}` : `e:${s.trabajador_externo_id}`;
                  const yaAgregado = trabajadores.some(t => t.key === key);
                  return (
                    <TouchableOpacity key={key} disabled={yaAgregado} onPress={() => agregarTrabajador(s)} style={[styles.chip, yaAgregado && styles.chipDisabled]}>
                      <Text style={styles.chipText}>{yaAgregado ? '✓ ' : '+ '}{s.nombre}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity onPress={() => setModalExterno(true)} style={[styles.chip, styles.chipOutline]}>
                  <Text style={styles.chipTextOutline}>+ Trabajador externo</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>En la jornada de hoy ({trabajadores.length})</Text>
              {trabajadores.length === 0 && <Text style={styles.empty}>Agrega al menos un trabajador.</Text>}
              {trabajadores.map(t => {
                const { neto } = calcularFila(t);
                return (
                  <TouchableOpacity key={t.key} style={styles.trabajadorRow} onPress={() => setEditando(t.key)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nombre}>{t.nombre}</Text>
                      <Text style={styles.sub}>{TIPOS_PAGO.find(tp => tp.key === t.tipo_pago)?.label} · Neto ${neto.toLocaleString('es-CO')}</Text>
                    </View>
                    <TouchableOpacity onPress={() => quitarTrabajador(t.key)} style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.sectionTitle}>Costos generales del día (transporte, comida)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={costosGenerales} onChangeText={setCostosGenerales} placeholder="Ej: 20000" />
              <Text style={styles.sectionTitle}>Observaciones</Text>
              <TextInput style={[styles.input, { minHeight: 80 }]} multiline value={observaciones} onChangeText={setObservaciones} placeholder="Notas libres del día..." />

              <View style={styles.resumenCard}>
                <Text style={styles.resumenTitle}>Resumen</Text>
                <Text style={styles.resumenLine}>{trabajadores.length} trabajadores</Text>
                <Text style={styles.resumenLine}>Pago bruto total: ${totales.bruto.toLocaleString('es-CO')}</Text>
                <Text style={styles.resumenLine}>Deudas descontadas: ${totales.deuda.toLocaleString('es-CO')}</Text>
                <Text style={styles.resumenNeto}>Neto a pagar: ${(totales.bruto - totales.deuda).toLocaleString('es-CO')}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.footerBtnSecondary} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.footerBtnSecondaryText}>Atrás</Text>
            </TouchableOpacity>
          )}
          {step < 4 ? (
            <TouchableOpacity style={[styles.footerBtnPrimary, !puedeAvanzar() && styles.footerBtnDisabled]} disabled={!puedeAvanzar()} onPress={() => setStep(s => s + 1)}>
              <Text style={styles.footerBtnPrimaryText}>Siguiente</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.footerBtnPrimary} onPress={confirmarCierre} disabled={guardando}>
              {guardando ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.footerBtnPrimaryText}>Cerrar jornada</Text>}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modal: elegir vacante */}
      <Modal visible={mostrarVacantes} transparent animationType="fade" onRequestClose={() => setMostrarVacantes(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Vacante asociada</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity style={styles.vacanteOption} onPress={() => { setVacanteId(null); setVacanteTitulo(''); setMostrarVacantes(false); }}>
                <Text>Ninguna</Text>
              </TouchableOpacity>
              {misVacantes.map(v => (
                <TouchableOpacity key={v.id} style={styles.vacanteOption} onPress={() => seleccionarVacante(v)}>
                  <Text>{v.titulo}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setMostrarVacantes(false)} style={styles.modalCloseBtn}><Text>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: trabajador externo */}
      <Modal visible={modalExterno} transparent animationType="fade" onRequestClose={() => setModalExterno(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Trabajador externo</Text>
            <TextInput style={styles.input} placeholder="Nombre completo" value={externoNombre} onChangeText={setExternoNombre} />
            <TextInput style={styles.input} placeholder="Teléfono (opcional)" keyboardType="phone-pad" value={externoTelefono} onChangeText={setExternoTelefono} />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setModalExterno(false)} style={styles.modalCancelBtn}><Text>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={agregarExterno} style={styles.modalSaveBtn}><Text style={{ color: COLORS.white, fontWeight: '700' }}>Agregar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: editar trabajador (labores, pago, kg, deuda) */}
      <Modal visible={!!trabajadorEnEdicion} transparent animationType="slide" onRequestClose={() => setEditando(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {trabajadorEnEdicion && (
              <ScrollView>
                <Text style={styles.modalTitle}>{trabajadorEnEdicion.nombre}</Text>

                <Text style={styles.miniLabel}>Labores</Text>
                <View style={styles.chipsRow}>
                  {[...LABORES_BASE, ...laboresCustom].map(l => (
                    <TouchableOpacity
                      key={l}
                      onPress={() => actualizarTrabajador(trabajadorEnEdicion.key, {
                        labores: trabajadorEnEdicion.labores.includes(l)
                          ? trabajadorEnEdicion.labores.filter(x => x !== l)
                          : [...trabajadorEnEdicion.labores, l],
                      })}
                      style={[styles.chip, trabajadorEnEdicion.labores.includes(l) && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, trabajadorEnEdicion.labores.includes(l) && styles.chipTextActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.miniLabel}>Tipo de pago</Text>
                <View style={styles.chipsRow}>
                  {TIPOS_PAGO.map(tp => (
                    <TouchableOpacity key={tp.key} onPress={() => actualizarTrabajador(trabajadorEnEdicion.key, { tipo_pago: tp.key })} style={[styles.chip, trabajadorEnEdicion.tipo_pago === tp.key && styles.chipActive]}>
                      <Text style={[styles.chipText, trabajadorEnEdicion.tipo_pago === tp.key && styles.chipTextActive]}>{tp.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.horaRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Hora entrada</Text>
                    <TextInput style={styles.input} placeholder="06:00" value={trabajadorEnEdicion.hora_entrada} onChangeText={(v) => actualizarTrabajador(trabajadorEnEdicion.key, { hora_entrada: v })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Hora salida</Text>
                    <TextInput style={styles.input} placeholder="14:00" value={trabajadorEnEdicion.hora_salida} onChangeText={(v) => actualizarTrabajador(trabajadorEnEdicion.key, { hora_salida: v })} />
                  </View>
                </View>

                {(trabajadorEnEdicion.tipo_pago === 'por_kilo' || trabajadorEnEdicion.tipo_pago === 'mixto') && (
                  <>
                    <Text style={styles.miniLabel}>Kg recogidos</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={trabajadorEnEdicion.cantidad_kg} onChangeText={(v) => actualizarTrabajador(trabajadorEnEdicion.key, { cantidad_kg: v })} />
                  </>
                )}

                <View style={styles.switchRow}>
                  <Text style={styles.miniLabel}>¿Tomó alimentación? (descuenta ${Number(precioAlimentacion || 0).toLocaleString('es-CO')})</Text>
                  <Switch value={trabajadorEnEdicion.alimentacion} onValueChange={(v) => actualizarTrabajador(trabajadorEnEdicion.key, { alimentacion: v })} trackColor={{ true: COLORS.primary }} />
                </View>

                <Text style={styles.miniLabel}>¿Debe algo más? (monto y concepto)</Text>
                <View style={styles.horaRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} keyboardType="numeric" placeholder="Monto" value={trabajadorEnEdicion.deuda_otro_monto} onChangeText={(v) => actualizarTrabajador(trabajadorEnEdicion.key, { deuda_otro_monto: v })} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Concepto" value={trabajadorEnEdicion.deuda_otro_concepto} onChangeText={(v) => actualizarTrabajador(trabajadorEnEdicion.key, { deuda_otro_concepto: v })} />
                </View>

                {(() => {
                  const { bruto, deuda, neto } = calcularFila(trabajadorEnEdicion);
                  return (
                    <View style={styles.pagoPreview}>
                      <Text style={styles.pagoLine}>Bruto: ${bruto.toLocaleString('es-CO')}</Text>
                      <Text style={styles.pagoLine}>Deuda: -${deuda.toLocaleString('es-CO')}</Text>
                      <Text style={styles.pagoNeto}>Neto: ${neto.toLocaleString('es-CO')}</Text>
                    </View>
                  );
                })()}

                <TouchableOpacity onPress={() => setEditando(null)} style={styles.modalSaveBtn}>
                  <Text style={{ color: COLORS.white, fontWeight: '700', textAlign: 'center' }}>Listo</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 8 },
  backBtn: { padding: 4 },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  sectionTitle: { fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.lg, marginBottom: 8 },
  hint: { color: COLORS.textLight, fontSize: 12, marginBottom: SPACING.sm },
  fechaLabel: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  selectBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, backgroundColor: COLORS.white },
  selectText: { color: COLORS.textPrimary },
  selectPlaceholder: { color: COLORS.textLight },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, backgroundColor: COLORS.white, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDisabled: { opacity: 0.4 },
  chipOutline: { borderColor: COLORS.primary, borderStyle: 'dashed' },
  chipText: { fontSize: 12, color: COLORS.textPrimary },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  chipTextOutline: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  customLaborRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm, alignItems: 'center' },
  addSmallBtn: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  empty: { color: COLORS.textLight, fontStyle: 'italic', marginTop: 8 },
  trabajadorRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  nombre: { fontWeight: '700', color: COLORS.textPrimary },
  sub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  resumenCard: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.xl },
  resumenTitle: { fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  resumenLine: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  resumenNeto: { fontWeight: '800', color: COLORS.primary, fontSize: 16, marginTop: 8 },
  footer: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.borderLight, backgroundColor: COLORS.background },
  footerBtnSecondary: { flex: 1, padding: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  footerBtnSecondaryText: { color: COLORS.textPrimary, fontWeight: '600' },
  footerBtnPrimary: { flex: 2, padding: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  footerBtnDisabled: { opacity: 0.5 },
  footerBtnPrimaryText: { color: COLORS.white, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, maxHeight: '85%' },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: SPACING.md, color: COLORS.textPrimary },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.sm },
  modalCancelBtn: { padding: 10 },
  modalSaveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: SPACING.md },
  modalCloseBtn: { alignSelf: 'center', padding: 10, marginTop: 8 },
  vacanteOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  miniLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, marginTop: SPACING.md, marginBottom: 6 },
  horaRow: { flexDirection: 'row', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, gap: 8 },
  pagoPreview: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md },
  pagoLine: { color: COLORS.textSecondary, fontSize: 13 },
  pagoNeto: { fontWeight: '800', color: COLORS.primary, fontSize: 16, marginTop: 4 },
});
