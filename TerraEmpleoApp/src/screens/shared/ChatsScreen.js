import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  Image, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { chatsAPI } from '../../services/api';
import { SPACING, RADIUS } from '../../theme';
import { MotiView } from 'moti';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { AnimatedPressable, ShimmerPlaceholder, FadeInView, StaggeredItem } from '../../components/animated';
import DecorativeBackground from '../../components/ui/DecorativeBackground';

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
function ChatSkeleton({ colors }) {
  return (
    <View style={[styles.chatItem, { backgroundColor: colors.surface }]}>
      <ShimmerPlaceholder width={52} height={52} borderRadius={26} />
      <View style={styles.chatContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <ShimmerPlaceholder width={130} height={14} borderRadius={4} />
          <ShimmerPlaceholder width={36} height={12} borderRadius={4} />
        </View>
        <ShimmerPlaceholder width={100} height={11} borderRadius={4} style={{ marginBottom: 5 }} />
        <ShimmerPlaceholder width={200} height={12} borderRadius={4} />
      </View>
    </View>
  );
}

/* ── Pulsing badge for unread count ── */
function PulsingBadge({ count, colors }) {
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
    <Animated.View style={[styles.badge, { backgroundColor: colors.primary }, animStyle]}>
      <Text style={styles.badgeText}>
        {count > 9 ? '9+' : count}
      </Text>
    </Animated.View>
  );
}

export default function ChatsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarChats = useCallback(async () => {
    // 1) Pintar desde cache local SQLite primero
    try {
      const { chatsRepo } = require('../../db/repos');
      const cacheLocal = await chatsRepo.listar();
      if (cacheLocal?.length) setChats(cacheLocal);
    } catch (_) {}

    // 2) Sync con servidor
    try {
      const res = await chatsAPI.misChats();
      const lista = res.data.chats || [];
      setChats(lista);
      try {
        const { chatsRepo } = require('../../db/repos');
        await chatsRepo.upsertMany(lista);
      } catch (_) {}
    } catch (err) {
      console.warn('cargarChats (offline?):', err?.message);
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
    const tieneFoto = Boolean(item.otro_foto && item.otro_foto.startsWith('http'));
    const iniciales = item.otro_nombre
      ? item.otro_nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
      : '?';
    const tieneNoLeidos = item.no_leidos > 0;

    return (
      <StaggeredItem index={index}>
        <AnimatedPressable
          style={[styles.chatItem, { backgroundColor: colors.surface }]}
          onPress={() => abrirChat(item)}
          scaleValue={0.98}
          haptic={false}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={[
              styles.avatarPlaceholder,
              { backgroundColor: isDark ? colors.primary + '28' : colors.primary + '18' },
            ]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{iniciales}</Text>
            </View>
            {tieneFoto && (
              <Image source={{ uri: item.otro_foto }} style={styles.avatar} />
            )}
            {tieneNoLeidos && (
              <PulsingBadge count={item.no_leidos} colors={colors} />
            )}
          </View>

          {/* Content */}
          <View style={styles.chatContent}>
            {/* Name + time row */}
            <View style={styles.chatHeader}>
              <Text
                style={[
                  styles.nombreUsuario,
                  { color: tieneNoLeidos ? colors.textPrimary : colors.textSecondary },
                  tieneNoLeidos && styles.nombreUnread,
                ]}
                numberOfLines={1}
              >
                {item.otro_nombre}
              </Text>
              <Text style={[styles.hora, { color: colors.textMuted }]}>
                {formatHora(item.ultimo_mensaje_at)}
              </Text>
            </View>

            {/* Vacancy label */}
            <Text style={[styles.vacanteTitulo, { color: colors.primary }]} numberOfLines={1}>
              {item.vacante_titulo}
            </Text>

            {/* Last message */}
            <Text
              style={[
                styles.ultimoMensaje,
                { color: tieneNoLeidos ? colors.textPrimary : colors.textMuted },
                tieneNoLeidos && styles.ultimoMensajeNoLeido,
              ]}
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <DecorativeBackground />
        <FadeInView delay={0}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{ gap: 0 }}>
              <ChatSkeleton colors={colors} />
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            </View>
          ))}
        </FadeInView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <DecorativeBackground />
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
            <View style={[styles.emptyIconWrap, { backgroundColor: '#EAF3DE' }]}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
            </View>
          </MotiView>
          <FadeInView delay={200}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {user?.rol === 'empleador' ? 'Aún no tienes más conversaciones' : 'Sin conversaciones'}
            </Text>
          </FadeInView>
          <FadeInView delay={300}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {user?.rol === 'empleador'
                ? 'Los chats aparecen cuando contactas a un trabajador o él acepta tu oferta.'
                : 'Los chats aparecen cuando un empleador acepta tu postulación.'}
            </Text>
          </FadeInView>
          {user?.rol === 'empleador' && (
            <FadeInView delay={380}>
              <AnimatedPressable
                style={[styles.emptyCta, { borderColor: colors.primary }]}
                onPress={() => navigation.navigate('Trabajadores', { screen: 'BuscarTrabajadoresHome' })}
                scaleValue={0.97}
              >
                <Ionicons name="search-outline" size={16} color={colors.primary} />
                <Text style={[styles.emptyCtaText, { color: colors.primary }]}>  Explorar trabajadores</Text>
              </AnimatedPressable>
            </FadeInView>
          )}
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderChat}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 80 }]} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  listContent: { paddingBottom: SPACING.xl * 2 },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Chat item */
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  separator: { height: 1 },

  /* Avatar */
  avatarContainer: { position: 'relative', marginRight: SPACING.md },
  avatar: {
    position: 'absolute',
    top: 0, left: 0,
    width: 52, height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52, height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },

  /* Unread badge */
  badge: {
    position: 'absolute',
    top: -2, right: -2,
    borderRadius: 10,
    minWidth: 20, height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  /* Content */
  chatContent: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nombreUsuario: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: SPACING.sm,
  },
  nombreUnread: { fontWeight: '700' },
  hora: { fontSize: 11, fontWeight: '500' },
  vacanteTitulo: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  ultimoMensaje: { fontSize: 13, fontWeight: '500' },
  ultimoMensajeNoLeido: { fontWeight: '600' },
});
