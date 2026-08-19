import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  Switch, ActivityIndicator, LayoutAnimation, Platform, UIManager, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI, fincaAPI, trabajadoresAPI, vacantesAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import { TUTORIALES } from '../../../context/TutorialContext';
import useTutorialPrimeraVez from '../../../hooks/useTutorialPrimeraVez';
import TutorialOverlay from '../../../components/tutorial/TutorialOverlay';
import Avatar from './Avatar';
import HoraField from '../../../components/ui/HoraField';
import CalendarioModal from '../../../components/ui/CalendarioModal';
import { formatMoney, asText, normalizarTexto, coincideTexto } from '../../../utils/fincaFormat';
import { leerPersonalFijo } from '../../../utils/personalFijo';
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
  // Rediseño "solo CSS" del modal de Nueva jornada: fondo blanco/verde
  // uniforme para botones y chips, secciones diferenciadas por fondo.
  surface1: '#FAFAF9', surface2: '#F2F4EE', border: '#e4e6de', textSecondary: '#6b7060',
  seccionBadge: '#1B512D', loteAccent: '#EAF3DE', loteAccentBorder: '#C0DD97',
};

// Chips/botones: blanco en reposo, verde sólido al seleccionar — sin
// colores por categoría ni estados intermedios (regla del rediseño).
function laborStyle(color, activo) {
  return activo
    ? { bg: COLORS.primary, fg: '#fff' }
    : { bg: '#fff', fg: COLORS.textSecondary };
}
function laborInfo(label) {
  return LABORES_JORNADA.find((l) => l.label === label) || { label, icon: 'ellipsis-horizontal', color: 'ink' };
}

// ── Persistencia local (equivalente a localStorage del web) ────────────────
const LABORES_PERSONALIZADAS_KEY = 'cuaderno_labores_personalizadas_v1';
const CACHE_KEY = 'cuaderno_cierre_cache_v1';
const BORRADOR_KEY = 'cuaderno_cierre_borrador_v1';
// Los precios (jornal/kilo/alimentación) no se resetean cada semana como el
// resto de la plantilla — se guardan aparte, sin fecha de vencimiento.
const PRECIOS_KEY = 'cuaderno_precios_v1';

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
const MESES_CORTOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function formatFechaCorta(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return ymd || '';
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
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

let bloqueSeq = 0;
function nuevoBloque(base = {}) {
  return {
    _key: `b-${Date.now()}-${bloqueSeq++}`,
    id: base.id || null,
    cultivo: base.cultivo || '',
    lote_id: base.lote_id || null,
    lote_nombre: base.lote_nombre || null,
    labor: base.labor || '',
    tipo_pago: '',
    horas: '',
    cantidad_kg: '',
    monto_libre: '',
  };
}

function nuevoTrabajador(base) {
  return {
    key: base.trabajador_id ? `t-${base.trabajador_id}` : `m-${base.manual_nombre || base.nombre}`,
    trabajador_id: base.trabajador_id || null,
    nombre: base.nombre,
    foto: base.foto || null,
    manual_telefono: base.manual_telefono || '',
    hora_entrada: '',
    hora_salida: '',
    deuda_alimentacion: false,
    deuda_otro: '',
    deuda_concepto: '',
    entradas: base.entradas?.length ? base.entradas.map((e) => nuevoBloque(e)) : [nuevoBloque({ labor: base.labores?.[0] || '' })],
  };
}

function subtotalBloque(b, precios) {
  const tp = b.tipo_pago;
  if (tp === 'por_kilo') return Math.round((Number(precios.kilo) || 0) * (Number(b.cantidad_kg) || 0));
  if (tp === 'por_hora') return Math.round((Number(precios.hora) || 0) * (Number(b.horas) || 0));
  if (tp === 'libre') return Math.round(Number(b.monto_libre) || 0);
  if (tp === 'jornal') return Math.round(Number(precios.jornal) || 0);
  return 0;
}
function pagoBruto(t, precios) {
  return (t.entradas || []).reduce((s, b) => s + subtotalBloque(b, precios), 0);
}
function deudaDe(t, precios) {
  return (t.deuda_alimentacion ? Number(precios.alimentacion) || 0 : 0) + (Number(t.deuda_otro) || 0);
}

const TIPOS_PAGO = [
  { key: 'jornal', label: 'Jornal' },
  { key: 'por_kilo', label: 'Por kilo' },
  { key: 'por_hora', label: 'Por hora' },
  { key: 'libre', label: 'Monto libre' },
];

// ── Chip genérico ───────────────────────────────────────────────────────────
function Chip({ label, icon, color = 'ink', activo, onPress, small }) {
  const s = laborStyle(color, activo);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, small && styles.chipSmall, { backgroundColor: s.bg, borderColor: activo ? s.bg : COLORS.border }]}
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

function PasoBadge({ n }) {
  return (
    <View style={styles.pasoBadge}>
      <Text style={styles.pasoBadgeText}>{n}</Text>
    </View>
  );
}

// ── Bloque de trabajo (una labor/cultivo dentro de la tarjeta del trabajador) ──
function resumenBloque(b, precios) {
  const partes = [b.cultivo, b.lote_nombre, b.labor].filter(Boolean);
  const tp = TIPOS_PAGO.find((x) => x.key === b.tipo_pago);
  if (tp) {
    if (b.tipo_pago === 'por_kilo' && b.cantidad_kg) partes.push(`${b.cantidad_kg} kg`);
    else if (b.tipo_pago === 'por_hora' && b.horas) partes.push(`${b.horas} h`);
    else partes.push(tp.label);
  }
  const sub = subtotalBloque(b, precios);
  return { texto: partes.length ? partes.join(' · ') : 'Bloque sin configurar', sub };
}

function BloqueCard({ b, index, precios, cultivos, lotesFinca, laboresPersonalizadas, onAgregarLaborPersonalizada, onChange, onQuitar, ocultarQuitar }) {
  const [open, setOpen] = useState(!b.tipo_pago);
  const upd = (k, v) => onChange({ ...b, [k]: v });
  const { texto, sub } = resumenBloque(b, precios);

  return (
    <View style={styles.bloqueCard}>
      <Pressable style={styles.rowBetween} onPress={() => { animate(); setOpen((o) => !o); }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bloqueResumenText} numberOfLines={1}>{texto}</Text>
          {sub > 0 && <Text style={styles.bloqueResumenSub}>{formatMoney(sub)}</Text>}
        </View>
        {!ocultarQuitar && (
          <Pressable onPress={() => onQuitar(b)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={15} color={COLORS.ink400} />
          </Pressable>
        )}
        <Ionicons name="chevron-down" size={16} color={COLORS.ink400} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

      {open && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.smallLabel}>Labor</Text>
          <View style={styles.wrapRow}>
            {LABORES_JORNADA.map((l) => (
              <Chip key={l.label} label={l.label} icon={l.icon} color={l.color} activo={b.labor === l.label} onPress={() => upd('labor', b.labor === l.label ? '' : l.label)} />
            ))}
            {laboresPersonalizadas.map((nombre) => (
              <Chip key={nombre} label={nombre} icon="ellipsis-horizontal" color="ink" activo={b.labor === nombre} onPress={() => upd('labor', b.labor === nombre ? '' : nombre)} />
            ))}
            <SelectorOtro onAgregar={(nombre) => { onAgregarLaborPersonalizada(nombre); upd('labor', nombre); }} />
          </View>

          {lotesFinca.length > 0 && (
            <>
              <Text style={styles.smallLabel}>Lote</Text>
              <View style={styles.wrapRow}>
                {lotesFinca.map((l) => (
                  <Chip
                    key={l.id} label={l.nombre} icon="location-outline" color="primary"
                    activo={b.lote_id === l.id}
                    onPress={() => onChange(b.lote_id === l.id
                      ? { ...b, lote_id: null, lote_nombre: null }
                      : { ...b, lote_id: l.id, lote_nombre: l.nombre })}
                  />
                ))}
              </View>
            </>
          )}

          {cultivos.length > 0 && (
            <>
              <Text style={styles.smallLabel}>Cultivo</Text>
              <View style={styles.wrapRow}>
                {cultivos.map((c) => (
                  <Chip key={c} label={c} color="primary" activo={b.cultivo === c} onPress={() => upd('cultivo', b.cultivo === c ? '' : c)} />
                ))}
              </View>
            </>
          )}

          <Text style={styles.smallLabel}>Tipo de pago</Text>
          <View style={[styles.wrapRow, { marginTop: 10 }]}>
            {TIPOS_PAGO.map((tp) => (
              <Pressable
                key={tp.key}
                onPress={() => upd('tipo_pago', tp.key)}
                style={[styles.tipoPagoBtn, b.tipo_pago === tp.key && styles.tipoPagoBtnActivo]}
              >
                <Text style={[styles.tipoPagoText, b.tipo_pago === tp.key && styles.tipoPagoTextActivo]}>{tp.label}</Text>
              </Pressable>
            ))}
          </View>

          {b.tipo_pago === 'por_kilo' && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>¿Cuántos kilos recogió?</Text>
              <TextInput placeholderTextColor={COLORS.ink400}
                value={String(b.cantidad_kg)} onChangeText={(v) => upd('cantidad_kg', v)}
                keyboardType="decimal-pad" placeholder="0" style={styles.input}
              />
            </View>
          )}
          {b.tipo_pago === 'por_hora' && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>¿Cuántas horas?</Text>
              <TextInput placeholderTextColor={COLORS.ink400}
                value={String(b.horas)} onChangeText={(v) => upd('horas', v)}
                keyboardType="decimal-pad" placeholder="0" style={styles.input}
              />
            </View>
          )}
          {b.tipo_pago === 'libre' && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Monto ($)</Text>
              <TextInput placeholderTextColor={COLORS.ink400}
                value={String(b.monto_libre)} onChangeText={(v) => upd('monto_libre', v)}
                keyboardType="numeric" placeholder="0" style={styles.input}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Tarjeta de trabajador dentro de la jornada ──────────────────────────────
function TrabajadorJornadaCard({ t, precios, onChange, onQuitar, laboresPersonalizadas, onAgregarLaborPersonalizada, lotesFinca }) {
  const [open, setOpen] = useState(true);
  const bruto = pagoBruto(t, precios);
  const deuda = deudaDe(t, precios);
  const upd = (k, v) => onChange({ ...t, [k]: v });
  const cultivos = useMemo(() => [...new Set(lotesFinca.map((l) => l.cultivo).filter(Boolean))], [lotesFinca]);
  const entradas = t.entradas || [];
  const setBloque = (nb) => upd('entradas', entradas.map((b) => (b._key === nb._key ? nb : b)));
  const quitarBloque = (b) => upd('entradas', entradas.filter((x) => x._key !== b._key));
  const agregarBloque = () => {
    const ultimo = entradas[entradas.length - 1];
    upd('entradas', [...entradas, nuevoBloque({ cultivo: ultimo?.cultivo, lote_id: ultimo?.lote_id, lote_nombre: ultimo?.lote_nombre, labor: ultimo?.labor })]);
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.rowBetween} onPress={() => { animate(); setOpen((o) => !o); }}>
        <Avatar src={t.foto} name={t.nombre} size={44} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.rowStart}>
            <Text style={styles.cardName}>{t.nombre}</Text>
            {!t.trabajador_id && <Text style={styles.badgeExterno}>externo</Text>}
          </View>
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
          <Text style={styles.smallLabel}>Bloques de trabajo</Text>
          <View style={{ gap: 8 }}>
            {entradas.map((b, i) => (
              <BloqueCard
                key={b._key} b={b} index={i} precios={precios} cultivos={cultivos} lotesFinca={lotesFinca}
                laboresPersonalizadas={laboresPersonalizadas} onAgregarLaborPersonalizada={onAgregarLaborPersonalizada}
                onChange={setBloque} onQuitar={quitarBloque} ocultarQuitar={entradas.length === 1}
              />
            ))}
          </View>
          <Pressable style={styles.agregarBloqueBtn} onPress={agregarBloque}>
            <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.agregarBloqueText}>  Agregar otro cultivo</Text>
          </Pressable>

          <View style={[styles.rowStart, { marginTop: 10, gap: 8 }]}>
            <HoraField
              label="Hora que entró"
              value={t.hora_entrada}
              onChange={(v) => upd('hora_entrada', v)}
              placeholder="06:00"
              style={{ flex: 1 }}
            />
            <HoraField
              label="Hora que salió"
              value={t.hora_salida}
              onChange={(v) => upd('hora_salida', v)}
              placeholder="15:30"
              style={{ flex: 1 }}
            />
          </View>

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
  const { activeFincaId } = useFinca();
  const [saving, setSaving] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [preciosOpen, setPreciosOpen] = useState(false);
  const [externoOpen, setExternoOpen] = useState(false);

  const [fecha, setFecha] = useState(route.params?.fecha || hoyYMD());
  const [vacanteId, setVacanteId] = useState('');
  const [vacantes, setVacantes] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [fincaSel, setFincaSel] = useState('');
  const [labor, setLabor] = useState([]);
  const toggleLaborGeneral = (l) => setLabor((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  const [titulo, setTitulo] = useState('');
  const [precios, setPrecios] = useState({ jornal: '', kilo: '', hora: '', alimentacion: '' });
  const [trabajadores, setTrabajadores] = useState([]);
  const [sugeridos, setSugeridos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [externo, setExterno] = useState({ nombre: '', telefono: '' });
  const [costosGenerales, setCostosGenerales] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [laboresPersonalizadas, setLaboresPersonalizadas] = useState([]);
  const [lotesFinca, setLotesFinca] = useState([]);
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [huboBorradorOCache, setHuboBorradorOCache] = useState(false);

  // Tutorial de primera vez de Nueva jornada
  const scrollTutorialRef = useRef(null);
  const encabezadoRef = useRef(null);
  const fechaRef = useRef(null);
  const laborRef = useRef(null);
  const preciosRef = useRef(null);
  const trabajadoresRef = useRef(null);
  const { mostrar: mostrarTutorial, finalizar: finalizarTutorial, saltar: saltarTutorial } =
    useTutorialPrimeraVez(TUTORIALES.NUEVA_JORNADA, { listo: cargado });

  useEffect(() => {
    leerJSON(LABORES_PERSONALIZADAS_KEY, []).then(setLaboresPersonalizadas);
    vacantesAPI.misVacantes().then((r) => setVacantes(r.data?.vacantes || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeFincaId) return;
    fincaAPI.listarLotesFinca(activeFincaId).then((r) => setLotesFinca(r.data?.lotes || [])).catch(() => {});
  }, [activeFincaId]);

  // Personal fijo (Configuración): siempre aparece como sugerido y, si el
  // formulario arrancó en blanco, entra pre-seleccionado — el atajo para no
  // agregar uno por uno a los que trabajan todas las semanas.
  useEffect(() => {
    if (!cargado || !activeFincaId) return;
    let vivo = true;
    leerPersonalFijo(activeFincaId).then((fijos) => {
      if (!vivo || !fijos.length) return;
      setSugeridos((prev) => {
        const merged = [...prev];
        for (const p of fijos) {
          const repetido = merged.some((s) => (p.trabajador_id && s.trabajador_id === p.trabajador_id)
            || (!p.trabajador_id && !s.trabajador_id && s.nombre === p.nombre));
          if (!repetido) merged.push({ ...p });
        }
        return merged;
      });
      if (!huboBorradorOCache) {
        setTrabajadores((prev) => {
          if (prev.length) return prev;
          return fijos.map((p) => nuevoTrabajador({ ...p, manual_nombre: p.nombre, labores: [] }));
        });
      }
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, activeFincaId]);
  const agregarLaborPersonalizada = (nombre) => {
    setLaboresPersonalizadas((prev) => {
      // Comparación sin tildes: "Fumigación" y "fumigacion" son la misma labor.
      if (prev.some((l) => normalizarTexto(l) === normalizarTexto(nombre))) return prev;
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
      const preciosGuardados = await leerJSON(PRECIOS_KEY, null);
      if (borrador) {
        setVacanteId(borrador.vacante_id || '');
        setLabor(borrador.labor || []);
        setTitulo(borrador.titulo || '');
        setPrecios(borrador.precios || preciosGuardados || { jornal: '', kilo: '', hora: '', alimentacion: '' });
        setSugeridos(borrador.sugeridos || []);
        setTrabajadores(borrador.trabajadores || []);
        setCostosGenerales(borrador.costosGenerales || '');
        setObservaciones(borrador.observaciones || '');
        setPreciosOpen(!(borrador.precios?.jornal || preciosGuardados?.jornal));
        toast.info('Recuperamos lo que habías escrito antes de guardar');
      } else {
        setVacanteId(c?.vacante_id || '');
        setLabor(c?.labor || []);
        setTitulo(c?.titulo || '');
        setPrecios(preciosGuardados || { jornal: '', kilo: '', hora: '', alimentacion: '' });
        setSugeridos(c?.sugeridos || []);
        setTrabajadores((c?.trabajadores || []).map(nuevoTrabajador));
        setPreciosOpen(!preciosGuardados?.jornal);
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
      setHuboBorradorOCache(!!borrador || !!(c?.trabajadores || []).length);
      setCargado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguarda borrador del día completo mientras se escribe. Espera a que
  // termine la carga inicial (cache semanal / borrador previo) — si no, este
  // efecto escribe el estado vacío del primer render y pisa lo que se estaba
  // por restaurar (bug: jornada nueva aparecía en blanco).
  useEffect(() => {
    if (!cargado) return;
    guardarBorrador({ fecha, vacante_id: vacanteId, labor, titulo, precios, sugeridos, trabajadores, costosGenerales, observaciones });
  }, [cargado, fecha, vacanteId, labor, titulo, precios, sugeridos, trabajadores, costosGenerales, observaciones]);

  // Los precios configurados se guardan aparte del cache semanal y NUNCA se
  // borran solos (ni al cerrar una jornada ni al empezar una semana nueva) —
  // solo cambian si el capataz los edita a mano.
  useEffect(() => {
    if (!cargado) return;
    guardarJSON(PRECIOS_KEY, precios);
  }, [cargado, precios]);

  // Si se cambia la fecha con trabajadores ya agregados, su hora de
  // entrada/salida y tipo de pago quedan de OTRO día — se limpian de una
  // vez (antes solo se limpiaban al cerrar y volver a abrir el formulario).
  const fechaPrevRef = useRef(fecha);
  useEffect(() => {
    if (!cargado) return;
    if (fechaPrevRef.current === fecha) return;
    fechaPrevRef.current = fecha;
    setTrabajadores((prev) => prev.map((t) => ({
      ...t, hora_entrada: '', hora_salida: '',
      entradas: (t.entradas || []).map((b) => ({ ...b, tipo_pago: '', cantidad_kg: '', horas: '', monto_libre: '' })),
    })));
  }, [fecha, cargado]);

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

  useEffect(() => { if (labor.length) setTitulo(labor.join(', ')); }, [labor]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busqueda.trim().length < 2) { setResultados([]); return; }
      setBuscando(true);
      try {
        const r = await trabajadoresAPI.listar({});
        // Búsqueda tolerante a tildes: "jose" encuentra a "José".
        const filtrados = (r.data?.trabajadores || []).filter((x) => coincideTexto(x.nombre_completo, busqueda));
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
      return [...prev, nuevoTrabajador({ ...s, manual_nombre: s.nombre, labores: [...labor] })];
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
      setTrabajadores((prev) => [...prev, nuevoTrabajador({ ...s, manual_nombre: nombre, labores: [...labor] })]);
    }
    setExterno({ nombre: '', telefono: '' }); setExternoOpen(false);
  };

  const totalDia = trabajadores.reduce((s, t) => s + pagoBruto(t, precios), 0);
  const totalDeudas = trabajadores.reduce((s, t) => s + deudaDe(t, precios), 0);

  const cerrarJornada = async () => {
    if (!fecha) { toast.error('La fecha es obligatoria'); return; }
    if (trabajadores.length === 0) { toast.error('Agrega al menos un trabajador'); return; }
    const todosBloques = trabajadores.flatMap((t) => t.entradas || []);
    if (todosBloques.some((b) => !b.tipo_pago)) {
      toast.error('Elige el tipo de pago de cada bloque de trabajo'); return;
    }
    const sinPrecio = todosBloques.some((b) =>
      (b.tipo_pago === 'jornal' && !Number(precios.jornal)) ||
      (b.tipo_pago === 'por_kilo' && !Number(precios.kilo)) ||
      (b.tipo_pago === 'por_hora' && !Number(precios.hora)));
    if (sinPrecio) { toast.error('Configura los precios arriba para los tipos de pago usados'); setPreciosOpen(true); return; }
    if (todosBloques.some((b) => b.tipo_pago === 'libre' && !(Number(b.monto_libre) > 0))) {
      toast.error('Escribe el monto de los bloques de "Monto libre"'); return;
    }

    setSaving(true);
    try {
      const r = await cuadernoAPI.crearJornada({
        fecha, titulo: titulo || labor.join(', ') || 'Jornada', finca: fincaSel || null,
        tipo_trabajo: labor.join(',') || null, vacante_id: vacanteId ? Number(vacanteId) : null,
        tipo_pago_default: trabajadores[0]?.entradas?.[0]?.tipo_pago || 'jornal',
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
          // Siempre se manda la llave, con null si el campo quedó vacío —
          // omitirla hacía que "limpiar hora" no se guardara.
          hora_llegada: t.hora_entrada ? `${t.hora_entrada}:00` : null,
          hora_salida: t.hora_salida ? `${t.hora_salida}:00` : null,
        });
        const partesNota = [];
        if (t.hora_entrada && t.hora_salida) partesNota.push(`Entró ${t.hora_entrada} · salió ${t.hora_salida}`);
        const notas = partesNota.length ? partesNota.join(' · ') : null;
        for (const b of (t.entradas || [])) {
          const tarifa = b.tipo_pago === 'jornal' ? Number(precios.jornal) || 0
            : b.tipo_pago === 'por_kilo' ? Number(precios.kilo) || 0
            : b.tipo_pago === 'por_hora' ? Number(precios.hora) || 0
            : Number(b.monto_libre) || 0;
          await cuadernoAPI.crearEntrada(a.id, {
            cultivo: b.cultivo || null, finca_lote_id: b.lote_id || null, labor: b.labor || null,
            tipo_pago: b.tipo_pago, tarifa,
            cantidad_kg: b.tipo_pago === 'por_kilo' ? Number(b.cantidad_kg) || null : null,
            horas: b.tipo_pago === 'por_hora' ? Number(b.horas) || null : null,
            notas,
          });
        }
        if (t.deuda_alimentacion && Number(precios.alimentacion) > 0) {
          await cuadernoAPI.agregarAjuste(a.id, { tipo: 'descuento', monto: Number(precios.alimentacion), motivo: 'Alimentación' }).catch(() => {});
        }
        if (Number(t.deuda_otro) > 0) {
          await cuadernoAPI.agregarAjuste(a.id, { tipo: 'descuento', monto: Number(t.deuda_otro), motivo: t.deuda_concepto || 'Tienda / otro' }).catch(() => {});
        }
      }

      await cuadernoAPI.actualizarJornada(jornadaId, { estado: 'cerrada' });

      await guardarCache({
        vacante_id: vacanteId, finca: fincaSel, labor, titulo, sugeridos,
        trabajadores: trabajadores.map((t) => ({
          trabajador_id: t.trabajador_id, nombre: t.nombre, foto: t.foto,
          manual_nombre: t.nombre, manual_telefono: t.manual_telefono,
          entradas: (t.entradas || []).map((b) => ({ cultivo: b.cultivo, lote_id: b.lote_id, lote_nombre: b.lote_nombre, labor: b.labor })),
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

  const pasosTutorial = [
    {
      icon: 'document-text-outline', title: '¡Nueva jornada!',
      text: 'Llena este formulario una sola vez al final del día para registrar quién trabajó, qué hizo cada uno y cuánto se les paga. Te mostramos los pasos.',
    },
    {
      targetRef: fechaRef, scrollY: 0, icon: 'calendar-outline', title: '¿Cuándo fue la jornada?',
      text: 'Selecciona la fecha de hoy o de cualquier día pasado. Si tienes una vacante abierta, puedes asociarla aquí.',
    },
    {
      targetRef: laborRef, scrollY: 0, icon: 'briefcase-outline', title: '¿Qué trabajo se realizó?',
      text: 'Elige las labores generales: recolección, desyerba, fumigación, etc. Cada trabajador puede hacer trabajo diferente más abajo.',
    },
    {
      targetRef: preciosRef, scrollY: 0, icon: 'cash-outline', title: 'Configura los precios',
      text: 'Define cuánto pagas por jornal completo, por kilo, por hora, o deducción de alimentación. Estos precios se guardan para las próximas jornadas.',
    },
    {
      targetRef: trabajadoresRef, scrollY: 0, icon: 'people-outline', title: 'Agrega trabajadores',
      text: 'Selecciona de tus trabajadores habituales o agrega uno nuevo. Para cada uno, marca su labor específica y cómo se le paga.',
    },
    {
      icon: 'checkmark-circle-outline', title: 'Revisa y guarda',
      text: 'Verifica el cálculo automático de pagos, agrega notas si es necesario, y guarda la jornada. ¡El sistema hace el resto!',
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View ref={encabezadoRef} collapsable={false} style={styles.modalHeader}>
        <Pressable onPress={() => !saving && navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COLORS.ink900} />
        </Pressable>
        <Text style={styles.modalTitle}>Nueva jornada</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView ref={scrollTutorialRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.ayudaBtn} onPress={() => { animate(); setAyudaOpen((o) => !o); }}>
          <View style={styles.rowStart}>
            <Ionicons name="help-circle-outline" size={16} color={COLORS.info} />
            <Text style={styles.ayudaBtnText}>  ¿Cómo funciona una jornada?</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={COLORS.info} style={{ transform: [{ rotate: ayudaOpen ? '180deg' : '0deg' }] }} />
        </Pressable>

        <Pressable
          style={styles.nuevaSemanaBtn}
          onPress={() => {
            Alert.alert('¿Empezar semana nueva?', 'Se borran los trabajadores y labores recordados. Los precios configurados NO se borran. La próxima jornada empieza en blanco.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Empezar de nuevo', style: 'destructive', onPress: async () => {
                  await AsyncStorage.removeItem(CACHE_KEY);
                  setSugeridos([]); setTrabajadores([]); setLabor([]);
                  toast.success('Semana reiniciada');
                },
              },
            ]);
          }}
        >
          <Ionicons name="refresh-outline" size={14} color={COLORS.ink500} />
          <Text style={styles.nuevaSemanaBtnText}>  Empezar semana nueva</Text>
        </Pressable>
        {ayudaOpen && (
          <Text style={styles.ayudaText}>
            El cuaderno se llena una sola vez al final del día: eliges los trabajadores, marcas qué hizo cada
            uno y el pago se calcula solo con los precios que configures. Al guardar, la jornada queda
            cerrada y la nómina de la semana se arma sola. El formulario recuerda los trabajadores y
            labores toda la semana (se limpia cada lunes). Los precios que configures quedan guardados
            siempre, no se borran solos.
          </Text>
        )}

        {/* Paso 1 */}
        <View ref={fechaRef} collapsable={false} style={styles.step}>
          <View style={styles.rowStart}>
            <PasoBadge n={1} />
            <Text style={styles.stepTitle}>  ¿Cuándo fue la jornada?</Text>
          </View>
          <Text style={styles.fieldLabel}>Fecha</Text>
          {/* Calendario propio multiplataforma — el picker nativo no abría en
              web y dejaba este botón sin respuesta. */}
          <Pressable style={styles.fechaDropdown} onPress={() => setShowFechaPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            <Text style={styles.fechaDropdownText}>{formatFechaCorta(fecha)}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.ink400} />
          </Pressable>
          <CalendarioModal
            visible={showFechaPicker}
            fecha={fecha}
            titulo="¿Cuándo fue la jornada?"
            onClose={() => setShowFechaPicker(false)}
            onSelect={setFecha}
          />
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
        <View ref={laborRef} collapsable={false} style={[styles.step, styles.stepAlt]}>
          <View style={styles.rowStart}>
            <PasoBadge n={2} />
            <Text style={styles.stepTitle}>  ¿Qué se va a hacer, en general?</Text>
          </View>
          <Text style={styles.hintText}>Puedes cambiarla persona por persona más abajo.</Text>
          <View style={styles.wrapRow}>
            {LABORES_JORNADA.map((l) => (
              <Chip key={l.label} label={l.label} icon={l.icon} color={l.color} activo={labor.includes(l.label)} onPress={() => toggleLaborGeneral(l.label)} />
            ))}
            {laboresPersonalizadas.map((nombre) => (
              <Chip key={nombre} label={nombre} icon="ellipsis-horizontal" color="ink" activo={labor.includes(nombre)} onPress={() => toggleLaborGeneral(nombre)} />
            ))}
            <SelectorOtro onAgregar={(nombre) => { agregarLaborPersonalizada(nombre); setLabor(nombre); }} />
          </View>
          <TextInput placeholderTextColor={COLORS.ink400} value={titulo} onChangeText={setTitulo} placeholder="Título de la jornada" style={[styles.input, { marginTop: 8 }]} />
        </View>

        {/* Precios (colapsable) */}
        <View ref={preciosRef} collapsable={false} style={styles.step}>
          <Pressable style={[styles.rowBetween, { justifyContent: 'space-between' }]} onPress={() => { animate(); setPreciosOpen((o) => !o); }}>
            <View style={styles.rowStart}>
              <PasoBadge n={3} />
              <Text style={styles.stepTitle}>  Precios: jornal, kilo, hora y alimentación</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={COLORS.ink700} style={{ transform: [{ rotate: preciosOpen ? '180deg' : '0deg' }] }} />
          </Pressable>
          {preciosOpen && (
            <View style={styles.preciosBody}>
              <Text style={styles.fieldLabel}>Precio jornal (COP)</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.jornal)} onChangeText={(v) => setPrecios((p) => ({ ...p, jornal: v }))} keyboardType="numeric" placeholder="Ej: 70000" style={styles.input} />
              <Text style={styles.fieldLabel}>Precio por kilo (COP)</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.kilo)} onChangeText={(v) => setPrecios((p) => ({ ...p, kilo: v }))} keyboardType="numeric" placeholder="Ej: 1100" style={styles.input} />
              <Text style={styles.fieldLabel}>Precio por hora (COP)</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.hora)} onChangeText={(v) => setPrecios((p) => ({ ...p, hora: v }))} keyboardType="numeric" placeholder="Ej: 5000" style={styles.input} />
              <Text style={styles.fieldLabel}>Precio alimentación (COP)</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.alimentacion)} onChangeText={(v) => setPrecios((p) => ({ ...p, alimentacion: v }))} keyboardType="numeric" placeholder="Ej: 12000" style={styles.input} />
            </View>
          )}
        </View>

        {/* Trabajadores */}
        <View ref={trabajadoresRef} collapsable={false} style={[styles.step, styles.stepAlt]}>
          <View style={styles.rowStart}>
            <PasoBadge n={4} />
            <Text style={styles.stepTitle}>  Trabajadores de la jornada</Text>
          </View>
          <Text style={styles.hintText}>Toca los nombres para agregarlos o quitarlos.</Text>

          {sugeridos.length > 0 && (
            <View style={[styles.wrapRow, { marginTop: 8 }]}>
              {sugeridos.map((s) => {
                const activo = trabajadores.some((t) => t.key === seleccionKey(s));
                return (
                  <Pressable key={seleccionKey(s)} onPress={() => toggleSeleccion(s)} style={[styles.sugeridoChip, activo && styles.sugeridoChipActivo]}>
                    {activo && <Ionicons name="checkmark" size={13} color="#fff" style={{ marginRight: 2 }} />}
                    <Avatar src={s.foto} name={s.nombre} size={24} />
                    <Text style={[styles.sugeridoText, activo && styles.sugeridoTextActivo]}>  {s.nombre}</Text>
                    {!s.trabajador_id && <Text style={styles.badgeExterno}>  externo</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={[styles.rowStart, { marginTop: 10, gap: 8 }]}>
            <View style={[styles.rowStart, styles.buscarInputWrap]}>
              <Ionicons name="search" size={15} color={COLORS.ink400} />
              <TextInput placeholderTextColor={COLORS.ink400}
                placeholder="Buscar registrado en TerraEmpleo…" value={busqueda} onChangeText={setBusqueda}
                style={[styles.input, styles.buscarInput]}
              />
            </View>
            <Pressable style={styles.agregarNuevoBtn} onPress={() => { animate(); setExternoOpen((o) => !o); }}>
              <Ionicons name="person-add-outline" size={14} color={COLORS.seccionBadge} />
              <Text style={styles.agregarNuevoText}>  Agregar nuevo</Text>
            </Pressable>
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

          {externoOpen && (
            <View style={{ marginTop: 8, gap: 8 }}>
              <TextInput placeholderTextColor={COLORS.ink400} placeholder="Nombre completo" value={externo.nombre} onChangeText={(v) => setExterno((x) => ({ ...x, nombre: v }))} style={styles.input} />
              <TextInput placeholderTextColor={COLORS.ink400} placeholder="Teléfono (opcional)" keyboardType="phone-pad" value={externo.telefono} onChangeText={(v) => setExterno((x) => ({ ...x, telefono: v }))} style={styles.input} />
              <Pressable style={styles.addBtn} onPress={agregarExterno}><Text style={styles.addBtnText}>Agregar</Text></Pressable>
            </View>
          )}
        </View>

        {/* Trabajadores agregados */}
        {trabajadores.length > 0 && (
          <View style={styles.step}>
            <View style={styles.rowStart}>
              <PasoBadge n={5} />
              <Text style={styles.stepTitle}>  Trabajadores agregados</Text>
            </View>
            <View style={{ marginTop: 10, gap: 10 }}>
              {trabajadores.map((t) => (
                <TrabajadorJornadaCard
                  key={t.key} t={t} precios={precios}
                  onChange={(nt) => setTrabajadores((prev) => prev.map((x) => (x.key === nt.key ? nt : x)))}
                  onQuitar={(x) => setTrabajadores((prev) => prev.filter((y) => y.key !== x.key))}
                  laboresPersonalizadas={laboresPersonalizadas}
                  onAgregarLaborPersonalizada={agregarLaborPersonalizada}
                  lotesFinca={lotesFinca}
                />
              ))}
            </View>
          </View>
        )}

        {/* Gastos y observaciones */}
        <View style={[styles.step, styles.stepAlt]}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: COLORS.line },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink900 },
  container: { padding: 16, paddingBottom: 120, gap: 14 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  fechaDropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface1, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12,
  },
  fechaDropdownText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.ink900 },
  fechaListoBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  fechaListoText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  fechaModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  fechaModalBackdrop: { ...StyleSheet.absoluteFillObject },
  fechaModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 16 },
  fechaSpinner: { height: 216, width: '100%' },
  ayudaBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: COLORS.infoSoft },
  ayudaBtnText: { color: COLORS.info, fontWeight: '700', fontSize: 13 },
  ayudaText: { fontSize: 12, color: COLORS.ink700, marginTop: -4, paddingHorizontal: 4 },
  nuevaSemanaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  nuevaSemanaBtnText: { color: COLORS.ink500, fontSize: 12, fontWeight: '600' },
  step: { borderRadius: 12, paddingVertical: 16, paddingHorizontal: 20, backgroundColor: COLORS.surface1 },
  stepAlt: { backgroundColor: COLORS.surface2 },
  stepTitle: { fontWeight: '800', color: COLORS.ink900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  hintText: { fontSize: 12, color: COLORS.ink500, marginBottom: 8, marginLeft: 30 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  smallLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginBottom: 6 },
  input: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.ink900, backgroundColor: COLORS.surface1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 0.5, backgroundColor: '#fff' },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontWeight: '700', fontSize: 13 },
  chipTextSmall: { fontSize: 11 },
  otroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  otroInput: { borderWidth: 2, borderColor: COLORS.ink400, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: COLORS.ink900, width: 170 },
  otroBtn: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  otroBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pasoBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.seccionBadge },
  pasoBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  preciosBody: { marginTop: 12, gap: 4 },
  card: { borderWidth: 0.5, borderColor: COLORS.border, borderLeftWidth: 3, borderLeftColor: COLORS.primary, borderRadius: 12, padding: 12, backgroundColor: COLORS.surface2 },
  cardName: { fontWeight: '900', color: COLORS.ink900, fontSize: 15 },
  badgeExterno: { fontSize: 10, fontWeight: '600', color: COLORS.ink400, backgroundColor: COLORS.lineLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginLeft: 6 },
  moneyPrimary: { fontWeight: '700', color: COLORS.primary, fontSize: 12 },
  moneyDanger: { fontWeight: '700', color: COLORS.danger, fontSize: 12 },
  moneyBold: { fontWeight: '700', color: COLORS.ink900, fontSize: 12 },
  dotSep: { color: COLORS.ink500 },
  cardBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: COLORS.line },
  bloqueCard: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  bloqueResumenText: { fontSize: 13, fontWeight: '700', color: COLORS.ink900 },
  bloqueResumenSub: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  agregarBloqueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 8 },
  agregarBloqueText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  tipoPagoBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff', alignItems: 'center' },
  tipoPagoBtnActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoPagoText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  tipoPagoTextActivo: { color: '#fff' },
  deudaBox: { marginTop: 10, backgroundColor: COLORS.lineLight, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, padding: 10 },
  switchLabel: { marginLeft: 8, fontSize: 13, color: COLORS.ink700 },
  totalBox: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12 },
  totalLabel: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  totalValuePrimary: { fontSize: 17, fontWeight: '900', color: COLORS.primaryDark },
  totalValueDanger: { fontSize: 17, fontWeight: '900', color: COLORS.danger },
  totalValueInk: { fontSize: 17, fontWeight: '900', color: COLORS.ink900 },
  sugeridoChip: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff' },
  sugeridoChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sugeridoText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  sugeridoTextActivo: { color: '#fff' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  resultName: { fontSize: 13, fontWeight: '600', color: COLORS.ink900 },
  resultPhone: { fontSize: 11, color: COLORS.ink500 },
  externoToggle: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  buscarInputWrap: { flex: 1, backgroundColor: COLORS.surface1, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12 },
  buscarInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', marginLeft: 6, paddingHorizontal: 0 },
  agregarNuevoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.loteAccent, borderWidth: 1, borderColor: COLORS.loteAccentBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  agregarNuevoText: { color: COLORS.seccionBadge, fontWeight: '700', fontSize: 12 },
  resumenBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(0,141,73,0.2)', padding: 14, flexWrap: 'wrap', gap: 6 },
  resumenText: { fontWeight: '700', color: COLORS.primaryDark },
  resumenTotal: { fontWeight: '900', color: COLORS.primaryDark, fontSize: 17 },
  resumenDeuda: { color: COLORS.danger, fontWeight: '700' },
  btnGhost: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnGhostText: { fontWeight: '700', color: COLORS.ink700 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  loteBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', marginTop: 6 },
  loteBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontWeight: '900', fontSize: 16, color: COLORS.ink900, marginBottom: 10 },
  modalCancelLink: { alignSelf: 'center', padding: 10, marginTop: 8 },
  modalCancelLinkText: { color: COLORS.ink500, fontWeight: '600' },
});
