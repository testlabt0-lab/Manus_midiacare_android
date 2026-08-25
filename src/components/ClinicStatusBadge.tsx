import { Text, View } from "react-native";
import { type VisitStatus, visitStatusLabel } from "../domain/clinic";

const colors: Record<VisitStatus, { background: string; text: string }> = {
  REQUESTED: { background: "#E8F2FF", text: "#1D5F9E" },
  ASSIGNED: { background: "#FFF4DF", text: "#A35A00" },
  CONFIRMED: { background: "#E6F7ED", text: "#257242" },
  EN_ROUTE: { background: "#E6F5F2", text: "#0B776B" },
  ARRIVED: { background: "#E9F3F6", text: "#26627B" },
  IN_PROGRESS: { background: "#EFE9FF", text: "#6541A5" },
  COMPLETED: { background: "#E6F7ED", text: "#257242" },
  CANCELLED: { background: "#FBEAEA", text: "#A33A35" },
};

export function ClinicStatusBadge({ status }: { status: VisitStatus }) {
  const tone = colors[status];

  return (
    <View style={{ backgroundColor: tone.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color: tone.text, fontSize: 12, fontWeight: "700", textAlign: "right" }}>{visitStatusLabel[status]}</Text>
    </View>
  );
}
