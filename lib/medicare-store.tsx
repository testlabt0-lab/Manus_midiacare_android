import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  advanceVisit,
  createAppointmentNotification,
  createMedicalNotification,
  createVisit,
  type ClinicNotification,
  type ClinicVisit,
} from "@/lib/medicare-domain";
import {
  clearPatientSession,
  createRemoteVisit,
  listRemoteNotifications,
  listRemoteVisits,
  loadPatientSession,
  markRemoteNotificationRead,
  registerRemotePushToken,
  renewPatientSession,
  startPatientLogin,
  type PatientSession,
} from "@/lib/patient-api";
import { activateAppointmentNotifications, syncAppointmentReminders, type NotificationActivation } from "@/lib/appointment-notifications";

const STORAGE_KEY = "medicare-pro-mobile-local-data-v2";
const SYNC_HISTORY_KEY = "medicare-pro-mobile-sync-history-v1";

type Preferences = {
  appointmentAlerts: boolean;
  medicalAlerts: boolean;
};

type PersistedState = {
  localVisits: ClinicVisit[];
  localNotifications: ClinicNotification[];
  preferences: Preferences;
};

export type ConnectionState = "LOCAL" | "CONNECTING" | "CONNECTED" | "OFFLINE" | "ERROR";

export type SyncEvent = {
  id: string;
  at: number;
  outcome: "SUCCESS" | "ERROR" | "OFFLINE";
  label: string;
};

type MediCareContextValue = {
  visits: ClinicVisit[];
  notifications: ClinicNotification[];
  preferences: Preferences;
  ready: boolean;
  unreadCount: number;
  connection: ConnectionState;
  connectionError: string | null;
  session: PatientSession | null;
  lastSyncedAt: number | null;
  syncHistory: SyncEvent[];
  addVisit: (input: { clinicName: string; serviceName: string; districtLabel?: string; scheduledStart?: string }) => Promise<void>;
  advanceVisitStatus: (visitId: string) => void;
  addMedicalNotification: () => boolean;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  setAppointmentAlerts: (enabled: boolean) => void;
  setMedicalAlerts: (enabled: boolean) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  sync: (silent?: boolean) => Promise<void>;
  enableDeviceNotifications: () => Promise<NotificationActivation>;
  resetLocalData: () => void;
};

const defaultState: PersistedState = {
  localVisits: [],
  localNotifications: [],
  preferences: { appointmentAlerts: true, medicalAlerts: true },
};

const MediCareContext = createContext<MediCareContextValue | null>(null);

function isPersistedState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedState>;
  return Array.isArray(candidate.localVisits) && Array.isArray(candidate.localNotifications) && Boolean(candidate.preferences);
}

function parseSyncHistory(value: string | null): SyncEvent[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as SyncEvent[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item?.at === "number" && typeof item?.label === "string" && ["SUCCESS", "ERROR", "OFFLINE"].includes(item.outcome)).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export function MediCareProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [remoteVisits, setRemoteVisits] = useState<ClinicVisit[]>([]);
  const [remoteNotifications, setRemoteNotifications] = useState<ClinicNotification[]>([]);
  const [session, setSession] = useState<PatientSession | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("LOCAL");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncEvent[]>([]);
  const [ready, setReady] = useState(false);

  const updateState = useCallback((updater: (current: PersistedState) => PersistedState) => {
    setState((current) => {
      const next = updater(current);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const recordSync = useCallback((outcome: SyncEvent["outcome"], label: string) => {
    setSyncHistory((current) => {
      const at = Date.now();
      const next = [{ id: `${at}-${outcome}`, at, outcome, label }, ...current].slice(0, 5);
      void AsyncStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const syncWithSession = useCallback(async (activeSession: PatientSession, silent = false) => {
    setConnection("CONNECTING");
    setConnectionError(null);
    try {
      const renewed = await renewPatientSession(activeSession);
      const [nextVisits, nextNotifications] = await Promise.all([
        listRemoteVisits(renewed),
        listRemoteNotifications(renewed),
      ]);
      setSession(renewed);
      setRemoteVisits(nextVisits);
      setRemoteNotifications(nextNotifications);
      setLastSyncedAt(Date.now());
      setConnection("CONNECTED");
      recordSync("SUCCESS", "تم تحديث زيارات وتنبيهات حساب المريض.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تحديث بيانات الحساب.";
      setConnectionError(message);
      setConnection(silent ? "OFFLINE" : "ERROR");
      recordSync(silent ? "OFFLINE" : "ERROR", message);
      if (/انتهت جلسة الحساب|سجّل الدخول/.test(message)) {
        setSession(null);
        setRemoteVisits([]);
        setRemoteNotifications([]);
      }
      throw error;
    }
  }, [recordSync]);

  useEffect(() => {
    void Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(SYNC_HISTORY_KEY), loadPatientSession()])
      .then(async ([saved, storedHistory, restoredSession]) => {
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isPersistedState(parsed)) {
            setState({
              localVisits: parsed.localVisits,
              localNotifications: parsed.localNotifications,
              preferences: {
                appointmentAlerts: parsed.preferences.appointmentAlerts !== false,
                medicalAlerts: parsed.preferences.medicalAlerts !== false,
              },
            });
          }
        }
        setSyncHistory(parseSyncHistory(storedHistory));
        if (restoredSession) {
          setSession(restoredSession);
          await syncWithSession(restoredSession, true).catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [syncWithSession]);

  const login = useCallback(async () => {
    setConnection("CONNECTING");
    setConnectionError(null);
    try {
      const nextSession = await startPatientLogin();
      setSession(nextSession);
      await syncWithSession(nextSession);
    } catch (error) {
      setConnection("LOCAL");
      setConnectionError(error instanceof Error ? error.message : "تعذر تسجيل الدخول.");
      throw error;
    }
  }, [syncWithSession]);

  const logout = useCallback(async () => {
    await clearPatientSession();
    setSession(null);
    setRemoteVisits([]);
    setRemoteNotifications([]);
    setConnection("LOCAL");
    setConnectionError(null);
    setLastSyncedAt(null);
  }, []);

  const sync = useCallback(async (silent = false) => {
    if (!session) return;
    await syncWithSession(session, silent);
  }, [session, syncWithSession]);

  const addVisit = useCallback(async (input: { clinicName: string; serviceName: string; districtLabel?: string; scheduledStart?: string }) => {
    if (session) {
      if (!input.districtLabel?.trim() || !input.scheduledStart?.trim()) {
        throw new Error("أدخل الحي وتاريخ ووقت موعد الزيارة عند استخدام حساب المريض.");
      }
      setConnection("CONNECTING");
      const renewed = await renewPatientSession(session);
      const visit = await createRemoteVisit(renewed, {
        clinicName: input.clinicName,
        serviceName: input.serviceName,
        districtLabel: input.districtLabel,
        scheduledStart: input.scheduledStart,
      });
      setSession(renewed);
      setRemoteVisits((current) => [visit, ...current.filter((item) => item.id !== visit.id)]);
      setConnection("CONNECTED");
      setLastSyncedAt(Date.now());
      recordSync("SUCCESS", "تم إرسال طلب زيارة جديد إلى الحساب.");
      return;
    }

    const visit = createVisit(input.clinicName, input.serviceName);
    updateState((current) => ({
      ...current,
      localVisits: [visit, ...current.localVisits],
      localNotifications: current.preferences.appointmentAlerts
        ? [createAppointmentNotification(visit), ...current.localNotifications]
        : current.localNotifications,
    }));
  }, [recordSync, session, updateState]);

  const advanceVisitStatus = useCallback((visitId: string) => {
    updateState((current) => ({
      ...current,
      localVisits: current.localVisits.map((visit) => (visit.id === visitId ? advanceVisit(visit) : visit)),
    }));
  }, [updateState]);

  const addMedicalNotification = useCallback(() => {
    if (!state.preferences.medicalAlerts) return false;
    const notification = createMedicalNotification();
    updateState((current) => ({ ...current, localNotifications: [notification, ...current.localNotifications] }));
    return true;
  }, [state.preferences.medicalAlerts, updateState]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    if (notificationId.startsWith("WEB-N-") && session) {
      const renewed = await renewPatientSession(session);
      await markRemoteNotificationRead(renewed, notificationId);
      setSession(renewed);
      setRemoteNotifications((current) => current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
      return;
    }
    updateState((current) => ({
      ...current,
      localNotifications: current.localNotifications.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    }));
  }, [session, updateState]);

  const markAllNotificationsRead = useCallback(async () => {
    const remoteUnread = remoteNotifications.filter((item) => !item.read);
    for (const notification of remoteUnread) await markNotificationRead(notification.id);
    updateState((current) => ({
      ...current,
      localNotifications: current.localNotifications.map((item) => ({ ...item, read: true })),
    }));
  }, [markNotificationRead, remoteNotifications, updateState]);

  const setAppointmentAlerts = useCallback((enabled: boolean) => {
    updateState((current) => ({ ...current, preferences: { ...current.preferences, appointmentAlerts: enabled } }));
  }, [updateState]);

  const setMedicalAlerts = useCallback((enabled: boolean) => {
    updateState((current) => ({ ...current, preferences: { ...current.preferences, medicalAlerts: enabled } }));
  }, [updateState]);

  const resetLocalData = useCallback(() => {
    setState(defaultState);
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  const visits = useMemo(() => [...remoteVisits, ...state.localVisits].sort((left, right) => right.createdAt - left.createdAt), [remoteVisits, state.localVisits]);
  const notifications = useMemo(() => [...remoteNotifications, ...state.localNotifications].sort((left, right) => right.createdAt - left.createdAt), [remoteNotifications, state.localNotifications]);

  useEffect(() => {
    void syncAppointmentReminders(visits, state.preferences.appointmentAlerts);
  }, [state.preferences.appointmentAlerts, visits]);

  const enableDeviceNotifications = useCallback(async () => {
    const activation = await activateAppointmentNotifications(async (expoPushToken) => {
      if (!session) return;
      const renewed = await renewPatientSession(session);
      await registerRemotePushToken(renewed, expoPushToken);
      setSession(renewed);
    });
    if (activation.status === "enabled") {
      await syncAppointmentReminders(visits, state.preferences.appointmentAlerts);
    }
    return activation;
  }, [session, state.preferences.appointmentAlerts, visits]);

  const value = useMemo<MediCareContextValue>(() => ({
    visits,
    notifications,
    preferences: state.preferences,
    ready,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    connection,
    connectionError,
    session,
    lastSyncedAt,
    syncHistory,
    addVisit,
    advanceVisitStatus,
    addMedicalNotification,
    markNotificationRead,
    markAllNotificationsRead,
    setAppointmentAlerts,
    setMedicalAlerts,
    login,
    logout,
    sync,
    enableDeviceNotifications,
    resetLocalData,
  }), [addMedicalNotification, addVisit, advanceVisitStatus, connection, connectionError, enableDeviceNotifications, lastSyncedAt, login, logout, markAllNotificationsRead, markNotificationRead, notifications, ready, resetLocalData, session, setAppointmentAlerts, setMedicalAlerts, state.preferences, sync, syncHistory, visits]);

  return <MediCareContext.Provider value={value}>{children}</MediCareContext.Provider>;
}

export function useMediCare() {
  const context = useContext(MediCareContext);
  if (!context) throw new Error("useMediCare must be used inside MediCareProvider");
  return context;
}
