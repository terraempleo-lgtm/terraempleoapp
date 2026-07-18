import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI, trabajadoresAPI, fincaAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import Avatar from './Avatar';
import { useToast } from './useFincaToast';
import { formatMoney, formatDate, asText, formatLabor } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  info: '#2563eb', infoSoft: '#e0edff',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080', ink300: '#c7cabc',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const TABS = [
  { key: 'asistencia', label: 'Asistencia' },
  { key: 'registro', label: 'Registro' },
  { key: 'calificacion', label: 'Cierre' },
];

const ESTADOS_ASIS = [
  { key: 'llego', label: 'Llegó', icon: 'checkmark-circle', color: COLORS.primary, soft: COLORS.primarySoft },
  { key: 'llego_tarde', label: 'Tarde', icon: 'time', color: COLORS.warning, soft: COLORS.warningSoft },
  { key: 'no_llego', label: 'No llegó', icon: 'close-circle', color: COLORS.danger, soft: COLORS.dangerSoft },
  { key: 'cancelo', label: 'Canceló', icon: 'ban', color: COLORS.ink500, soft: COLORS.lineLight },
];

const NIVELES = [
  { key: 'bien', label: 'Bien', icon: 'happy', color: COLORS.primary, soft: COLORS.primarySoft },
  { key: 'regular', label: 'Regular', icon: 'remove-circle', color: COLORS.warning, soft: COLORS.warningSoft },
  { key: 'mal', label: 'Mal', icon: 'sad', color: COLORS.danger, soft: COLORS.dangerSoft },
];

const TIPOS_PAGO = [
  { key: 'jornal', label: 'Jornal' },
  { key: 'por_kilo', label: 'Por kilo' },
  { key: 'mixto', label: 'Mixto' },
];

const horaCorta = (t) => (t ? String(t).slice(0, 5) : null);

function AsistenciaRow({ a, onCambiar, onEliminar, onSalida, onCheckin }) {
  const nombre = a.trabajador_nombre || a.manual_nombre || 'Sin nombre';
  const subtitulo = a.trabajador_celular || a.manual_telefono || '';
  const asistio = ['llego', 'llego_tarde'].includes(a.estado);
  return (
    <View style={styles.card}>
      <View style={styles.rowStart}>
        <Avatar src={a.trabajador_foto} name={nombre} size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.rowStart}>
            <Text style={styles.cardName}>{nombre}</Text>
            {!a.trabajador_id && <Text style={styles.badgeExterno}>externo</Text>}
          </View>
          {subtitulo ? <Text style={styles.cardSub}>{subtitulo}</Text> : null}
        </View>
        <Pressable onPress={() => onEliminar(a)} style={{ padding: 8 }}>
          <Ionicons name="trash-outline" size={16} color={COLORS.ink400} />
        </Pressable>
      </View>

      <View style={[styles.wrapRow, { marginTop: 10 }]}>
        {ESTADOS_ASIS.map((e) => {
          const active = a.estado === e.key;
          return (
            <Pressable
              key={e.key}
              onPress={() => onCambiar(a, e.key)}
              style={[styles.estadoChip, { backgroundColor: active ? e.color : e.soft }]}
            >
              <Ionicons name={e.icon} size={12} color={active ? '#fff' : e.color} />
              <Text style={[styles.estadoChipText, { color: active ? '#fff' : e.color }]}>{e.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.wrapRow, { marginTop: 8 }]}>
        {a.estado === 'pendiente' && (
          <Pressable onPress={() => onCambiar(a, 'llego')} style={styles.accionBtn}>
            <Ionicons name="log-in-outline" size={13} color="#fff" />
            <Text style={styles.accionBtnText}>  Check-in (llegó)</Text>
          </Pressable>
        )}
        {asistio && !a.hora_llegada && (
          <Pressable onPress={() => onCheckin(a)} style={styles.accionBtn}>
            <Ionicons name="log-in-outline" size={13} color="#fff" />
            <Text style={styles.accionBtnText}>  Check-in ahora</Text>
          </Pressable>
        )}
        {asistio && a.hora_llegada && (
          <View style={styles.horaChip}>
            <Ionicons name="log-in-outline" size={11} color={COLORS.primary} />
            <Text style={styles.horaChipText}>  Entró {horaCorta(a.hora_llegada)}</Text>
          </View>
        )}
        {asistio && !a.hora_salida && (
          <Pressable onPress={() => onSalida(a)} style={styles.accionBtnDark}>
            <Ionicons name="log-out-outline" size={13} color="#fff" />
            <Text style={styles.accionBtnText}>  Check-out ahora</Text>
          </Pressable>
        )}
        {asistio && a.hora_salida && (
          <View style={styles.horaChipDark}>
            <Ionicons name="log-out-outline" size={11} color={COLORS.ink700} />
            <Text style={styles.horaChipTextDark}>  Salió {horaCorta(a.hora_salida)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function RegistroRow({ a, jornada, onGuardar, lotesFinca = [] }) {
  const nombre = a.trabajador_nombre || a.manual_nombre || 'Sin nombre';
  const asistio = ['llego', 'llego_tarde'].includes(a.estado);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cantidad_kg: a.cantidad_kg ?? '',
    horas: a.horas ?? '',
    tipo_pago: a.tipo_pago || jornada.tipo_pago_default || 'jornal',
    precio_jornal: a.r_precio_jornal ?? jornada.precio_jornal ?? '',
    precio_kilo: a.r_precio_kilo ?? jornada.precio_kilo ?? '',
    estado: a.registro_estado || 'completo',
    notas: a.registro_notas || '',
    finca_lote_id: a.finca_lote_id || null,
  });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pagoCalculado = useMemo(() => {
    if (form.estado === 'cancelado') return 0;
    const kg = Number(form.cantidad_kg) || 0;
    const pk = Number(form.precio_kilo) || 0;
    const pj = Number(form.precio_jornal) || 0;
    if (form.tipo_pago === 'por_kilo') return Math.round(kg * pk);
    if (form.tipo_pago === 'jornal') {
      if (form.estado === 'parcial' && form.horas) return Math.round(pj * ((Number(form.horas) || 0) / 8));
      return pj;
    }
    if (form.tipo_pago === 'mixto') return Math.round(pj + kg * pk);
    return 0;
  }, [form]);

  const guardar = async () => {
    setSaving(true);
    try { await onGuardar(a, form); setOpen(false); } finally { setSaving(false); }
  };

  return (
    <View style={[styles.card, !asistio && { opacity: 0.6 }]}>
      <Pressable style={styles.rowStart} onPress={() => asistio && setOpen((o) => !o)} disabled={!asistio}>
        <Avatar src={a.trabajador_foto} name={nombre} size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardName}>{nombre}</Text>
          {!asistio ? (
            <Text style={styles.lockText}>🔒 Marca asistencia primero</Text>
          ) : a.registro_id ? (
            <View style={styles.rowStart}>
              <Text style={styles.cardSub}>{Number(a.cantidad_kg || 0)} kg · </Text>
              <Text style={styles.moneyPrimary}>{formatMoney(a.pago_total || 0)}</Text>
              {a.pagado ? (
                <Text style={styles.pagadoBadge}>  Pagado</Text>
              ) : (
                <Text style={styles.pendienteBadge}>  Pendiente</Text>
              )}
            </View>
          ) : (
            <Text style={styles.lockText}>Sin registrar</Text>
          )}
        </View>
        {asistio && <Ionicons name="chevron-down" size={16} color={COLORS.ink400} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />}
      </Pressable>

      {open && asistio && (
        <View style={styles.cardBody}>
          <Text style={styles.fieldLabel}>Tipo de pago</Text>
          <View style={styles.wrapRow}>
            {TIPOS_PAGO.map((t) => (
              <Pressable key={t.key} onPress={() => update('tipo_pago', t.key)} style={[styles.tipoPagoBtn, form.tipo_pago === t.key && styles.tipoPagoBtnActivo]}>
                <Text style={[styles.tipoPagoText, form.tipo_pago === t.key && styles.tipoPagoTextActivo]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          {(form.tipo_pago === 'por_kilo' || form.tipo_pago === 'mixto') && (
            <>
              <Text style={styles.fieldLabel}>Kg recolectados</Text>
              <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="decimal-pad" value={String(form.cantidad_kg)} onChangeText={(v) => update('cantidad_kg', v)} placeholder="0" />
            </>
          )}
          <Text style={styles.fieldLabel}>Horas trabajadas</Text>
          <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="decimal-pad" value={String(form.horas)} onChangeText={(v) => update('horas', v)} placeholder="8" />
          {(form.tipo_pago === 'jornal' || form.tipo_pago === 'mixto') && (
            <>
              <Text style={styles.fieldLabel}>Precio jornal</Text>
              <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric" value={String(form.precio_jornal)} onChangeText={(v) => update('precio_jornal', v)} placeholder="0" />
            </>
          )}
          {(form.tipo_pago === 'por_kilo' || form.tipo_pago === 'mixto') && (
            <>
              <Text style={styles.fieldLabel}>Precio kilo</Text>
              <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric" value={String(form.precio_kilo)} onChangeText={(v) => update('precio_kilo', v)} placeholder="0" />
            </>
          )}
          {lotesFinca.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>¿Qué lote trabajó?</Text>
              <View style={styles.wrapRow}>
                {lotesFinca.map((l) => (
                  <Pressable key={l.id} onPress={() => update('finca_lote_id', form.finca_lote_id === l.id ? null : l.id)} style={[styles.tipoPagoBtn, form.finca_lote_id === l.id && styles.tipoPagoBtnActivo]}>
                    <Text style={[styles.tipoPagoText, form.finca_lote_id === l.id && styles.tipoPagoTextActivo]}>{l.nombre}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={styles.fieldLabel}>Estado</Text>
          <View style={styles.wrapRow}>
            {['completo', 'parcial', 'cancelado'].map((e) => (
              <Pressable key={e} onPress={() => update('estado', e)} style={[styles.tipoPagoBtn, form.estado === e && styles.tipoPagoBtnActivo]}>
                <Text style={[styles.tipoPagoText, form.estado === e && styles.tipoPagoTextActivo]}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Notas</Text>
          <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={form.notas} onChangeText={(v) => update('notas', v)} placeholder="Observaciones del trabajo" />

          <View style={styles.totalBox}>
            <View>
              <Text style={styles.totalLabel}>Pago calculado</Text>
              <Text style={styles.totalValue}>{formatMoney(pagoCalculado)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {a.registro_id && (
                <Text style={styles.pagoEstadoHint}>
                  {a.pagado ? '✓ Pagado (firmado en Nómina)' : 'Pendiente — se paga al firmar en Nómina'}
                </Text>
              )}
              <Pressable onPress={guardar} disabled={saving} style={styles.btnPrimarySmall}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimarySmallText}>Guardar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function CalificacionRow({ a, onCalificar }) {
  const nombre = a.trabajador_nombre || a.manual_nombre || 'Sin nombre';
  const asistio = ['llego', 'llego_tarde'].includes(a.estado);
  const [comentario, setComentario] = useState(a.calif_comentario || '');
  if (!asistio) return null;

  return (
    <View style={styles.card}>
      <View style={styles.rowStart}>
        <Avatar src={a.trabajador_foto} name={nombre} size={36} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardName}>{nombre}</Text>
          {a.calif_nivel && (
            <Text style={styles.cardSub}>Ya calificado: {NIVELES.find((n) => n.key === a.calif_nivel)?.label}</Text>
          )}
        </View>
      </View>
      <View style={[styles.wrapRow, { marginTop: 8 }]}>
        {NIVELES.map((n) => {
          const active = a.calif_nivel === n.key;
          return (
            <Pressable
              key={n.key}
              onPress={() => onCalificar(a, { nivel: n.key, comentario })}
              style={[styles.nivelBtn, { backgroundColor: active ? n.color : n.soft }]}
            >
              <Ionicons name={n.icon} size={14} color={active ? '#fff' : n.color} />
              <Text style={[styles.nivelBtnText, { color: active ? '#fff' : n.color }]}>  {n.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput placeholderTextColor={COLORS.ink400}
        style={[styles.input, { marginTop: 8 }]}
        placeholder="Comentario interno (opcional)"
        value={comentario}
        onChangeText={setComentario}
        onBlur={() => {
          if (a.calif_nivel && comentario !== (a.calif_comentario || '')) onCalificar(a, { nivel: a.calif_nivel, comentario });
        }}
      />
    </View>
  );
}

function AgregarTrabajadorModal({ visible, onClose, jornadaId, jornada, onAgregado }) {
  const toast = useToast();
  const [tab, setTab] = useState('buscar');
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargandoB, setCargandoB] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [manual, setManual] = useState({ nombre: '', telefono: '' });
  const [pago, setPago] = useState({ tipo_pago: 'jornal', precio_jornal: '', precio_kilo: '', cantidad_kg: '' });
  const [marcarLlego, setMarcarLlego] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setBusqueda(''); setResultados([]); setSeleccionado(null); setManual({ nombre: '', telefono: '' }); setTab('buscar');
    } else {
      setPago({
        tipo_pago: jornada?.tipo_pago_default || 'jornal',
        precio_jornal: jornada?.precio_jornal ?? '',
        precio_kilo: jornada?.precio_kilo ?? '',
        cantidad_kg: '',
      });
      setMarcarLlego(true);
    }
  }, [visible, jornada]);

  const updatePago = (k, v) => setPago((p) => ({ ...p, [k]: v }));
  const pagoEstimado = useMemo(() => {
    const kg = Number(pago.cantidad_kg) || 0;
    const pk = Number(pago.precio_kilo) || 0;
    const pj = Number(pago.precio_jornal) || 0;
    if (pago.tipo_pago === 'por_kilo') return Math.round(kg * pk);
    if (pago.tipo_pago === 'mixto') return Math.round(pj + kg * pk);
    return Math.round(pj);
  }, [pago]);

  useEffect(() => {
    if (tab !== 'buscar') return;
    const t = setTimeout(async () => {
      if (busqueda.trim().length < 2) { setResultados([]); return; }
      setCargandoB(true);
      try {
        const r = await trabajadoresAPI.listar({});
        const q = busqueda.trim().toLowerCase();
        setResultados((r.data?.trabajadores || []).filter((x) => (x.nombre_completo || '').toLowerCase().includes(q)));
      } catch { setResultados([]); } finally { setCargandoB(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, tab]);

  const agregar = async () => {
    const payload = tab === 'buscar' ? { trabajador_id: seleccionado?.id } : { manual_nombre: manual.nombre, manual_telefono: manual.telefono };
    if (tab === 'buscar' && !seleccionado) { toast.error('Selecciona un trabajador'); return; }
    if (tab === 'manual' && !manual.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }

    setSaving(true);
    try {
      const r = await cuadernoAPI.agregarAsistencia(jornadaId, payload);
      let asisId = r.data?.id ?? null;
      if (!asisId) {
        const det = await cuadernoAPI.detalleJornada(jornadaId);
        const lista = det.data?.asistencias || [];
        const match = payload.trabajador_id
          ? lista.find((x) => Number(x.trabajador_id) === Number(payload.trabajador_id))
          : [...lista].reverse().find((x) => x.manual_nombre === payload.manual_nombre);
        asisId = match?.id ?? null;
      }
      if (asisId && marcarLlego) {
        await cuadernoAPI.actualizarAsistencia(asisId, { estado: 'llego' });
        await cuadernoAPI.upsertRegistro(asisId, {
          cantidad_kg: pago.cantidad_kg ? Number(pago.cantidad_kg) : null,
          horas: null, tipo_pago: pago.tipo_pago,
          precio_jornal: pago.precio_jornal ? Number(pago.precio_jornal) : null,
          precio_kilo: pago.precio_kilo ? Number(pago.precio_kilo) : null,
          estado: 'completo', notas: null, pagado: 0,
        });
        toast.success('Trabajador agregado con su registro de pago');
      } else {
        toast.success('Trabajador agregado');
      }
      onAgregado?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo agregar');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxHeight: '85%' }]}>
          <ScrollView>
            <Text style={styles.modalTitle}>Agregar trabajador</Text>
            <View style={styles.tabRow}>
              {[{ key: 'buscar', label: 'Buscar registrado' }, { key: 'manual', label: 'Agregar externo' }].map((t) => (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActivo]}>
                  <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActivo]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'buscar' ? (
              <>
                <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} placeholder="Nombre del trabajador…" value={busqueda} onChangeText={setBusqueda} />
                {cargandoB && <ActivityIndicator style={{ marginVertical: 8 }} />}
                {resultados.slice(0, 12).map((t) => {
                  const activo = seleccionado?.id === t.id;
                  return (
                    <Pressable key={t.id} onPress={() => setSeleccionado(activo ? null : t)} style={[styles.resultRow, activo && styles.resultRowActivo]}>
                      <Avatar src={t.foto_selfie} name={t.nombre_completo} size={36} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.resultName}>{t.nombre_completo}</Text>
                        <Text style={styles.resultPhone}>{t.celular}</Text>
                      </View>
                      {activo && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <>
                <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} placeholder="Nombre completo" value={manual.nombre} onChangeText={(v) => setManual((m) => ({ ...m, nombre: v }))} />
                <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} placeholder="Teléfono (opcional)" keyboardType="phone-pad" value={manual.telefono} onChangeText={(v) => setManual((m) => ({ ...m, telefono: v }))} />
              </>
            )}

            <View style={styles.divider} />
            <View style={styles.rowBetween}>
              <Text style={styles.fieldLabel}>¿Cómo se le paga?</Text>
              <View style={styles.rowStart}>
                <Switch value={marcarLlego} onValueChange={setMarcarLlego} trackColor={{ true: COLORS.primary }} />
                <Text style={styles.switchLabel}>Marcar que llegó</Text>
              </View>
            </View>
            <View style={styles.wrapRow}>
              {TIPOS_PAGO.map((t) => (
                <Pressable key={t.key} onPress={() => updatePago('tipo_pago', t.key)} style={[styles.tipoPagoBtn, pago.tipo_pago === t.key && styles.tipoPagoBtnActivo]}>
                  <Text style={[styles.tipoPagoText, pago.tipo_pago === t.key && styles.tipoPagoTextActivo]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            {(pago.tipo_pago === 'jornal' || pago.tipo_pago === 'mixto') && (
              <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric" placeholder="Precio jornal" value={String(pago.precio_jornal)} onChangeText={(v) => updatePago('precio_jornal', v)} />
            )}
            {(pago.tipo_pago === 'por_kilo' || pago.tipo_pago === 'mixto') && (
              <>
                <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric" placeholder="Precio kilo" value={String(pago.precio_kilo)} onChangeText={(v) => updatePago('precio_kilo', v)} />
                <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="decimal-pad" placeholder="Kg recolectados" value={String(pago.cantidad_kg)} onChangeText={(v) => updatePago('cantidad_kg', v)} />
              </>
            )}

            <View style={styles.totalBox}>
              <View>
                <Text style={styles.totalLabel}>Pago estimado</Text>
                <Text style={styles.totalValue}>{formatMoney(pagoEstimado)}</Text>
              </View>
              <Pressable onPress={agregar} disabled={saving} style={styles.btnPrimarySmall}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimarySmallText}>{tab === 'buscar' ? 'Agregar' : 'Agregar externo'}</Text>}
              </Pressable>
            </View>
            <Pressable onPress={() => !saving && onClose()} style={styles.modalCancelLink}><Text style={styles.modalCancelLinkText}>Cancelar</Text></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CerrarDiaModal({ visible, onClose, jornada, asistencias, onCerrada }) {
  const toast = useToast();
  const [filas, setFilas] = useState([]);
  const [obs, setObs] = useState('');
  const [precioAlim, setPrecioAlim] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setObs(jornada.observaciones || '');
    const asistieron = asistencias.filter((x) => ['llego', 'llego_tarde'].includes(x.estado));
    fincaAPI.misFincas().then((r) => {
      const fs = r.data?.fincas || [];
      const f = fs.find((x) => x.id === jornada.finca_id) || fs.find((x) => (x.nombre || '').toLowerCase() === (jornada.finca || '').toLowerCase()) || fs[0] || null;
      setPrecioAlim(Number(f?.precio_alimentacion) || 0);
      setFilas(asistieron.map((a) => ({
        a,
        tipo_pago: a.tipo_pago || jornada.tipo_pago_default || 'jornal',
        cantidad_kg: a.cantidad_kg ?? '',
        precio_jornal: a.r_precio_jornal ?? jornada.precio_jornal ?? f?.precio_jornal_default ?? '',
        precio_kilo: a.r_precio_kilo ?? jornada.precio_kilo ?? f?.precio_kilo_default ?? '',
        alimentacion: Number(a.descuento_alimentacion || 0) > 0,
      })));
    }).catch(() => {
      setFilas(asistieron.map((a) => ({
        a, tipo_pago: a.tipo_pago || jornada.tipo_pago_default || 'jornal',
        cantidad_kg: a.cantidad_kg ?? '', precio_jornal: a.r_precio_jornal ?? jornada.precio_jornal ?? '',
        precio_kilo: a.r_precio_kilo ?? jornada.precio_kilo ?? '', alimentacion: false,
      })));
    });
  }, [visible]);

  const setFila = (i, k, v) => setFilas((fs) => fs.map((f, ix) => (ix === i ? { ...f, [k]: v } : f)));
  const pagoDe = (f) => {
    const kg = Number(f.cantidad_kg) || 0, pj = Number(f.precio_jornal) || 0, pk = Number(f.precio_kilo) || 0;
    let base = f.tipo_pago === 'por_kilo' ? kg * pk : f.tipo_pago === 'mixto' ? pj + kg * pk : pj;
    return Math.max(0, Math.round(base - (f.alimentacion ? precioAlim : 0)));
  };
  const total = filas.reduce((s, f) => s + pagoDe(f), 0);

  const guardar = async () => {
    setSaving(true);
    try {
      for (const f of filas) {
        await cuadernoAPI.upsertRegistro(f.a.id, {
          cantidad_kg: f.cantidad_kg ? Number(f.cantidad_kg) : null, horas: null, tipo_pago: f.tipo_pago,
          precio_jornal: f.precio_jornal ? Number(f.precio_jornal) : null, precio_kilo: f.precio_kilo ? Number(f.precio_kilo) : null,
          estado: 'completo', notas: null, pagado: f.a.pagado || 0,
          descuento_alimentacion: f.alimentacion ? precioAlim : 0,
        });
      }
      await cuadernoAPI.actualizarJornada(jornada.id, { observaciones: obs || null, estado: 'cerrada' });
      toast.success('Cuaderno guardado y jornada cerrada');
      onCerrada?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar el cuaderno');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxHeight: '88%' }]}>
          {filas.length === 0 ? (
            <Text style={styles.emptyModalText}>Nadie tiene check-in todavía. Marca primero quién llegó en la pestaña Asistencia.</Text>
          ) : (
            <ScrollView>
              <Text style={styles.modalTitle}>El cuaderno del día</Text>
              <Text style={styles.hintText}>Llena el día completo aquí y listo: al guardar se calculan los pagos y la jornada queda cerrada.</Text>
              {filas.map((f, i) => {
                const nombre = f.a.trabajador_nombre || f.a.manual_nombre || 'Sin nombre';
                return (
                  <View key={f.a.id} style={styles.card}>
                    <View style={styles.rowStart}>
                      <Avatar src={f.a.trabajador_foto} name={nombre} size={32} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.cardNameSm}>{nombre}</Text>
                        <Text style={styles.cardSub}>
                          {f.a.hora_llegada ? `Entró ${horaCorta(f.a.hora_llegada)}` : ''}{f.a.hora_salida ? ` · Salió ${horaCorta(f.a.hora_salida)}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.moneyPrimary}>{formatMoney(pagoDe(f))}</Text>
                    </View>
                    <View style={[styles.wrapRow, { marginTop: 8 }]}>
                      {[{ key: 'jornal', label: 'Jornal' }, { key: 'por_kilo', label: 'Kilo' }, { key: 'mixto', label: 'Mixto' }].map((t) => (
                        <Pressable key={t.key} onPress={() => setFila(i, 'tipo_pago', t.key)} style={[styles.tipoPagoBtn, f.tipo_pago === t.key && styles.tipoPagoBtnActivo]}>
                          <Text style={[styles.tipoPagoText, f.tipo_pago === t.key && styles.tipoPagoTextActivo]}>{t.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {(f.tipo_pago === 'jornal' || f.tipo_pago === 'mixto') && (
                      <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric" placeholder="Precio jornal" value={String(f.precio_jornal)} onChangeText={(v) => setFila(i, 'precio_jornal', v)} />
                    )}
                    {(f.tipo_pago === 'por_kilo' || f.tipo_pago === 'mixto') && (
                      <>
                        <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="numeric" placeholder="Precio kilo" value={String(f.precio_kilo)} onChangeText={(v) => setFila(i, 'precio_kilo', v)} />
                        <TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="decimal-pad" placeholder="Kg que recogió" value={String(f.cantidad_kg)} onChangeText={(v) => setFila(i, 'cantidad_kg', v)} />
                      </>
                    )}
                    <View style={[styles.rowStart, { marginTop: 6 }]}>
                      <Switch value={f.alimentacion} onValueChange={(v) => setFila(i, 'alimentacion', v)} disabled={!precioAlim} trackColor={{ true: COLORS.primary }} />
                      <Text style={styles.switchLabel}>  Tomó alimentación {precioAlim > 0 ? `(-${formatMoney(precioAlim)})` : '(configura el precio en "Precios")'}</Text>
                    </View>
                  </View>
                );
              })}
              <TextInput placeholderTextColor={COLORS.ink400} style={[styles.input, { minHeight: 60, marginTop: 8 }]} multiline placeholder="Observaciones del día (opcional)" value={obs} onChangeText={setObs} />
              <View style={styles.totalBox}>
                <View>
                  <Text style={styles.totalLabel}>Total del día</Text>
                  <Text style={styles.totalValue}>{formatMoney(total)}</Text>
                </View>
                <Pressable onPress={guardar} disabled={saving} style={styles.btnPrimarySmall}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimarySmallText}>Guardar jornada</Text>}
                </Pressable>
              </View>
            </ScrollView>
          )}
          <Pressable onPress={() => !saving && onClose()} style={styles.modalCancelLink}><Text style={styles.modalCancelLinkText}>Cerrar</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function DetalleJornadaScreen({ route, navigation }) {
  const { jornadaId } = route.params;
  const toast = useToast();
  const { activeFincaId } = useFinca();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('asistencia');
  const [agregarOpen, setAgregarOpen] = useState(false);
  const [cerrarDiaOpen, setCerrarDiaOpen] = useState(false);
  const [lotesFinca, setLotesFinca] = useState([]);

  const cargar = () => {
    cuadernoAPI.detalleJornada(jornadaId).then((r) => setData(r.data)).catch(() => toast.error('No se pudo cargar la jornada')).finally(() => setLoading(false));
  };

  useFocusEffect(React.useCallback(() => { cargar(); }, [jornadaId]));

  useEffect(() => {
    if (!activeFincaId) return;
    fincaAPI.listarLotesFinca(activeFincaId).then((r) => setLotesFinca(r.data?.lotes || [])).catch(() => {});
  }, [activeFincaId]);

  const cambiarEstadoAsistencia = async (a, estado) => {
    try { await cuadernoAPI.actualizarAsistencia(a.id, { estado }); cargar(); } catch { toast.error('No se pudo actualizar'); }
  };
  const marcarSalida = async (a) => {
    const ahora = new Date();
    const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:00`;
    try { await cuadernoAPI.actualizarAsistencia(a.id, { hora_salida: hora }); toast.success(`Salida ${hora.slice(0, 5)}`); cargar(); }
    catch { toast.error('No se pudo registrar la salida'); }
  };
  const marcarCheckin = async (a) => {
    const ahora = new Date();
    const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:00`;
    try { await cuadernoAPI.actualizarAsistencia(a.id, { hora_llegada: hora }); toast.success(`Entrada ${hora.slice(0, 5)}`); cargar(); }
    catch { toast.error('No se pudo guardar la hora'); }
  };
  const guardarRegistro = async (a, form) => {
    try {
      await cuadernoAPI.upsertRegistro(a.id, {
        cantidad_kg: form.cantidad_kg ? Number(form.cantidad_kg) : null,
        horas: form.horas ? Number(form.horas) : null, tipo_pago: form.tipo_pago,
        precio_jornal: form.precio_jornal ? Number(form.precio_jornal) : null,
        precio_kilo: form.precio_kilo ? Number(form.precio_kilo) : null,
        estado: form.estado, notas: form.notas || null, pagado: a.pagado || 0,
        finca_lote_id: form.finca_lote_id || null,
      });
      toast.success('Registro guardado'); cargar();
    } catch { toast.error('No se pudo guardar'); }
  };
  const calificar = async (a, { nivel, comentario }) => {
    try { await cuadernoAPI.calificarAsistencia(a.id, { nivel, comentario }); cargar(); } catch { toast.error('No se pudo calificar'); }
  };
  const eliminarAsistencia = (a) => {
    Alert.alert('¿Quitar trabajador?', `¿Deseas quitar a ${a.trabajador_nombre || a.manual_nombre} de esta jornada?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: async () => { try { await cuadernoAPI.eliminarAsistencia(a.id); toast.success('Removido'); cargar(); } catch { toast.error('No se pudo eliminar'); } } },
    ]);
  };
  const cerrarSolo = () => {
    Alert.alert('¿Cerrar jornada?', 'Quedará archivada. Podrás verla en lectura pero no editar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí, cerrar', onPress: async () => { try { await cuadernoAPI.actualizarJornada(jornadaId, { estado: 'cerrada' }); toast.success('Jornada cerrada'); cargar(); } catch { toast.error('No se pudo cerrar'); } } },
    ]);
  };
  const eliminarJornada = () => {
    Alert.alert('¿Eliminar jornada?', 'Se borrarán todas las asistencias, registros y calificaciones. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await cuadernoAPI.eliminarJornada(jornadaId); toast.success('Jornada eliminada'); navigation.goBack(); } catch { toast.error('No se pudo eliminar'); } } },
    ]);
  };
  const iniciarJornada = async () => {
    try { await cuadernoAPI.actualizarJornada(jornadaId, { estado: 'en_curso' }); toast.success('Jornada iniciada'); cargar(); } catch { toast.error('No se pudo actualizar'); }
  };

  if (loading) return <SafeAreaView style={styles.screen}><ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} /></SafeAreaView>;
  if (!data?.jornada) return <SafeAreaView style={styles.screen}><Text style={styles.emptyModalText}>Jornada no encontrada</Text></SafeAreaView>;

  const j = data.jornada;
  const asistencias = data.asistencias || [];
  const totalTrabajadores = asistencias.length;
  const asistieron = asistencias.filter((a) => ['llego', 'llego_tarde'].includes(a.estado)).length;
  const totalPagado = asistencias.reduce((s, a) => s + Number(a.pago_total || 0), 0);
  const totalKg = asistencias.reduce((s, a) => s + Number(a.cantidad_kg || 0), 0);
  const calificadas = asistencias.filter((a) => a.calif_nivel).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.rowStart}>
            <Pressable onPress={() => navigation.goBack()} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <View style={styles.rowStart}>
                <View style={styles.estadoPill}>
                  <View style={[styles.dot, { backgroundColor: j.estado === 'cerrada' ? 'rgba(255,255,255,0.6)' : '#c1ff72' }]} />
                  <Text style={styles.estadoPillText}>{j.estado === 'planeada' ? 'Planeada' : j.estado === 'en_curso' ? 'En curso' : 'Cerrada'}</Text>
                </View>
                <Text style={styles.heroFecha}>  {formatDate(j.fecha)}</Text>
              </View>
              <Text style={styles.heroTitle}>{j.titulo || 'Jornada sin título'}</Text>
              <View style={[styles.wrapRow, { marginTop: 6 }]}>
                {j.finca && <Text style={styles.heroMeta}>📍 {j.finca}</Text>}
                {j.vacante_titulo && <Text style={styles.heroMeta}>💼 {asText(j.vacante_titulo)}</Text>}
                {j.tipo_trabajo && <Text style={styles.heroMeta}>📈 {formatLabor(j.tipo_trabajo)}</Text>}
              </View>
            </View>
          </View>

          <View style={styles.heroGrid}>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>Trabajadores</Text><Text style={styles.heroStatValue}>{asistieron}/{totalTrabajadores}</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>Producción</Text><Text style={styles.heroStatValue}>{totalKg.toLocaleString()} kg</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>Pagado</Text><Text style={styles.heroStatValue}>{formatMoney(totalPagado)}</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>Calificados</Text><Text style={styles.heroStatValue}>{calificadas}/{asistieron}</Text></View>
          </View>

          <View style={[styles.wrapRow, { marginTop: 12 }]}>
            {j.estado === 'planeada' && (
              <Pressable onPress={iniciarJornada} style={styles.heroBtnAccent}><Text style={styles.heroBtnAccentText}>✓ Iniciar jornada</Text></Pressable>
            )}
            {j.estado !== 'cerrada' && (
              <Pressable onPress={() => setCerrarDiaOpen(true)} style={styles.heroBtnWhite}><Text style={styles.heroBtnWhiteText}>📖 Llenar cuaderno y cerrar el día</Text></Pressable>
            )}
            {j.estado !== 'cerrada' && (
              <Pressable onPress={cerrarSolo} style={styles.heroBtnGhost}><Text style={styles.heroBtnGhostText}>Solo cerrar</Text></Pressable>
            )}
            <Pressable onPress={eliminarJornada} style={styles.heroBtnGhost}><Text style={styles.heroBtnGhostText}>Eliminar</Text></Pressable>
          </View>
        </View>

        {(Number(j.costos_generales) > 0 || j.observaciones) && (
          <View style={styles.card}>
            {Number(j.costos_generales) > 0 && <Text style={styles.costoText}>Costos generales: {formatMoney(j.costos_generales)}</Text>}
            {j.observaciones && <Text style={styles.cardSub}>{j.observaciones}</Text>}
          </View>
        )}

        <View style={styles.rowBetween}>
          <View style={styles.wrapRow}>
            {TABS.map((t) => (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabPill, tab === t.key && styles.tabPillActivo]}>
                <Text style={[styles.tabPillText, tab === t.key && styles.tabPillTextActivo]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setAgregarOpen(true)} style={styles.addBtn}>
            <Ionicons name="person-add-outline" size={14} color="#fff" /><Text style={styles.addBtnText}>  Agregar</Text>
          </Pressable>
        </View>

        {asistencias.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={40} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>Aún no hay trabajadores</Text>
            <Pressable onPress={() => setAgregarOpen(true)} style={styles.btnPrimarySmall}>
              <Text style={styles.btnPrimarySmallText}>Agregar trabajadores</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 10 }}>
            {tab === 'asistencia' && asistencias.map((a) => (
              <AsistenciaRow key={a.id} a={a} onCambiar={cambiarEstadoAsistencia} onEliminar={eliminarAsistencia} onSalida={marcarSalida} onCheckin={marcarCheckin} />
            ))}
            {tab === 'registro' && asistencias.map((a) => (
              <RegistroRow key={a.id} a={a} jornada={j} onGuardar={guardarRegistro} lotesFinca={lotesFinca} />
            ))}
            {tab === 'calificacion' && (
              asistencias.filter((a) => ['llego', 'llego_tarde'].includes(a.estado)).length === 0 ? (
                <Text style={styles.emptyModalText}>Marca asistencia para poder calificar a los trabajadores.</Text>
              ) : asistencias.map((a) => <CalificacionRow key={a.id} a={a} onCalificar={calificar} />)
            )}
          </View>
        )}
      </ScrollView>

      <AgregarTrabajadorModal visible={agregarOpen} onClose={() => setAgregarOpen(false)} jornadaId={jornadaId} jornada={j} onAgregado={cargar} />
      <CerrarDiaModal visible={cerrarDiaOpen} onClose={() => setCerrarDiaOpen(false)} jornada={j} asistencias={asistencias} onCerrada={cargar} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 120 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hero: { borderRadius: 20, padding: 18, marginBottom: 16, backgroundColor: COLORS.primaryDark },
  estadoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  estadoPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  heroFecha: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginRight: 10 },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  heroStat: { flexGrow: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 },
  heroStatLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  heroStatValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 },
  heroBtnAccent: { backgroundColor: '#c1ff72', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  heroBtnAccentText: { color: COLORS.ink900, fontWeight: '800', fontSize: 12 },
  heroBtnWhite: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  heroBtnWhiteText: { color: COLORS.primaryDark, fontWeight: '900', fontSize: 12 },
  heroBtnGhost: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  heroBtnGhostText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  card: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 12, backgroundColor: '#fff', marginBottom: 10 },
  cardName: { fontWeight: '800', color: COLORS.ink900, fontSize: 14 },
  cardNameSm: { fontWeight: '800', color: COLORS.ink900, fontSize: 13 },
  cardSub: { fontSize: 11, color: COLORS.ink500, marginTop: 2 },
  badgeExterno: { fontSize: 10, color: COLORS.ink400, backgroundColor: COLORS.lineLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginLeft: 6 },
  lockText: { fontSize: 11, color: COLORS.ink400, fontStyle: 'italic' },
  moneyPrimary: { fontWeight: '700', color: COLORS.primary, fontSize: 12 },
  pagadoBadge: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  pagoEstadoHint: { fontSize: 11, color: COLORS.ink400, flex: 1 },
  pendienteBadge: { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  estadoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  estadoChipText: { fontSize: 11, fontWeight: '700' },
  accionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  accionBtnDark: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.ink900, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  accionBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  horaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  horaChipText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  horaChipDark: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lineLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  horaChipTextDark: { fontSize: 11, fontWeight: '700', color: COLORS.ink700 },
  cardBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: COLORS.line },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink900, backgroundColor: '#fff' },
  tipoPagoBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.line },
  tipoPagoBtnActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoPagoText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  tipoPagoTextActivo: { color: '#fff' },
  totalBox: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12 },
  totalLabel: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  totalValue: { fontSize: 18, fontWeight: '900', color: COLORS.primaryDark },
  btnOutlineSmall: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  btnOutlineSmallText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  btnPrimarySmall: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnPrimarySmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  nivelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  nivelBtnText: { fontWeight: '700', fontSize: 13 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line },
  tabPillActivo: { backgroundColor: '#c1ff72', borderColor: '#c1ff72' },
  tabPillText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  tabPillTextActivo: { color: COLORS.ink900 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontWeight: '700', color: COLORS.ink900, marginTop: 8, marginBottom: 12 },
  emptyModalText: { textAlign: 'center', color: COLORS.ink500, padding: 20 },
  costoText: { fontSize: 12, fontWeight: '700', color: COLORS.danger, marginBottom: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontWeight: '900', fontSize: 17, color: COLORS.ink900, marginBottom: 10 },
  hintText: { fontSize: 12, color: COLORS.ink500, marginBottom: 10 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: COLORS.line, marginBottom: 10 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 2, borderColor: 'transparent' },
  tabBtnActivo: { borderColor: COLORS.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.ink500 },
  tabBtnTextActivo: { color: COLORS.primary },
  resultRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10 },
  resultRowActivo: { backgroundColor: COLORS.primarySoft },
  resultName: { fontSize: 13, fontWeight: '600', color: COLORS.ink900 },
  resultPhone: { fontSize: 11, color: COLORS.ink500 },
  divider: { borderTopWidth: 1, borderColor: COLORS.line, marginTop: 10, marginBottom: 10 },
  switchLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink700 },
  modalCancelLink: { alignSelf: 'center', padding: 12, marginTop: 4 },
  modalCancelLinkText: { color: COLORS.ink500, fontWeight: '600' },
});
