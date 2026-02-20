// Pantalla de registro: inputs de nombre, ubicación, cédula, celular y botón guardar en SQLite

import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { insertUser } from "../../../../src/services/db";
// insertUser is defined at the bottom of this file

type RootStackParamList = {
  Register: { role: "Trabajador" | "Empleador" } | undefined;
  WorkerHome: undefined;
  EmployerHome: undefined;
};

type Props = {
  route: RouteProp<RootStackParamList, "Register">;
  navigation: NativeStackNavigationProp<RootStackParamList, "Register">;
};

export default function Register({ route, navigation }: Props) {
  const role = route?.params?.role ?? "Trabajador";
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [cedula, setCedula] = useState("");
  const [celular, setCelular] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (
      !nombre.trim() ||
      !ubicacion.trim() ||
      !cedula.trim() ||
      !celular.trim()
    ) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      // insertUser debería ser una función async en services/db
      await insertUser(
        nombre.trim(),
        ubicacion.trim(),
        cedula.trim(),
        celular.trim(),
        role,
      );
      Alert.alert("Registro exitoso", `Bienvenido ${role}: ${nombre.trim()}`);

      if (role === "Trabajador") {
        navigation.replace("WorkerHome");
      } else {
        navigation.replace("EmployerHome");
      }
    } catch (err) {
      console.error("Insert user error:", err);
      Alert.alert(
        "Error",
        "No se pudo completar el registro. Intenta nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registro de {role}</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre"
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        placeholder="Ubicación"
        value={ubicacion}
        onChangeText={setUbicacion}
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

      <TouchableOpacity
        style={[styles.button, loading ? { opacity: 0.7 } : null]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Registrar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 18, textAlign: "center" },
});

// Add your existing db exports here
