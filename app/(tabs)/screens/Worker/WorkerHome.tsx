import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getVacancies } from "../../../../src/services/db";

type Vacancy = {
  id: number;
  title: string;
  description?: string;
  pay?: string;
  location?: string;
  createdAt?: number;
};

type RootStackParamList = {
  WorkerHome: undefined;
  VacancyDetail: { vacancy: Vacancy };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "WorkerHome">;
};

export function WorkerHome({ navigation }: Props) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);

  async function load() {
    const rows = await getVacancies();
    setVacancies(rows as any);
  }

  useEffect(() => {
    load();
  }, []);

  function renderVacancy({ item }: { item: Vacancy }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("VacancyDetail", { vacancy: item })}
      >
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.location ? `${item.location} • ` : ""}
          {item.pay ?? ""}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Vacantes disponibles</Text>
        <TouchableOpacity onPress={load}>
          <Text style={styles.refresh}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vacancies}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderVacancy}
        contentContainerStyle={vacancies.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.empty}>No hay vacantes disponibles.</Text>}
      />
    </SafeAreaView>
  );
}

const GREEN = "#4CAF50";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F9F7", padding: 16 },
  headerRow: { marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  header: { fontSize: 20, fontWeight: "800" },
  refresh: { color: GREEN, fontWeight: "800" },

  card: { backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E6EAE6" },
  title: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, color: "#666", marginTop: 6 },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#666", marginTop: 40 },
});