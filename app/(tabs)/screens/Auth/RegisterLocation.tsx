import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import BigChoiceQuestion, { Option } from "../../../../components/BigChoiceQuestion";

const DEPTS: Option[] = [
  { key: "Caldas", label: "Caldas" },
  { key: "Antioquia", label: "Antioquia" },
  { key: "Risaralda", label: "Risaralda" },
  { key: "Quindio", label: "Quindío" },
  { key: "Tolima", label: "Tolima" },
];

const MUNICIPIOS: Record<string, Option[]> = {
  Caldas: [
    { key: "Manizales", label: "Manizales" },
    { key: "Chinchina", label: "Chinchiná" },
    { key: "Villamaria", label: "Villamaría" },
    { key: "Neira", label: "Neira" },
    { key: "Anserma", label: "Anserma" },
  ],
  Antioquia: [
    { key: "Medellin", label: "Medellín" },
    { key: "Rionegro", label: "Rionegro" },
    { key: "SantaFe", label: "Santa Fe de Antioquia" },
  ],
};

export default function RegisterLocation() {
  const router = useRouter();
  const p = useLocalSearchParams<any>();

  const [step, setStep] = useState<"dept" | "mun">("dept");
  const [dept, setDept] = useState<string[]>([]);
  const [mun, setMun] = useState<string[]>([]);

  const deptKey = dept[0];
  const municipios = useMemo(() => MUNICIPIOS[deptKey] ?? [], [deptKey]);

  function nextDept() {
    if (!deptKey) return Alert.alert("Selecciona un departamento");
    setStep("mun");
  }

  function nextMun() {
    const munKey = mun[0];
    if (!munKey) return Alert.alert("Selecciona un municipio");

    router.push({
      pathname: "/screens/Auth/RegisterSkills",
      params: {
        ...p,
        departamento: deptKey,
        municipio: munKey,
      },
    });
  }

  if (step === "dept") {
    return (
      <View style={{ flex: 1 }}>
        <BigChoiceQuestion
          title="¿En qué departamento estás?"
          options={DEPTS}
          value={dept}
          onChange={setDept}
          includeOther
          otherPlaceholder="Escribe tu departamento…"
        />

        <View style={styles.footer}>
          <Pressable style={styles.cta} onPress={nextDept}>
            <Text style={styles.ctaText}>Continuar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <BigChoiceQuestion
        title="¿En qué municipio estás?"
        options={municipios}
        value={mun}
        onChange={setMun}
        includeOther
        otherPlaceholder="Escribe tu municipio…"
      />

      <View style={styles.footerRow}>
        <Pressable style={styles.back} onPress={() => setStep("dept")}>
          <Text style={styles.backText}>Atrás</Text>
        </Pressable>
        <Pressable style={styles.cta} onPress={nextMun}>
          <Text style={styles.ctaText}>Continuar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const GREEN = "#4CAF50";
const BORDER = "#E6EAE6";

const styles = StyleSheet.create({
  footer: { padding: 16, backgroundColor: "#F7F9F7" },
  footerRow: { padding: 16, backgroundColor: "#F7F9F7", flexDirection: "row", gap: 10 },
  cta: { flex: 1, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  back: { width: 110, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  backText: { fontWeight: "900" },
});