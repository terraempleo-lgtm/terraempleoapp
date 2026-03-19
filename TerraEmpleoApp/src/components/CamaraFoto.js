import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Alert, Image, ActivityIndicator, Platform, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../theme';

const useNative = Platform.OS !== 'web';

export default function CamaraFoto({ tipo, onFotoGuardada, label, modoLocal = false, permitirGaleria = false }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [modalVisible, setModalVisible] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const cameraRef = useRef(null);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const facing = (tipo === 'selfie' || tipo === 'selfie_cedula') ? 'front' : 'back';

  const playSuccessAnimation = (callback) => {
    setShowSuccess(true);
    successScale.setValue(0);
    successOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: useNative,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: useNative,
        }),
      ]),
      Animated.delay(1200),
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: useNative,
      }),
    ]).start(() => {
      setShowSuccess(false);
      if (callback) callback();
    });
  };

  const abrirCamara = async () => {
    if (Platform.OS === 'web') {
      abrirGaleria();
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara para verificar tu identidad.');
        return;
      }
    }
    setPreview(null);
    setModalVisible(true);
  };

  const abrirGaleria = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPreview(result.assets[0].uri);
        setModalVisible(true);
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la galeria. Intenta de nuevo.');
    }
  };

  const abrirSelector = () => {
    if (Platform.OS === 'web') {
      abrirGaleria();
      return;
    }

    if (!permitirGaleria) {
      abrirCamara();
      return;
    }

    Alert.alert('Cargar foto', 'Elige como deseas continuar', [
      { text: 'Tomar foto', onPress: abrirCamara },
      { text: 'Subir desde galeria', onPress: abrirGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const tomarFoto = async () => {
    if (!cameraRef.current) return;
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setPreview(foto.uri);
    } catch (err) {
      Alert.alert('Error', 'No se pudo tomar la foto. Intenta de nuevo.');
    }
  };

  const confirmarFoto = async () => {
    if (!preview) return;
    if (modoLocal) {
      const savedPreview = preview;
      playSuccessAnimation(() => {
        setModalVisible(false);
        onFotoGuardada(tipo, savedPreview);
      });
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(preview);
        const blob = await response.blob();
        formData.append('foto', blob, `${tipo}_${Date.now()}.jpg`);
      } else {
        formData.append('foto', {
          uri: preview,
          type: 'image/jpeg',
          name: `${tipo}_${Date.now()}.jpg`,
        });
      }
      await authAPI.subirFoto(tipo, formData);
      const savedPreview = preview;
      playSuccessAnimation(() => {
        setModalVisible(false);
        onFotoGuardada(tipo, savedPreview);
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo guardar la foto. Verifica tu conexión.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={abrirSelector}>
        <Ionicons name={Platform.OS === 'web' ? 'cloud-upload-outline' : 'camera'} size={28} color={COLORS.primary} />
        <Text style={styles.btnText}>{label}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{label}</Text>
            <View style={{ width: 28 }} />
          </View>

          {!preview ? (
            <View style={{ flex: 1 }}>
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
              <View style={[styles.overlay, StyleSheet.absoluteFillObject]}>
                <View style={styles.guideBox} />
                <Text style={styles.guideText}>
                  {tipo === 'selfie' ? 'Centra tu cara' : tipo === 'cedula' ? 'Coloca tu cédula' : 'Cara y cédula juntas'}
                </Text>
              </View>
              <View style={styles.captureBar}>
                <TouchableOpacity style={styles.captureBtn} onPress={tomarFoto}>
                  <View style={styles.captureBtnInner} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Image source={{ uri: preview }} style={{ flex: 1 }} resizeMode="contain" />
              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.btnRepetir} onPress={() => setPreview(null)}>
                  <Ionicons name="refresh" size={20} color={COLORS.white} />
                  <Text style={styles.btnRepetirText}>Repetir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnConfirmar, loading && { opacity: 0.6 }]}
                  onPress={confirmarFoto} disabled={loading}>
                  {loading ? <ActivityIndicator color={COLORS.white} /> : (
                    <>
                      <Ionicons name="checkmark" size={20} color={COLORS.white} />
                      <Text style={styles.btnConfirmarText}>Usar esta foto</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          {showSuccess && (
            <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]}>
              <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }] }]}>
                <Ionicons name="checkmark-circle" size={80} color="#fff" />
                <Text style={styles.successText}>Foto guardada</Text>
              </Animated.View>
            </Animated.View>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 2, borderColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, marginVertical: 8, backgroundColor: COLORS.white,
  },
  btnText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guideBox: {
    width: 260, height: 180, borderWidth: 2,
    borderColor: '#fff', borderRadius: 12, backgroundColor: 'transparent',
  },
  guideText: {
    color: '#fff', marginTop: 12, fontSize: 14, textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16,
    paddingVertical: 6, borderRadius: 8,
  },
  captureBar: { paddingVertical: 32, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  previewActions: {
    flexDirection: 'row', padding: 20, gap: 12, backgroundColor: 'rgba(0,0,0,0.8)',
  },
  btnRepetir: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: '#fff',
  },
  btnRepetirText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnConfirmar: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#008d49',
  },
  btnConfirmarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 141, 73, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  successCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.5,
  },
});
