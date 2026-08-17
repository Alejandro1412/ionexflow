import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#05070F" },
          headerTintColor: "#E8F1FF",
          contentStyle: { backgroundColor: "#05070F" },
        }}
      />
    </AuthProvider>
  );
}
