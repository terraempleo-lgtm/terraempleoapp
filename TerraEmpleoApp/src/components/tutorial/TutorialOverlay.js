import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, useWindowDimensions } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

/**
 * Overlay reutilizable de tutorial interactivo (coach-marks).
 *
 * Oscurece la pantalla, resalta el elemento del paso actual y muestra una
 * tarjeta con la explicación, progreso ("1 de 5"), Atrás/Siguiente/Finalizar
 * y "Saltar tutorial".
 *
 * Cada paso: {
 *   title:     string
 *   text:      string
 *   icon?:     nombre de Ionicons (opcional)
 *   targetRef?: ref a un View con collapsable={false} — si falta o no se
 *              puede medir, el paso se muestra como tarjeta centrada
 *   scrollY?:  posición Y del ScrollView (prop scrollRef) a la que hay que
 *              desplazarse para que el target quede visible
 * }
 */
const HOLE_PAD = 8;

export default function TutorialOverlay({ visible, steps, onFinish, onSkip, scrollRef }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [indice, setIndice] = useState(0);
  const [hole, setHole] = useState(null); // {x,y,w,h} o null → tarjeta centrada
  const [midiendo, setMidiendo] = useState(true);
  const [cardH, setCardH] = useState(230);
  const vivoRef = useRef(false);

  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  // Al abrir, siempre desde el primer paso
  useEffect(() => {
    if (visible) { setIndice(0); setHole(null); }
  }, [visible]);

  const total = steps.length;
  const paso = steps[Math.min(indice, total - 1)] || null;
  const esUltimo = indice >= total - 1;

  const medirPaso = useCallback((p) => {
    setMidiendo(true);
    const terminar = (rect) => { if (vivoRef.current) { setHole(rect); setMidiendo(false); } };
    if (!p || !p.targetRef?.current?.measureInWindow) { terminar(null); return; }
    const medir = () => {
      const nodo = p.targetRef.current;
      if (!nodo?.measureInWindow) { terminar(null); return; }
      nodo.measureInWindow((x, y, w, h) => {
        // Si el elemento no es medible o quedó fuera de pantalla → tarjeta centrada
        if (!w || !h || y == null || y > winH - 80 || y + h < 0) { terminar(null); return; }
        terminar({ x, y, w, h });
      });
    };
    if (p.scrollY !== undefined && scrollRef?.current?.scrollTo) {
      scrollRef.current.scrollTo({ y: Math.max(0, p.scrollY), animated: true });
      setTimeout(medir, 450); // esperar a que termine el scroll
    } else {
      setTimeout(medir, 80);
    }
  }, [scrollRef, winH]);

  useEffect(() => {
    if (visible) medirPaso(steps[Math.min(indice, steps.length - 1)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, indice]);

  if (!visible || !paso) return null;

  const siguiente = () => (esUltimo ? onFinish() : setIndice((i) => i + 1));
  const atras = () => setIndice((i) => Math.max(0, i - 1));

  // Geometría del "hueco" resaltado
  const hx = hole ? Math.max(0, hole.x - HOLE_PAD) : 0;
  const hy = hole ? Math.max(0, hole.y - HOLE_PAD) : 0;
  const hw = hole ? Math.min(winW - hx, hole.w + HOLE_PAD * 2) : 0;
  const hh = hole ? hole.h + HOLE_PAD * 2 : 0;

  // Posición de la tarjeta: debajo del hueco si cabe, si no encima; centrada si no hay target
  const cardW = Math.min(winW - 32, 360);
  let cardTop = null;
  let cardLeft = (winW - cardW) / 2;
  if (hole) {
    const abajo = hy + hh + 14;
    cardTop = abajo + cardH + 24 <= winH ? abajo : Math.max(24, hy - 14 - cardH);
    cardLeft = Math.min(Math.max(16, hx + hw / 2 - cardW / 2), winW - 16 - cardW);
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Fondo oscurecido: 4 rectángulos alrededor del hueco (o pantalla completa) */}
        {hole ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hy }]} />
            <View style={[styles.dim, { top: hy, left: 0, width: hx, height: hh }]} />
            <View style={[styles.dim, { top: hy, left: hx + hw, right: 0, height: hh }]} />
            <View style={[styles.dim, { top: hy + hh, left: 0, right: 0, bottom: 0 }]} />
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 220 }}
              pointerEvents="none"
              style={[styles.marco, { top: hy, left: hx, width: hw, height: hh }]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        {/* Tarjeta explicativa */}
        {!midiendo && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 240 }}
            onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
            style={[
              styles.card,
              { width: cardW, left: cardLeft },
              cardTop === null ? { top: winH / 2 - cardH / 2 } : { top: cardTop },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.progreso}>{Math.min(indice + 1, total)} de {total}</Text>
              <Pressable onPress={onSkip} hitSlop={10}>
                <Text style={styles.saltar}>Saltar tutorial</Text>
              </Pressable>
            </View>

            <View style={styles.tituloRow}>
              {paso.icon ? (
                <View style={styles.iconBadge}>
                  <Ionicons name={paso.icon} size={18} color={COLORS.primary} />
                </View>
              ) : null}
              <Text style={styles.titulo}>{paso.title}</Text>
            </View>
            <Text style={styles.texto}>{paso.text}</Text>

            <View style={styles.dotsRow}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.dot, i === indice && styles.dotActivo]} />
              ))}
            </View>

            <View style={styles.botonesRow}>
              {indice > 0 ? (
                <Pressable onPress={atras} style={styles.btnGhost}>
                  <Ionicons name="chevron-back" size={14} color={COLORS.textLight} />
                  <Text style={styles.btnGhostText}> Atrás</Text>
                </Pressable>
              ) : <View />}
              <Pressable onPress={siguiente} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>{esUltimo ? 'Finalizar' : 'Siguiente'}</Text>
                {!esUltimo && <Ionicons name="chevron-forward" size={14} color={COLORS.white} />}
              </Pressable>
            </View>
          </MotiView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(10, 18, 12, 0.72)' },
  marco: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  card: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 16,
    ...SHADOWS.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progreso: { fontSize: 11, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  saltar: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, textDecorationLine: 'underline' },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  iconBadge: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  titulo: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  texto: { fontSize: 13, lineHeight: 19, color: COLORS.textLight },
  dotsRow: { flexDirection: 'row', gap: 5, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActivo: { backgroundColor: COLORS.primary, width: 16 },
  botonesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  btnGhost: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  btnGhostText: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 18,
  },
  btnPrimaryText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
});
