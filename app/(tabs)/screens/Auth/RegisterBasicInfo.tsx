import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function RegisterBasicInfo() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (params.role ?? "Trabajador") as "Trabajador" | "Empleador";

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [celular, setCelular] = useState("");

  function next() {
    if (!nombre.trim() || !cedula.trim() || !celular.trim()) {
      Alert.alert("Falta información", "Completa Nombre, Cédula y Celular.");
      return;
    }

    router.push({
      pathname: "/screens/Auth/RegisterLocation",
      params: {
        role,
        nombre: nombre.trim(),
        cedula: cedula.trim(),
        celular: celular.trim(),
      },
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registro ({role})</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre"
        value={nombre}
        onChangeText={setNombre}
      />
      <TextInput
        style={styles.input}
        placeholder="Cédula"
        value={cedula}
        onChangeText={setCedula}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Celular"
        value={celular}
        onChangeText={setCelular}
        keyboardType="phone-pad"
      />

      <Pressable style={styles.cta} onPress={next}>
        <Text style={styles.ctaText}>Continuar</Text>
      </Pressable>
    </View>
  );
}

const GREEN = "#4CAF50";
const BG = "#F7F9F7";
const BORDER = "#E6EAE6";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "900", marginBottom: 16 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cta: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  ctaText: { color: "#fff", fontSize: 18, fontWeight: "900" },
});
