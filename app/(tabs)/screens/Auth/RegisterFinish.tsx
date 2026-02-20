import { insertUser } from "@/src/services/db"; // ajusta según tu alias/ruta real
import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";

export default function RegisterFinish() {
  const params = useLocalSearchParams();

  const role = String(params.role ?? "Trabajador");
  const nombre = String(params.nombre ?? "");
  const cedula = String(params.cedula ?? "");
  const celular = String(params.celular ?? "");
  const ubicacion = String(params.ubicacion ?? ""); // ejemplo: "Caldas - Manizales"

  // si skills te llega como string, parsea seguro:
  const skills =
    typeof params.skills === "string" ? safeParseSkills(params.skills) : [];

  const onFinish = async () => {
    try {
      await insertUser(nombre, ubicacion, cedula, celular, role, skills);

      // ✅ Rutas según tu estructura actual:
      if (role === "Trabajador") {
        router.replace("/screens/Worker/WorkerHome");
      } else {
        router.replace("/screens/Employer/EmployerHome");
      }
    } catch (e: any) {
      console.error("Finish error:", e);
      Alert.alert("Error", "No se pudo finalizar el registro.");
    }
  };

  return <View>{/* tu UI + botón que llame onFinish() */}</View>;
}

function safeParseSkills(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // si viene tipo "siembra,poda"
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
