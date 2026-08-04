import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Selector de fecha propio (grilla de mes) que funciona igual en web,
// Android e iOS. Reemplaza a @react-native-community/datetimepicker en el
// Cuaderno: ese picker no renderiza nada en web y dejaba el botón de fecha
// "muerto" (bug reportado en ¿Cuándo fue la jornada?).

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const pad = (n) => String(n).padStart(2, '0');
export const dateAYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function ymdADate(ymd) {
  if (ymd && /^\d{4}-\d{2}-\d{2}/.test(String(ymd))) {
    const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

// Celdas del mes en filas de 7, arrancando lunes. null = celda vacía.
function celdasDelMes(anio, mes /* 0-11 */) {
  const primerDia = new Date(anio, mes, 1);
  const dow = primerDia.getDay(); // 0=Dom
  const offset = dow === 0 ? 6 : dow - 1;
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  const celdas = Array(offset).fill(null);
  for (let d = 1; d <= ultimoDia; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

export default function CalendarioModal({ visible, fecha, onClose, onSelect, titulo = 'Elige la fecha' }) {
  const inicial = ymdADate(fecha);
  const [anio, setAnio] = useState(inicial.getFullYear());
  const [mes, setMes] = useState(inicial.getMonth());

  // Si se reabre con otra fecha seleccionada, mostrar ese mes.
  const keyFecha = String(fecha || '');
  const [ultimaKey, setUltimaKey] = useState(keyFecha);
  if (visible && keyFecha !== ultimaKey) {
    setUltimaKey(keyFecha);
    const d = ymdADate(fecha);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  }

  const celdas = useMemo(() => celdasDelMes(anio, mes), [anio, mes]);
  const hoy = dateAYMD(new Date());
  const seleccionada = String(fecha || '').slice(0, 10);

  const moverMes = (delta) => {
    let m = mes + delta;
    let a = anio;
    if (m < 0) { m = 11; a -= 1; }
    if (m > 11) { m = 0; a += 1; }
    setMes(m); setAnio(a);
  };

  const elegir = (dia) => {
    if (!dia) return;
    onSelect(`${anio}-${pad(mes + 1)}-${pad(dia)}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.titulo}>{titulo}</Text>
          <View style={styles.nav}>
            <Pressable onPress={() => moverMes(-1)} hitSlop={8} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color={COLORS.ink700} />
            </Pressable>
            <Text style={styles.navLabel}>{MESES[mes]} {anio}</Text>
            <Pressable onPress={() => moverMes(1)} hitSlop={8} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.ink700} />
            </Pressable>
          </View>

          <View style={styles.fila}>
            {DIAS.map((d, i) => <Text key={i} style={styles.diaHeader}>{d}</Text>)}
          </View>
          {Array.from({ length: celdas.length / 7 }, (_, f) => (
            <View key={f} style={styles.fila}>
              {celdas.slice(f * 7, f * 7 + 7).map((dia, i) => {
                const ymd = dia ? `${anio}-${pad(mes + 1)}-${pad(dia)}` : null;
                const esSel = ymd && ymd === seleccionada;
                const esHoy = ymd && ymd === hoy;
                return (
                  <Pressable key={i} disabled={!dia} onPress={() => elegir(dia)}
                    style={[styles.celda, esHoy && !esSel && styles.celdaHoy, esSel && styles.celdaSel]}>
                    <Text style={[styles.celdaText, esHoy && !esSel && styles.celdaHoyText, esSel && styles.celdaSelText]}>
                      {dia || ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.acciones}>
            <Pressable onPress={() => { onSelect(hoy); onClose(); }} style={styles.hoyBtn}>
              <Ionicons name="today-outline" size={14} color={COLORS.primary} />
              <Text style={styles.hoyBtnText}>  Hoy</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.cerrarBtn}>
              <Text style={styles.cerrarBtnText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, maxWidth: 380, width: '100%', alignSelf: 'center' },
  titulo: { fontWeight: '900', fontSize: 15, color: COLORS.ink900, marginBottom: 8 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { padding: 8, borderRadius: 10, backgroundColor: COLORS.lineLight },
  navLabel: { fontWeight: '800', fontSize: 14, color: COLORS.ink900 },
  fila: { flexDirection: 'row' },
  diaHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.ink400, paddingVertical: 6 },
  celda: { flex: 1, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center', borderRadius: 10, margin: 1 },
  celdaText: { fontSize: 13, color: COLORS.ink700, fontWeight: '600' },
  celdaHoy: { borderWidth: 1.5, borderColor: COLORS.primary },
  celdaHoyText: { color: COLORS.primary, fontWeight: '800' },
  celdaSel: { backgroundColor: COLORS.primary },
  celdaSelText: { color: '#fff', fontWeight: '900' },
  acciones: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  hoyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  hoyBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
  cerrarBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  cerrarBtnText: { color: COLORS.ink500, fontWeight: '700', fontSize: 13 },
});
