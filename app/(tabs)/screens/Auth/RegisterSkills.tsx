import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import BigChoiceQuestion from "../../../../components/BigChoiceQuestion";

export default function RegisterSkills() {
  const router = useRouter();
  const p = useLocalSearchParams<any>();
  const [skills, setSkills] = useState<string[]>([]);

  const options = [
    { key: "recoleccion", label: "Recolección" },
    { key: "siembra", label: "Siembra" },
    { key: "abonado", label: "Abonado / fertilización" },
    { key: "fumigacion", label: "Fumigación" },
    { key: "poda", label: "Poda" },
    { key: "guadana", label: "Manejo de guadaña" },
    { key: "cafe", label: "Cosecha café" },
    { key: "seleccion", label: "Clasificación/selección" },
    { key: "carga", label: "Carga y descargue" },
  ];

  function next() {
    if (skills.length === 0)
      return Alert.alert("Selecciona al menos una habilidad");

    router.push({
      pathname: "/screens/Auth/RegisterFinish",
      params: { ...p, skills: JSON.stringify(skills) },
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <BigChoiceQuestion
        title="¿Qué labores sabes hacer?"
        options={options}
        multiple
        value={skills}
        onChange={setSkills}
        includeOther
        otherPlaceholder="Ej: ordeño, riego, vivero…"
      />

      <View style={styles.footer}>
        <Pressable style={styles.cta} onPress={next}>
          <Text style={styles.ctaText}>Finalizar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const GREEN = "#4CAF50";
const styles = StyleSheet.create({
  footer: { padding: 16, backgroundColor: "#F7F9F7" },
  cta: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 18, fontWeight: "900" },
});
