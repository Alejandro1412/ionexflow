import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type ApprovalRow = {
  id: string;
  status: string;
  node_id: string;
  execution_id: string;
  created_at: string;
  payload: { label?: string; message?: string } | null;
};

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3000";

export default function ApprovalsScreen() {
  const { session, signOut } = useAuth();
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("approvals")
      .select("id, status, node_id, execution_id, created_at, payload")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setItems((data as ApprovalRow[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    load();
    const channel = supabase
      .channel("approvals-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approvals" },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, load]);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    const token = session?.access_token;
    if (!token) {
      setError("Missing session token");
      setBusyId(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/approvals/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ approvalId: id, decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: "#05070F" }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Approvals",
          headerRight: () => (
            <Pressable onPress={() => signOut()} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: "#3DFFF2" }}>Sign out</Text>
            </Pressable>
          ),
        }}
      />

      {error ? (
        <Text style={{ color: "#FF5C7A", paddingHorizontal: 16, paddingTop: 8 }}>{error}</Text>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#3DFFF2" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#3DFFF2"
            />
          }
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={
            <Text style={{ color: "#9fb0c9", textAlign: "center", marginTop: 48 }}>
              No pending approvals. Run a workflow with an Approval node from the web app.
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                backgroundColor: "rgba(11,18,32,0.9)",
                padding: 16,
                gap: 10,
              }}
            >
              <Text style={{ color: "#E8F1FF", fontSize: 16, fontWeight: "600" }}>
                {item.payload?.label ?? item.node_id}
              </Text>
              <Text style={{ color: "#9fb0c9" }}>
                {item.payload?.message ?? "Approval required"}
              </Text>
              <Text style={{ color: "#6b7c94", fontSize: 12 }}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <Pressable
                  onPress={() => decide(item.id, "approved")}
                  disabled={busyId === item.id}
                  style={{
                    flex: 1,
                    backgroundColor: "#3DFFF2",
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: busyId === item.id ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: "#05070F", fontWeight: "700" }}>Approve</Text>
                </Pressable>
                <Pressable
                  onPress={() => decide(item.id, "rejected")}
                  disabled={busyId === item.id}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#E8F1FF", fontWeight: "600" }}>Reject</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
