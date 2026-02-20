import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function RoleSelection() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¿Cuál te describe mejor?</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: "/screens/Auth/RegisterBasicInfo",
            params: { role: "Trabajador" },
          })
        }
      >
        <Text style={styles.buttonText}>Trabajador agrícola</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#2E7D32" }]}
        onPress={() =>
          router.push({
            pathname: "/screens/Auth/RegisterBasicInfo",
            params: { role: "Empleador" },
          })
        }
      >
        <Text style={styles.buttonText}>Empleador agrícola</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 24, marginBottom: 30 },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: "80%",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    fontWeight: "700",
  },
});
