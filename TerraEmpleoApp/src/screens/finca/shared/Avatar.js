import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const AVATAR_COLORS = ['#C8A882', '#A8B8D0', '#B8C8A0', '#D0A8A8', '#A8C8C8', '#C8B8A0', '#B0A8C8', '#C0B0B8'];

function getInitials(name) {
  if (!name) return '?';
  const p = String(name).trim().split(' ').filter(Boolean);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[1][0]).toUpperCase();
}
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function Avatar({ src, name, size = 40 }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (src) {
    return <Image source={{ uri: src }} style={[styles.img, dim]} />;
  }
  return (
    <View style={[styles.fallback, dim, { backgroundColor: getAvatarColor(name) }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: '#eee' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '800' },
});
