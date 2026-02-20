import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { getVacancies, insertVacancy } from "../../../../src/services/db";

type Vacancy = {
  id: number;
  title: string;
  description: string;
  pay: string;
  location: string;
  createdAt: number;
};

export default function EmployerHome() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pay, setPay] = useState("");
  const [location, setLocation] = useState("");

  async function loadVacancies() {
    const rows = await getVacancies();
    setVacancies(rows as any);
  }

  useEffect(() => {
    loadVacancies();
  }, []);

  function resetForm() {
    setTitle("");
    setDescription("");
    setPay("");
    setLocation("");
  }

  async function createVacancy() {
    if (!title.trim() || !location.trim()) {
      Alert.alert("Falta información", "Escribe por lo menos Título y Ubicación.");
      return;
    }

    await insertVacancy({
      title,
      description,
      pay,
      location,
    });

    resetForm();
    setModalVisible(false);
    loadVacancies();
  }

  function renderVacancy({ item }: { item: Vacancy }) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.location ? item.location + " • " : ""}
          {item.pay ? item.pay + " • " : ""}
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        {!!item.description && <Text style={styles.description}>{item.description}</Text>}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Vacantes creadas</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>Crear nueva vacante</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vacancies}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderVacancy}
        ListEmptyComponent={<Text style={styles.empty}>Aún no hay vacantes.</Text>}
        contentContainerStyle={vacancies.length === 0 ? styles.emptyContainer : undefined}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        transparent={Platform.OS === "ios"}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nueva vacante</Text>

            <TextInput style={styles.input} placeholder="Título" value={title} onChangeText={setTitle} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descripción"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <TextInput style={styles.input} placeholder="Pago (ej. $10/día)" value={pay} onChangeText={setPay} />
            <TextInput style={styles.input} placeholder="Ubicación" value={location} onChangeText={setLocation} />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => {
                  resetForm();
                  setModalVisible(false);
                }}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={createVacancy}>
                <Text style={[styles.btnText, { color: "#fff" }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const GREEN = "#4CAF50";
const GREEN_DARK = "#2E7D32";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F9F7", padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  header: { fontSize: 20, fontWeight: "800" },

  createButton: { backgroundColor: GREEN_DARK, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  createButtonText: { color: "#fff", fontWeight: "800" },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#666", marginTop: 40 },

  card: { backgroundColor: "#fff", padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E6EAE6" },
  title: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, color: "#666", marginTop: 4 },
  description: { marginTop: 8, color: "#333" },

  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  modal: { width: "92%", backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },

  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: "#fff" },
  textArea: { height: 90, textAlignVertical: "top" },

  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginLeft: 8 },
  btnCancel: { backgroundColor: "#eee" },
  btnSave: { backgroundColor: GREEN },
  btnText: { color: "#333", fontWeight: "800" },
});