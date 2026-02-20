import React, { useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export type Option = { key: string; label: string };

type Props = {
  title: string;
  options: Option[];
  multiple?: boolean;
  value: string[]; // siempre array
  onChange: (next: string[]) => void;
  includeOther?: boolean; // agrega botón "Otro"
  otherLabel?: string; // texto del botón
  otherPlaceholder?: string; // placeholder modal
};

export default function BigChoiceQuestion({
  title,
  options,
  multiple = false,
  value,
  onChange,
  includeOther = false,
  otherLabel = "Otro",
  otherPlaceholder = "Escribe tu opción…",
}: Props) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");

  const allOptions = useMemo(() => {
    const base = [...options];
    if (includeOther) base.push({ key: "__other__", label: otherLabel });
    return base;
  }, [options, includeOther, otherLabel]);

  function toggle(key: string) {
    if (key === "__other__") {
      setOtherOpen(true);
      return;
    }

    if (!multiple) {
      onChange([key]);
      return;
    }

    const exists = value.includes(key);
    onChange(exists ? value.filter((v) => v !== key) : [...value, key]);
  }

  function isSelected(key: string) {
    if (key === "__other__") return value.some((v) => v.startsWith("other:"));
    return value.includes(key);
  }

  function saveOther() {
    const clean = otherText.trim();
    if (!clean) {
      setOtherOpen(false);
      return;
    }
    const tag = `other:${clean}`;
    const withoutOldOther = value.filter((v) => !v.startsWith("other:"));
    const next = multiple ? [...withoutOldOther, tag] : [tag];
    onChange(next);
    setOtherText("");
    setOtherOpen(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <View style={{ gap: 12 }}>
        {allOptions.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => toggle(opt.key)}
            style={({ pressed }) => [
              styles.card,
              isSelected(opt.key) && styles.cardSelected,
              pressed && { opacity: 0.95 },
            ]}
          >
            <Text
              style={[
                styles.cardText,
                isSelected(opt.key) && styles.cardTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Modal visible={otherOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Escribe tu opción</Text>

            <TextInput
              value={otherText}
              onChangeText={setOtherText}
              placeholder={otherPlaceholder}
              style={styles.input}
              autoFocus
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setOtherOpen(false)}
                style={[styles.btn, styles.btnGhost]}
              >
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={saveOther}
                style={[styles.btn, styles.btnPrimary]}
              >
                <Text style={styles.btnPrimaryText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const GREEN = "#4CAF50";
const GREEN_DARK = "#2E7D32";
const BORDER = "#E6EAE6";
const BG = "#F7F9F7";
const TEXT = "#1F2A1F";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "900", color: TEXT, marginBottom: 18 },

  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  cardSelected: { borderColor: GREEN, backgroundColor: "#EAF7EC" },
  cardText: { fontSize: 18, fontWeight: "800", color: TEXT },
  cardTextSelected: { color: GREEN_DARK },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 18,
  },
  modal: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: TEXT },

  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },

  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnPrimary: { backgroundColor: GREEN },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  btnGhost: { backgroundColor: "#EEF3EE" },
  btnGhostText: { color: TEXT, fontWeight: "900", fontSize: 16 },
});
