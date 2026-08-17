import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth-context";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#05070F" }}>
        <ActivityIndicator color="#3DFFF2" />
      </View>
    );
  }

  if (session) return <Redirect href="/approvals" />;
  return <Redirect href="/login" />;
}
