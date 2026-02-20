import { Tabs } from "expo-router";
import React from "react";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="explore" options={{ title: "Explorar" }} />
      <Tabs.Screen name="worker" options={{ title: "Trabajador" }} />
      <Tabs.Screen name="employer" options={{ title: "Empleador" }} />
    </Tabs>
  );
}
