import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  Image, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { chatsAPI } from '../../services/api';
import { COLORS, SPACING, ANIMATION } from '../../theme';
import { MotiView } from 'moti';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { AnimatedPressable, ShimmerPlaceholder, FadeInView, StaggeredItem } from '../../components/animated';

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

/* ── Shimmer skeleton row for loading ── */
function ChatSkeleton() {
  return (
    <View style={styles.chatItem}>
      <ShimmerPlaceholder width={52} height={52} borderRadius={26} />
      <View style={styles.chatContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <ShimmerPlaceholder width={120} height={14} borderRadius={4} />
          <ShimmerPlaceholder width={40} height={12} borderRadius={4} />
        </View>
        <ShimmerPlaceholder width={160} height={12} borderRadius={4} style={{ marginBottom: 4 }} />
        <ShimmerPlaceholder width={200} height={12} borderRadius={4} />
      </View>
    </View>
  );
}

/* ── Pulsing badge for unread count ── */
function PulsingBadge({ count }) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View style={[styles.badge, animStyle]}>
      <Text style={styles.badgeText}>
        {count > 9 ? '9+' : count}
      </Text>
    </Animated.View>
  );
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

  const renderChat = ({ item, index }) => {
    const tieneFoto = item.otro_foto && item.otro_foto.startsWith('http');
    const iniciales = item.otro_nombre
      ? item.otro_nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
      : '?';

    return (
      <StaggeredItem index={index}>
        <AnimatedPressable style={styles.chatItem} onPress={() => abrirChat(item)} scaleValue={0.98} haptic={false}>
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
              <PulsingBadge count={item.no_leidos} />
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
        </AnimatedPressable>
      </StaggeredItem>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <FadeInView delay={0}>
          {[0, 1, 2, 3].map(i => (
            <View key={i}>
              <ChatSkeleton />
              <View style={styles.separator} />
            </View>
          ))}
        </FadeInView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MotiView
            from={{ translateY: 0 }}
            animate={{ translateY: -8 }}
            transition={{
              type: 'timing',
              duration: 1500,
              loop: true,
              repeatReverse: true,
              easing: Easing.inOut(Easing.ease),
            }}
          >
            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.disabled} />
          </MotiView>
          <FadeInView delay={200}>
            <Text style={styles.emptyTitle}>Sin conversaciones</Text>
          </FadeInView>
          <FadeInView delay={300}>
            <Text style={styles.emptyText}>
              Los chats aparecen cuando un empleador acepta tu postulación.
            </Text>
          </FadeInView>
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
    textAlign: 'center',
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
