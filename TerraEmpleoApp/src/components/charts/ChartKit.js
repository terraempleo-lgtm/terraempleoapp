import React from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { MotiPressable } from 'moti/interactions';

// ── Paleta compartida por las 6 gráficas del Resumen del Cuaderno ──────────
export const CHART_COLORS = {
  primary: '#008d49',
  primaryDark: '#1B512D',
  terracota: '#C0652A',
  grid: '#F3F4F6',
  axis: '#9CA3AF',
  tooltipBg: '#1B512D',
  emptyIconBg: '#EAF3DE',
  emptyText: '#9CA3AF',
  ink900: '#171a15',
  ink700: '#3f4438',
  ink500: '#6b7060',
  ink400: '#8b9080',
  line: '#e4e6de',
};

// Interpola de rojo a verde en HSL (0 = rojo/malo, 1 = verde/bueno).
export function colorMaloBueno(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const hue = clamped * 122; // 0=rojo, 122=verde
  return `hsl(${Math.round(hue)}, 65%, 45%)`;
}

export function ChartCard({ title, icon, children, right }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.rowStart}>
          {icon && <Ionicons name={icon} size={16} color={CHART_COLORS.primary} />}
          <Text style={styles.cardTitle}>  {title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// Card compacta de análisis — SIN fondo de color completo (se siente
// alarmante); solo borde izquierdo de 3px en el color del estado.
export function AnalisisCard({ texto, tono = 'ok' }) {
  const color = {
    ok: CHART_COLORS.primary,
    alerta: '#d97706',
    riesgo: CHART_COLORS.terracota,
  }[tono] || CHART_COLORS.primary;
  return (
    <View style={[styles.analisisCard, { borderLeftColor: color }]}>
      <Text style={styles.analisisTexto} numberOfLines={3}>{texto}</Text>
    </View>
  );
}

export function ChartTooltip({ visible, children }) {
  if (!visible) return null;
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={styles.tooltip}
    >
      {children}
    </MotiView>
  );
}

export function TooltipLine({ label, value }) {
  return (
    <View style={styles.tooltipLine}>
      <Text style={styles.tooltipLabel}>{label}</Text>
      <Text style={styles.tooltipValue}>{value}</Text>
    </View>
  );
}

export function ChartEmptyState({ texto, accion, onAccion, icon = 'stats-chart-outline' }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={20} color={CHART_COLORS.primary} /></View>
      <Text style={styles.emptyTexto}>{texto}</Text>
      {accion && (
        <Pressable onPress={onAccion} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>{accion}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Barra/punto tocable con la animación de escala pedida (0.97 → 1.0, 150ms).
export function Tocable({ onPress, style, children }) {
  return (
    <MotiPressable
      onPress={onPress}
      style={style}
      animate={({ pressed }) => ({ scale: pressed ? 0.97 : 1 })}
      transition={{ type: 'timing', duration: 150 }}
    >
      {children}
    </MotiPressable>
  );
}

// Campo pequeño editable para configurar meta_kg_semanal / precio_venta_kilo
// directo arriba de la gráfica correspondiente.
export function CampoConfigurable({ label, value, onGuardar, placeholder, sufijo }) {
  const [editando, setEditando] = React.useState(false);
  const [texto, setTexto] = React.useState(value != null ? String(value) : '');

  React.useEffect(() => { setTexto(value != null ? String(value) : ''); }, [value]);

  const guardar = () => {
    setEditando(false);
    const num = Number(texto.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(num) && num > 0) onGuardar(num);
  };

  if (editando) {
    return (
      <View style={styles.configRow}>
        <Text style={styles.configLabel}>{label}</Text>
        <TextInput
          placeholderTextColor={CHART_COLORS.ink400}
          value={texto}
          onChangeText={setTexto}
          onBlur={guardar}
          onSubmitEditing={guardar}
          keyboardType="numeric"
          autoFocus
          placeholder={placeholder}
          style={styles.configInput}
        />
      </View>
    );
  }
  return (
    <Pressable style={styles.configRow} onPress={() => setEditando(true)}>
      <Text style={styles.configLabel}>{label}</Text>
      <View style={styles.rowStart}>
        <Text style={styles.configValue}>{value != null ? `${value}${sufijo || ''}` : 'Configurar'}</Text>
        <Ionicons name="pencil-outline" size={12} color={CHART_COLORS.ink400} style={{ marginLeft: 4 }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: CHART_COLORS.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontWeight: '700', color: CHART_COLORS.ink900, fontSize: 14 },
  analisisCard: { marginTop: 12, backgroundColor: '#fff', borderLeftWidth: 3, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  analisisTexto: { fontSize: 13, color: CHART_COLORS.ink700, lineHeight: 18 },
  tooltip: { backgroundColor: CHART_COLORS.tooltipBg, borderRadius: 8, padding: 10, marginTop: 10 },
  tooltipLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  tooltipLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  tooltipValue: { fontSize: 11, color: '#fff', fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: CHART_COLORS.emptyIconBg, alignItems: 'center', justifyContent: 'center' },
  emptyTexto: { fontSize: 12, color: CHART_COLORS.emptyText, textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: { marginTop: 4, backgroundColor: CHART_COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CHART_COLORS.grid, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  configLabel: { fontSize: 11, color: CHART_COLORS.ink500, fontWeight: '600' },
  configValue: { fontSize: 12, color: CHART_COLORS.ink900, fontWeight: '700' },
  configInput: { fontSize: 12, color: CHART_COLORS.ink900, fontWeight: '700', minWidth: 80, textAlign: 'right', padding: 0 },
});
