import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useMediCare } from "@/lib/medicare-store";

export default function ReportsScreen() {
  const router = useRouter();
  const { visits } = useMediCare();
  const reports = visits.filter((visit) => visit.status === "COMPLETED" && visit.remoteId);
  return <ScreenContainer><FlatList data={reports} keyExtractor={(item) => item.id} contentContainerStyle={reports.length ? styles.content : styles.emptyContent} renderItem={({ item }) => <Pressable onPress={() => router.push(`/report/${item.remoteId}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.icon}><MaterialIcons name="description" size={22} color="#0B776B" /></View><View style={styles.copy}><Text style={styles.name}>{item.serviceName}</Text><Text style={styles.meta}>مرجع {item.reference ?? item.id} · تقرير نهائي</Text></View><MaterialIcons name="chevron-left" size={23} color="#0B776B" /></Pressable>} ListHeaderComponent={<View style={styles.header}><Text style={styles.title}>التقارير الطبية</Text><Text style={styles.subtitle}>تظهر التقارير النهائية لزياراتك المكتملة فقط.</Text></View>} ListEmptyComponent={<View style={styles.empty}><MaterialIcons name="lock-outline" size={31} color="#0B776B" /><Text style={styles.emptyTitle}>لا توجد تقارير متاحة</Text><Text style={styles.emptyText}>يتاح التقرير بعد اكتمال الزيارة وإقفاله من الفريق المخول.</Text></View>} /></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 10, padding: 20 }, emptyContent: { flexGrow: 1, padding: 20 }, header: { marginBottom: 20 }, title: { color: "#183B36", fontSize: 25, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#6A827C", fontSize: 13, lineHeight: 20, marginTop: 5, textAlign: "right" }, card: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E0ECE8", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", padding: 14 }, icon: { alignItems: "center", backgroundColor: "#EAF6F3", borderRadius: 12, height: 43, justifyContent: "center", width: 43 }, copy: { flex: 1, marginRight: 11 }, name: { color: "#183B36", fontSize: 14, fontWeight: "800", textAlign: "right" }, meta: { color: "#6A827C", fontSize: 11, marginTop: 4, textAlign: "right" }, empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E0ECE8", borderRadius: 22, borderWidth: 1, flex: 1, justifyContent: "center", padding: 28 }, emptyTitle: { color: "#183B36", fontSize: 18, fontWeight: "800", marginTop: 15 }, emptyText: { color: "#6A827C", fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: "center" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] } });
