import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  Switch, ActivityIndicator, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI, fincaAPI, trabajadoresAPI, vacantesAPI } from '../../../services/api';
import Avatar from './Avatar';
import { formatMoney, asText } from '../../../utils/fincaFormat';
import { useToast } from './useFincaToast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// Cada labor tiene su propio color e ícono, para reconocerla de un vistazo
// sin leer el texto (pensado para capataces con poco uso de tecnología).
const LABORES_JORNADA = [
  { label: 'Recolección', icon: 'basket-outline', color: 'primary' },
  { label: 'Desyerba / Guadaña', icon: 'cut-outline', color: 'warning' },
  { label: 'Fumigación', icon: 'flask-outline', color: 'danger' },
  { label: 'Fertilización', icon: 'leaf-outline', color: 'info' },
  { label: 'Poda', icon: 'construct-outline', color: 'accent' },
  { label: 'Siembra', icon: 'flower-outline', color: 'primary' },
];

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  info: '#2563eb', infoSoft: '#e0edff',
  accent: '#5a7d12', accentSoft: '#f3ffd9',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0', white: '#ffffff',
};

function laborStyle(color, activo) {
  const map = {
    primary: { bg: activo ? COLORS.primary : COLORS.primarySoft, fg: activo ? '#fff' : COLORS.primaryDark },
    warning: { bg: activo ? COLORS.warning : COLORS.warningSoft, fg: activo ? '#fff' : COLORS.warning },
    danger: { bg: activo ? COLORS.danger : COLORS.dangerSoft, fg: activo ? '#fff' : COLORS.danger },
    info: { bg: activo ? COLORS.info : COLORS.infoSoft, fg: activo ? '#fff' : COLORS.info },
    accent: { bg: activo ? COLORS.accent : COLORS.accentSoft, fg: activo ? '#fff' : COLORS.ink900 },
    ink: { bg: activo ? COLORS.ink700 : COLORS.lineLight, fg: activo ? '#fff' : COLORS.ink700 },
  };
  return map[color] || map.ink;
}
function laborInfo(label) {
  return LABORES_JORNADA.find((l) => l.label === label) || { label, icon: 'ellipsis-horizontal', color: 'ink' };
}

// ── Persistencia local (equivalente a localStorage del web) ────────────────
const LABORES_PERSONALIZADAS_KEY = 'cuaderno_labores_personalizadas_v1';
const CACHE_KEY = 'cuaderno_cierre_cache_v1';
const BORRADOR_KEY = 'cuaderno_cierre_borrador_v1';

async function leerJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
async function guardarJSON(key, data) {
  try { await AsyncStorage.setItem(key, JSON.stringify(data)); } catch { /* no-op */ }
}

function pad(n) { return String(n).padStart(2, '0'); }
function hoyYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function lunesKey() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function leerCache() {
  const data = await leerJSON(CACHE_KEY, null);
  if (data?.semana !== lunesKey()) { await AsyncStorage.removeItem(CACHE_KEY); return null; }
  return data;
}
async function guardarCache(data) { await guardarJSON(CACHE_KEY, { ...data, semana: lunesKey() }); }

async function leerBorrador() {
  const data = await leerJSON(BORRADOR_KEY, null);
  if (data?.fecha !== hoyYMD()) { await AsyncStorage.removeItem(BORRADOR_KEY); return null; }
  return data;
}
async function guardarBorrador(data) { await guardarJSON(BORRADOR_KEY, data); }
async function borrarBorrador() { try { await AsyncStorage.removeItem(BORRADOR_KEY); } catch { /* no-op */ } }

function horasEntre(entrada, salida) {
  if (!entrada || !salida) return null;
  const [h1, m1] = entrada.split(':').map(Number);
  const [h2, m2] = salida.split(':').map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins <= 0) return null;
  return Math.round((mins / 60) * 10) / 10;
}

function nuevoTrabajador(base) {
  return {
    key: base.trabajador_id ? `t-${base.trabajador_id}` : `m-${base.manual_nombre || base.nombre}`,
    trabajador_id: base.trabajador_id || null,
    nombre: base.nombre,
    foto: base.foto || null,
    manual_telefono: base.manual_telefono || '',
    tipo_pago: base.tipo_pago || 'jornal',
    labores: base.labores || [],
    hora_entrada: '',
    hora_salida: '',
    cantidad_kg: '',
    deuda_alimentacion: false,
    deuda_otro: '',
    deuda_concepto: '',
  };
}

function pagoBruto(t, precios) {
  const kg = Number(t.cantidad_kg) || 0;
  const pj = Number(precios.jornal) || 0;
  const pk = Number(precios.kilo) || 0;
  if (t.tipo_pago === 'por_kilo') return Math.round(kg * pk);
  if (t.tipo_pago === 'mixto') return Math.round(pj + kg * pk);
  return pj;
}
function deudaDe(t, precios) {
  return (t.deuda_alimentacion ? Number(precios.alimentacion) || 0 : 0) + (Number(t.deuda_otro) || 0);
}

const TIPOS_PAGO = [
  { key: 'jornal', label: 'Jornal' },
  { key: 'por_kilo', label: 'Por kilo' },
  { key: 'mixto', label: 'Mixto' },
];

// ── Chip genérico ───────────────────────────────────────────────────────────
function Chip({ label, icon, color = 'ink', activo, onPress, small }) {
  const s = laborStyle(color, activo);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, small && styles.chipSmall, { backgroundColor: s.bg, borderColor: s.bg }]}
    >
      {icon && <Ionicons name={icon} size={small ? 13 : 15} color={s.fg} />}
      <Text style={[styles.chipText, small && styles.chipTextSmall, { color: s.fg }]}>{label}</Text>
    </Pressable>
  );
}

// ── "Otro": escribir una labor nueva; queda guardada en el dispositivo ──────
function SelectorOtro({ onAgregar }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  if (!abierto) {
    return <Chip label="Otro" icon="ellipsis-horizontal" color="ink" onPress={() => { animate(); setAbierto(true); }} />;
  }
  const confirmar = () => {
    const nombre = texto.trim();
    setAbierto(false); setTexto('');
    if (nombre) onAgregar(nombre);
  };
  return (
    <View style={styles.otroRow}>
      <TextInput placeholderTextColor={COLORS.ink400}
        autoFocus
        value={texto}
        onChangeText={setTexto}
        placeholder="Ej: Mantenimiento general"
        style={styles.otroInput}
        onSubmitEditing={confirmar}
      />
      <Pressable style={styles.otroBtn} onPress={confirmar}>
        <Text style={styles.otroBtnText}>Guardar</Text>
      </Pressable>
    </View>
  );
}

function PasoBadge({ n, color = 'primary' }) {
  const bg = { primary: COLORS.primary, warning: COLORS.warning, info: COLORS.info, danger: COLORS.danger }[color] || COLORS.primary;
  return (
    <View style={[styles.pasoBadge, { backgroundColor: bg }]}>
      <Text style={styles.pasoBadgeText}>{n}</Text>
    </View>
  );
}

// ── Tarjeta de trabajador dentro de la jornada ──────────────────────────────
function TrabajadorJornadaCard({ t, precios, onChange, onQuitar, laboresPersonalizadas, onAgregarLaborPersonalizada }) {
  const [open, setOpen] = useState(true);
  const bruto = pagoBruto(t, precios);
  const deuda = deudaDe(t, precios);
  const upd = (k, v) => onChange({ ...t, [k]: v });
  const labores = t.labores || [];
  const toggleLabor = (label) => upd('labores', labores.includes(label) ? labores.filter((l) => l !== label) : [...labores, label]);

  return (
    <View style={styles.card}>
      <Pressable style={styles.rowBetween} onPress={() => { animate(); setOpen((o) => !o); }}>
        <Avatar src={t.foto} name={t.nombre} size={44} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.rowStart}>
            <Text style={styles.cardName}>{t.nombre}</Text>
            {!t.trabajador_id && <Text style={styles.badgeExterno}>externo</Text>}
          </View>
          {labores.length > 0 && (
            <View style={[styles.wrapRow, { marginTop: 4 }]}>
              {labores.map((l) => {
                const info = laborInfo(l);
                return <Chip key={l} label={l} icon={info.icon} color={info.color} activo small onPress={() => {}} />;
              })}
            </View>
          )}
          <View style={styles.rowStart}>
            <Text style={styles.moneyPrimary}>{formatMoney(bruto)}</Text>
            {deuda > 0 && (
              <>
                <Text style={styles.dotSep}> · </Text>
                <Text style={styles.moneyDanger}>debe {formatMoney(deuda)}</Text>
                <Text style={styles.dotSep}> · </Text>
                <Text style={styles.moneyBold}>neto {formatMoney(bruto - deuda)}</Text>
              </>
            )}
          </View>
        </View>
        <Pressable onPress={() => onQuitar(t)} hitSlop={8} style={{ padding: 8 }}>
          <Ionicons name="trash-outline" size={16} color={COLORS.ink400} />
        </Pressable>
        <Ionicons name="chevron-down" size={18} color={COLORS.ink400} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

      {open && (
        <View style={styles.cardBody}>
          <Text style={styles.smallLabel}>¿Qué hizo hoy? (toca una o varias)</Text>
          <View style={styles.wrapRow}>
            {LABORES_JORNADA.map((l) => (
              <Chip key={l.label} label={l.label} icon={l.icon} color={l.color} activo={labores.includes(l.label)} onPress={() => toggleLabor(l.label)} />
            ))}
            {laboresPersonalizadas.map((nombre) => (
              <Chip key={nombre} label={nombre} icon="ellipsis-horizontal" color="ink" activo={labores.includes(nombre)} onPress={() => toggleLabor(nombre)} />
            ))}
            <SelectorOtro onAgregar={(nombre) => { onAgregarLaborPersonalizada(nombre); toggleLabor(nombre); }} />
          </View>

          <View style={[styles.wrapRow, { marginTop: 10 }]}>
            {TIPOS_PAGO.map((tp) => (
              <Pressable
                key={tp.key}
                onPress={() => upd('tipo_pago', tp.key)}
                style={[styles.tipoPagoBtn, t.tipo_pago === tp.key && styles.tipoPagoBtnActivo]}
              >
                <Text style={[styles.tipoPagoText, t.tipo_pago === tp.key && styles.tipoPagoTextActivo]}>{tp.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.rowStart, { marginTop: 10, gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Hora que entró</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={t.hora_entrada} onChangeText={(v) => upd('hora_entrada', v)} placeholder="06:00" style={styles.input} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Hora que salió</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={t.hora_salida} onChangeText={(v) => upd('hora_salida', v)} placeholder="15:30" style={styles.input} />
            </View>
          </View>

          {(t.tipo_pago === 'por_kilo' || t.tipo_pago === 'mixto') && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>¿Cuántos kilos recogió?</Text>
              <TextInput placeholderTextColor={COLORS.ink400}
                value={String(t.cantidad_kg)} onChangeText={(v) => upd('cantidad_kg', v)}
                keyboardType="decimal-pad" placeholder="0" style={styles.input}
              />
            </View>
          )}

          <View style={styles.deudaBox}>
            <Text style={styles.smallLabel}>¿Debe algo? (opcional)</Text>
            <View style={[styles.rowStart, { marginTop: 6 }]}>
              <Switch value={t.deuda_alimentacion} onValueChange={(v) => upd('deuda_alimentacion', v)} trackColor={{ true: COLORS.primary }} />
              <Text style={styles.switchLabel}>Alimentación ({formatMoney(Number(precios.alimentacion) || 0)})</Text>
            </View>
            <View style={[styles.rowStart, { marginTop: 8, gap: 8 }]}>
              <TextInput placeholderTextColor={COLORS.ink400}
                placeholder="Tienda / otro ($)" keyboardType="numeric" value={String(t.deuda_otro)}
                onChangeText={(v) => upd('deuda_otro', v)} style={[styles.input, { flex: 1 }]}
              />
              <TextInput placeholderTextColor={COLORS.ink400}
                placeholder="Concepto (ej: tienda)" value={t.deuda_concepto}
                onChangeText={(v) => upd('deuda_concepto', v)} style={[styles.input, { flex: 1 }]}
              />
            </View>
          </View>

          <View style={styles.totalBox}>
            <View>
              <Text style={styles.totalLabel}>Pago del día</Text>
              <Text style={styles.totalValuePrimary}>{formatMoney(bruto)}</Text>
            </View>
            {deuda > 0 && (
              <>
                <View>
                  <Text style={styles.totalLabel}>Debe</Text>
                  <Text style={styles.totalValueDanger}>-{formatMoney(deuda)}</Text>
                </View>
                <View>
                  <Text style={styles.totalLabel}>Neto a pagar</Text>
                  <Text style={styles.totalValueInk}>{formatMoney(bruto - deuda)}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Cierre de jornada estilo "cuaderno": se llena una sola vez al final del día.
 * Crea la jornada + asistencias + registros + deudas y la deja cerrada.
 */
export default function CerrarJornadaScreen({ navigation, route }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [preciosOpen, setPreciosOpen] = useState(false);
  const [externoOpen, setExternoOpen] = useState(false);

  const [fecha, setFecha] = useState(route.params?.fecha || hoyYMD());
  const [vacanteId, setVacanteId] = useState('');
  const [vacantes, setVacantes] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [fincaSel, setFincaSel] = useState('');
  const [labor, setLabor] = useState('');
  const [titulo, setTitulo] = useState('');
  const [precios, setPrecios] = useState({ jornal: '', kilo: '', alimentacion: '' });
  const [trabajadores, setTrabajadores] = useState([]);
  const [sugeridos, setSugeridos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [externo, setExterno] = useState({ nombre: '', telefono: '' });
  const [costosGenerales, setCostosGenerales] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [laboresPersonalizadas, setLaboresPersonalizadas] = useState([]);

  useEffect(() => {
    leerJSON(LABORES_PERSONALIZADAS_KEY, []).then(setLaboresPersonalizadas);
    vacantesAPI.misVacantes().then((r) => setVacantes(r.data?.vacantes || [])).catch(() => {});
  }, []);
  const agregarLaborPersonalizada = (nombre) => {
    setLaboresPersonalizadas((prev) => {
      if (prev.some((l) => l.toLowerCase() === nombre.toLowerCase())) return prev;
      const next = [...prev, nombre];
      guardarJSON(LABORES_PERSONALIZADAS_KEY, next);
      return next;
    });
  };

  // Restaurar borrador del día, o si no hay, la plantilla semanal
  useEffect(() => {
    (async () => {
      const c = await leerCache();
      const borrador = await leerBorrador();
      if (borrador) {
        setVacanteId(borrador.vacante_id || '');
        setLabor(borrador.labor || '');
        setTitulo(borrador.titulo || '');
        setPrecios(borrador.precios || { jornal: '', kilo: '', alimentacion: '' });
        setSugeridos(borrador.sugeridos || []);
        setTrabajadores(borrador.trabajadores || []);
        setCostosGenerales(borrador.costosGenerales || '');
        setObservaciones(borrador.observaciones || '');
        setPreciosOpen(!borrador.precios?.jornal);
        toast.info('Recuperamos lo que habías escrito antes de guardar');
      } else {
        setVacanteId(c?.vacante_id || '');
        setLabor(c?.labor || '');
        setTitulo(c?.titulo || '');
        setPrecios(c?.precios || { jornal: '', kilo: '', alimentacion: '' });
        setSugeridos(c?.sugeridos || []);
        setTrabajadores((c?.trabajadores || []).map(nuevoTrabajador));
        setPreciosOpen(!c?.precios?.jornal);
      }
      fincaAPI.misFincas().then((r) => {
        const list = r.data?.fincas || [];
        setFincas(list);
        setFincaSel((prev) => prev || c?.finca || list[0]?.nombre || '');
      }).catch(() => {});
      // Trabajadores propios como base de sugeridos si no hay caché de la semana.
      if (!c?.sugeridos?.length) {
        cuadernoAPI.misTrabajadores().then((r) => {
          const propios = (r.data?.trabajadores || []).slice(0, 10).map((p) => ({
            trabajador_id: p.trabajador_id || null,
            trabajador_externo_id: p.trabajador_externo_id || null,
            nombre: p.nombre,
            foto: p.foto || null,
            manual_telefono: p.telefono || '',
          }));
          setSugeridos((prev) => (prev.length ? prev : propios));
        }).catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguarda borrador del día completo mientras se escribe
  useEffect(() => {
    guardarBorrador({ fecha, vacante_id: vacanteId, labor, titulo, precios, sugeridos, trabajadores, costosGenerales, observaciones });
  }, [fecha, vacanteId, labor, titulo, precios, sugeridos, trabajadores, costosGenerales, observaciones]);

  useEffect(() => {
    if (!vacanteId) return;
    const v = vacantes.find((x) => String(x.id) === String(vacanteId));
    if (v) setTitulo((t) => t || asText(v.titulo));
    cuadernoAPI.postulantesVacante(vacanteId).then((r) => {
      const post = (r.data?.postulantes || []).filter((p) => p.postulacion_estado === 'aceptada');
      setSugeridos((prev) => {
        const merged = [...prev];
        for (const p of post) {
          const id = p.trabajador_id;
          if (!id || merged.some((s) => s.trabajador_id === id)) continue;
          merged.push({ trabajador_id: id, nombre: asText(p.nombre_completo), foto: p.foto_selfie || null });
        }
        return merged;
      });
    }).catch(() => {});
  }, [vacanteId]);

  useEffect(() => { if (labor) setTitulo(labor); }, [labor]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busqueda.trim().length < 2) { setResultados([]); return; }
      setBuscando(true);
      try {
        const r = await trabajadoresAPI.listar({});
        const q = busqueda.trim().toLowerCase();
        const filtrados = (r.data?.trabajadores || []).filter((x) => (x.nombre_completo || '').toLowerCase().includes(q));
        setResultados(filtrados);
      } catch { setResultados([]); } finally { setBuscando(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const seleccionKey = (s) => (s.trabajador_id ? `t-${s.trabajador_id}` : `m-${s.nombre}`);

  const toggleSeleccion = (s) => {
    setTrabajadores((prev) => {
      const key = seleccionKey(s);
      const existe = prev.find((t) => t.key === key);
      if (existe) return prev.filter((t) => t.key !== key);
      return [...prev, nuevoTrabajador({ ...s, manual_nombre: s.nombre, labores: labor ? [labor] : [] })];
    });
  };

  const agregarRegistrado = (r) => {
    const s = { trabajador_id: r.id, nombre: asText(r.nombre_completo), foto: r.foto_selfie || null };
    setSugeridos((prev) => (prev.some((x) => x.trabajador_id === r.id) ? prev : [...prev, s]));
    if (!trabajadores.some((t) => t.trabajador_id === r.id)) toggleSeleccion(s);
    setBusqueda(''); setResultados([]);
  };

  const agregarExterno = () => {
    const nombre = externo.nombre.trim();
    if (!nombre) { toast.error('El nombre es obligatorio'); return; }
    const s = { trabajador_id: null, nombre, manual_telefono: externo.telefono };
    setSugeridos((prev) => (prev.some((x) => !x.trabajador_id && x.nombre === nombre) ? prev : [...prev, s]));
    if (!trabajadores.some((t) => !t.trabajador_id && t.nombre === nombre)) {
      setTrabajadores((prev) => [...prev, nuevoTrabajador({ ...s, manual_nombre: nombre, labores: labor ? [labor] : [] })]);
    }
    setExterno({ nombre: '', telefono: '' }); setExternoOpen(false);
  };

  const totalDia = trabajadores.reduce((s, t) => s + pagoBruto(t, precios), 0);
  const totalDeudas = trabajadores.reduce((s, t) => s + deudaDe(t, precios), 0);

  const cerrarJornada = async () => {
    if (!fecha) { toast.error('La fecha es obligatoria'); return; }
    if (trabajadores.length === 0) { toast.error('Agrega al menos un trabajador'); return; }
    const sinPrecio = trabajadores.some((t) =>
      (t.tipo_pago !== 'por_kilo' && !Number(precios.jornal)) ||
      (t.tipo_pago !== 'jornal' && !Number(precios.kilo)));
    if (sinPrecio) { toast.error('Configura el precio del jornal y/o del kilo arriba'); setPreciosOpen(true); return; }

    setSaving(true);
    try {
      const r = await cuadernoAPI.crearJornada({
        fecha, titulo: titulo || labor || 'Jornada', finca: fincaSel || null,
        tipo_trabajo: labor || null, vacante_id: vacanteId ? Number(vacanteId) : null,
        tipo_pago_default: trabajadores[0]?.tipo_pago || 'jornal',
        precio_jornal: Number(precios.jornal) || null, precio_kilo: Number(precios.kilo) || null,
        costos_generales: Number(costosGenerales) || 0, observaciones: observaciones || null,
      });
      const jornadaId = r.data?.id;
      if (!jornadaId) throw new Error('sin id');

      for (const t of trabajadores) {
        await cuadernoAPI.agregarAsistencia(jornadaId, t.trabajador_id
          ? { trabajador_id: t.trabajador_id }
          : { manual_nombre: t.nombre, manual_telefono: t.manual_telefono || null });
      }

      const det = await cuadernoAPI.detalleJornada(jornadaId);
      const asistencias = det.data?.asistencias || [];
      for (const t of trabajadores) {
        const a = asistencias.find((x) => t.trabajador_id
          ? Number(x.trabajador_id) === Number(t.trabajador_id)
          : (x.manual_nombre || '') === t.nombre);
        if (!a) continue;
        await cuadernoAPI.actualizarAsistencia(a.id, {
          estado: 'llego',
          ...(t.hora_entrada && !a.hora_llegada ? { hora_llegada: `${t.hora_entrada}:00` } : {}),
          ...(t.hora_salida && !a.hora_salida ? { hora_salida: `${t.hora_salida}:00` } : {}),
        });
        const horas = horasEntre(t.hora_entrada, t.hora_salida);
        const partesNota = [];
        if (t.labores?.length) partesNota.push(`Labor: ${t.labores.join(', ')}`);
        if (t.hora_entrada && t.hora_salida) partesNota.push(`Entró ${t.hora_entrada} · salió ${t.hora_salida}`);
        await cuadernoAPI.upsertRegistro(a.id, {
          cantidad_kg: t.tipo_pago === 'jornal' ? null : Number(t.cantidad_kg) || null,
          horas, tipo_pago: t.tipo_pago,
          precio_jornal: t.tipo_pago === 'por_kilo' ? null : Number(precios.jornal) || null,
          precio_kilo: t.tipo_pago === 'jornal' ? null : Number(precios.kilo) || null,
          estado: 'completo', notas: partesNota.length ? partesNota.join(' · ') : null, pagado: 0,
        });
        if (t.deuda_alimentacion && Number(precios.alimentacion) > 0) {
          await cuadernoAPI.agregarAjuste(a.id, { tipo: 'descuento', monto: Number(precios.alimentacion), motivo: 'Alimentación' }).catch(() => {});
        }
        if (Number(t.deuda_otro) > 0) {
          await cuadernoAPI.agregarAjuste(a.id, { tipo: 'descuento', monto: Number(t.deuda_otro), motivo: t.deuda_concepto || 'Tienda / otro' }).catch(() => {});
        }
      }

      await cuadernoAPI.actualizarJornada(jornadaId, { estado: 'cerrada' });

      await guardarCache({
        vacante_id: vacanteId, finca: fincaSel, labor, titulo, precios, sugeridos,
        trabajadores: trabajadores.map((t) => ({
          trabajador_id: t.trabajador_id, nombre: t.nombre, foto: t.foto,
          manual_nombre: t.nombre, manual_telefono: t.manual_telefono,
          tipo_pago: t.tipo_pago, labores: t.labores, hora_entrada: t.hora_entrada, hora_salida: t.hora_salida,
        })),
      });

      await borrarBorrador();
      toast.success('Jornada cerrada y guardada');
      navigation.replace('DetalleJornada', { jornadaId });
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar la jornada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.modalHeader}>
        <Pressable onPress={() => !saving && navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COLORS.ink900} />
        </Pressable>
        <Text style={styles.modalTitle}>Nueva jornada</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.ayudaBtn} onPress={() => { animate(); setAyudaOpen((o) => !o); }}>
          <View style={styles.rowStart}>
            <Ionicons name="help-circle-outline" size={16} color={COLORS.info} />
            <Text style={styles.ayudaBtnText}>  ¿Cómo funciona una jornada?</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={COLORS.info} style={{ transform: [{ rotate: ayudaOpen ? '180deg' : '0deg' }] }} />
        </Pressable>
        {ayudaOpen && (
          <Text style={styles.ayudaText}>
            El cuaderno se llena una sola vez al final del día: eliges los trabajadores, marcas qué hizo cada
            uno y el pago se calcula solo con los precios que configures. Al guardar, la jornada queda
            cerrada y la nómina de la semana se arma sola. El formulario recuerda los trabajadores y
            precios toda la semana (se limpia cada lunes).
          </Text>
        )}

        {/* Paso 1 */}
        <View style={styles.step}>
          <View style={styles.rowStart}>
            <PasoBadge n={1} color="primary" />
            <Text style={styles.stepTitle}>  ¿Cuándo fue la jornada?</Text>
          </View>
          <Text style={styles.fieldLabel}>Fecha (AAAA-MM-DD)</Text>
          <TextInput placeholderTextColor={COLORS.ink400} value={fecha} onChangeText={setFecha} style={styles.input} placeholder="2026-07-16" />
          <Text style={styles.fieldLabel}>Vacante asociada (opcional)</Text>
          <View style={styles.wrapRow}>
            <Chip label="— Sin vacante —" activo={!vacanteId} color="ink" onPress={() => setVacanteId('')} />
            {vacantes.map((v) => (
              <Chip key={v.id} label={asText(v.titulo) || `Vacante ${v.id}`} activo={String(vacanteId) === String(v.id)} color="primary" onPress={() => setVacanteId(v.id)} />
            ))}
          </View>
        </View>

        {fincas.length > 0 && (
          <View style={styles.step}>
            <Text style={styles.fieldLabel}>Finca</Text>
            <View style={styles.wrapRow}>
              {fincas.map((f) => (
                <Chip key={f.id} label={f.nombre} activo={fincaSel === f.nombre} color="primary" onPress={() => setFincaSel(f.nombre)} />
              ))}
            </View>
          </View>
        )}

        {/* Paso 2 */}
        <View style={styles.step}>
          <View style={styles.rowStart}>
            <PasoBadge n={2} color="warning" />
            <Text style={styles.stepTitle}>  ¿Qué se va a hacer, en general?</Text>
          </View>
          <Text style={styles.hintText}>Puedes cambiarla persona por persona más abajo.</Text>
          <View style={styles.wrapRow}>
            {LABORES_JORNADA.map((l) => (
              <Chip key={l.label} label={l.label} icon={l.icon} color={l.color} activo={labor === l.label} onPress={() => setLabor(l.label)} />
            ))}
            {laboresPersonalizadas.map((nombre) => (
              <Chip key={nombre} label={nombre} icon="ellipsis-horizontal" color="ink" activo={labor === nombre} onPress={() => setLabor(nombre)} />
            ))}
            <SelectorOtro onAgregar={(nombre) => { agregarLaborPersonalizada(nombre); setLabor(nombre); }} />
          </View>
          <TextInput placeholderTextColor={COLORS.ink400} value={titulo} onChangeText={setTitulo} placeholder="Título de la jornada" style={[styles.input, { marginTop: 8 }]} />
        </View>

        {/* Precios (colapsable) */}
        <Pressable style={styles.preciosHeader} onPress={() => { animate(); setPreciosOpen((o) => !o); }}>
          <View style={styles.rowStart}>
            <PasoBadge n={3} color="warning" />
            <Text style={styles.stepTitle}>  Precios: jornal, kilo y alimentación</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={COLORS.ink700} style={{ transform: [{ rotate: preciosOpen ? '180deg' : '0deg' }] }} />
        </Pressable>
        {preciosOpen && (
          <View style={styles.preciosBody}>
            <Text style={styles.fieldLabel}>Precio jornal (COP)</Text>
            <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.jornal)} onChangeText={(v) => setPrecios((p) => ({ ...p, jornal: v }))} keyboardType="numeric" placeholder="Ej: 70000" style={styles.input} />
            <Text style={styles.fieldLabel}>Precio por kilo (COP)</Text>
            <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.kilo)} onChangeText={(v) => setPrecios((p) => ({ ...p, kilo: v }))} keyboardType="numeric" placeholder="Ej: 1100" style={styles.input} />
            <Text style={styles.fieldLabel}>Precio alimentación (COP)</Text>
            <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.alimentacion)} onChangeText={(v) => setPrecios((p) => ({ ...p, alimentacion: v }))} keyboardType="numeric" placeholder="Ej: 12000" style={styles.input} />
          </View>
        )}

        {/* Trabajadores */}
        <View style={styles.step}>
          <View style={styles.rowStart}>
            <PasoBadge n={4} color="primary" />
            <Text style={styles.stepTitle}>  Trabajadores de la jornada</Text>
          </View>
          <Text style={styles.hintText}>Toca los nombres para agregarlos o quitarlos.</Text>

          {sugeridos.length > 0 && (
            <View style={[styles.wrapRow, { marginTop: 8 }]}>
              {sugeridos.map((s) => {
                const activo = trabajadores.some((t) => t.key === seleccionKey(s));
                return (
                  <Pressable key={seleccionKey(s)} onPress={() => toggleSeleccion(s)} style={[styles.sugeridoChip, activo && styles.sugeridoChipActivo]}>
                    <Avatar src={s.foto} name={s.nombre} size={24} />
                    <Text style={[styles.sugeridoText, activo && styles.sugeridoTextActivo]}>  {s.nombre}</Text>
                    {!s.trabajador_id && <Text style={styles.badgeExterno}>  externo</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={[styles.rowStart, { marginTop: 10 }]}>
            <Ionicons name="search" size={15} color={COLORS.ink400} />
            <TextInput placeholderTextColor={COLORS.ink400}
              placeholder="Buscar registrado en TerraEmpleo…" value={busqueda} onChangeText={setBusqueda}
              style={[styles.input, { flex: 1, marginLeft: 6 }]}
            />
          </View>
          {buscando && <ActivityIndicator style={{ marginTop: 6 }} />}
          {resultados.slice(0, 8).map((r) => (
            <Pressable key={r.id} onPress={() => agregarRegistrado(r)} style={styles.resultRow}>
              <Avatar src={r.foto_selfie} name={asText(r.nombre_completo)} size={30} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.resultName}>{asText(r.nombre_completo)}</Text>
                {r.celular && <Text style={styles.resultPhone}>{r.celular}</Text>}
              </View>
              <Ionicons name="add" size={14} color={COLORS.primary} />
            </Pressable>
          ))}

          <Pressable style={[styles.rowStart, { marginTop: 12 }]} onPress={() => { animate(); setExternoOpen((o) => !o); }}>
            <Ionicons name="person-add-outline" size={15} color={COLORS.primary} />
            <Text style={styles.externoToggle}>  ¿No aparece? Agrégalo como externo</Text>
          </Pressable>
          {externoOpen && (
            <View style={{ marginTop: 8, gap: 8 }}>
              <TextInput placeholderTextColor={COLORS.ink400} placeholder="Nombre completo" value={externo.nombre} onChangeText={(v) => setExterno((x) => ({ ...x, nombre: v }))} style={styles.input} />
              <TextInput placeholderTextColor={COLORS.ink400} placeholder="Teléfono (opcional)" keyboardType="phone-pad" value={externo.telefono} onChangeText={(v) => setExterno((x) => ({ ...x, telefono: v }))} style={styles.input} />
              <Pressable style={styles.addBtn} onPress={agregarExterno}><Text style={styles.addBtnText}>Agregar</Text></Pressable>
            </View>
          )}

          {trabajadores.map((t) => (
            <TrabajadorJornadaCard
              key={t.key} t={t} precios={precios}
              onChange={(nt) => setTrabajadores((prev) => prev.map((x) => (x.key === nt.key ? nt : x)))}
              onQuitar={(x) => setTrabajadores((prev) => prev.filter((y) => y.key !== x.key))}
              laboresPersonalizadas={laboresPersonalizadas}
              onAgregarLaborPersonalizada={agregarLaborPersonalizada}
            />
          ))}
        </View>

        {/* Gastos y observaciones */}
        <View style={styles.step}>
          <Text style={styles.fieldLabel}>Costos generales del día (transporte, comida, etc.)</Text>
          <TextInput placeholderTextColor={COLORS.ink400} value={String(costosGenerales)} onChangeText={setCostosGenerales} keyboardType="numeric" placeholder="0" style={styles.input} />
          <Text style={styles.fieldLabel}>Observaciones (opcional)</Text>
          <TextInput placeholderTextColor={COLORS.ink400} value={observaciones} onChangeText={setObservaciones} placeholder="Notas del día" style={[styles.input, { height: 70 }]} multiline />
        </View>

        {trabajadores.length > 0 && (
          <View style={styles.resumenBox}>
            <View style={styles.rowStart}>
              <Ionicons name="people-outline" size={16} color={COLORS.primaryDark} />
              <Text style={styles.resumenText}>  {trabajadores.length} trabajador{trabajadores.length !== 1 ? 'es' : ''}</Text>
            </View>
            <Text style={styles.resumenTotal}>{formatMoney(totalDia)}</Text>
            {totalDeudas > 0 && <Text style={styles.resumenDeuda}>deudas -{formatMoney(totalDeudas)}</Text>}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 40 }}>
          <Pressable style={styles.btnGhost} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={styles.btnGhostText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={cerrarJornada} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <View style={styles.rowStart}>
                <Ionicons name="archive-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>  Cerrar jornada</Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: COLORS.line },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink900 },
  container: { padding: 16, paddingBottom: 120, gap: 14 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  ayudaBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: COLORS.infoSoft },
  ayudaBtnText: { color: COLORS.info, fontWeight: '700', fontSize: 13 },
  ayudaText: { fontSize: 12, color: COLORS.ink700, marginTop: -4, paddingHorizontal: 4 },
  step: { borderWidth: 2, borderColor: COLORS.line, borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  stepTitle: { fontWeight: '900', color: COLORS.ink900, fontSize: 14 },
  hintText: { fontSize: 12, color: COLORS.ink500, marginBottom: 8, marginLeft: 30 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  smallLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink900, backgroundColor: '#fff' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontWeight: '700', fontSize: 13 },
  chipTextSmall: { fontSize: 11 },
  otroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  otroInput: { borderWidth: 2, borderColor: COLORS.ink400, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: COLORS.ink900, width: 170 },
  otroBtn: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  otroBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pasoBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pasoBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  preciosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: COLORS.warningSoft, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(217,119,6,0.3)' },
  preciosBody: { padding: 4 },
  card: { borderWidth: 2, borderColor: COLORS.line, borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  cardName: { fontWeight: '900', color: COLORS.ink900, fontSize: 15 },
  badgeExterno: { fontSize: 10, fontWeight: '600', color: COLORS.ink400, backgroundColor: COLORS.lineLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginLeft: 6 },
  moneyPrimary: { fontWeight: '700', color: COLORS.primary, fontSize: 12 },
  moneyDanger: { fontWeight: '700', color: COLORS.danger, fontSize: 12 },
  moneyBold: { fontWeight: '700', color: COLORS.ink900, fontSize: 12 },
  dotSep: { color: COLORS.ink500 },
  cardBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: COLORS.line },
  tipoPagoBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.primarySoft, alignItems: 'center' },
  tipoPagoBtnActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoPagoText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  tipoPagoTextActivo: { color: '#fff' },
  deudaBox: { marginTop: 10, backgroundColor: COLORS.lineLight, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, padding: 10 },
  switchLabel: { marginLeft: 8, fontSize: 13, color: COLORS.ink700 },
  totalBox: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12 },
  totalLabel: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  totalValuePrimary: { fontSize: 17, fontWeight: '900', color: COLORS.primaryDark },
  totalValueDanger: { fontSize: 17, fontWeight: '900', color: COLORS.danger },
  totalValueInk: { fontSize: 17, fontWeight: '900', color: COLORS.ink900 },
  sugeridoChip: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  sugeridoChipActivo: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  sugeridoText: { fontSize: 13, fontWeight: '600', color: COLORS.ink700 },
  sugeridoTextActivo: { color: COLORS.primaryDark },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  resultName: { fontSize: 13, fontWeight: '600', color: COLORS.ink900 },
  resultPhone: { fontSize: 11, color: COLORS.ink500 },
  externoToggle: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  resumenBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(0,141,73,0.2)', padding: 14, flexWrap: 'wrap', gap: 6 },
  resumenText: { fontWeight: '700', color: COLORS.primaryDark },
  resumenTotal: { fontWeight: '900', color: COLORS.primaryDark, fontSize: 17 },
  resumenDeuda: { color: COLORS.danger, fontWeight: '700' },
  btnGhost: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnGhostText: { fontWeight: '700', color: COLORS.ink700 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
