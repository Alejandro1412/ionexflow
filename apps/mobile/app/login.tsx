import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/approvals" />;

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        gap: 12,
        padding: 24,
        backgroundColor: "#05070F",
      }}
    >
      <Text style={{ color: "#E8F1FF", fontSize: 28, fontWeight: "700" }}>IonexFlow</Text>
      <Text style={{ color: "#9fb0c9", marginBottom: 12 }}>
        Companion login — same account as the web app
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Work email"
        placeholderTextColor="#6b7c94"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
          borderRadius: 10,
          color: "#E8F1FF",
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#6b7c94"
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
          borderRadius: 10,
          color: "#E8F1FF",
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      />
      {error ? <Text style={{ color: "#FF5C7A" }}>{error}</Text> : null}
      <Pressable
        onPress={onSubmit}
        disabled={busy}
        style={{
          backgroundColor: "#3DFFF2",
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#05070F" />
        ) : (
          <Text style={{ color: "#05070F", fontWeight: "700" }}>Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}
