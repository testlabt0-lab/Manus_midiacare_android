import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  filterPatientVisits,
  getUpcomingVisit,
  getVisitSummary,
  patientVisitFilterLabel,
  searchPatientVisits,
  sortPatientVisits,
  type ClinicVisit,
  type PatientVisitFilter,
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
import { isPatientSessionExpiredFailure } from "./src/api/patientSessionErrors";
import { getPatientConnectionDiagnostic } from "./src/domain/connectionDiagnostics";
import { shouldRefreshOnAppResume, type AppVisibility } from "./src/domain/foregroundRefresh";
import { PATIENT_RELEASE_CHECKLIST_PROGRESS_KEY, patientLocalDataResetMessage, patientLocalStorageKeys } from "./src/domain/localDataReset";
import { patientPrivacyInformation } from "./src/domain/privacyInfo";
import { getReleaseChecklistStatusLabel, patientReleaseChecklist, type ReleaseChecklistStatus } from "./src/domain/releaseChecklist";
import { isReleaseChecklistItemTrackable, parseReleaseChecklistProgress, toggleReleaseChecklistProgress, type ReleaseChecklistProgress } from "./src/domain/releaseChecklistProgress";
import { appendPatientSyncHistory, getPatientSyncHistoryLabel, parsePatientSyncHistory, type PatientSyncHistoryEntry, type PatientSyncOutcome } from "./src/domain/syncHistory";
import { filterPatientSyncHistoryByRetention, getPatientSyncHistoryRetentionLabel, isPatientSyncHistoryRetention, patientSyncHistoryRetentions, resolvePatientSyncHistoryPreference, shouldRecordPatientSyncHistory, type PatientSyncHistoryRetention } from "./src/domain/syncHistoryPrivacy";
import { getPatientSyncStatus } from "./src/domain/syncStatus";
import { getPatientSessionRestoreStatus, type PatientSessionRestoreState } from "./src/domain/sessionRestoreStatus";

type TabKey = "dashboard" | "visits" | "notifications" | "profile";
const SYNC_HISTORY_STORAGE_KEY = "medicare_pro_patient_sync_history";
const SYNC_HISTORY_PREFERENCE_STORAGE_KEY = "medicare_pro_patient_sync_history_enabled";
const SYNC_HISTORY_RETENTION_STORAGE_KEY = "medicare_pro_patient_sync_history_retention";
const REFRESH_ON_RESUME_STORAGE_KEY = "medicare_pro_patient_refresh_on_resume";

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

function SyncHistoryCard({ entries, onClear }: { entries: PatientSyncHistoryEntry[]; onClear: () => void }) {
  return <View style={styles.syncHistoryCard}><View style={styles.syncHistoryHeader}><Text style={styles.syncHistoryTitle}>سجل المزامنة المحلي</Text>{entries.length ? <Pressable onPress={onClear} style={({ pressed }) => [styles.clearHistoryButton, pressed && styles.pressed]}><Text style={styles.clearHistoryButtonText}>مسح السجل</Text></Pressable> : null}</View>{entries.length ? entries.map(entry => <View key={entry.id} style={styles.syncHistoryRow}><MaterialIcons name={entry.outcome === "SUCCESS" ? "check-circle-outline" : "error-outline"} size={18} color={entry.outcome === "SUCCESS" ? "#0B776B" : "#A44916"} /><View style={styles.syncHistoryCopy}><Text style={styles.syncHistoryEntryTitle}>{getPatientSyncHistoryLabel(entry.outcome)}</Text><Text style={styles.syncHistoryEntryTime}>{new Date(entry.occurredAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</Text></View></View>) : <Text style={styles.syncHistoryEmpty}>لا توجد نتائج مزامنة محفوظة على هذا الجهاز بعد.</Text>}</View>;
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
  const [visitFilter, setVisitFilter] = useState<PatientVisitFilter>("ALL");
  const [visitSearchQuery, setVisitSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [notificationSettings, setNotificationSettings] = useState({ appointments: true, medical: true });
  const [session, setSession] = useState<PatientSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionRestoreState, setSessionRestoreState] = useState<PatientSessionRestoreState>("CHECKING");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncHistory, setSyncHistory] = useState<PatientSyncHistoryEntry[]>([]);
  const syncHistoryRef = useRef<PatientSyncHistoryEntry[]>([]);
  const [syncHistoryEnabled, setSyncHistoryEnabled] = useState(true);
  const syncHistoryEnabledRef = useRef(true);
  const [syncHistoryRetention, setSyncHistoryRetention] = useState<PatientSyncHistoryRetention>("7_DAYS");
  const syncHistoryRetentionRef = useRef<PatientSyncHistoryRetention>("7_DAYS");
  const [refreshOnResume, setRefreshOnResume] = useState(false);
  const appVisibilityRef = useRef<AppVisibility>((AppState.currentState ?? "unknown") as AppVisibility);
  const [privacyInfoOpen, setPrivacyInfoOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [releaseChecklistOpen, setReleaseChecklistOpen] = useState(false);
  const [releaseChecklistProgress, setReleaseChecklistProgress] = useState<ReleaseChecklistProgress>({});
  const releaseChecklistProgressRef = useRef<ReleaseChecklistProgress>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [districtLabel, setDistrictLabel] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const summary = useMemo(() => getVisitSummary(visits), [visits]);
  const upcomingVisit = useMemo(() => getUpcomingVisit(visits), [visits]);
  const unreadNotifications = useMemo(() => countUnreadNotifications(notifications), [notifications]);
  const syncStatus = getPatientSyncStatus({ isConnected: Boolean(session), isSyncing: syncing, hasError: syncError, lastSyncedAt });
  const connectionDiagnostic = getPatientConnectionDiagnostic({ isConnected: Boolean(session), isSyncing: syncing, hasError: syncError, lastSyncedAt, historyEnabled: syncHistoryEnabled, historyEntryCount: syncHistory.length, sessionRestoreState });
  const sessionRestoreStatus = getPatientSessionRestoreStatus(sessionRestoreState);

  const saveSyncHistory = (entries: PatientSyncHistoryEntry[]) => {
    if (!shouldRecordPatientSyncHistory(syncHistoryEnabledRef.current)) return;
    syncHistoryRef.current = entries;
    setSyncHistory(entries);
    void AsyncStorage.setItem(SYNC_HISTORY_STORAGE_KEY, JSON.stringify(entries)).catch(() => undefined);
  };
  const recordSyncOutcome = (outcome: PatientSyncOutcome) => {
    const now = Date.now();
    const retainedHistory = filterPatientSyncHistoryByRetention(syncHistoryRef.current, syncHistoryRetentionRef.current, now);
    saveSyncHistory(appendPatientSyncHistory(retainedHistory, outcome, now));
  };
  const clearSyncHistory = () => {
    syncHistoryRef.current = [];
    setSyncHistory([]);
    void AsyncStorage.removeItem(SYNC_HISTORY_STORAGE_KEY).catch(() => undefined);
  };
  const setSyncHistoryPreference = (enabled: boolean) => {
    syncHistoryEnabledRef.current = enabled;
    setSyncHistoryEnabled(enabled);
    void AsyncStorage.setItem(SYNC_HISTORY_PREFERENCE_STORAGE_KEY, enabled ? "true" : "false").catch(() => undefined);
    if (!enabled) clearSyncHistory();
  };
  const setSyncHistoryRetentionPreference = (retention: PatientSyncHistoryRetention) => {
    syncHistoryRetentionRef.current = retention;
    setSyncHistoryRetention(retention);
    void AsyncStorage.setItem(SYNC_HISTORY_RETENTION_STORAGE_KEY, retention).catch(() => undefined);
    const retainedHistory = filterPatientSyncHistoryByRetention(syncHistoryRef.current, retention, Date.now());
    if (retainedHistory.length !== syncHistoryRef.current.length) saveSyncHistory(retainedHistory);
  };
  const setRefreshOnResumePreference = (enabled: boolean) => {
    setRefreshOnResume(enabled);
    void AsyncStorage.setItem(REFRESH_ON_RESUME_STORAGE_KEY, enabled ? "true" : "false").catch(() => undefined);
  };
  const saveReleaseChecklistProgress = (progress: ReleaseChecklistProgress) => {
    releaseChecklistProgressRef.current = progress;
    setReleaseChecklistProgress(progress);
    void AsyncStorage.setItem(PATIENT_RELEASE_CHECKLIST_PROGRESS_KEY, JSON.stringify(progress)).catch(() => undefined);
  };
  const toggleReleaseChecklistItem = (itemId: string) => {
    saveReleaseChecklistProgress(toggleReleaseChecklistProgress(releaseChecklistProgressRef.current, itemId, Date.now()));
  };
  const clearReleaseChecklistProgress = () => saveReleaseChecklistProgress({});
  const resetLocalPatientData = async () => {
    await Promise.all([
      clearPatientSession(),
      AsyncStorage.multiRemove([...patientLocalStorageKeys]).catch(() => undefined),
    ]);
    syncHistoryRef.current = [];
    syncHistoryEnabledRef.current = true;
    syncHistoryRetentionRef.current = "7_DAYS";
    setSession(null);
    setVisits([]);
    setNotifications([]);
    setNotificationSettings({ appointments: true, medical: true });
    setSyncHistory([]);
    setSyncHistoryEnabled(true);
    setSyncHistoryRetention("7_DAYS");
    setRefreshOnResume(false);
    releaseChecklistProgressRef.current = {};
    setReleaseChecklistProgress({});
    setSyncError(false);
    setLastSyncedAt(null);
    setComposerOpen(false);
    setClinicName("");
    setServiceName("");
    setDistrictLabel("");
    setScheduledStart("");
    setTab("dashboard");
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const confirmResetLocalPatientData = () => {
    Alert.alert("حذف البيانات المحلية؟", patientLocalDataResetMessage, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف من هذا الجهاز", style: "destructive", onPress: () => void resetLocalPatientData() },
    ]);
  };

  const renewSessionForAction = (activeSession: PatientSession) => renewPatientSessionForAction(activeSession, {
    renew: ensurePatientSession,
    onRenewed: setSession,
    onExpired: async () => {
      await clearPatientSession();
      clearSyncHistory();
      setSession(null);
      setSessionRestoreState("EXPIRED");
    },
  });

  const refreshPatientData = async (activeSession: PatientSession, options: { restoring?: boolean; silent?: boolean } = {}) => {
    setSyncing(true);
    setSyncError(false);
    try {
      const currentSession = await renewSessionForAction(activeSession);
      const [syncedVisits, syncedNotifications] = await Promise.all([
        listPatientVisits(currentSession),
        listPatientNotifications(currentSession),
      ]);
      setVisits(syncedVisits);
      setNotifications(syncedNotifications);
      setLastSyncedAt(Date.now());
      recordSyncOutcome("SUCCESS");
      setSessionRestoreState("RESTORED");
      return currentSession;
    } catch (error) {
      const expired = isPatientSessionExpiredFailure(error);
      setSyncError(!expired);
      recordSyncOutcome("FAILURE");
      if (options.restoring) setSessionRestoreState(expired ? "EXPIRED" : "OFFLINE");
      if (!options.silent) Alert.alert(expired ? "انتهت الجلسة" : "تعذر التحديث", expired ? "سجّل الدخول من جديد لربط حساب المريض بأمان." : "تعذر مزامنة بيانات حسابك الآن. تحقّق من الاتصال ثم أعد المحاولة.");
      return null;
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const [storedSession, storedHistory, storedPreference, storedRetention, storedRefreshPreference, storedChecklistProgress] = await Promise.all([loadPatientSession(), AsyncStorage.getItem(SYNC_HISTORY_STORAGE_KEY).catch(() => null), AsyncStorage.getItem(SYNC_HISTORY_PREFERENCE_STORAGE_KEY).catch(() => null), AsyncStorage.getItem(SYNC_HISTORY_RETENTION_STORAGE_KEY).catch(() => null), AsyncStorage.getItem(REFRESH_ON_RESUME_STORAGE_KEY).catch(() => null), AsyncStorage.getItem(PATIENT_RELEASE_CHECKLIST_PROGRESS_KEY).catch(() => null)]);
      const historyEnabled = storedPreference !== "false";
      const historyRetention = isPatientSyncHistoryRetention(storedRetention) ? storedRetention : "7_DAYS";
      syncHistoryEnabledRef.current = historyEnabled;
      setSyncHistoryEnabled(historyEnabled);
      syncHistoryRetentionRef.current = historyRetention;
      setSyncHistoryRetention(historyRetention);
      setRefreshOnResume(storedRefreshPreference === "true");
      let parsedChecklistProgress: ReleaseChecklistProgress = {};
      try { parsedChecklistProgress = parseReleaseChecklistProgress(storedChecklistProgress ? JSON.parse(storedChecklistProgress) : {}); } catch { parsedChecklistProgress = {}; }
      releaseChecklistProgressRef.current = parsedChecklistProgress;
      setReleaseChecklistProgress(parsedChecklistProgress);
      let parsedHistory: PatientSyncHistoryEntry[] = [];
      try { parsedHistory = parsePatientSyncHistory(storedHistory ? JSON.parse(storedHistory) : []); } catch { parsedHistory = []; }
      const visibleHistory = resolvePatientSyncHistoryPreference(historyEnabled, filterPatientSyncHistoryByRetention(parsedHistory, historyRetention, Date.now()));
      syncHistoryRef.current = visibleHistory;
      setSyncHistory(visibleHistory);
      if (!historyEnabled || visibleHistory.length !== parsedHistory.length) void AsyncStorage.setItem(SYNC_HISTORY_STORAGE_KEY, JSON.stringify(visibleHistory)).catch(() => undefined);
      setSession(storedSession);
      setSessionRestoreState(storedSession ? "CHECKING" : "NONE");
      setAuthReady(true);
      if (storedSession) await refreshPatientData(storedSession, { restoring: true, silent: true });
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", nextState => {
      const previousState = appVisibilityRef.current;
      const nextVisibility = (nextState ?? "unknown") as AppVisibility;
      appVisibilityRef.current = nextVisibility;
      if (shouldRefreshOnAppResume({ enabled: refreshOnResume, previousState, nextState: nextVisibility, hasSession: Boolean(session), isSyncing: syncing }) && session) {
        void refreshPatientData(session);
      }
    });
    return () => subscription.remove();
  }, [refreshOnResume, session, syncing]);

  const openComposer = () => {
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    setComposerOpen(true);
  };

  const signIn = async () => {
    setSyncing(true);
    try {
      const nextSession = await startPatientLogin();
      setSession(nextSession);
      setSessionRestoreState("RESTORED");
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
    clearSyncHistory();
    setSession(null);
    setSessionRestoreState("NONE");
    setSyncError(false);
    setLastSyncedAt(null);
    setVisits(items => items.filter(item => item.source !== "REMOTE"));
    setTab("dashboard");
  };

  const refreshAccount = () => {
    if (!session || syncing) return;
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    void refreshPatientData(session);
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

  const visibleVisits = useMemo(() => sortPatientVisits(searchPatientVisits(filterPatientVisits(visits, visitFilter), visitSearchQuery)), [visits, visitFilter, visitSearchQuery]);

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
            <View style={styles.heroCopy}><Text style={styles.heroTitle}>{session ? "حساب المريض متصل" : "وضع محلي مؤقت"}</Text><Text style={styles.heroText}>{syncStatus}</Text></View>
          </View>
          {session && syncError ? <Pressable onPress={refreshAccount} disabled={syncing} style={({ pressed }) => [styles.retryButton, syncing && styles.disabledButton, pressed && styles.pressed]}><MaterialIcons name="refresh" size={18} color="#A44916" /><Text style={styles.retryButtonText}>إعادة محاولة التحديث</Text></Pressable> : null}
          <View style={styles.upcomingVisitCard}>
            <View style={styles.upcomingVisitIcon}><MaterialIcons name={upcomingVisit ? "event-available" : "event-busy"} size={23} color="#0B776B" /></View>
            <View style={styles.upcomingVisitCopy}>
              <Text style={styles.upcomingVisitEyebrow}>موعدك القادم</Text>
              {upcomingVisit ? <><Text style={styles.upcomingVisitTitle}>{upcomingVisit.serviceName}</Text><Text style={styles.upcomingVisitMeta}>{new Date(upcomingVisit.scheduledStart as number).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</Text></> : <Text style={styles.upcomingVisitEmpty}>لا يوجد موعد مستقبلي مؤكد أو نشط حالياً.</Text>}
            </View>
          </View>
          {session && syncHistoryEnabled ? <SyncHistoryCard entries={syncHistory} onClear={clearSyncHistory} /> : null}
          <View style={styles.metricGrid}>
            <MetricCard title="كل الزيارات" value={summary.total} icon="calendar-month" tint="#E6F5F2" />
            <MetricCard title="نشطة" value={summary.active} icon="pending-actions" tint="#FFF4DF" />
            <MetricCard title="قيد التنفيذ" value={summary.inProgress} icon="monitor-heart" tint="#EFE9FF" />
            <MetricCard title="مكتملة" value={summary.completed} icon="task-alt" tint="#E6F7ED" />
          </View>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.actionGrid}>
            <Pressable onPress={openComposer} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}><MaterialIcons name="add-circle-outline" size={25} color="#0B776B" /><Text style={styles.actionTitle}>إضافة زيارة</Text><Text style={styles.actionCopy}>إنشاء سجل محلي جديد</Text></Pressable>
            <Pressable onPress={session ? refreshAccount : signIn} disabled={syncing} style={({ pressed }) => [styles.actionCard, syncing && styles.disabledButton, pressed && styles.pressed]}><MaterialIcons name={session ? "sync" : "login"} size={25} color="#0B776B" /><Text style={styles.actionTitle}>{session ? "تحديث الحساب" : "تسجيل الدخول"}</Text><Text style={styles.actionCopy}>{session ? "سحب الزيارات والتنبيهات المصرح بها" : "ربط حساب المريض بأمان"}</Text></Pressable>
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
      ListHeaderComponent={<View><View style={styles.listHeader}><View><Text style={styles.pageTitle}>زياراتي</Text><Text style={styles.pageCopy}>{session ? syncStatus : "هذه سجلات محلية؛ سجّل الدخول لمزامنتها مع حسابك."}</Text></View><View style={styles.listHeaderActions}>{session ? <Pressable onPress={refreshAccount} disabled={syncing} style={({ pressed }) => [styles.iconAction, styles.syncAction, syncing && styles.disabledButton, pressed && styles.pressed]}><MaterialIcons name="sync" size={20} color="#0B776B" /></Pressable> : null}<Pressable onPress={openComposer} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><MaterialIcons name="add" size={24} color="#FFFFFF" /></Pressable></View></View><TextInput value={visitSearchQuery} onChangeText={setVisitSearchQuery} placeholder="ابحث باسم العيادة أو نوع الخدمة" placeholderTextColor="#8BA49D" style={styles.visitSearchInput} textAlign="right" returnKeyType="search" /><View style={styles.visitFilterRow}>{(["ALL", "ACTIVE", "COMPLETED", "CANCELLED"] as PatientVisitFilter[]).map(filter => <Pressable key={filter} onPress={() => setVisitFilter(filter)} style={({ pressed }) => [styles.visitFilterButton, visitFilter === filter && styles.visitFilterButtonSelected, pressed && styles.pressed]}><Text style={[styles.visitFilterText, visitFilter === filter && styles.visitFilterTextSelected]}>{patientVisitFilterLabel[filter]}</Text></Pressable>)}</View></View>}
      ListEmptyComponent={<EmptyState icon="calendar-month" title={visitSearchQuery.trim() ? "لا توجد زيارات مطابقة" : visitFilter === "ALL" ? "لا توجد زيارات بعد" : `لا توجد زيارات ${patientVisitFilterLabel[visitFilter]} الآن`} copy={visitSearchQuery.trim() ? "جرّب كتابة اسم عيادة أو نوع خدمة مختلف، أو أزل البحث." : visitFilter === "ALL" ? (session ? "لا توجد زيارات مرتبطة بحسابك حالياً." : "أضف زيارة محلية أو سجّل الدخول للبحث في حسابك.") : "غيّر المرشح لعرض فئات الزيارات الأخرى أو أضف زيارة جديدة."} actionLabel="إضافة زيارة" onAction={openComposer} />}
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
      ListHeaderComponent={<View><View style={styles.listHeader}><View><Text style={styles.pageTitle}>التنبيهات</Text><Text style={styles.pageCopy}>{session ? syncStatus : "تنبيهات محلية للمواعيد ومعلومات عامة من العيادة."}</Text></View></View><View style={styles.notificationActions}>{session ? <Pressable onPress={refreshAccount} disabled={syncing} style={({ pressed }) => [styles.compactSecondary, syncing && styles.disabledButton, pressed && styles.pressed]}><MaterialIcons name="sync" size={17} color="#41665D" /><Text style={styles.compactSecondaryText}>تحديث</Text></Pressable> : <Pressable onPress={addMedicalInfoNotice} style={({ pressed }) => [styles.compactPrimary, pressed && styles.pressed]}><MaterialIcons name="add-alert" size={18} color="#FFFFFF" /><Text style={styles.compactPrimaryText}>تنبيه معلوماتي</Text></Pressable>}<Pressable onPress={() => void readAllNotifications()} disabled={unreadNotifications === 0 || syncing} style={({ pressed }) => [styles.compactSecondary, (unreadNotifications === 0 || syncing) && styles.disabledButton, pressed && styles.pressed]}><Text style={styles.compactSecondaryText}>تعليم الكل كمقروء</Text></Pressable></View></View>}
      ListEmptyComponent={<EmptyState icon="notifications-none" title="لا توجد تنبيهات بعد" copy={session ? "لا توجد تنبيهات مرتبطة بحسابك حالياً." : "ستظهر هنا تنبيهات الزيارات التي تضيفها والتنبيهات المعلوماتية التي تختار إضافتها."} actionLabel={session ? "تحديث الحساب" : "إضافة تنبيه معلوماتي"} onAction={session ? () => void refreshPatientData(session) : addMedicalInfoNotice} />}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderProfile = () => (
    <FlatList
      data={[]}
      keyExtractor={(_, index) => `profile-${index}`}
      renderItem={null}
      ListHeaderComponent={
        <View style={styles.screenPadding}>
          <View style={styles.profileMark}><MaterialIcons name="health-and-safety" size={34} color="#0B776B" /></View>
          <Text style={styles.pageTitle}>MediCare Pro</Text>
          <Text style={styles.pageCopy}>تطبيق مريض مستقل لأندرويد مرتبط بخدمة MediCare Pro Web.</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialIcons name={sessionRestoreState === "OFFLINE" ? "sync-problem" : session ? "verified-user" : "lock-outline"} size={20} color={sessionRestoreState === "OFFLINE" ? "#A44916" : "#0B776B"} />
              <View>
                <Text style={styles.infoTitle}>{sessionRestoreState === "OFFLINE" ? sessionRestoreStatus.title : session ? "حساب المريض متصل" : sessionRestoreStatus.title}</Text>
                <Text style={styles.infoCopy}>{sessionRestoreState === "OFFLINE" ? sessionRestoreStatus.description : session ? "تُجدّد جلسة الحساب تلقائياً برمز دوار محفوظ في تخزين الجهاز الآمن." : sessionRestoreStatus.description}</Text>
              </View>
            </View>
            {session ? <>
              <View style={styles.divider} />
              <View style={styles.syncStatusRow}><MaterialIcons name={sessionRestoreState === "OFFLINE" ? "sync-problem" : "sync"} size={18} color={sessionRestoreState === "OFFLINE" ? "#A44916" : "#0B776B"} /><Text style={styles.infoCopy}>{sessionRestoreState === "OFFLINE" ? sessionRestoreStatus.description : syncStatus}</Text></View>
              <Pressable onPress={refreshAccount} disabled={syncing} style={({ pressed }) => [styles.compactSecondary, styles.profileSyncButton, syncing && styles.disabledButton, pressed && styles.pressed]}><MaterialIcons name="sync" size={17} color="#41665D" /><Text style={styles.compactSecondaryText}>{sessionRestoreState === "OFFLINE" ? "إعادة محاولة استعادة الجلسة" : "تحديث بيانات الحساب"}</Text></Pressable>
            </> : null}
            <View style={styles.divider} />
            <Pressable onPress={() => setDiagnosticsOpen(true)} style={({ pressed }) => [styles.diagnosticsLink, pressed && styles.pressed]}><MaterialIcons name="network-check" size={18} color="#0B776B" /><Text style={styles.diagnosticsLinkText}>فحص الاتصال والمزامنة</Text><MaterialIcons name="arrow-back" size={17} color="#0B776B" /></Pressable>
            <View style={styles.divider} />
            <Pressable onPress={() => setReleaseChecklistOpen(true)} style={({ pressed }) => [styles.diagnosticsLink, pressed && styles.pressed]}><MaterialIcons name="fact-check" size={18} color="#0B776B" /><Text style={styles.diagnosticsLinkText}>قائمة تحقق الإصدار</Text><MaterialIcons name="arrow-back" size={17} color="#0B776B" /></Pressable>
            <View style={styles.divider} />
            <Pressable onPress={session ? signOut : signIn} disabled={syncing || !authReady} style={({ pressed }) => [styles.primaryButton, (syncing || !authReady) && styles.disabledButton, pressed && styles.pressed]}>{syncing || !authReady ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{session ? "تسجيل الخروج" : "تسجيل الدخول الآمن"}</Text>}</Pressable>
          </View>
          <Text style={styles.sectionTitle}>تحديث الحساب</Text>
          <View style={styles.infoCard}>
            <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.infoTitle}>تحديث عند فتح التطبيق</Text><Text style={styles.infoCopy}>يحدّث التطبيق الزيارات والتنبيهات المصرح بها عند عودتك إليه فقط، إذا كان الحساب متصلاً. لا يستخدم هذا الخيار مؤقتات أو تحديثات في الخلفية.</Text></View><Switch value={refreshOnResume} onValueChange={setRefreshOnResumePreference} trackColor={{ false: "#DCE9E4", true: "#8ED8C5" }} thumbColor={refreshOnResume ? "#0B776B" : "#F7FAF8"} /></View>
          </View>
          <Text style={styles.sectionTitle}>إعدادات التنبيهات</Text>
          <View style={styles.infoCard}>
            <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.infoTitle}>تنبيهات المواعيد</Text><Text style={styles.infoCopy}>{session ? "تصل من سجل التنبيهات المتزامن مع حسابك." : "ينشئ التطبيق تنبيهاً محلياً عند إضافة زيارة."}</Text></View><Switch value={notificationSettings.appointments} onValueChange={value => setNotificationSettings(current => ({ ...current, appointments: value }))} trackColor={{ false: "#DCE9E4", true: "#8ED8C5" }} thumbColor={notificationSettings.appointments ? "#0B776B" : "#F7FAF8"} /></View>
            <View style={styles.divider} />
            <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.infoTitle}>تنبيهات معلوماتية</Text><Text style={styles.infoCopy}>تسمح برسائل عامة صادرة عن العيادة دون نصيحة علاجية.</Text></View><Switch value={notificationSettings.medical} onValueChange={value => setNotificationSettings(current => ({ ...current, medical: value }))} trackColor={{ false: "#DCE9E4", true: "#8ED8C5" }} thumbColor={notificationSettings.medical ? "#0B776B" : "#F7FAF8"} /></View>
          </View>
          <Text style={styles.sectionTitle}>خصوصية الجهاز</Text>
          <View style={styles.infoCard}>
            <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.infoTitle}>حفظ سجل المزامنة محلياً</Text><Text style={styles.infoCopy}>{syncHistoryEnabled ? "يحفظ الجهاز آخر ثلاث نتائج عامة للمزامنة فقط. يمكنك مسحه أو إيقافه في أي وقت." : "تم إيقاف السجل وحذف نتائجه المحفوظة من هذا الجهاز."}</Text></View><Switch value={syncHistoryEnabled} onValueChange={setSyncHistoryPreference} trackColor={{ false: "#DCE9E4", true: "#8ED8C5" }} thumbColor={syncHistoryEnabled ? "#0B776B" : "#F7FAF8"} /></View>
            {syncHistoryEnabled ? <><View style={styles.divider} /><Text style={styles.retentionTitle}>مدة احتفاظ سجل المزامنة: {getPatientSyncHistoryRetentionLabel(syncHistoryRetention)}</Text><View style={styles.retentionOptions}>{patientSyncHistoryRetentions.map(retention => <Pressable key={retention} onPress={() => setSyncHistoryRetentionPreference(retention)} style={({ pressed }) => [styles.retentionOption, syncHistoryRetention === retention && styles.retentionOptionSelected, pressed && styles.pressed]}><Text style={[styles.retentionOptionText, syncHistoryRetention === retention && styles.retentionOptionTextSelected]}>{getPatientSyncHistoryRetentionLabel(retention)}</Text></Pressable>)}</View></> : null}
            <View style={styles.divider} />
            <Pressable onPress={() => setPrivacyInfoOpen(true)} style={({ pressed }) => [styles.privacyInfoLink, pressed && styles.pressed]}><MaterialIcons name="privacy-tip" size={18} color="#0B776B" /><Text style={styles.privacyInfoLinkText}>تفاصيل خصوصية البيانات</Text><MaterialIcons name="arrow-back" size={17} color="#0B776B" /></Pressable>
            <View style={styles.divider} />
            <Pressable onPress={confirmResetLocalPatientData} style={({ pressed }) => [styles.localDataDeleteButton, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={18} color="#A44916" /><Text style={styles.localDataDeleteButtonText}>حذف بيانات هذا الجهاز</Text></Pressable>
          </View>
        </View>
      }
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
      <Modal visible={privacyInfoOpen} animationType="slide" onRequestClose={() => setPrivacyInfoOpen(false)}>
        <SafeAreaView style={styles.privacyScreen}>
          <FlatList
            data={patientPrivacyInformation}
            keyExtractor={item => item.title}
            contentContainerStyle={styles.privacyListContent}
            ListHeaderComponent={<View><View style={styles.privacyHeader}><Pressable onPress={() => setPrivacyInfoOpen(false)} style={({ pressed }) => [styles.privacyCloseIcon, pressed && styles.pressed]} accessibilityLabel="العودة إلى الحساب"><MaterialIcons name="arrow-forward" size={23} color="#0B776B" /></Pressable><View style={styles.privacyHeaderCopy}><Text style={styles.privacyTitle}>خصوصية بياناتك</Text><Text style={styles.privacySubtitle}>شرح محلي موجز لما يحتفظ به تطبيق MediCare Pro Mobile على جهازك.</Text></View></View><View style={styles.privacyNotice}><MaterialIcons name="verified-user" size={20} color="#0B776B" /><Text style={styles.privacyNoticeText}>لا تعرض هذه الصفحة أي سجلات مريض أو تفاصيل زيارة أو معلومات صحية.</Text></View></View>}
            renderItem={({ item }) => <View style={styles.privacySection}><Text style={styles.privacySectionTitle}>{item.title}</Text><Text style={styles.privacySectionBody}>{item.body}</Text></View>}
            ListFooterComponent={<Pressable onPress={() => setPrivacyInfoOpen(false)} style={({ pressed }) => [styles.primaryButton, styles.privacyDoneButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>العودة إلى الحساب</Text></Pressable>}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
      <Modal visible={diagnosticsOpen} animationType="slide" onRequestClose={() => setDiagnosticsOpen(false)}>
        <SafeAreaView style={styles.diagnosticsScreen}>
          <FlatList
            data={connectionDiagnostic.checks}
            keyExtractor={item => item.label}
            contentContainerStyle={styles.diagnosticsListContent}
            ListHeaderComponent={<View><View style={styles.diagnosticsHeader}><Pressable onPress={() => setDiagnosticsOpen(false)} style={({ pressed }) => [styles.privacyCloseIcon, pressed && styles.pressed]} accessibilityLabel="العودة إلى الحساب"><MaterialIcons name="arrow-forward" size={23} color="#0B776B" /></Pressable><View style={styles.privacyHeaderCopy}><Text style={styles.privacyTitle}>فحص الاتصال</Text><Text style={styles.privacySubtitle}>ملخص مبسط لحالة الحساب والمزامنة على هذا الجهاز.</Text></View></View><View style={[styles.diagnosticSummary, connectionDiagnostic.tone === "ATTENTION" && styles.diagnosticSummaryAttention]}><MaterialIcons name={connectionDiagnostic.tone === "ATTENTION" ? "error-outline" : connectionDiagnostic.tone === "OK" ? "check-circle-outline" : "sync"} size={22} color={connectionDiagnostic.tone === "ATTENTION" ? "#A44916" : "#0B776B"} /><View style={styles.diagnosticSummaryCopy}><Text style={styles.diagnosticSummaryTitle}>{connectionDiagnostic.overallTitle}</Text><Text style={styles.diagnosticSummaryText}>{connectionDiagnostic.overallDescription}</Text></View></View></View>}
            renderItem={({ item }) => <View style={styles.diagnosticCheck}><MaterialIcons name={item.tone === "ATTENTION" ? "error-outline" : item.tone === "OK" ? "check-circle-outline" : "info-outline"} size={20} color={item.tone === "ATTENTION" ? "#A44916" : item.tone === "OK" ? "#0B776B" : "#668179"} /><View style={styles.diagnosticCheckCopy}><Text style={styles.diagnosticCheckLabel}>{item.label}</Text><Text style={styles.diagnosticCheckValue}>{item.value}</Text></View></View>}
            ListFooterComponent={<Pressable onPress={() => { setDiagnosticsOpen(false); session ? void refreshAccount() : void signIn(); }} disabled={syncing} style={({ pressed }) => [styles.primaryButton, styles.diagnosticsAction, syncing && styles.disabledButton, pressed && styles.pressed]}>{syncing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{session ? "تحديث بيانات الحساب" : "تسجيل الدخول الآمن"}</Text>}</Pressable>}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
      <Modal visible={releaseChecklistOpen} animationType="slide" onRequestClose={() => setReleaseChecklistOpen(false)}>
        <SafeAreaView style={styles.releaseChecklistScreen}>
          <FlatList
            data={patientReleaseChecklist}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.diagnosticsListContent}
            ListHeaderComponent={<View><View style={styles.diagnosticsHeader}><Pressable onPress={() => setReleaseChecklistOpen(false)} style={({ pressed }) => [styles.privacyCloseIcon, pressed && styles.pressed]} accessibilityLabel="العودة إلى الحساب"><MaterialIcons name="arrow-forward" size={23} color="#0B776B" /></Pressable><View style={styles.privacyHeaderCopy}><Text style={styles.privacyTitle}>تحقق قبل إصدار APK</Text><Text style={styles.privacySubtitle}>قائمة موجزة تحدد ما تم في بيئة التطوير وما يجب اختباره على جهاز Android.</Text></View></View><View style={styles.releaseChecklistNotice}><MaterialIcons name="info-outline" size={20} color="#31584F" /><Text style={styles.releaseChecklistNoticeText}>لا تعني عناصر القائمة أن اختبار الجهاز تم بالفعل. أكمل العناصر المطلوبة على جهاز أو محاكي قبل التوزيع.</Text></View></View>}
            renderItem={({ item, index }) => { const trackable = isReleaseChecklistItemTrackable(item); const completedAt = releaseChecklistProgress[item.id]; const isCompleted = Boolean(completedAt); return <View>{index === 0 || patientReleaseChecklist[index - 1]?.section !== item.section ? <Text style={styles.releaseSectionTitle}>{item.section}</Text> : null}<Pressable disabled={!trackable} onPress={() => toggleReleaseChecklistItem(item.id)} style={({ pressed }) => [styles.releaseChecklistItem, trackable && styles.releaseChecklistItemTrackable, isCompleted && styles.releaseChecklistItemCompleted, pressed && trackable && styles.pressed]}><MaterialIcons name={isCompleted ? "check-circle" : item.status === "VERIFIED" ? "check-circle-outline" : item.status === "DEVICE_REQUIRED" ? "phone-android" : "assignment-late"} size={21} color={isCompleted || item.status === "VERIFIED" ? "#0B776B" : item.status === "DEVICE_REQUIRED" ? "#3B5E9B" : "#A44916"} /><View style={styles.releaseChecklistCopy}><Text style={styles.releaseChecklistTitle}>{item.title}</Text><Text style={styles.releaseChecklistDescription}>{item.description}</Text><Text style={[styles.releaseChecklistStatus, isCompleted || item.status === "VERIFIED" ? styles.releaseChecklistStatusVerified : item.status === "DEVICE_REQUIRED" ? styles.releaseChecklistStatusDevice : styles.releaseChecklistStatusRelease]}>{isCompleted ? `تأشير محلي: ${new Date(completedAt).toLocaleDateString("ar-SA")}` : getReleaseChecklistStatusLabel(item.status as ReleaseChecklistStatus)}</Text>{trackable ? <Text style={styles.releaseChecklistHint}>{isCompleted ? "اضغط لإلغاء التأشير المحلي" : "اضغط بعد إكمال الاختبار على جهازك"}</Text> : null}</View></Pressable></View>; }}
            ListFooterComponent={<View>{Object.keys(releaseChecklistProgress).length ? <Pressable onPress={clearReleaseChecklistProgress} style={({ pressed }) => [styles.releaseChecklistReset, pressed && styles.pressed]}><Text style={styles.releaseChecklistResetText}>إعادة ضبط التأشير المحلي</Text></Pressable> : null}<Pressable onPress={() => setReleaseChecklistOpen(false)} style={({ pressed }) => [styles.primaryButton, styles.diagnosticsAction, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>العودة إلى الحساب</Text></Pressable></View>}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
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
  retryButton: { alignItems: "center", backgroundColor: "#FFF4DF", borderColor: "#F0C98E", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 10, minHeight: 44, paddingHorizontal: 14 },
  retryButtonText: { color: "#A44916", fontSize: 13, fontWeight: "800" },
  upcomingVisitCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 12, padding: 15 },
  upcomingVisitIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  upcomingVisitCopy: { flex: 1 },
  upcomingVisitEyebrow: { color: "#0B776B", fontSize: 11, fontWeight: "800", textAlign: "right" },
  upcomingVisitTitle: { color: "#244C43", fontSize: 15, fontWeight: "800", marginTop: 4, textAlign: "right" },
  upcomingVisitMeta: { color: "#668179", fontSize: 12, marginTop: 3, textAlign: "right" },
  upcomingVisitEmpty: { color: "#6B857C", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" },
  syncHistoryCard: { backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 15 },
  syncHistoryHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  syncHistoryTitle: { color: "#244C43", fontSize: 14, fontWeight: "800" },
  clearHistoryButton: { paddingHorizontal: 4, paddingVertical: 3 },
  clearHistoryButtonText: { color: "#0B776B", fontSize: 12, fontWeight: "800" },
  syncHistoryRow: { alignItems: "center", borderTopColor: "#E6EFEB", borderTopWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 11, paddingTop: 11 },
  syncHistoryCopy: { flex: 1 },
  syncHistoryEntryTitle: { color: "#41665D", fontSize: 12, fontWeight: "700", textAlign: "right" },
  syncHistoryEntryTime: { color: "#8A9E98", fontSize: 11, marginTop: 2, textAlign: "right" },
  syncHistoryEmpty: { color: "#6B857C", fontSize: 12, lineHeight: 19, marginTop: 11, textAlign: "right" },
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
  listHeaderActions: { flexDirection: "row-reverse", gap: 8, marginTop: 6 },
  visitFilterRow: { flexDirection: "row-reverse", gap: 7, marginBottom: 16, marginTop: -8 },
  visitSearchInput: { backgroundColor: "#FFFFFF", borderColor: "#CDE2D9", borderRadius: 13, borderWidth: 1, color: "#244C43", fontSize: 13, marginBottom: 15, minHeight: 44, paddingHorizontal: 13 },
  visitFilterButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CDE2D9", borderRadius: 11, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: 5 },
  visitFilterButtonSelected: { backgroundColor: "#E6F5F2", borderColor: "#0B776B" },
  visitFilterText: { color: "#668179", fontSize: 11, fontWeight: "800" },
  visitFilterTextSelected: { color: "#0B776B" },
  iconAction: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 14, height: 46, justifyContent: "center", marginTop: 6, width: 46 },
  syncAction: { backgroundColor: "#EFF9F5", borderColor: "#CDE7DC", borderWidth: 1 },
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
  privacyInfoLink: { alignItems: "center", flexDirection: "row-reverse", gap: 8, justifyContent: "space-between", minHeight: 38 },
  privacyInfoLinkText: { color: "#0B776B", flex: 1, fontSize: 13, fontWeight: "800", textAlign: "right" },
  diagnosticsLink: { alignItems: "center", flexDirection: "row-reverse", gap: 8, justifyContent: "space-between", minHeight: 38 },
  diagnosticsLinkText: { color: "#0B776B", flex: 1, fontSize: 13, fontWeight: "800", textAlign: "right" },
  retentionTitle: { color: "#41665D", fontSize: 12, fontWeight: "800", textAlign: "right" },
  retentionOptions: { flexDirection: "row-reverse", gap: 7, marginTop: 10 },
  retentionOption: { alignItems: "center", borderColor: "#CDE2D9", borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 36, justifyContent: "center", paddingHorizontal: 6 },
  retentionOptionSelected: { backgroundColor: "#E6F5F2", borderColor: "#0B776B" },
  retentionOptionText: { color: "#668179", fontSize: 11, fontWeight: "800" },
  retentionOptionTextSelected: { color: "#0B776B" },
  localDataDeleteButton: { alignItems: "center", backgroundColor: "#FFF8EF", borderColor: "#F0C98E", borderRadius: 11, borderWidth: 1, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 42, paddingHorizontal: 12 },
  localDataDeleteButtonText: { color: "#A44916", fontSize: 13, fontWeight: "800" },
  privacyScreen: { backgroundColor: "#F6FAF8", flex: 1 },
  privacyListContent: { padding: 20, paddingBottom: 32 },
  privacyHeader: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12 },
  privacyCloseIcon: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 14, height: 46, justifyContent: "center", width: 46 },
  privacyHeaderCopy: { flex: 1 },
  privacyTitle: { color: "#173E37", fontSize: 26, fontWeight: "800", textAlign: "right" },
  privacySubtitle: { color: "#668179", fontSize: 13, lineHeight: 21, marginTop: 6, textAlign: "right" },
  privacyNotice: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 16, flexDirection: "row-reverse", gap: 9, marginTop: 22, padding: 14 },
  privacyNoticeText: { color: "#31584F", flex: 1, fontSize: 12, lineHeight: 19, textAlign: "right" },
  privacySection: { backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 16 },
  privacySectionTitle: { color: "#244C43", fontSize: 15, fontWeight: "800", textAlign: "right" },
  privacySectionBody: { color: "#668179", fontSize: 13, lineHeight: 21, marginTop: 7, textAlign: "right" },
  privacyDoneButton: { marginTop: 20 },
  diagnosticsScreen: { backgroundColor: "#F6FAF8", flex: 1 },
  diagnosticsListContent: { padding: 20, paddingBottom: 32 },
  diagnosticsHeader: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12 },
  diagnosticSummary: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 16, flexDirection: "row-reverse", gap: 10, marginTop: 22, padding: 15 },
  diagnosticSummaryAttention: { backgroundColor: "#FFF4DF" },
  diagnosticSummaryCopy: { flex: 1 },
  diagnosticSummaryTitle: { color: "#244C43", fontSize: 15, fontWeight: "800", textAlign: "right" },
  diagnosticSummaryText: { color: "#5E786F", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" },
  diagnosticCheck: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 11, marginTop: 11, padding: 15 },
  diagnosticCheckCopy: { flex: 1 },
  diagnosticCheckLabel: { color: "#244C43", fontSize: 13, fontWeight: "800", textAlign: "right" },
  diagnosticCheckValue: { color: "#668179", fontSize: 12, lineHeight: 19, marginTop: 3, textAlign: "right" },
  diagnosticsAction: { marginTop: 20 },
  releaseChecklistScreen: { backgroundColor: "#F6FAF8", flex: 1 },
  releaseChecklistNotice: { alignItems: "center", backgroundColor: "#E6F5F2", borderRadius: 16, flexDirection: "row-reverse", gap: 9, marginTop: 22, padding: 14 },
  releaseChecklistNoticeText: { color: "#31584F", flex: 1, fontSize: 12, lineHeight: 19, textAlign: "right" },
  releaseSectionTitle: { color: "#244C43", fontSize: 15, fontWeight: "800", marginTop: 20, textAlign: "right" },
  releaseChecklistItem: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#DCEAE5", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 11, marginTop: 10, padding: 15 },
  releaseChecklistItemTrackable: { borderColor: "#BEDBD0" },
  releaseChecklistItemCompleted: { backgroundColor: "#F0FBF6", borderColor: "#71BFA8" },
  releaseChecklistCopy: { flex: 1 },
  releaseChecklistTitle: { color: "#244C43", fontSize: 13, fontWeight: "800", textAlign: "right" },
  releaseChecklistDescription: { color: "#668179", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" },
  releaseChecklistStatus: { alignSelf: "flex-end", borderRadius: 9, fontSize: 10, fontWeight: "800", marginTop: 8, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  releaseChecklistStatusVerified: { backgroundColor: "#E6F5F2", color: "#0B776B" },
  releaseChecklistStatusDevice: { backgroundColor: "#EAF0FC", color: "#3B5E9B" },
  releaseChecklistStatusRelease: { backgroundColor: "#FFF4DF", color: "#A44916" },
  releaseChecklistHint: { color: "#6B857C", fontSize: 10, marginTop: 7, textAlign: "right" },
  releaseChecklistReset: { alignItems: "center", borderColor: "#CDE2D9", borderRadius: 12, borderWidth: 1, justifyContent: "center", marginTop: 20, minHeight: 44 },
  releaseChecklistResetText: { color: "#41665D", fontSize: 13, fontWeight: "800" },
  syncStatusRow: { alignItems: "center", flexDirection: "row-reverse", gap: 8 },
  profileSyncButton: { flex: 0, flexDirection: "row-reverse", gap: 7, marginTop: 14, paddingHorizontal: 12 },
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
