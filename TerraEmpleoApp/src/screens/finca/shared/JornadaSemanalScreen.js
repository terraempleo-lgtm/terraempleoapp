import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  Switch, ActivityIndicator, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI, fincaAPI, trabajadoresAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import Avatar from './Avatar';
import HoraField from '../../../components/ui/HoraField';
import { formatMoney, coincideTexto } from '../../../utils/fincaFormat';
import { leerPersonalFijo } from '../../../utils/personalFijo';
import { setFechaRef } from '../../../context/periodoStore';
import { useToast } from './useFincaToast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// Registro SEMANAL del cuaderno: para quien no lleva el detalle diario sino
// "Ana cogió café 3 días y guadañó 2, y esto fue el total". Crea por dentro
// las jornadas diarias equivalentes (lunes en adelante) para que la Nómina,
// las Finanzas y el Rendimiento cuadren igual que con el registro diario.

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  danger: '#dc2626',
  info: '#2563eb', infoSoft: '#e0edff',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
  surface1: '#FAFAF9', surface2: '#F2F4EE', border: '#e4e6de',
  seccionBadge: '#1B512D', loteAccent: '#EAF3DE', loteAccentBorder: '#C0DD97',
};

const LABORES = ['Recolección', 'Desyerba / Guadaña', 'Fumigación', 'Fertilización', 'Poda', 'Siembra'];
const PRECIOS_KEY = 'cuaderno_precios_v1'; // compartida con el registro diario

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function lunesDe(ref) {
  const d = new Date(ref); d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}
function fechaCorta(d) {
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${MES[d.getMonth()]}`;
}

let seq = 0;
function nuevoBloque() {
  return { _key: `sb-${Date.now()}-${seq++}`, labor: '', jornales: 1, tipo_pago: 'jornal', kilos: '', cultivo: '', lote_id: null, lote_nombre: null };
}
function nuevoTrabajadorSemana(base) {
  return {
    key: base.trabajador_id ? `t-${base.trabajador_id}` : `m-${base.nombre}`,
    trabajador_id: base.trabajador_id || null,
    nombre: base.nombre,
    foto: base.foto || null,
    manual_telefono: base.manual_telefono || '',
    hora_entrada: '',
    hora_salida: '',
    alimentacion: false,
    bloques: [nuevoBloque()],
  };
}

function diasDe(t) {
  return (t.bloques || []).reduce((s, b) => s + (Number(b.jornales) || 0), 0);
}
function pagoBloque(b, precios) {
  if (b.tipo_pago === 'por_kilo') return Math.round((Number(precios.kilo) || 0) * (Number(b.kilos) || 0));
  return Math.round((Number(precios.jornal) || 0) * (Number(b.jornales) || 0));
}
function brutoDe(t, precios) {
  return (t.bloques || []).reduce((s, b) => s + pagoBloque(b, precios), 0);
}
function alimentacionDe(t, precios) {
  return t.alimentacion ? (Number(precios.alimentacion) || 0) * diasDe(t) : 0;
}

function Stepper({ value, onChange, max = 7 }) {
  const v = Number(value) || 0;
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(0, v - 1))} style={styles.stepperBtn} hitSlop={6}>
        <Ionicons name="remove" size={16} color={COLORS.ink700} />
      </Pressable>
      <Text style={styles.stepperValue}>{v}</Text>
      <Pressable onPress={() => onChange(Math.min(max, v + 1))} style={styles.stepperBtn} hitSlop={6}>
        <Ionicons name="add" size={16} color={COLORS.ink700} />
      </Pressable>
    </View>
  );
}

function Chip({ label, activo, onPress, icon }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, activo && styles.chipActivo]}>
      {icon ? <Ionicons name={icon} size={13} color={activo ? '#fff' : COLORS.ink500} /> : null}
      <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{icon ? ' ' : ''}{label}</Text>
    </Pressable>
  );
}

// ── Bloque: una labor de la semana (ej. "Recolección · 3 jornales · por kilo") ──
function BloqueSemana({ b, precios, lotesFinca, onChange, onQuitar, ocultarQuitar }) {
  const upd = (k, v) => onChange({ ...b, [k]: v });
  const cultivos = useMemo(() => [...new Set(lotesFinca.map((l) => l.cultivo).filter(Boolean))], [lotesFinca]);
  const sub = pagoBloque(b, precios);
  return (
    <View style={styles.bloqueCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.smallLabel}>Labor</Text>
        {!ocultarQuitar && (
          <Pressable onPress={onQuitar} hitSlop={8}><Ionicons name="trash-outline" size={14} color={COLORS.ink400} /></Pressable>
        )}
      </View>
      <View style={styles.wrapRow}>
        {LABORES.map((l) => (
          <Chip key={l} label={l} activo={b.labor === l} onPress={() => upd('labor', b.labor === l ? '' : l)} />
        ))}
      </View>
      <TextInput
        placeholderTextColor={COLORS.ink400} value={b.labor && !LABORES.includes(b.labor) ? b.labor : ''}
        onChangeText={(v) => upd('labor', v)} placeholder="Otra labor (escríbela)" style={[styles.input, { marginTop: 6 }]}
      />

      <View style={[styles.rowStart, { marginTop: 10, gap: 14, flexWrap: 'wrap' }]}>
        <View>
          <Text style={styles.smallLabel}>¿Cuántos jornales (días)?</Text>
          <Stepper value={b.jornales} onChange={(v) => upd('jornales', v)} />
        </View>
        <View>
          <Text style={styles.smallLabel}>¿Se paga por…?</Text>
          <View style={styles.rowStart}>
            <Chip label="Jornal" activo={b.tipo_pago === 'jornal'} onPress={() => upd('tipo_pago', 'jornal')} />
            <View style={{ width: 6 }} />
            <Chip label="Kilo" activo={b.tipo_pago === 'por_kilo'} onPress={() => upd('tipo_pago', 'por_kilo')} />
          </View>
        </View>
        {b.tipo_pago === 'por_kilo' && (
          <View style={{ minWidth: 120 }}>
            <Text style={styles.smallLabel}>Kilos de la semana</Text>
            <TextInput placeholderTextColor={COLORS.ink400} value={String(b.kilos)} onChangeText={(v) => upd('kilos', v)}
              keyboardType="decimal-pad" placeholder="0" style={styles.input} />
          </View>
        )}
      </View>

      {(cultivos.length > 0 || lotesFinca.length > 0) && (
        <View style={{ marginTop: 8 }}>
          {cultivos.length > 0 && (
            <View style={styles.wrapRow}>
              <Text style={[styles.smallLabel, { marginRight: 4 }]}>Cultivo:</Text>
              {cultivos.map((c) => (
                <Chip key={c} label={c} activo={b.cultivo === c} onPress={() => upd('cultivo', b.cultivo === c ? '' : c)} />
              ))}
            </View>
          )}
          {lotesFinca.length > 0 && (
            <View style={[styles.wrapRow, { marginTop: 6 }]}>
              <Text style={[styles.smallLabel, { marginRight: 4 }]}>Lote:</Text>
              {lotesFinca.map((l) => (
                <Chip
                  key={l.id} label={l.nombre} icon="location-outline"
                  activo={b.lote_id === l.id}
                  onPress={() => onChange(b.lote_id === l.id
                    ? { ...b, lote_id: null, lote_nombre: null }
                    : { ...b, lote_id: l.id, lote_nombre: l.nombre })}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {sub > 0 && <Text style={styles.bloqueSub}>Subtotal: {formatMoney(sub)}</Text>}
    </View>
  );
}

// ── Tarjeta de trabajador (semana completa) ────────────────────────────────
function TrabajadorSemanaCard({ t, precios, lotesFinca, onChange, onQuitar }) {
  const [open, setOpen] = useState(true);
  const bruto = brutoDe(t, precios);
  const alim = alimentacionDe(t, precios);
  const dias = diasDe(t);
  const upd = (k, v) => onChange({ ...t, [k]: v });
  const bloques = t.bloques || [];

  return (
    <View style={styles.card}>
      <Pressable style={styles.rowBetween} onPress={() => { animate(); setOpen((o) => !o); }}>
        <View style={styles.rowStart}>
          <Avatar src={t.foto} name={t.nombre} size={42} />
          <View style={{ marginLeft: 10 }}>
            <View style={styles.rowStart}>
              <Text style={styles.cardName}>{t.nombre}</Text>
              {!t.trabajador_id && <Text style={styles.badgeExterno}>externo</Text>}
            </View>
            <Text style={styles.cardResumen}>
              {dias} jornal{dias === 1 ? '' : 'es'} · <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{formatMoney(bruto - alim)}</Text>
              {alim > 0 ? ` (aliment. -${formatMoney(alim)})` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.rowStart}>
          <Pressable onPress={() => onQuitar(t)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={16} color={COLORS.ink400} />
          </Pressable>
          <Ionicons name="chevron-down" size={18} color={COLORS.ink400} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </View>
      </Pressable>

      {open && (
        <View style={styles.cardBody}>
          <View style={{ gap: 8 }}>
            {bloques.map((b) => (
              <BloqueSemana
                key={b._key} b={b} precios={precios} lotesFinca={lotesFinca}
                onChange={(nb) => upd('bloques', bloques.map((x) => (x._key === nb._key ? nb : x)))}
                onQuitar={() => upd('bloques', bloques.filter((x) => x._key !== b._key))}
                ocultarQuitar={bloques.length === 1}
              />
            ))}
          </View>
          <Pressable style={styles.agregarBloqueBtn} onPress={() => upd('bloques', [...bloques, nuevoBloque()])}>
            <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.agregarBloqueText}>  Agregar otra labor</Text>
          </Pressable>

          <View style={[styles.rowStart, { marginTop: 10, gap: 8 }]}>
            <HoraField label="Hora que entra" value={t.hora_entrada} onChange={(v) => upd('hora_entrada', v)} placeholder="06:00" style={{ flex: 1 }} />
            <HoraField label="Hora que sale" value={t.hora_salida} onChange={(v) => upd('hora_salida', v)} placeholder="15:30" style={{ flex: 1 }} />
          </View>

          <View style={[styles.rowStart, { marginTop: 10 }]}>
            <Switch value={t.alimentacion} onValueChange={(v) => upd('alimentacion', v)} trackColor={{ true: COLORS.primary }} />
            <Text style={styles.switchLabel}>
              Descontar alimentación · {formatMoney(Number(precios.alimentacion) || 0)} × {dias} día{dias === 1 ? '' : 's'} = {formatMoney((Number(precios.alimentacion) || 0) * dias)}
            </Text>
          </View>

          <View style={styles.totalBox}>
            <View>
              <Text style={styles.totalLabel}>Pago de la semana</Text>
              <Text style={styles.totalValuePrimary}>{formatMoney(bruto)}</Text>
            </View>
            {alim > 0 && (
              <>
                <View>
                  <Text style={styles.totalLabel}>Alimentación</Text>
                  <Text style={styles.totalValueDanger}>-{formatMoney(alim)}</Text>
                </View>
                <View>
                  <Text style={styles.totalLabel}>Neto</Text>
                  <Text style={styles.totalValueInk}>{formatMoney(bruto - alim)}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default function JornadaSemanalScreen({ navigation }) {
  const toast = useToast();
  const { activeFinca, activeFincaId } = useFinca();
  const [saving, setSaving] = useState(false);
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const [precios, setPrecios] = useState({ jornal: '', kilo: '', alimentacion: '' });
  const [preciosOpen, setPreciosOpen] = useState(false);
  const [trabajadores, setTrabajadores] = useState([]);
  const [sugeridos, setSugeridos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [externoOpen, setExternoOpen] = useState(false);
  const [externo, setExterno] = useState({ nombre: '', telefono: '' });
  const [lotesFinca, setLotesFinca] = useState([]);

  const domingo = useMemo(() => { const d = new Date(lunes); d.setDate(d.getDate() + 6); return d; }, [lunes]);
  const moverSemana = (delta) => { const d = new Date(lunes); d.setDate(d.getDate() + delta * 7); setLunes(d); };

  useEffect(() => {
    // Precios compartidos con el registro diario; si no hay, los de la finca.
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PRECIOS_KEY);
        const guardados = raw ? JSON.parse(raw) : null;
        setPrecios({
          jornal: guardados?.jornal || (activeFinca?.precio_jornal_default != null ? String(activeFinca.precio_jornal_default) : ''),
          kilo: guardados?.kilo || (activeFinca?.precio_kilo_default != null ? String(activeFinca.precio_kilo_default) : ''),
          alimentacion: guardados?.alimentacion || (activeFinca?.precio_alimentacion != null ? String(activeFinca.precio_alimentacion) : ''),
        });
        setPreciosOpen(!(guardados?.jornal || activeFinca?.precio_jornal_default));
      } catch { /* no-op */ }
    })();
  }, [activeFinca]);

  useEffect(() => {
    if (!activeFincaId) return;
    fincaAPI.listarLotesFinca(activeFincaId).then((r) => setLotesFinca(r.data?.lotes || [])).catch(() => {});
    // Personal fijo pre-seleccionado + trabajadores conocidos como sugeridos.
    leerPersonalFijo(activeFincaId).then((fijos) => {
      if (!fijos.length) return;
      setSugeridos((prev) => {
        const merged = [...prev];
        for (const p of fijos) {
          if (!merged.some((s) => (p.trabajador_id && s.trabajador_id === p.trabajador_id) || (!p.trabajador_id && s.nombre === p.nombre))) merged.push(p);
        }
        return merged;
      });
      setTrabajadores((prev) => (prev.length ? prev : fijos.map(nuevoTrabajadorSemana)));
    });
    cuadernoAPI.misTrabajadores().then((r) => {
      const propios = (r.data?.trabajadores || []).slice(0, 12).map((p) => ({
        trabajador_id: p.trabajador_id || null, nombre: p.nombre, foto: p.foto || null, manual_telefono: p.telefono || '',
      }));
      setSugeridos((prev) => {
        const merged = [...prev];
        for (const p of propios) {
          if (!merged.some((s) => (p.trabajador_id && s.trabajador_id === p.trabajador_id) || (!p.trabajador_id && s.nombre === p.nombre))) merged.push(p);
        }
        return merged;
      });
    }).catch(() => {});
  }, [activeFincaId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (busqueda.trim().length < 2) { setResultados([]); return; }
      setBuscando(true);
      try {
        const r = await trabajadoresAPI.listar({});
        setResultados((r.data?.trabajadores || []).filter((x) => coincideTexto(x.nombre_completo, busqueda)));
      } catch { setResultados([]); } finally { setBuscando(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const keyDe = (s) => (s.trabajador_id ? `t-${s.trabajador_id}` : `m-${s.nombre}`);
  const toggleSeleccion = (s) => {
    setTrabajadores((prev) => {
      const key = keyDe(s);
      const existe = prev.find((t) => t.key === key);
      if (existe) return prev.filter((t) => t.key !== key);
      return [...prev, nuevoTrabajadorSemana(s)];
    });
  };

  const agregarExterno = () => {
    const nombre = externo.nombre.trim();
    if (!nombre) { toast.error('El nombre es obligatorio'); return; }
    const s = { trabajador_id: null, nombre, manual_telefono: externo.telefono };
    setSugeridos((prev) => (prev.some((x) => !x.trabajador_id && x.nombre === nombre) ? prev : [...prev, s]));
    if (!trabajadores.some((t) => !t.trabajador_id && t.nombre === nombre)) {
      setTrabajadores((prev) => [...prev, nuevoTrabajadorSemana(s)]);
    }
    setExterno({ nombre: '', telefono: '' }); setExternoOpen(false);
  };

  const totalNeto = trabajadores.reduce((s, t) => s + brutoDe(t, precios) - alimentacionDe(t, precios), 0);
  const totalDias = trabajadores.reduce((s, t) => s + diasDe(t), 0);

  // Reparte los bloques del trabajador en días concretos de la semana
  // (lunes en adelante): 3 jornales de café → lun, mar, mié. Así la Nómina
  // cuenta los jornales reales.
  function planPorDia(t) {
    const plan = [];
    for (const b of t.bloques || []) {
      const n = Number(b.jornales) || 0;
      if (!n || !b.tipo_pago) continue;
      const kgPorDia = b.tipo_pago === 'por_kilo' ? (Number(b.kilos) || 0) / n : 0;
      for (let i = 0; i < n && plan.length < 7; i++) {
        plan.push({ labor: b.labor || null, tipo_pago: b.tipo_pago, kg: kgPorDia, cultivo: b.cultivo || null, lote_id: b.lote_id || null });
      }
    }
    return plan;
  }

  const guardarSemana = async () => {
    if (trabajadores.length === 0) { toast.error('Agrega al menos un trabajador'); return; }
    const sinJornales = trabajadores.find((t) => diasDe(t) === 0);
    if (sinJornales) { toast.error(`Ponle jornales a ${sinJornales.nombre}`); return; }
    const usaJornal = trabajadores.some((t) => (t.bloques || []).some((b) => b.tipo_pago === 'jornal' && Number(b.jornales) > 0));
    const usaKilo = trabajadores.some((t) => (t.bloques || []).some((b) => b.tipo_pago === 'por_kilo' && Number(b.jornales) > 0));
    if ((usaJornal && !Number(precios.jornal)) || (usaKilo && !Number(precios.kilo))) {
      toast.error('Configura los precios de jornal/kilo arriba'); setPreciosOpen(true); return;
    }
    const sinKilos = trabajadores.find((t) => (t.bloques || []).some((b) => b.tipo_pago === 'por_kilo' && !(Number(b.kilos) > 0)));
    if (sinKilos) { toast.error(`Escribe los kilos de la semana de ${sinKilos.nombre}`); return; }

    setSaving(true);
    try {
      await AsyncStorage.setItem(PRECIOS_KEY, JSON.stringify({ ...precios, hora: '' })).catch(() => {});
      const planes = trabajadores.map((t) => ({ t, plan: planPorDia(t) }));
      const maxDias = Math.max(...planes.map((p) => p.plan.length));
      const rango = `${fechaCorta(lunes)} – ${fechaCorta(domingo)}`;

      // Una jornada por día usado; cada trabajador aparece en sus días.
      const jornadaIds = [];
      for (let dia = 0; dia < maxDias; dia++) {
        const fechaDia = new Date(lunes); fechaDia.setDate(fechaDia.getDate() + dia);
        const delDia = planes.filter((p) => p.plan[dia]);
        if (!delDia.length) continue;

        const r = await cuadernoAPI.crearJornada({
          fecha: ymd(fechaDia),
          titulo: `Registro semanal (${rango})`,
          finca: activeFinca?.nombre || null,
          tipo_pago_default: 'jornal',
          precio_jornal: Number(precios.jornal) || null,
          precio_kilo: Number(precios.kilo) || null,
        });
        const jornadaId = r.data?.id;
        if (!jornadaId) throw new Error('sin id de jornada');
        jornadaIds.push(jornadaId);

        for (const { t, plan } of delDia) {
          const bloqueDia = plan[dia];
          const ar = await cuadernoAPI.agregarAsistencia(jornadaId, t.trabajador_id
            ? { trabajador_id: t.trabajador_id }
            : { manual_nombre: t.nombre, manual_telefono: t.manual_telefono || null });
          let asisId = ar.data?.id ?? null;
          if (!asisId) {
            const det = await cuadernoAPI.detalleJornada(jornadaId);
            const match = (det.data?.asistencias || []).find((x) => t.trabajador_id
              ? Number(x.trabajador_id) === Number(t.trabajador_id)
              : (x.manual_nombre || '') === t.nombre);
            asisId = match?.id ?? null;
          }
          if (!asisId) continue;

          await cuadernoAPI.actualizarAsistencia(asisId, {
            estado: 'llego',
            hora_llegada: t.hora_entrada ? `${t.hora_entrada}:00` : null,
            hora_salida: t.hora_salida ? `${t.hora_salida}:00` : null,
          });
          await cuadernoAPI.crearEntrada(asisId, {
            cultivo: bloqueDia.cultivo, finca_lote_id: bloqueDia.lote_id, labor: bloqueDia.labor,
            tipo_pago: bloqueDia.tipo_pago,
            tarifa: bloqueDia.tipo_pago === 'por_kilo' ? Number(precios.kilo) || 0 : Number(precios.jornal) || 0,
            cantidad_kg: bloqueDia.tipo_pago === 'por_kilo' ? Math.round(bloqueDia.kg * 100) / 100 : null,
            horas: null,
            notas: 'Registro semanal',
          });

          // La alimentación de TODA la semana se ancla al último día del trabajador.
          const esUltimoDia = dia === plan.length - 1;
          const alim = alimentacionDe(t, precios);
          if (esUltimoDia && alim > 0) {
            await cuadernoAPI.agregarAjuste(asisId, {
              tipo: 'descuento', monto: alim,
              motivo: `Alimentación (${diasDe(t)} días)`,
            }).catch(() => {});
          }
        }
      }

      for (const id of jornadaIds) {
        await cuadernoAPI.actualizarJornada(id, { estado: 'cerrada' }).catch(() => {});
      }

      toast.success('Semana registrada — mira la planilla en Nómina');
      setFechaRef(new Date(lunes)); // que Nómina abra en ESTA semana
      navigation.replace('NominaHome');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar la semana');
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
        <Text style={styles.modalTitle}>Registrar semana</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.ayudaBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
          <Text style={styles.ayudaText}>
            {'  '}Si no llevas el detalle diario, registra aquí la semana completa: cuántos jornales hizo cada
            persona, en qué labor, y el sistema arma la nómina solo.
          </Text>
        </View>

        {/* Semana */}
        <View style={styles.step}>
          <Text style={styles.stepTitle}>¿Qué semana fue?</Text>
          <View style={[styles.rowStart, { marginTop: 8 }]}>
            <Pressable onPress={() => moverSemana(-1)} style={styles.weekBtn}><Ionicons name="chevron-back" size={16} color={COLORS.ink700} /></Pressable>
            <View style={styles.weekLabelBox}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
              <Text style={styles.weekLabel}>  {fechaCorta(lunes)} – {fechaCorta(domingo)}</Text>
            </View>
            <Pressable onPress={() => moverSemana(1)} style={styles.weekBtn}><Ionicons name="chevron-forward" size={16} color={COLORS.ink700} /></Pressable>
          </View>
        </View>

        {/* Precios */}
        <View style={[styles.step, styles.stepAlt]}>
          <Pressable style={styles.rowBetween} onPress={() => { animate(); setPreciosOpen((o) => !o); }}>
            <Text style={styles.stepTitle}>Precios: jornal, kilo y alimentación</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.ink700} style={{ transform: [{ rotate: preciosOpen ? '180deg' : '0deg' }] }} />
          </Pressable>
          {preciosOpen && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.fieldLabel}>Precio jornal (COP)</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.jornal)} onChangeText={(v) => setPrecios((p) => ({ ...p, jornal: v }))} keyboardType="numeric" placeholder="Ej: 70000" style={styles.input} />
              <Text style={styles.fieldLabel}>Precio por kilo (COP)</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.kilo)} onChangeText={(v) => setPrecios((p) => ({ ...p, kilo: v }))} keyboardType="numeric" placeholder="Ej: 1100" style={styles.input} />
              <Text style={styles.fieldLabel}>Alimentación por día (COP)</Text>
              <TextInput placeholderTextColor={COLORS.ink400} value={String(precios.alimentacion)} onChangeText={(v) => setPrecios((p) => ({ ...p, alimentacion: v }))} keyboardType="numeric" placeholder="Ej: 12000" style={styles.input} />
            </View>
          )}
        </View>

        {/* Trabajadores */}
        <View style={styles.step}>
          <Text style={styles.stepTitle}>¿Quiénes trabajaron esta semana?</Text>
          <Text style={styles.hintText}>Toca los nombres para agregarlos o quitarlos.</Text>
          {sugeridos.length > 0 && (
            <View style={[styles.wrapRow, { marginTop: 8 }]}>
              {sugeridos.map((s) => {
                const activo = trabajadores.some((t) => t.key === keyDe(s));
                return (
                  <Pressable key={keyDe(s)} onPress={() => toggleSeleccion(s)} style={[styles.sugeridoChip, activo && styles.sugeridoChipActivo]}>
                    {activo && <Ionicons name="checkmark" size={13} color="#fff" style={{ marginRight: 2 }} />}
                    <Avatar src={s.foto} name={s.nombre} size={24} />
                    <Text style={[styles.sugeridoText, activo && styles.sugeridoTextActivo]}>  {s.nombre}</Text>
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
            <Pressable key={r.id} onPress={() => { toggleSeleccion({ trabajador_id: r.id, nombre: r.nombre_completo, foto: r.foto_selfie || null }); setBusqueda(''); setResultados([]); }} style={styles.resultRow}>
              <Avatar src={r.foto_selfie} name={r.nombre_completo} size={30} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.resultName}>{r.nombre_completo}</Text>
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

        {/* Detalle por trabajador */}
        {trabajadores.length > 0 && (
          <View style={{ gap: 10 }}>
            {trabajadores.map((t) => (
              <TrabajadorSemanaCard
                key={t.key} t={t} precios={precios} lotesFinca={lotesFinca}
                onChange={(nt) => setTrabajadores((prev) => prev.map((x) => (x.key === nt.key ? nt : x)))}
                onQuitar={(x) => setTrabajadores((prev) => prev.filter((y) => y.key !== x.key))}
              />
            ))}
          </View>
        )}

        {trabajadores.length > 0 && (
          <View style={styles.resumenBox}>
            <View style={styles.rowStart}>
              <Ionicons name="people-outline" size={16} color={COLORS.primaryDark} />
              <Text style={styles.resumenText}>  {trabajadores.length} trabajador{trabajadores.length !== 1 ? 'es' : ''} · {totalDias} jornales</Text>
            </View>
            <Text style={styles.resumenTotal}>{formatMoney(totalNeto)}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 40 }}>
          <Pressable style={styles.btnGhost} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={styles.btnGhostText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={guardarSemana} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <View style={styles.rowStart}>
                <Ionicons name="archive-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>  Guardar semana</Text>
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  ayudaBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.infoSoft, borderRadius: 12, padding: 12 },
  ayudaText: { flex: 1, fontSize: 12, color: COLORS.ink700, lineHeight: 17 },
  step: { borderRadius: 12, paddingVertical: 16, paddingHorizontal: 20, backgroundColor: COLORS.surface1 },
  stepAlt: { backgroundColor: COLORS.surface2 },
  stepTitle: { fontWeight: '800', color: COLORS.ink900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  hintText: { fontSize: 12, color: COLORS.ink500, marginTop: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  smallLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginBottom: 6 },
  input: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.ink900, backgroundColor: '#fff' },
  weekBtn: { padding: 10, borderRadius: 10, backgroundColor: COLORS.lineLight },
  weekLabelBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  weekLabel: { fontWeight: '800', color: COLORS.ink900, fontSize: 13 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff' },
  chipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontWeight: '700', fontSize: 12, color: COLORS.ink500 },
  chipTextActivo: { color: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-start' },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  stepperValue: { minWidth: 28, textAlign: 'center', fontWeight: '900', fontSize: 15, color: COLORS.ink900 },
  card: { borderWidth: 0.5, borderColor: COLORS.border, borderLeftWidth: 3, borderLeftColor: COLORS.primary, borderRadius: 12, padding: 12, backgroundColor: COLORS.surface2 },
  cardName: { fontWeight: '900', color: COLORS.ink900, fontSize: 15 },
  cardResumen: { fontSize: 12, color: COLORS.ink500, marginTop: 2 },
  badgeExterno: { fontSize: 10, fontWeight: '600', color: COLORS.ink400, backgroundColor: COLORS.lineLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginLeft: 6 },
  cardBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: COLORS.line },
  bloqueCard: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  bloqueSub: { fontSize: 12, fontWeight: '800', color: COLORS.primary, marginTop: 8 },
  agregarBloqueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 8 },
  agregarBloqueText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  switchLabel: { marginLeft: 8, fontSize: 12, color: COLORS.ink700, flex: 1 },
  totalBox: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12 },
  totalLabel: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase' },
  totalValuePrimary: { fontSize: 17, fontWeight: '900', color: COLORS.primaryDark },
  totalValueDanger: { fontSize: 17, fontWeight: '900', color: COLORS.danger },
  totalValueInk: { fontSize: 17, fontWeight: '900', color: COLORS.ink900 },
  sugeridoChip: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff' },
  sugeridoChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sugeridoText: { fontSize: 13, fontWeight: '600', color: COLORS.ink500 },
  sugeridoTextActivo: { color: '#fff' },
  buscarInputWrap: { flex: 1, backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12 },
  buscarInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', marginLeft: 6, paddingHorizontal: 0 },
  agregarNuevoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.loteAccent, borderWidth: 1, borderColor: COLORS.loteAccentBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  agregarNuevoText: { color: COLORS.seccionBadge, fontWeight: '700', fontSize: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  resultName: { fontSize: 13, fontWeight: '600', color: COLORS.ink900 },
  resultPhone: { fontSize: 11, color: COLORS.ink500 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  resumenBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(0,141,73,0.2)', padding: 14, flexWrap: 'wrap', gap: 6 },
  resumenText: { fontWeight: '700', color: COLORS.primaryDark },
  resumenTotal: { fontWeight: '900', color: COLORS.primaryDark, fontSize: 17 },
  btnGhost: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnGhostText: { fontWeight: '700', color: COLORS.ink700 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
