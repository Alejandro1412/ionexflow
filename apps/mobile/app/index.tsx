import { View, Text } from "react-native";

// Placeholder screen. Phase 5 replaces this with:
//   - a Supabase-authenticated login screen sharing the web app's session
//   - a Realtime "Approval Inbox" list (public.approvals, status = pending)
//   - Approve/Reject actions that update workflow_executions
export default function CompanionHome() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-white px-6">
      <Text className="text-xl font-semibold">IonexFlow Companion</Text>
      <Text className="text-center text-gray-500">
        Monorepo + auth scaffolding (Phase 1). Login and the Realtime
        approval inbox ship in Phase 5.
      </Text>
    </View>
  );
}
