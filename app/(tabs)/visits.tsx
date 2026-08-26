import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { VisitStatusBadge } from "@/components/medicare/visit-status-badge";
import { ScreenContainer } from "@/components/screen-container";
import { filterAndSearchVisits, filterLabel, type ClinicVisit, type VisitFilter } from "@/lib/medicare-domain";
import { useMediCare } from "@/lib/medicare-store";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp));
}

export default function VisitsScreen() {
  const router = useRouter();
  const { visits, session } = useMediCare();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VisitFilter>("ALL");
  const visibleVisits = useMemo(() => filterAndSearchVisits(visits, filter, query), [filter, query, visits]);

  const renderVisit = ({ item }: { item: ClinicVisit }) => {
    return (
      <View style={styles.visitCard}>
        <View style={styles.visitTop}>
          <View style={styles.visitIcon}><MaterialIcons name="medical-services" size={22} color="#0B776B" /></View>
          <View style={styles.visitCopy}><Text style={styles.visitService}>{item.serviceName}</Text><Text style={styles.visitClinic}>{item.clinicName} · {item.scheduledStart ? formatDate(item.scheduledStart) : formatDate(item.createdAt)}</Text></View>
          <VisitStatusBadge status={item.status} />
        </View>
        <View style={styles.divider} />
        <Pressable onPress={() => router.push(`/visit/${item.remoteId ?? item.id}`)} style={({ pressed }) => [styles.updateButton, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={18} color="#0B776B" /><Text style={styles.updateText}>عرض التفاصيل</Text></Pressable>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <FlatList
        data={visibleVisits}
        keyExtractor={(item) => item.id}
        renderItem={renderVisit}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, visibleVisits.length === 0 && styles.grow]}
        ListHeaderComponent={
          <>
            <View style={styles.header}><View><Text style={styles.title}>زياراتي</Text><Text style={styles.subtitle}>{session ? "حجوزاتك المحفوظة في حساب المريض." : "سجّل الدخول لمزامنة حجوزاتك مع الموقع."}</Text></View><Pressable onPress={() => router.push("/book")} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} accessibilityLabel="حجز زيارة"><MaterialIcons name="add" size={25} color="#FFFFFF" /></Pressable></View>
            <View style={styles.searchBox}><MaterialIcons name="search" size={20} color="#78938C" /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم العيادة أو الخدمة" placeholderTextColor="#8EA19C" style={styles.searchInput} textAlign="right" returnKeyType="search" /></View>
            <View style={styles.filters}>{(["ALL", "ACTIVE", "COMPLETED", "CANCELLED"] as VisitFilter[]).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={({ pressed }) => [styles.filter, filter === item && styles.filterActive, pressed && styles.pressed]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{filterLabel[item]}</Text></Pressable>)}</View>
          </>
        }
        ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name="calendar-month" size={33} color="#0B776B" /></View><Text style={styles.emptyTitle}>{query.trim() ? "لا توجد نتائج مطابقة" : "لا توجد زيارات بعد"}</Text><Text style={styles.emptyCopy}>{query.trim() ? "جرّب كتابة اسم مختلف للعيادة أو الخدمة." : "ابدأ بحجز زيارة جديدة لتتابع حالتها من هنا."}</Text><Pressable onPress={() => router.push("/book")} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}><Text style={styles.emptyButtonText}>حجز زيارة</Text></Pressable></View>}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 30 }, grow: { flexGrow: 1 },
  header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 20 },
  title: { color: "#183B36", fontSize: 28, fontWeight: "800", textAlign: "right" },
  subtitle: { color: "#6A827C", fontSize: 13, marginTop: 5, textAlign: "right" },
  addButton: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 15, height: 48, justifyContent: "center", width: 48 },
  searchBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DFECE8", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", height: 51, marginBottom: 13, paddingHorizontal: 14 },
  searchInput: { color: "#183B36", flex: 1, fontSize: 14, marginRight: 8 },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  filter: { backgroundColor: "#FFFFFF", borderColor: "#DCE9E5", borderRadius: 99, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { backgroundColor: "#0B776B", borderColor: "#0B776B" },
  filterText: { color: "#58766F", fontSize: 12, fontWeight: "700" }, filterTextActive: { color: "#FFFFFF" },
  visitCard: { backgroundColor: "#FFFFFF", borderColor: "#E1EEEA", borderRadius: 19, borderWidth: 1, padding: 15 },
  visitTop: { alignItems: "flex-start", flexDirection: "row-reverse" },
  visitIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  visitCopy: { flex: 1, marginHorizontal: 10 },
  visitService: { color: "#183B36", fontSize: 15, fontWeight: "800", lineHeight: 21, textAlign: "right" },
  visitClinic: { color: "#6A827C", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" },
  divider: { backgroundColor: "#E8F0ED", height: 1, marginVertical: 12 },
  updateButton: { alignItems: "center", alignSelf: "flex-end", flexDirection: "row", gap: 5, padding: 3 },
  updateText: { color: "#0B776B", fontSize: 13, fontWeight: "800" }, completeText: { color: "#6A827C", fontSize: 13, textAlign: "right" },
  separator: { height: 11 },
  empty: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 26, paddingTop: 60 },
  emptyIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 22, height: 70, justifyContent: "center", width: 70 },
  emptyTitle: { color: "#183B36", fontSize: 19, fontWeight: "800", marginTop: 17, textAlign: "center" },
  emptyCopy: { color: "#6A827C", fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "center" },
  emptyButton: { backgroundColor: "#0B776B", borderRadius: 13, marginTop: 20, paddingHorizontal: 17, paddingVertical: 12 }, emptyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
