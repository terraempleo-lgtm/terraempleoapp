import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking, Alert, Image, Modal, Pressable, Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { chatsAPI, reportesAPI } from '../../services/api';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { showAlert } from '../../utils/alertService';
import { AnimatedPressable } from '../../components/animated';

const { width: SCREEN_W } = Dimensions.get('window');

function formatHoraMensaje(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatFechaSeparador(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDias = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDias === 0) return 'Hoy';
  if (diffDias === 1) return 'Ayer';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function esMismoDia(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDuracion(segundos) {
  const s = Math.floor(segundos || 0);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Burbuja de Audio ─────────────────────────────────────────────────────────
function BurbujaAudio({ url, duracion, esMio, colors }) {
  const [sound, setSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [posicion, setPosicion] = useState(0);
  const [durTotal, setDurTotal] = useState(duracion || 0);

  useEffect(() => {
    return () => { sound?.unloadAsync(); };
  }, [sound]);

  const togglePlay = async () => {
    try {
      if (!sound) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPosicion(status.positionMillis / 1000);
              setDurTotal(status.durationMillis ? status.durationMillis / 1000 : duracion || 0);
              if (status.didJustFinish) {
                setPlaying(false);
                setPosicion(0);
              }
            }
          }
        );
        setSound(s);
        setPlaying(true);
      } else if (playing) {
        await sound.pauseAsync();
        setPlaying(false);
      } else {
        await sound.playAsync();
        setPlaying(true);
      }
    } catch (e) {
      console.warn('Error reproduciendo audio:', e);
    }
  };

  const progreso = durTotal > 0 ? Math.min(posicion / durTotal, 1) : 0;
  const barColor = esMio ? 'rgba(255,255,255,0.9)' : COLORS.primary;
  const trackColor = esMio ? 'rgba(255,255,255,0.3)' : (colors?.borderLight || '#e0e0e0');

  return (
    <TouchableOpacity style={styles.audioRow} onPress={togglePlay} activeOpacity={0.8}>
      <View style={[styles.playBtn, { backgroundColor: esMio ? 'rgba(255,255,255,0.25)' : (COLORS.primarySoft || '#e8f5e9') }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={esMio ? COLORS.white : COLORS.primary} />
      </View>
      <View style={styles.audioInfo}>
        <View style={[styles.audioTrack, { backgroundColor: trackColor }]}>
          <View style={[styles.audioProgress, { width: `${progreso * 100}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.audioDur, { color: esMio ? 'rgba(255,255,255,0.75)' : (colors?.textMuted || '#999') }]}>
          {formatDuracion(posicion > 0 ? posicion : durTotal)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ChatDetalleScreen({ route, navigation }) {
  const { chat } = route.params;
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();
  const headerHeight = useHeaderHeight();

  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [grabando, setGrabando] = useState(false);
  const [durGrabacion, setDurGrabacion] = useState(0);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);

  const [imagenPreview, setImagenPreview] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [reporteModal, setReporteModal] = useState(null); // { mensaje_id?, usuario_id }
  const [reporteMotivo, setReporteMotivo] = useState('');
  const [reporteDesc, setReporteDesc] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);

  const flatListRef = useRef(null);
  const pollingRef = useRef(null);

  // ── Header ─────────────────────────────────────────────────────────────────
  const irAlPerfilRelacionado = useCallback(() => {
    const otroUsuarioId = Number(chat?.otro_usuario_id);
    const vacanteId = Number(chat?.vacante_id);
    if (!user?.rol || !otroUsuarioId) { navigation.goBack(); return; }
    if (user.rol === 'empleador') {
      navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: otroUsuarioId, vacante_id: Number.isFinite(vacanteId) ? vacanteId : undefined, postulacion_estado: 'aceptada' });
    } else if (user.rol === 'trabajador') {
      navigation.navigate('PerfilPublicoEmpleador', { empleador_id: otroUsuarioId, vacante_id: Number.isFinite(vacanteId) ? vacanteId : undefined, chat_data: chat });
    } else { navigation.goBack(); }
  }, [chat, user, navigation]);

  const llamar = useCallback(() => {
    if (!chat.otro_celular) { showAlert('Sin número', 'No hay número disponible.'); return; }
    const numero = String(chat.otro_celular).replace(/\D/g, '');
    Linking.openURL(`tel:+57${numero}`).catch(() => showAlert('Error', 'No se pudo abrir el marcador.'));
  }, [chat]);

  const reportarMensaje = useCallback((mensaje) => {
    setReporteMotivo('');
    setReporteDesc('');
    setReporteModal({ mensaje_id: mensaje.id, usuario_id: mensaje.emisor_id });
  }, []);

  const enviarReporte = useCallback(async () => {
    if (!reporteMotivo) { Alert.alert('Selecciona un motivo', 'Elige el motivo del reporte.'); return; }
    try {
      setEnviandoReporte(true);
      const payload = {
        usuario_reportado: reporteModal.usuario_id,
        chat_id: chat.id,
        motivo: reporteMotivo,
        descripcion: reporteDesc.trim() || undefined,
      };
      if (reporteModal.mensaje_id) payload.mensaje_id = reporteModal.mensaje_id;
      await reportesAPI.reportar(payload);
      setReporteModal(null);
      Alert.alert('Reporte enviado', 'Nuestro equipo revisará este contenido en las próximas 24 horas.');
    } catch { Alert.alert('Error', 'No se pudo enviar el reporte.'); }
    finally { setEnviandoReporte(false); }
  }, [reporteModal, reporteMotivo, reporteDesc, chat]);

  const handleBloquear = useCallback(() => {
    const otroId = chat?.otro_usuario_id;
    const nombre = chat?.otro_nombre || 'este usuario';
    setMenuVisible(false);
    Alert.alert(
      bloqueado ? 'Desbloquear usuario' : 'Bloquear usuario',
      bloqueado
        ? `¿Deseas desbloquear a ${nombre}?`
        : `¿Deseas bloquear a ${nombre}? Ya no podrán enviarse mensajes mutuamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: bloqueado ? 'Desbloquear' : 'Bloquear',
          style: bloqueado ? 'default' : 'destructive',
          onPress: async () => {
            try {
              if (bloqueado) {
                await reportesAPI.desbloquear(otroId);
                setBloqueado(false);
              } else {
                await reportesAPI.bloquear(otroId);
                setBloqueado(true);
                navigation.goBack();
              }
            } catch { showAlert('Error', 'No se pudo completar la acción.'); }
          }
        },
      ]
    );
  }, [chat, bloqueado]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <AnimatedPressable onPress={irAlPerfilRelacionado} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {chat.otro_foto ? (
            <Image source={{ uri: chat.otro_foto }} style={{ width: 38, height: 38, borderRadius: 19, overflow: 'hidden' }} />
          ) : (
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
          )}
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textPrimary }}>{chat.otro_nombre}</Text>
            {chat.vacante_titulo && <Text style={{ fontSize: 12, color: COLORS.textSecondary }} numberOfLines={1}>{chat.vacante_titulo}</Text>}
          </View>
        </AnimatedPressable>
      ),
      headerTitleAlign: 'left',
      headerLeft: () => (
        <AnimatedPressable onPress={() => navigation.goBack()} style={{ marginLeft: 16 }} scaleValue={0.9} haptic>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </AnimatedPressable>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
          <AnimatedPressable onPress={llamar} style={{ padding: 8 }} scaleValue={0.9} haptic>
            <Ionicons name="call" size={22} color={COLORS.textPrimary} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setMenuVisible(v => !v)} style={{ padding: 8 }} scaleValue={0.9} haptic>
            <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textPrimary} />
          </AnimatedPressable>
        </View>
      ),
    });
  }, [navigation, chat, irAlPerfilRelacionado, llamar]);

  // ── Carga y polling ────────────────────────────────────────────────────────
  const cargarMensajes = useCallback(async () => {
    try {
      const res = await chatsAPI.getMensajes(chat.id);
      setMensajes(res.data.mensajes || []);
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    } finally {
      setLoading(false);
    }
  }, [chat.id]);

  const marcarLeidos = useCallback(async () => {
    try { await chatsAPI.marcarLeidos(chat.id); } catch (_) {}
  }, [chat.id]);

  useEffect(() => {
    cargarMensajes();
    marcarLeidos();
    pollingRef.current = setInterval(() => { cargarMensajes(); marcarLeidos(); }, 5000);
    return () => clearInterval(pollingRef.current);
  }, [cargarMensajes, marcarLeidos]);

  useEffect(() => {
    if (mensajes.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [mensajes.length]);

  // ── Enviar texto ───────────────────────────────────────────────────────────
  const enviarTexto = async () => {
    const msg = texto.trim();
    if (!msg || enviando) return;
    setTexto('');
    setEnviando(true);
    try {
      const res = await chatsAPI.enviarMensaje(chat.id, msg);
      setMensajes(prev => [...prev, res.data.mensaje]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setTexto(msg);
      showAlert('Error', 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Enviar media ───────────────────────────────────────────────────────────
  const _subirMedia = async (uri, tipo, duracion = null) => {
    setEnviando(true);
    try {
      const res = await chatsAPI.enviarMedia(chat.id, uri, tipo, duracion);
      setMensajes(prev => [...prev, res.data.mensaje]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.warn('Error enviando media:', e);
      showAlert('Error', 'No se pudo enviar el archivo. Revisa tu conexión.');
    } finally {
      setEnviando(false);
    }
  };

  const seleccionarImagen = async (desdeCamera = false) => {
    try {
      let result;
      if (desdeCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showAlert('Permiso requerido', 'Necesitamos acceso a la cámara.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.7 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 });
      }
      if (result.canceled || !result.assets?.[0]) return;
      await _subirMedia(result.assets[0].uri, 'imagen');
    } catch (e) {
      console.warn('Error seleccionando imagen:', e);
    }
  };

  const mostrarOpcionesImagen = () => {
    Alert.alert('Enviar imagen', 'Elige una opción', [
      { text: 'Galería', onPress: () => seleccionarImagen(false) },
      { text: 'Cámara', onPress: () => seleccionarImagen(true) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ── Grabación de audio ─────────────────────────────────────────────────────
  const iniciarGrabacion = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { showAlert('Permiso requerido', 'Necesitamos acceso al micrófono.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setGrabando(true);
      setDurGrabacion(0);
      timerRef.current = setInterval(() => setDurGrabacion(d => d + 1), 1000);
    } catch (e) {
      console.warn('Error iniciando grabación:', e);
    }
  };

  const detenerGrabacion = async (cancelar = false) => {
    clearInterval(timerRef.current);
    const recording = recordingRef.current;
    recordingRef.current = null;
    const dur = durGrabacion;
    setGrabando(false);
    setDurGrabacion(0);
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (cancelar) return;
      const uri = recording.getURI();
      if (uri && dur >= 1) await _subirMedia(uri, 'audio', dur);
    } catch (e) {
      console.warn('Error deteniendo grabación:', e);
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  // ── Render mensajes ────────────────────────────────────────────────────────
  const renderMensaje = ({ item, index }) => {
    const esMio = item.emisor_id === user.id;
    const anterior = index > 0 ? mensajes[index - 1] : null;
    const mostrarFecha = !anterior || !esMismoDia(anterior.created_at, item.created_at);
    const tipo = item.tipo || 'texto';

    return (
      <>
        {mostrarFecha && (
          <View style={styles.fechaSeparador}>
            <Text style={styles.fechaSeparadorText}>{formatFechaSeparador(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.mensajeRow, esMio ? styles.mensajeRowMio : styles.mensajeRowOtro]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={!esMio ? () => reportarMensaje(item) : undefined}
            delayLongPress={500}
            style={styles.burbujaTouch}
          >
          <View style={[styles.burbuja, esMio ? styles.burbujaPropia : [styles.burbujaOtra, { backgroundColor: colors.surface }]]}>

            {tipo === 'imagen' && item.archivo_url && (
              <TouchableOpacity onPress={() => setImagenPreview(item.archivo_url)} activeOpacity={0.9} style={styles.imagenWrapper}>
                <Image source={{ uri: item.archivo_url }} style={styles.imagenBurbuja} resizeMode="cover" />
              </TouchableOpacity>
            )}

            {tipo === 'audio' && item.archivo_url && (
              <BurbujaAudio url={item.archivo_url} duracion={item.duracion_audio} esMio={esMio} colors={colors} />
            )}

            {tipo === 'texto' && (
              <Text style={[styles.textoMensaje, esMio ? styles.textoMio : { color: colors.textPrimary }]}>
                {item.mensaje}
              </Text>
            )}

            <View style={styles.metaRow}>
              <Text style={[styles.horaTexto, esMio ? styles.horaMio : { color: colors.textMuted }]}>
                {formatHoraMensaje(item.created_at)}
              </Text>
              {esMio && (
                <Ionicons
                  name={item.leido ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.leido ? '#90EE90' : 'rgba(255,255,255,0.7)'}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // ── Barra de input ─────────────────────────────────────────────────────────
  const renderInputBar = () => {
    if (grabando) {
      return (
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => detenerGrabacion(true)}>
            <Ionicons name="close" size={22} color={COLORS.error} />
          </TouchableOpacity>
          <View style={styles.grabandoIndicador}>
            <View style={styles.grabandoPunto} />
            <Text style={styles.grabandoTexto}>Grabando {formatDuracion(durGrabacion)}</Text>
          </View>
          <TouchableOpacity style={styles.sendBtn} onPress={() => detenerGrabacion(false)}>
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {!texto.trim() && (
          <TouchableOpacity style={styles.mediaBtn} onPress={mostrarOpcionesImagen} disabled={enviando}>
            <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <TextInput
          style={[styles.input, {
            backgroundColor: isDark ? colors.background : '#F0F4F1',
            color: colors.textPrimary,
            borderColor: isDark ? colors.border : 'transparent',
          }]}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />

        {texto.trim() ? (
          <AnimatedPressable
            style={[styles.sendBtn, enviando && styles.sendBtnDisabled]}
            onPress={enviarTexto}
            disabled={enviando}
            scaleValue={0.9}
          >
            {enviando ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.white} />
            )}
          </AnimatedPressable>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: '#5a9d5a' }]}
            onPressIn={iniciarGrabacion}
            onPressOut={() => detenerGrabacion(false)}
            disabled={enviando}
          >
            <Ionicons name="mic" size={22} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: isDark ? colors.background : '#F0F4F1' }]}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          ref={flatListRef}
          data={mensajes}
          keyExtractor={(item, i) => String(item.id ?? i)}
          renderItem={renderMensaje}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubble-outline" size={40} color={COLORS.disabled} />
              <Text style={styles.emptyChatText}>Sé el primero en escribir</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        {renderInputBar()}
      </KeyboardAvoidingView>

      <Modal visible={!!imagenPreview} transparent animationType="fade" onRequestClose={() => setImagenPreview(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setImagenPreview(null)}>
          <Image source={{ uri: imagenPreview }} style={styles.imagenFullscreen} resizeMode="contain" />
          <TouchableOpacity style={styles.modalClose} onPress={() => setImagenPreview(null)}>
            <Ionicons name="close-circle" size={36} color={COLORS.white} />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* Menú contextual — reportar / bloquear */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenuVisible(false)}>
          <View style={{ position: 'absolute', top: 60, right: 12, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 8, overflow: 'hidden', minWidth: 200 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}
              onPress={handleBloquear}
            >
              <Ionicons name={bloqueado ? 'lock-open-outline' : 'ban-outline'} size={20} color={bloqueado ? COLORS.primary : COLORS.error} />
              <Text style={{ fontSize: 15, color: bloqueado ? COLORS.primary : COLORS.error }}>{bloqueado ? 'Desbloquear usuario' : 'Bloquear usuario'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
              onPress={() => {
                setMenuVisible(false);
                setReporteMotivo('');
                setReporteDesc('');
                setReporteModal({ usuario_id: chat.otro_usuario_id });
              }}
            >
              <Ionicons name="flag-outline" size={20} color={COLORS.warning} />
              <Text style={{ fontSize: 15, color: COLORS.warning }}>Reportar usuario</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal reporte con motivo + descripción */}
      <Modal visible={!!reporteModal} transparent animationType="slide" onRequestClose={() => setReporteModal(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setReporteModal(null)}>
          <Pressable onPress={() => {}}>
            <View style={styles.reporteCard}>
              <View style={styles.reporteHeader}>
                <Text style={styles.reporteTitulo}>
                  {reporteModal?.mensaje_id ? 'Reportar mensaje' : 'Reportar usuario'}
                </Text>
                <TouchableOpacity onPress={() => setReporteModal(null)}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.reporteLabel}>Motivo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {['Contenido inapropiado', 'Acoso o amenazas', 'Spam o fraude', 'Lenguaje ofensivo', 'Información falsa', 'Otro'].map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setReporteMotivo(m)}
                    style={[styles.motivoChip, reporteMotivo === m && styles.motivoChipActivo]}
                  >
                    <Text style={[styles.motivoChipText, reporteMotivo === m && styles.motivoChipTextActivo]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.reporteLabel}>¿Puedes contarnos más? <Text style={{ color: COLORS.textSecondary, fontWeight: '400' }}>(opcional)</Text></Text>
              <TextInput
                style={styles.reporteInput}
                placeholder="Describe lo que ocurrió..."
                placeholderTextColor={COLORS.textSecondary}
                value={reporteDesc}
                onChangeText={setReporteDesc}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />

              <TouchableOpacity
                style={[styles.reporteBtn, { opacity: enviandoReporte || !reporteMotivo ? 0.6 : 1 }]}
                onPress={enviarReporte}
                disabled={enviandoReporte || !reporteMotivo}
                activeOpacity={0.85}
              >
                {enviandoReporte
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.reporteBtnText}>Enviar reporte</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 8, paddingVertical: 12 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyChatText: { marginTop: 8, color: COLORS.textLight, fontSize: 14 },
  fechaSeparador: { alignItems: 'center', marginVertical: 12 },
  fechaSeparadorText: {
    fontSize: 12, color: COLORS.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  mensajeRow: { marginVertical: 2, flexDirection: 'row' },
  mensajeRowMio: { justifyContent: 'flex-end' },
  mensajeRowOtro: { justifyContent: 'flex-start' },
  burbujaTouch: { maxWidth: '75%' },
  burbuja: {
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
    borderRadius: RADIUS.xl, elevation: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1,
  },
  burbujaPropia: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  burbujaOtra: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  textoMensaje: { fontSize: 15, lineHeight: 21 },
  textoMio: { color: COLORS.white },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  horaTexto: { fontSize: 11 },
  horaMio: { color: 'rgba(255,255,255,0.75)' },
  imagenWrapper: { margin: -12, marginBottom: 0 },
  imagenBurbuja: { width: SCREEN_W * 0.62, height: SCREEN_W * 0.62, borderRadius: RADIUS.xl },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180, paddingVertical: 4 },
  playBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  audioInfo: { flex: 1, gap: 4 },
  audioTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  audioProgress: { height: '100%', borderRadius: 2 },
  audioDur: { fontSize: 11 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: 1, gap: 8,
  },
  mediaBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1, borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, maxHeight: 120, borderWidth: 1,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.disabled },
  cancelBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  grabandoIndicador: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  grabandoPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.error },
  grabandoTexto: { fontSize: 14, color: COLORS.error, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  imagenFullscreen: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  modalClose: { position: 'absolute', top: 48, right: 16 },
  reporteCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 10 },
  reporteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reporteTitulo: { fontSize: 17, fontWeight: '700', color: '#111' },
  reporteLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4 },
  motivoChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: '#F5F5F5' },
  motivoChipActivo: { borderColor: COLORS.error, backgroundColor: COLORS.error + '15' },
  motivoChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  motivoChipTextActivo: { color: COLORS.error, fontWeight: '700' },
  reporteInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, fontSize: 14, color: '#111', minHeight: 80, backgroundColor: '#FAFAFA' },
  reporteBtn: { backgroundColor: COLORS.error, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  reporteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
