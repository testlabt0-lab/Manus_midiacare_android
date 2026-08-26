import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { VisitComposer } from "@/components/medicare/visit-composer";
import { ScreenContainer } from "@/components/screen-container";
import { getVisitSummary } from "@/lib/medicare-domain";
import { useMediCare } from "@/lib/medicare-store";

function Metric({ label, value, icon, tint }: { label: string; value: number; icon: keyof typeof MaterialIcons.glyphMap; tint: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}><MaterialIcons name={icon} size={20} color="#0B776B" /></View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { visits, unreadCount, ready } = useMediCare();
  const [composerOpen, setComposerOpen] = useState(false);
  const summary = useMemo(() => getVisitSummary(visits), [visits]);
  const latestVisit = visits[0];

  if (!ready) {
    return <ScreenContainer><View style={styles.loading}><ActivityIndicator size="large" color="#0B776B" /><Text style={styles.loadingText}>يتم تجهيز بياناتك المحلية…</Text></View></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={(_, index) => `dashboard-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <View style={styles.brandMark}><MaterialIcons name="health-and-safety" size={23} color="#FFFFFF" /></View>
              <View style={styles.topCopy}><Text style={styles.eyebrow}>MEDICARE PRO MOBILE</Text><Text style={styles.greeting}>صباح العافية</Text></View>
              <View style={styles.localPill}><View style={styles.localDot} /><Text style={styles.localText}>محلي</Text></View>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroPattern}><MaterialIcons name="monitor-heart" size={96} color="rgba(255,255,255,0.12)" /></View>
              <Text style={styles.heroKicker}>متابعة الزيارات المنزلية</Text>
              <Text style={styles.heroTitle}>كل ما تحتاجه لرعاية أكثر تنظيماً.</Text>
              <Text style={styles.heroCopy}>تُحفظ السجلات والتنبيهات على جهازك لتتابعها بسهولة وفي أي وقت.</Text>
              <Pressable onPress={() => setComposerOpen(true)} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
                <MaterialIcons name="add" size={21} color="#0B776B" />
                <Text style={styles.heroButtonText}>إضافة زيارة</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>ملخص الزيارات</Text><Text style={styles.sectionHint}>يُحدّث تلقائياً</Text></View>
            <View style={styles.metrics}>
              <Metric label="كل الزيارات" value={summary.total} icon="calendar-month" tint="#E4F5F1" />
              <Metric label="نشطة" value={summary.active} icon="pending-actions" tint="#FFF2DD" />
              <Metric label="قيد التنفيذ" value={summary.inProgress} icon="monitor-heart" tint="#EEE9FF" />
              <Metric label="مكتملة" value={summary.completed} icon="task-alt" tint="#E6F7ED" />
            </View>

            <Text style={styles.sectionTitle}>نظرة سريعة</Text>
            <View style={styles.upcomingCard}>
              <View style={styles.upcomingIcon}><MaterialIcons name={latestVisit ? "event-available" : "event-busy"} size={22} color="#0B776B" /></View>
              <View style={styles.upcomingCopy}>
                <Text style={styles.upcomingLabel}>{latestVisit ? "آخر زيارة تم تسجيلها" : "لا توجد زيارات مسجلة"}</Text>
                <Text style={styles.upcomingTitle}>{latestVisit ? `${latestVisit.serviceName} — ${latestVisit.clinicName}` : "أضف زيارة لتبدأ متابعة حالتها هنا."}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable onPress={() => setComposerOpen(true)} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
                <View style={styles.actionIcon}><MaterialIcons name="add-circle-outline" size={24} color="#0B776B" /></View>
                <Text style={styles.actionTitle}>زيارة جديدة</Text>
                <Text style={styles.actionCopy}>أنشئ سجلاً محلياً لموعدك أو خدمتك الصحية.</Text>
              </Pressable>
              <View style={styles.actionCard}>
                <View style={[styles.actionIcon, { backgroundColor: "#FBEFEB" }]}><MaterialIcons name="notifications-none" size={24} color="#B6403A" /></View>
                <Text style={styles.actionTitle}>التنبيهات</Text>
                <Text style={styles.actionCopy}>{unreadCount ? `لديك ${unreadCount} تنبيه غير مقروء.` : "أنت على اطلاع، لا توجد تنبيهات جديدة."}</Text>
              </View>
            </View>
          </>
        }
      />
      <VisitComposer visible={composerOpen} onClose={() => setComposerOpen(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 34 },
  loading: { alignItems: "center", flex: 1, justifyContent: "center", gap: 14 },
  loadingText: { color: "#6A827C", fontSize: 14 },
  topRow: { alignItems: "center", flexDirection: "row-reverse", marginBottom: 22 },
  brandMark: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 16, height: 48, justifyContent: "center", width: 48 },
  topCopy: { flex: 1, marginRight: 11 },
  eyebrow: { color: "#6A827C", fontSize: 10, fontWeight: "800", letterSpacing: 1, textAlign: "right" },
  greeting: { color: "#183B36", fontSize: 22, fontWeight: "800", marginTop: 3, textAlign: "right" },
  localPill: { alignItems: "center", backgroundColor: "#E7F5EF", borderRadius: 99, flexDirection: "row-reverse", gap: 5, paddingHorizontal: 9, paddingVertical: 7 },
  localDot: { backgroundColor: "#31945B", borderRadius: 5, height: 7, width: 7 },
  localText: { color: "#267A49", fontSize: 11, fontWeight: "800" },
  hero: { backgroundColor: "#0B776B", borderRadius: 26, marginBottom: 26, overflow: "hidden", padding: 23 },
  heroPattern: { position: "absolute", left: -5, top: -20 },
  heroKicker: { color: "#BFE9DE", fontSize: 12, fontWeight: "800", marginBottom: 8, textAlign: "right" },
  heroTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "800", lineHeight: 34, maxWidth: "88%", textAlign: "right" },
  heroCopy: { color: "#D7F0EA", fontSize: 13, lineHeight: 20, marginTop: 9, textAlign: "right" },
  heroButton: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#FFFFFF", borderRadius: 14, flexDirection: "row-reverse", gap: 6, marginTop: 20, paddingHorizontal: 15, paddingVertical: 12 },
  heroButtonText: { color: "#0B776B", fontSize: 14, fontWeight: "800" },
  sectionHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: "#183B36", fontSize: 17, fontWeight: "800", marginBottom: 12, textAlign: "right" },
  sectionHint: { color: "#6A827C", fontSize: 11, marginBottom: 12 },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginBottom: 25 },
  metricCard: { backgroundColor: "#FFFFFF", borderColor: "#E3EFEB", borderRadius: 18, borderWidth: 1, flexBasis: "47%", flexGrow: 1, padding: 14 },
  metricIcon: { alignItems: "center", alignSelf: "flex-end", borderRadius: 11, height: 35, justifyContent: "center", width: 35 },
  metricValue: { color: "#183B36", fontSize: 26, fontWeight: "800", marginTop: 14, textAlign: "right" },
  metricLabel: { color: "#6A827C", fontSize: 12, marginTop: 2, textAlign: "right" },
  upcomingCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E3EFEB", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", marginBottom: 16, padding: 15 },
  upcomingIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 13, height: 43, justifyContent: "center", width: 43 },
  upcomingCopy: { flex: 1, marginRight: 12 },
  upcomingLabel: { color: "#6A827C", fontSize: 12, textAlign: "right" },
  upcomingTitle: { color: "#183B36", fontSize: 14, fontWeight: "700", lineHeight: 20, marginTop: 4, textAlign: "right" },
  actions: { flexDirection: "row-reverse", gap: 10 },
  actionCard: { backgroundColor: "#FFFFFF", borderColor: "#E3EFEB", borderRadius: 18, borderWidth: 1, flex: 1, minHeight: 170, padding: 14 },
  actionIcon: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#E6F5F2", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  actionTitle: { color: "#183B36", fontSize: 15, fontWeight: "800", marginTop: 15, textAlign: "right" },
  actionCopy: { color: "#6A827C", fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: "right" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
