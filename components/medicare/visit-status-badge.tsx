import { StyleSheet, Text, View } from "react-native";

import { visitStatusLabel, type VisitStatus } from "@/lib/medicare-domain";

const toneByStatus: Record<VisitStatus, { background: string; color: string }> = {
  REQUESTED: { background: "#EAF4F2", color: "#0B776B" },
  ASSIGNED: { background: "#FFF3DB", color: "#9A5B12" },
  EN_ROUTE: { background: "#E8F0FF", color: "#3A69B8" },
  IN_PROGRESS: { background: "#EEE9FF", color: "#6950AA" },
  COMPLETED: { background: "#E6F7ED", color: "#267A49" },
  CANCELLED: { background: "#FDEAEA", color: "#AE403A" },
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const tone = toneByStatus[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.label, { color: tone.color }]}>{visitStatusLabel[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  label: { fontSize: 12, fontWeight: "700", textAlign: "right" },
});
