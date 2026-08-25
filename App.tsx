import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  clearPatientSession,
  createPatientVisit,
  ensurePatientSession,
  listPatientNotifications,
  listPatientVisits,
  loadPatientSession,
  markPatientNotificationRead,
  startPatientLogin,
  type PatientSession,
} from "./src/api/patientApi";
import { ClinicStatusBadge } from "./src/components/ClinicStatusBadge";
import {
  advanceVisit,
  createLocalVisit,
  getVisitSummary,
  type ClinicVisit,
  type VisitStatus,
  visitStatusLabel,
} from "./src/domain/clinic";
import {
  countUnreadNotifications,
  createAppointmentNotification,
  createMedicalInfoNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type ClinicNotification,
} from "./src/domain/notifications";
import { renewPatientSessionForAction } from "./src/api/patientSessionLifecycle";

type TabKey = "dashboard" | "visits" | "notifications" | "profile";

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(style);
  }
}

function IconButton({ icon, label, active, badge, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; active: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      {badge ? <View style={styles.notificationCount}><Text style={styles.notificationCountText}>{badge > 9 ? "9+" : badge}</Text></View> : null}
      <MaterialIcons name={icon} size={23} color={active ? "#0B776B" : "#78938C"} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ title, value, icon, tint }: { title: string; value: number; icon: keyof typeof MaterialIcons.glyphMap; tint: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}><MaterialIcons name={icon} size={21} color="#0B776B" /></View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{title}</Text>
    </View>
  );
}

function EmptyState({ icon, title, copy, actionLabel, onAction }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; copy: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><MaterialIcons name={icon} size={32} color="#0B776B" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
      {actionLabel && onAction ? <Pressable onPress={onAction} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{actionLabel}</Text></Pressable> : null}
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [visits, setVisits] = useState<ClinicVisit[]>([]);
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [notificationSettings, setNotificationSettings] = useState({ appointments: true, medical: true });
  const [session, setSession] = useState<PatientSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [districtLabel, setDistrictLabel] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const summary = useMemo(() => getVisitSummary(visits), [visits]);
  const unreadNotifications = useMemo(() => countUnreadNotifications(notifications), [notifications]);

  const renewSessionForAction = (activeSession: PatientSession) => renewPatientSessionForAction(activeSession, {
    renew: ensurePatientSession,
    onRenewed: setSession,
    onExpired: async () => {
      await clearPatientSession();
      setSession(null);
    },
  });

  const refreshPatientData = async (activeSession: PatientSession) => {
    setSyncing(true);
    try {
      const currentSession = await renewSessionForAction(activeSession);
      const [syncedVisits, syncedNotifications] = await Promise.all([
        listPatientVisits(currentSession),
        listPatientNotifications(currentSession),
      ]);
      setVisits(syncedVisits);
      setNotifications(syncedNotifications);
      return currentSession;
    } catch (error) {
      Alert.alert("تعذر التحديث", error instanceof Error ? error.message : "تحقق من اتصالك ثم حاول مرة أخرى.");
      return null;
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const storedSession = await loadPatientSession();
      setSession(storedSession);
      setAuthReady(true);
      if (storedSession) await refreshPatientData(storedSession);
    })();
  }, []);

  const openComposer = () => {
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    setComposerOpen(true);
  };

  const signIn = async () => {
    setSyncing(true);
    try {
      const nextSession = await startPatientLogin();
      setSession(nextSession);
      await refreshPatientData(nextSession);
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("تعذر تسجيل الدخول", error instanceof Error ? error.message : "حاول مرة أخرى.");
    } finally {
      setSyncing(false);
    }
  };

  const signOut = async () => {
    await clearPatientSession();
    setSession(null);
    setVisits(items => items.filter(item => item.source !== "REMOTE"));
    setTab("dashboard");
  };

  const saveVisit = async () => {
    try {
      let visit: ClinicVisit;
      let activeSession: PatientSession | null = null;
      if (session) {
        if (!districtLabel.trim() || !scheduledStart.trim()) {
          throw new Error("أدخل الحي وموعد الزيارة بصيغة YYYY-MM-DDTHH:MM.");
        }
        setSyncing(true);
        activeSession = await renewSessionForAction(session);
        visit = await createPatientVisit(activeSession, { clinicName, serviceName, districtLabel, scheduledStart });
      } else {
        visit = createLocalVisit({ clinicName, serviceName });
      }
      setVisits(current => [visit, ...current.filter(item => item.id !== visit.id)]);
      if (activeSession) {
        await refreshPatientData(activeSession);
      } else if (notificationSettings.appointments) {
        setNotifications(current => [createAppointmentNotification(visit), ...current]);
      }
      setClinicName("");
      setServiceName("");
      setDistrictLabel("");
      setScheduledStart("");
      setComposerOpen(false);
      setTab("visits");
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("تعذر حفظ الزيارة", error instanceof Error ? error.message : "أدخل بيانات الزيارة المطلوبة أولاً.");
    } finally {
      setSyncing(false);
    }
  };

  const updateVisit = (id: string) => {
    const current = visits.find(visit => visit.id === id);
    if (!current) return;
    if (current.source === "REMOTE") {
      Alert.alert("حالة الزيارة", "يستطيع المريض متابعة حالة الزيارة فقط. يعدّل فريق العيادة الحالة من لوحة التشغيل.");
      return;
    }
    const next = advanceVisit(current);
    if (next.status === current.status) {
      Alert.alert("حالة نهائية", "هذه الزيارة مكتملة ولا يوجد إجراء تشغيلي تالٍ.");
      return;
    }
    safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setVisits(items => items.map(visit => visit.id === id ? next : visit));
  };

  const visibleVisits = visits;

  const addMedicalInfoNotice = () => {
    if (!notificationSettings.medical) {
      Alert.alert("التنبيهات الطبية متوقفة", "يمكنك تفعيل التنبيهات المعلوماتية من شاشة الحساب.");
      return;
    }
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    setNotifications(current => [createMedicalInfoNotification(), ...current]);
  };

  const readNotification = async (notification: ClinicNotification) => {
    if (session && notification.id.startsWith("WEB-N-")) {
      setSyncing(true);
      try {
        const currentSession = await renewSessionForAction(session);
        await markPatientNotificationRead(currentSession, notification.id);
        setNotifications(current => markNotificationRead(current, notification.id));
      } catch (error) {
        Alert.alert("تعذر تحديث التنبيه", error instanceof Error ? error.message : "حاول مرة أخرى.");
      } finally {
        setSyncing(false);
      }
      return;
    }
    setNotifications(current => markNotificationRead(current, notification.id));
  };

  const readAllNotifications = async () => {
    const unread = notifications.filter(notification => !notification.read);
    if (session && unread.some(notification => notification.id.startsWith("WEB-N-"))) {
      setSyncing(true);
      try {
        const currentSession = await renewSessionForAction(session);
        await Promise.all(unread.filter(notification => notification.id.startsWith("WEB-N-")).map(notification => markPatientNotificationRead(currentSession, notification.id)));
      } catch (error) {
        Alert.alert("تعذر تحديث التنبيهات", error instanceof Error ? error.message : "حاول مرة أخرى.");
      } finally {
        setSyncing(false);
      }
    }
    setNotifications(current => markAllNotificationsRead(current));
  };

  const renderVisit = ({ item }: { item: ClinicVisit }) => (
    <View style={styles.visitCard}>
      <View style={styles.visitRow}>
        <View style={styles.visitIcon}><MaterialIcons name="medical-services" size={21} color="#0B776B" /></View>
        <View style={styles.visitCopy}>
          <Text style={styles.visitTitle}>{item.serviceName}</Text>
          <Text style={styles.visitMeta}>{item.clinicName} · {item.id}</Text>
        </View>
        <ClinicStatusBadge status={item.status} />
      </View>
      <Pressable onPress={() => updateVisit(item.id)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>{item.source === "REMOTE" ? "عرض حالة الزيارة" : item.status === "COMPLETED" ? "زيارة مكتملة" : `تحديث محلي إلى ${visitStatusLabel[advanceVisit(item).status as VisitStatus]}`}</Text>
        <MaterialIcons name={item.source === "REMOTE" ? "visibility" : "arrow-back"} size={18} color="#0B776B" />
      </Pressable>
    </View>
  );

  const renderDashboard = () => (
    <FlatList
      data={[]}
      keyExtractor={(_, index) => `dashboard-${index}`}
      renderItem={null}
      ListHeaderComponent={
        <View style={styles.screenPadding}>
          <Text style={styles.eyebrow}>MEDICARE PRO MOBILE</Text>
          <Text style={styles.pageTitle}>زياراتك من هاتفك</Text>
          <Text style={styles.pageCopy}>{session ? "أنت متصل بحسابك في MediCare Pro. تُعرض هنا زياراتك المصرح بها فقط." : "سجّل الدخول لمزامنة زياراتك مع تطبيق MediCare Pro Web، أو استخدم السجل المحلي مؤقتاً."}</Text>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}><MaterialIcons name="local-hospital" size={28} color="#FFFFFF" /></View>
            <View style={styles.heroCopy}><Text style={styles.heroTitle}>{session ? "حساب المريض متصل" : "وضع محلي مؤقت"}</Text><Text style={styles.heroText}>{session ? "استخدم تحديث الزيارات لمزامنة أحدث بيانات حسابك." : "لن تُرسل البيانات إلى الخادم قبل تسجيل الدخول."}</Text></View>
          </View>
          <View style={styles.metricGrid}>
            <MetricCard title="كل الزيارات" value={summary.total} icon="calendar-month" tint="#E6F5F2" />
            <MetricCard title="نشطة" value={summary.active} icon="pending-actions" tint="#FFF4DF" />
            <MetricCard title="قيد التنفيذ" value={summary.inProgress} icon="monitor-heart" tint="#EFE9FF" />
            <MetricCard title="مكتملة" value={summary.completed} icon="task-alt" tint="#E6F7ED" />
          </View>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.actionGrid}>
            <Pressable onPress={openComposer} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}><MaterialIcons name="add-circle-outline" size={25} color="#0B776B" /><Text style={styles.actionTitle}>إضافة زيارة</Text><Text style={styles.actionCopy}>إنشاء سجل محلي جديد</Text></Pressable>
            <Pressable onPress={session ? () => void refreshPatientData(session) : signIn} disabled={syncing} style={({ pressed }) => [styles.actionCard, syncing && styles.disabledButton, pressed && styles.pressed]}><MaterialIcons name={session ? "sync" : "login"} size={25} color="#0B776B" /><Text style={styles.actionTitle}>{session ? "تحديث الحساب" : "تسجيل الدخول"}</Text><Text style={styles.actionCopy}>{session ? "سحب الزيارات والتنبيهات المصرح بها" : "ربط حساب المريض بأمان"}</Text></Pressable>
          </View>
        </View>
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderVisits = () => (
    <FlatList
      data={visibleVisits}
      keyExtractor={item => item.id}
      renderItem={renderVisit}
      contentContainerStyle={[styles.listContent, styles.screenPadding, visibleVisits.length === 0 && styles.grow]}
      ListHeaderComponent={<View style={styles.listHeader}><View><Text style={styles.pageTitle}>زياراتي</Text><Text style={styles.pageCopy}>{session ? "هذه هي الزيارات المرتبطة بحساب المريض في تطبيق الويب." : "هذه سجلات محلية؛ سجّل الدخول لمزامنتها مع حسابك."}</Text></View><Pressable onPress={openComposer} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><MaterialIcons name="add" size={24} color="#FFFFFF" /></Pressable></View>}
      ListEmptyComponent={<EmptyState icon="calendar-month" title="لا توجد زيارات بعد" copy={session ? "لا توجد زيارات مرتبطة بحسابك حالياً." : "أضف زيارة محلية أو سجّل الدخول للبحث في حسابك."} actionLabel="إضافة زيارة" onAction={openComposer} />}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderNotifications = () => (
    <FlatList
      data={notifications}
      keyExtractor={item => item.id}
      renderItem={({ item }) => {
        const icon = item.category === "APPOINTMENT" ? "calendar-month" : "health-and-safety";
        const tint = item.category === "APPOINTMENT" ? "#E6F5F2" : "#EFE9FF";
        return (
          <Pressable onPress={() => void readNotification(item)} style={({ pressed }) => [styles.notificationCard, !item.read && styles.notificationCardUnread, pressed && styles.pressed]}>
            <View style={[styles.notificationIcon, { backgroundColor: tint }]}><MaterialIcons name={icon} size={21} color="#0B776B" /></View>
            <View style={styles.notificationCopy}>
              <View style={styles.notificationTitleRow}><Text style={styles.notificationTitle}>{item.title}</Text>{!item.read ? <View style={styles.unreadDot} /> : null}</View>
              <Text style={styles.notificationBody}>{item.body}</Text>
              <Text style={styles.notificationTime}>{new Date(item.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          </Pressable>
        );
      }}
      contentContainerStyle={[styles.listContent, styles.screenPadding, notifications.length === 0 && styles.grow]}
      ListHeaderComponent={<View><View style={styles.listHeader}><View><Text style={styles.pageTitle}>التنبيهات</Text><Text style={styles.pageCopy}>{session ? "تنبيهات حسابك المصرح بها من MediCare Pro، وليست تشخيصاً أو نصيحة علاجية." : "تنبيهات محلية للمواعيد ومعلومات عامة من العيادة."}</Text></View></View><View style={styles.notificationActions}>{!session ? <Pressable onPress={addMedicalInfoNotice} style={({ pressed }) => [styles.compactPrimary, pressed && styles.pressed]}><MaterialIcons name="add-alert" size={18} color="#FFFFFF" /><Text style={styles.compactPrimaryText}>تنبيه معلوماتي</Text></Pressable> : null}<Pressable onPress={() => void readAllNotifications()} disabled={unreadNotifications === 0 || syncing} style={({ pressed }) => [styles.compactSecondary, (unreadNotifications === 0 || syncing) && styles.disabledButton, pressed && styles.pressed]}><Text style={styles.compactSecondaryText}>تعليم الكل كمقروء</Text></Pressable></View></View>}
      ListEmptyComponent={<EmptyState icon="notifications-none" title="لا توجد تنبيهات بعد" copy={session ? "لا توجد تنبيهات مرتبطة بحسابك حالياً." : "ستظهر هنا تنبيهات الزيارات التي تضيفها والتنبيهات المعلوماتية التي تختار إضافتها."} actionLabel={session ? "تحديث الحساب" : "إضافة تنبيه معلوماتي"} onAction={session ? () => void refreshPatientData(session) : addMedicalInfoNotice} />}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderProfile = () => (
    <FlatList
      data={[]}
      keyExtractor={(_, index) => `profile-${index}`}
      renderItem={null}
      ListHeaderComponent={<View style={styles.screenPadding}><View style={styles.profileMark}><MaterialIcons name="health-and-safety" size={34} color="#0B776B" /></View><Text style={styles.pageTitle}>MediCare Pro</Text><Text style={styles.pageCopy}>تطبيق مريض مستقل لأندرويد مرتبط بخدمة MediCare Pro Web.</Text><View style={styles.infoCard}><View style={styles.infoRow}><MaterialIcons name={session ? "verified-user" : "lock-outline"} size={20} color="#0B776B" /><View><Text style={styles.infoTitle}>{session ? "حساب المريض متصل" : "لم يتم تسجيل الدخول"}</Text><Text style={styles.infoCopy}>{session ? "تُجدّد جلسة الحساب تلقائياً برمز دوار محفوظ في تخزين الجهاز الآمن." : "سجّل الدخول لمزامنة بيانات حسابك مع تطبيق الويب."}</Text></View></View><View style={styles.divider} /><Pressable onPress={session ? signOut : signIn} disabled={syncing || !authReady} style={({ pressed }) => [styles.primaryButton, (syncing || !authReady) && styles.disabledButton, pressed && styles.pressed]}>{syncing || !authReady ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{session ? "تسجيل الخروج" : "تسجيل الدخول الآمن"}</Text>}</Pressable></View><Text style={styles.sectionTitle}>إعدادات التنبيهات</Text><View style={styles.infoCard}><View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.infoTitle}>تنبيهات المواعيد</Text><Text style={styles.infoCopy}>{session ? "تصل من سجل التنبيهات المتزامن مع حسابك." : "ينشئ التطبيق تنبيهاً محلياً عند إضافة زيارة."}</Text></View><Switch value={notificationSettings.appointments} onValueChange={value => setNotificationSettings(current => ({ ...current, appointments: value }))} trackColor={{ false: "#DCE9E4", true: "#8ED8C5" }} thumbColor={notificationSettings.appointments ? "#0B776B" : "#F7FAF8"} /></View><View style={styles.divider} /><View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.infoTitle}>تنبيهات معلوماتية</Text><Text style={styles.infoCopy}>تسمح برسائل عامة صادرة عن العيادة دون نصيحة علاجية.</Text></View><Switch value={notificationSettings.medical} onValueChange={value => setNotificationSettings(current => ({ ...current, medical: value }))} trackColor={{ false: "#DCE9E4", true: "#8ED8C5" }} thumbColor={notificationSettings.medical ? "#0B776B" : "#F7FAF8"} /></View></View></View>}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {tab === "dashboard" ? renderDashboard() : null}
        {tab === "visits" ? renderVisits() : null}
        {tab === "notifications" ? renderNotifications() : null}
        {tab === "profile" ? renderProfile() : null}
      </View>
      <View style={styles.tabBar}>
        <IconButton icon="dashboard" label="الرئيسية" active={tab === "dashboard"} onPress={() => setTab("dashboard")} />
        <IconButton icon="calendar-month" label="الزيارات" active={tab === "visits"} onPress={() => setTab("visits")} />
        <IconButton icon="notifications-none" label="التنبيهات" active={tab === "notifications"} badge={unreadNotifications} onPress={() => setTab("notifications")} />
        <IconButton icon="person-outline" label="الحساب" active={tab === "profile"} onPress={() => setTab("profile")} />
      </View>
      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>إضافة زيارة جديدة</Text>
            <Text style={styles.modalCopy}>{session ? "سيُرسل الطلب إلى حسابك في تطبيق الويب." : "ينشئ هذا النموذج سجلاً محلياً داخل النسخة المحمولة الحالية."}</Text>
            <Text style={styles.inputLabel}>اسم العيادة</Text>
            <TextInput value={clinicName} onChangeText={setClinicName} placeholder="مثال: عيادة الحياة" placeholderTextColor="#8BA49D" style={styles.input} textAlign="right" returnKeyType="next" />
            <Text style={styles.inputLabel}>نوع الخدمة</Text>
            <TextInput value={serviceName} onChangeText={setServiceName} placeholder="مثال: زيارة منزلية" placeholderTextColor="#8BA49D" style={styles.input} textAlign="right" onSubmitEditing={saveVisit} returnKeyType="done" />
            {session ? <><Text style={styles.inputLabel}>الحي أو المنطقة</Text><TextInput value={districtLabel} onChangeText={setDistrictLabel} placeholder="مثال: حي الروضة" placeholderTextColor="#8BA49D" style={styles.input} textAlign="right" returnKeyType="next" /><Text style={styles.inputLabel}>موعد الزيارة</Text><TextInput value={scheduledStart} onChangeText={setScheduledStart} placeholder="2026-08-30T10:30" placeholderTextColor="#8BA49D" style={styles.input} textAlign="right" onSubmitEditing={saveVisit} returnKeyType="done" /></> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setComposerOpen(false)} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelButtonText}>إلغاء</Text></Pressable>
              <Pressable onPress={() => void saveVisit()} disabled={syncing} style={({ pressed }) => [styles.primaryButton, styles.modalPrimary, syncing && styles.disabledButton, pressed && styles.pressed]}>{syncing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{session ? "إرسال الطلب" : "حفظ الزيارة"}</Text>}</Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6FAF8" },
  content: { flex: 1 },
  screenPadding: { paddingHorizontal: 20, paddingTop: 18 },
  listContent: { paddingBottom: 22 },
  grow: { flexGrow: 1 },
  eyebrow: { color: "#0B776B", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textAlign: "right" },
  pageTitle: { color: "#173E37", fontSize: 28, fontWeight: "800", textAlign: "right", marginTop: 7 },
  pageCopy: { color: "#668179", fontSize: 14, lineHeight: 22, textAlign: "right", marginTop: 7 },
  heroCard: { backgroundColor: "#0B776B", borderRadius: 24, padding: 20, marginTop: 22, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: "#0B776B", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 4 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1 },
  heroTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "right" },
  heroText: { color: "#D8F5EC", fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 4 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  metricCard: { width: "48.5%", backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderWidth: 1, borderRadius: 18, padding: 15 },
  metricIcon: { alignItems: "center", borderRadius: 12, height: 36, justifyContent: "center", width: 36 },
  metricValue: { color: "#173E37", fontSize: 25, fontWeight: "800", marginTop: 12, textAlign: "right" },
  metricLabel: { color: "#6B857C", fontSize: 12, fontWeight: "600", marginTop: 2, textAlign: "right" },
  sectionTitle: { color: "#244C43", fontSize: 19, fontWeight: "800", marginTop: 27, textAlign: "right" },
  actionGrid: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionCard: { backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderWidth: 1, borderRadius: 18, flex: 1, minHeight: 132, padding: 15 },
  actionTitle: { color: "#244C43", fontSize: 14, fontWeight: "800", marginTop: 16, textAlign: "right" },
  actionCopy: { color: "#6B857C", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right" },
  tabBar: { backgroundColor: "#FFFFFF", borderTopColor: "#D9E8E2", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-around", paddingBottom: 10, paddingTop: 9 },
  tabButton: { alignItems: "center", gap: 4, minWidth: 58, position: "relative" },
  tabLabel: { color: "#78938C", fontSize: 10, fontWeight: "700" },
  tabLabelActive: { color: "#0B776B" },
  notificationCount: { alignItems: "center", backgroundColor: "#CB3A32", borderColor: "#FFFFFF", borderRadius: 9, borderWidth: 1, height: 18, justifyContent: "center", position: "absolute", right: 8, top: -4, minWidth: 18, zIndex: 1 },
  notificationCountText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  listHeader: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 18 },
  iconAction: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 14, height: 46, justifyContent: "center", marginTop: 6, width: 46 },
  visitCard: { backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderWidth: 1, borderRadius: 18, marginBottom: 11, padding: 15 },
  visitRow: { alignItems: "center", flexDirection: "row-reverse", gap: 11 },
  visitIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  visitCopy: { flex: 1 },
  visitTitle: { color: "#244C43", fontSize: 15, fontWeight: "800", textAlign: "right" },
  visitMeta: { color: "#718980", fontSize: 12, marginTop: 3, textAlign: "right" },
  secondaryButton: { alignItems: "center", backgroundColor: "#EFF9F5", borderColor: "#CDE7DC", borderRadius: 12, borderWidth: 1, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 14, minHeight: 43, paddingHorizontal: 12 },
  secondaryButtonText: { color: "#0B776B", fontSize: 13, fontWeight: "800" },
  notificationActions: { flexDirection: "row-reverse", gap: 9, marginBottom: 18 },
  compactPrimary: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 11, flexDirection: "row-reverse", gap: 6, justifyContent: "center", minHeight: 42, paddingHorizontal: 11 },
  compactPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  compactSecondary: { alignItems: "center", borderColor: "#CDE2D9", borderRadius: 11, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 8 },
  compactSecondaryText: { color: "#41665D", fontSize: 12, fontWeight: "800" },
  disabledButton: { opacity: 0.45 },
  notificationCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginBottom: 11, padding: 15 },
  notificationCardUnread: { borderColor: "#8ED8C5", borderWidth: 1.5 },
  notificationIcon: { alignItems: "center", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  notificationCopy: { flex: 1 },
  notificationTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 7, justifyContent: "flex-start" },
  notificationTitle: { color: "#244C43", flexShrink: 1, fontSize: 14, fontWeight: "800", textAlign: "right" },
  notificationBody: { color: "#6B857C", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" },
  notificationTime: { color: "#8A9E98", fontSize: 11, marginTop: 7, textAlign: "right" },
  unreadDot: { backgroundColor: "#0B776B", borderRadius: 4, height: 8, width: 8 },
  emptyState: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 400, paddingHorizontal: 26 },
  emptyIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 18, height: 64, justifyContent: "center", width: 64 },
  emptyTitle: { color: "#244C43", fontSize: 19, fontWeight: "800", marginTop: 18, textAlign: "center" },
  emptyCopy: { color: "#6B857C", fontSize: 14, lineHeight: 22, marginTop: 7, maxWidth: 300, textAlign: "center" },
  primaryButton: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 13, justifyContent: "center", minHeight: 48, paddingHorizontal: 18 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  profileMark: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 22, height: 74, justifyContent: "center", marginLeft: "auto", marginRight: "auto", marginTop: 16, width: 74 },
  infoCard: { backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderRadius: 18, borderWidth: 1, marginTop: 24, padding: 16 },
  infoRow: { flexDirection: "row-reverse", gap: 12 },
  infoTitle: { color: "#244C43", fontSize: 14, fontWeight: "800", textAlign: "right" },
  infoCopy: { color: "#6B857C", fontSize: 12, lineHeight: 19, marginTop: 3, textAlign: "right" },
  switchRow: { alignItems: "center", flexDirection: "row-reverse", gap: 12, justifyContent: "space-between" },
  switchCopy: { flex: 1 },
  divider: { backgroundColor: "#E6EFEB", height: 1, marginVertical: 16 },
  modalBackdrop: { backgroundColor: "rgba(12, 47, 41, 0.42)", flex: 1, justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30 },
  modalHandle: { alignSelf: "center", backgroundColor: "#D5E4DE", borderRadius: 4, height: 4, marginBottom: 19, width: 46 },
  modalTitle: { color: "#173E37", fontSize: 21, fontWeight: "800", textAlign: "right" },
  modalCopy: { color: "#6B857C", fontSize: 13, lineHeight: 20, marginTop: 5, textAlign: "right" },
  inputLabel: { color: "#365B53", fontSize: 13, fontWeight: "800", marginTop: 18, textAlign: "right" },
  input: { backgroundColor: "#F8FBFA", borderColor: "#D4E6DE", borderRadius: 12, borderWidth: 1, color: "#244C43", fontSize: 15, marginTop: 7, minHeight: 48, paddingHorizontal: 13 },
  modalActions: { flexDirection: "row-reverse", gap: 10, marginTop: 24 },
  modalPrimary: { flex: 1 },
  cancelButton: { alignItems: "center", borderColor: "#CDE2D9", borderRadius: 13, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 18 },
  cancelButtonText: { color: "#41665D", fontSize: 14, fontWeight: "800" },
});
