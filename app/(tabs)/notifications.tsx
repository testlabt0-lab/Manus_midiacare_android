import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { type ClinicNotification } from "@/lib/medicare-domain";
import { useMediCare } from "@/lib/medicare-store";

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

export default function NotificationsScreen() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, addMedicalNotification } = useMediCare();

  const createInfoNotice = () => {
    if (!addMedicalNotification()) {
      Alert.alert("التنبيهات المعلوماتية متوقفة", "فعّلها من شاشة الحساب ثم حاول مرة أخرى.");
    }
  };

  const renderNotification = ({ item }: { item: ClinicNotification }) => {
    const medical = item.category === "MEDICAL";
    return <Pressable onPress={() => markNotificationRead(item.id)} style={({ pressed }) => [styles.card, !item.read && styles.unreadCard, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: medical ? "#F0ECFF" : "#E6F5F2" }]}><MaterialIcons name={medical ? "health-and-safety" : "event-note"} size={21} color={medical ? "#6950AA" : "#0B776B"} /></View>
      <View style={styles.copy}><View style={styles.cardTitleRow}>{!item.read ? <View style={styles.unreadDot} /> : null}<Text style={styles.cardTitle}>{item.title}</Text></View><Text style={styles.cardBody}>{item.body}</Text><Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text></View>
    </Pressable>;
  };

  return <ScreenContainer>
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={renderNotification}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, notifications.length === 0 && styles.grow]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={<><Text style={styles.title}>التنبيهات</Text><Text style={styles.subtitle}>تابع تحديثات الزيارات والمعلومات الصحية.</Text><View style={styles.actions}><Pressable onPress={createInfoNotice} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><MaterialIcons name="add-alert" size={18} color="#FFFFFF" /><Text style={styles.primaryActionText}>تنبيه معلوماتي</Text></Pressable><Pressable disabled={unreadCount === 0} onPress={markAllNotificationsRead} style={({ pressed }) => [styles.secondaryAction, unreadCount === 0 && styles.disabled, pressed && styles.pressed]}><Text style={styles.secondaryActionText}>تعليم الكل كمقروء</Text></Pressable></View></>}
      ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name="notifications-none" size={33} color="#0B776B" /></View><Text style={styles.emptyTitle}>لا توجد تنبيهات بعد</Text><Text style={styles.emptyCopy}>ستظهر هنا رسائل الزيارات التي تضيفها، وكذلك التذكيرات الصحية التي تنشئها.</Text><Pressable onPress={createInfoNotice} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}><Text style={styles.emptyButtonText}>إضافة تنبيه</Text></Pressable></View>}
    />
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 30 }, grow: { flexGrow: 1 },
  title: { color: "#183B36", fontSize: 28, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#6A827C", fontSize: 13, marginTop: 5, textAlign: "right" },
  actions: { flexDirection: "row-reverse", gap: 9, marginBottom: 21, marginTop: 18 },
  primaryAction: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 13, flex: 1, flexDirection: "row-reverse", gap: 5, justifyContent: "center", minHeight: 46, paddingHorizontal: 8 }, primaryActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  secondaryAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE9E5", borderRadius: 13, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 8 }, secondaryActionText: { color: "#41665D", fontSize: 12, fontWeight: "800" }, disabled: { opacity: 0.45 },
  card: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E1EEEA", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", padding: 14 }, unreadCard: { borderColor: "#83CBBB", borderWidth: 1.5 },
  icon: { alignItems: "center", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, copy: { flex: 1, marginRight: 11 }, cardTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 7 }, unreadDot: { backgroundColor: "#0B776B", borderRadius: 5, height: 8, width: 8 },
  cardTitle: { color: "#183B36", flex: 1, fontSize: 15, fontWeight: "800", textAlign: "right" }, cardBody: { color: "#58766F", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "right" }, cardTime: { color: "#8AA09A", fontSize: 11, marginTop: 7, textAlign: "right" }, separator: { height: 10 },
  empty: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 25, paddingTop: 50 }, emptyIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 22, height: 70, justifyContent: "center", width: 70 }, emptyTitle: { color: "#183B36", fontSize: 19, fontWeight: "800", marginTop: 17 }, emptyCopy: { color: "#6A827C", fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "center" }, emptyButton: { backgroundColor: "#0B776B", borderRadius: 13, marginTop: 20, paddingHorizontal: 17, paddingVertical: 12 }, emptyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
