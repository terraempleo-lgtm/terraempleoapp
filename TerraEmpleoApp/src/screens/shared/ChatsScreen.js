import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { chatsAPI } from '../../services/api';
import { COLORS } from '../../theme';

function formatHora(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDias = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDias === 0) {
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) {
    return date.toLocaleDateString('es-CO', { weekday: 'short' });
  }
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
}

export default function ChatsScreen({ navigation, route }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarChats = useCallback(async () => {
    try {
      const res = await chatsAPI.misChats();
      setChats(res.data.chats || []);
    } catch (err) {
      console.error('Error cargando chats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarChats();
    // Polling cada 5 segundos para nuevos mensajes
    const interval = setInterval(cargarChats, 5000);
    return () => clearInterval(interval);
  }, [cargarChats]);

  useEffect(() => {
    const chatObjetivoId = Number(route?.params?.abrirChatId);
    if (!chatObjetivoId || chats.length === 0) return;

    const chatObjetivo = chats.find((c) => Number(c.id) === chatObjetivoId);
    if (chatObjetivo) {
      navigation.navigate('ChatDetalle', { chat: chatObjetivo });
      navigation.setParams({ abrirChatId: undefined });
    }
  }, [route?.params?.abrirChatId, chats, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarChats();
  };

  const abrirChat = (chat) => {
    navigation.navigate('ChatDetalle', { chat });
  };

  const renderChat = ({ item }) => {
    const tieneFoto = item.otro_foto && item.otro_foto.startsWith('http');
    const iniciales = item.otro_nombre
      ? item.otro_nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
      : '?';

    return (
      <TouchableOpacity style={styles.chatItem} onPress={() => abrirChat(item)} activeOpacity={0.7}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {tieneFoto ? (
            <Image source={{ uri: item.otro_foto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{iniciales}</Text>
            </View>
          )}
          {item.no_leidos > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.no_leidos > 9 ? '9+' : item.no_leidos}
              </Text>
            </View>
          )}
        </View>

        {/* Contenido */}
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.nombreUsuario} numberOfLines={1}>{item.otro_nombre}</Text>
            <Text style={styles.hora}>{formatHora(item.ultimo_mensaje_at)}</Text>
          </View>
          <Text style={styles.vacanteTitulo} numberOfLines={1}>
            {item.vacante_titulo}
          </Text>
          <Text
            style={[styles.ultimoMensaje, item.no_leidos > 0 && styles.ultimoMensajeNoLeido]}
            numberOfLines={1}
          >
            {item.ultimo_mensaje || 'Sin mensajes aún'}
          </Text>
        </View>
      </TouchableOpacity>
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
    <View style={styles.container}>
      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.disabled} />
          <Text style={styles.emptyTitle}>Sin conversaciones</Text>
          <Text style={styles.emptyText}>
            Los chats aparecen cuando un empleador acepta tu postulación.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderChat}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  separator: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 76 },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  nombreUsuario: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  hora: { fontSize: 12, color: COLORS.textLight },
  vacanteTitulo: { fontSize: 12, color: COLORS.primary, fontWeight: '500', marginBottom: 2 },
  ultimoMensaje: { fontSize: 13, color: COLORS.textSecondary },
  ultimoMensajeNoLeido: { color: COLORS.textPrimary, fontWeight: '600' },
});
