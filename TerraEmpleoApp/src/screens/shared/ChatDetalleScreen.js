import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { chatsAPI } from '../../services/api';
import { COLORS } from '../../theme';

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
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}

export default function ChatDetalleScreen({ route, navigation }) {
  const { chat } = route.params;
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const flatListRef = useRef(null);
  const pollingRef = useRef(null);

  const volverAlPerfilRelacionado = () => {
    const otroUsuarioId = Number(chat?.otro_usuario_id);
    const vacanteId = Number(chat?.vacante_id);

    if (!user?.rol || !otroUsuarioId) {
      navigation.goBack();
      return;
    }

    if (user.rol === 'empleador') {
      navigation.replace('PerfilPublicoTrabajador', {
        trabajador_id: otroUsuarioId,
        vacante_id: Number.isFinite(vacanteId) ? vacanteId : undefined,
        postulacion_estado: 'aceptada',
      });
      return;
    }

    if (user.rol === 'trabajador') {
      navigation.replace('PerfilPublicoEmpleador', {
        empleador_id: otroUsuarioId,
        vacante_id: Number.isFinite(vacanteId) ? vacanteId : undefined,
        chat_data: chat,
      });
      return;
    }

    navigation.goBack();
  };

  useEffect(() => {
    navigation.setOptions({
      title: chat.otro_nombre,
      headerLeft: () => (
        <TouchableOpacity onPress={volverAlPerfilRelacionado} style={{ marginLeft: 16 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={llamar} style={{ marginRight: 16 }}>
          <Ionicons name="call" size={22} color={COLORS.white} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, chat, user]);

  const llamar = () => {
    if (!chat.otro_celular) {
      Alert.alert('Sin número', 'No hay número disponible para este contacto.');
      return;
    }
    const numero = String(chat.otro_celular).replace(/\D/g, '');
    const url = `tel:+57${numero}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'No se puede abrir el marcador en este dispositivo.');
        }
      })
      .catch(() => Alert.alert('Error', 'No se pudo abrir el marcador.'));
  };

  const cargarMensajes = useCallback(async () => {
    try {
      const res = await chatsAPI.getMensajes(chat.id);
      const nuevos = res.data.mensajes || [];
      setMensajes(nuevos);
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    } finally {
      setLoading(false);
    }
  }, [chat.id]);

  const marcarLeidos = useCallback(async () => {
    try {
      await chatsAPI.marcarLeidos(chat.id);
    } catch (_) {}
  }, [chat.id]);

  useEffect(() => {
    cargarMensajes();
    marcarLeidos();
    // Polling cada 5 segundos
    pollingRef.current = setInterval(() => {
      cargarMensajes();
      marcarLeidos();
    }, 5000);
    return () => clearInterval(pollingRef.current);
  }, [cargarMensajes, marcarLeidos]);

  useEffect(() => {
    if (mensajes.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [mensajes.length]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || enviando) return;

    setTexto('');
    setEnviando(true);
    try {
      const res = await chatsAPI.enviarMensaje(chat.id, msg);
      const nuevo = res.data.mensaje;
      setMensajes(prev => [...prev, nuevo]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error('Error enviando:', err);
      setTexto(msg);
      Alert.alert('Error', 'No se pudo enviar el mensaje. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const renderMensaje = ({ item, index }) => {
    const esMio = item.emisor_id === user.id;
    const anterior = index > 0 ? mensajes[index - 1] : null;
    const mostrarFecha = !anterior || !esMismoDia(anterior.created_at, item.created_at);

    return (
      <>
        {mostrarFecha && (
          <View style={styles.fechaSeparador}>
            <Text style={styles.fechaSeparadorText}>{formatFechaSeparador(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.mensajeRow, esMio ? styles.mensajeRowMio : styles.mensajeRowOtro]}>
          <View style={[styles.burbuja, esMio ? styles.burbujaPropia : styles.burbujaOtra]}>
            <Text style={[styles.textoMensaje, esMio ? styles.textoMio : styles.textoOtro]}>
              {item.mensaje}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.horaTexto, esMio ? styles.horaMio : styles.horaOtro]}>
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
        </View>
      </>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Cabecera de vacante */}
      <View style={styles.vacanteHeader}>
        <Ionicons name="briefcase-outline" size={14} color={COLORS.primary} />
        <Text style={styles.vacanteTitulo} numberOfLines={1}>{chat.vacante_titulo}</Text>
      </View>

      {/* Lista de mensajes */}
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

      {/* Input de mensaje */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={COLORS.textLight}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!texto.trim() || enviando) && styles.sendBtnDisabled]}
          onPress={enviar}
          disabled={!texto.trim() || enviando}
          activeOpacity={0.8}
        >
          {enviando ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  vacanteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 6,
  },
  vacanteTitulo: { fontSize: 13, color: COLORS.primary, fontWeight: '500', flex: 1 },
  listContent: { paddingHorizontal: 8, paddingVertical: 12 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyChatText: { marginTop: 8, color: COLORS.textLight, fontSize: 14 },
  fechaSeparador: {
    alignItems: 'center',
    marginVertical: 12,
  },
  fechaSeparadorText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mensajeRow: { marginVertical: 2, flexDirection: 'row' },
  mensajeRowMio: { justifyContent: 'flex-end' },
  mensajeRowOtro: { justifyContent: 'flex-start' },
  burbuja: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  burbujaPropia: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 2,
  },
  burbujaOtra: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 2,
  },
  textoMensaje: { fontSize: 15, lineHeight: 21 },
  textoMio: { color: COLORS.white },
  textoOtro: { color: COLORS.textPrimary },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  horaTexto: { fontSize: 11 },
  horaMio: { color: 'rgba(255,255,255,0.75)' },
  horaOtro: { color: COLORS.textLight },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.disabled },
});
