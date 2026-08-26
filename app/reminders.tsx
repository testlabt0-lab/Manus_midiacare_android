import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";

type ScheduledReminder = {
  id: string;
  title: string;
  body: string;
  at: number | null;
};

function getTriggerTime(request: Notifications.NotificationRequest): number | null {
  const trigger = request.trigger as { date?: Date | string | number } | null;
  const value = trigger?.date;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default function RemindersScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReminders = useCallback(async () => {
    if (Platform.OS === "web") {
      setReminders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      setReminders(requests.map((request) => ({
        id: request.identifier,
        title: request.content.title || "تذكير بموعد MediCare Pro",
        body: request.content.body || "لديك تذكير موعد مجدول.",
        at: getTriggerTime(request),
      })).sort((left, right) => (left.at ?? Number.MAX_SAFE_INTEGER) - (right.at ?? Number.MAX_SAFE_INTEGER)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReminders(); }, [loadReminders]);

  return <ScreenContainer>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityLabel="العودة">
        <MaterialIcons name="arrow-forward" size={22} color="#0B776B" />
      </Pressable>
      <View style={styles.headerCopy}><Text style={styles.title}>التذكيرات المجدولة</Text><Text style={styles.subtitle}>مواعيد التنبيه القادمة على هذا الجهاز.</Text></View>
    </View>
    {Platform.OS === "web" ? <View style={styles.notice}><MaterialIcons name="info-outline" size={22} color="#B6651C" /><Text style={styles.noticeText}>تظهر التذكيرات الفعلية عند فتح التطبيق في نسخة Android أو iOS مبنية.</Text></View> : null}
    <FlatList
      data={reminders}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={() => void loadReminders()}
      contentContainerStyle={reminders.length ? styles.list : styles.emptyContent}
      renderItem={({ item }) => <View style={styles.card}>
        <View style={styles.icon}><MaterialIcons name="notifications-active" size={21} color="#0B776B" /></View>
        <View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardBody}>{item.body}</Text><Text style={styles.cardTime}>{item.at ? new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(item.at)) : "سيظهر وقت التذكير عند جدولة الموعد."}</Text></View>
      </View>}
      ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name="notifications-none" size={30} color="#0B776B" /></View><Text style={styles.emptyTitle}>{loading ? "جارٍ قراءة التذكيرات…" : "لا توجد تذكيرات مجدولة"}</Text><Text style={styles.emptyText}>فعّل تنبيهات المواعيد وأضف زيارة متصلة بموعد لاحق لرؤية تذكيرك هنا.</Text></View>}
    />
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row-reverse", paddingHorizontal: 20, paddingVertical: 16 },
  back: { alignItems: "center", backgroundColor: "#EAF6F3", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  headerCopy: { flex: 1, marginRight: 12 },
  title: { color: "#183B36", fontSize: 22, fontWeight: "800", textAlign: "right" },
  subtitle: { color: "#6A827C", fontSize: 12, marginTop: 4, textAlign: "right" },
  notice: { alignItems: "center", backgroundColor: "#FFF7E8", borderColor: "#F5DEAF", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginHorizontal: 20, padding: 13 },
  noticeText: { color: "#8A5A1D", flex: 1, fontSize: 12, lineHeight: 18, textAlign: "right" },
  list: { gap: 10, padding: 20 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  card: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E0ECE8", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", padding: 14 },
  icon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  cardCopy: { flex: 1, marginRight: 11 },
  cardTitle: { color: "#183B36", fontSize: 14, fontWeight: "800", textAlign: "right" },
  cardBody: { color: "#58766F", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right" },
  cardTime: { color: "#0B776B", fontSize: 11, fontWeight: "700", marginTop: 8, textAlign: "right" },
  empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E0ECE8", borderRadius: 22, borderWidth: 1, padding: 25 },
  emptyIcon: { alignItems: "center", backgroundColor: "#EAF6F3", borderRadius: 18, height: 58, justifyContent: "center", width: 58 },
  emptyTitle: { color: "#183B36", fontSize: 17, fontWeight: "800", marginTop: 14, textAlign: "center" },
  emptyText: { color: "#6A827C", fontSize: 12, lineHeight: 19, marginTop: 7, textAlign: "center" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
