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

const STORAGE_KEY = "medicare-pro-mobile-local-data-v1";

type Preferences = {
  appointmentAlerts: boolean;
  medicalAlerts: boolean;
};

type PersistedState = {
  visits: ClinicVisit[];
  notifications: ClinicNotification[];
  preferences: Preferences;
};

type MediCareContextValue = PersistedState & {
  ready: boolean;
  unreadCount: number;
  addVisit: (clinicName: string, serviceName: string) => void;
  advanceVisitStatus: (visitId: string) => void;
  addMedicalNotification: () => boolean;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  setAppointmentAlerts: (enabled: boolean) => void;
  setMedicalAlerts: (enabled: boolean) => void;
  resetLocalData: () => void;
};

const defaultState: PersistedState = {
  visits: [],
  notifications: [],
  preferences: {
    appointmentAlerts: true,
    medicalAlerts: true,
  },
};

const MediCareContext = createContext<MediCareContextValue | null>(null);

function isPersistedState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedState>;
  return Array.isArray(candidate.visits) && Array.isArray(candidate.notifications) && Boolean(candidate.preferences);
}

export function MediCareProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (isPersistedState(parsed)) {
          setState({
            visits: parsed.visits,
            notifications: parsed.notifications,
            preferences: {
              appointmentAlerts: parsed.preferences.appointmentAlerts !== false,
              medicalAlerts: parsed.preferences.medicalAlerts !== false,
            },
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const updateState = useCallback((updater: (current: PersistedState) => PersistedState) => {
    setState((current) => {
      const next = updater(current);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const addVisit = useCallback(
    (clinicName: string, serviceName: string) => {
      const visit = createVisit(clinicName, serviceName);
      updateState((current) => ({
        ...current,
        visits: [visit, ...current.visits],
        notifications: current.preferences.appointmentAlerts
          ? [createAppointmentNotification(visit), ...current.notifications]
          : current.notifications,
      }));
    },
    [updateState],
  );

  const advanceVisitStatus = useCallback(
    (visitId: string) => {
      updateState((current) => ({
        ...current,
        visits: current.visits.map((visit) => (visit.id === visitId ? advanceVisit(visit) : visit)),
      }));
    },
    [updateState],
  );

  const addMedicalNotification = useCallback(() => {
    if (!state.preferences.medicalAlerts) return false;
    const notification = createMedicalNotification();
    updateState((current) => ({ ...current, notifications: [notification, ...current.notifications] }));
    return true;
  }, [state.preferences.medicalAlerts, updateState]);

  const markNotificationRead = useCallback(
    (notificationId: string) => {
      updateState((current) => ({
        ...current,
        notifications: current.notifications.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification,
        ),
      }));
    },
    [updateState],
  );

  const markAllNotificationsRead = useCallback(() => {
    updateState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) => ({ ...notification, read: true })),
    }));
  }, [updateState]);

  const setAppointmentAlerts = useCallback(
    (enabled: boolean) => {
      updateState((current) => ({ ...current, preferences: { ...current.preferences, appointmentAlerts: enabled } }));
    },
    [updateState],
  );

  const setMedicalAlerts = useCallback(
    (enabled: boolean) => {
      updateState((current) => ({ ...current, preferences: { ...current.preferences, medicalAlerts: enabled } }));
    },
    [updateState],
  );

  const resetLocalData = useCallback(() => {
    setState(defaultState);
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  const value = useMemo<MediCareContextValue>(
    () => ({
      ...state,
      ready,
      unreadCount: state.notifications.filter((notification) => !notification.read).length,
      addVisit,
      advanceVisitStatus,
      addMedicalNotification,
      markNotificationRead,
      markAllNotificationsRead,
      setAppointmentAlerts,
      setMedicalAlerts,
      resetLocalData,
    }),
    [addMedicalNotification, addVisit, advanceVisitStatus, markAllNotificationsRead, markNotificationRead, ready, resetLocalData, setAppointmentAlerts, setMedicalAlerts, state],
  );

  return <MediCareContext.Provider value={value}>{children}</MediCareContext.Provider>;
}

export function useMediCare() {
  const context = useContext(MediCareContext);
  if (!context) throw new Error("useMediCare must be used inside MediCareProvider");
  return context;
}
