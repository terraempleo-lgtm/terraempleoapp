import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, SafeAreaView, Alert, Image, ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../theme';

export default function CamaraFoto({ tipo, onFotoGuardada, label }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [modalVisible, setModalVisible] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  const facing = tipo === 'selfie' ? 'front' : 'back';

  const abrirCamara = async () => {
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
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('foto', {
        uri: preview,
        type: 'image/jpeg',
        name: `${tipo}_${Date.now()}.jpg`,
      });
      await authAPI.subirFoto(tipo, formData);
      setModalVisible(false);
      onFotoGuardada(tipo);
      Alert.alert('Foto guardada', `${label} guardada correctamente.`);
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar la foto. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={abrirCamara}>
        <Ionicons name="camera" size={28} color={COLORS.primary} />
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
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing}>
                <View style={styles.overlay}>
                  <View style={styles.guideBox} />
                  <Text style={styles.guideText}>
                    {tipo === 'selfie' ? 'Centra tu cara' : tipo === 'cedula' ? 'Coloca tu cédula' : 'Cara y cédula juntas'}
                  </Text>
                </View>
              </CameraView>
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
    gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2E7D32',
  },
  btnConfirmarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
