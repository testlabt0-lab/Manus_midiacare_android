import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { ClinicVisit } from "@/lib/medicare-domain";
import { getReminderLabel, getReminderTimestamp, type ReminderLeadMinutes } from "@/lib/appointment-reminder";

const APPOINTMENTS_CHANNEL = "appointments";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationActivation = {
  status: "enabled" | "denied" | "device-required" | "build-required" | "unavailable";
  expoPushToken?: string;
};

export async function configureAppointmentChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(APPOINTMENTS_CHANNEL, {
    name: "مواعيد MediCare Pro",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: "#0B776B",
  });
}

async function requestPermission() {
  await configureAppointmentChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function activateAppointmentNotifications(
  registerToken?: (token: string) => Promise<void>,
): Promise<NotificationActivation> {
  if (Platform.OS === "web") return { status: "unavailable" };
  if (!Device.isDevice) return { status: "device-required" };
  const granted = await requestPermission();
  if (!granted) return { status: "denied" };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { status: "build-required" };

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerToken?.(expoPushToken).catch(() => undefined);
  return { status: "enabled", expoPushToken };
}

export async function syncAppointmentReminders(visits: ClinicVisit[], enabled: boolean, leadMinutes: ReminderLeadMinutes) {
  if (Platform.OS === "web" || !enabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;

  await configureAppointmentChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const eligibleVisits = visits.filter((visit) => typeof visit.scheduledStart === "number" && visit.status !== "COMPLETED" && visit.status !== "CANCELLED");

  await Promise.all(eligibleVisits.map(async (visit) => {
    const reminderAt = getReminderTimestamp(visit.scheduledStart as number, leadMinutes, now);
    if (!reminderAt) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "تذكير بموعد MediCare Pro",
        body: `لديك ${visit.serviceName} لدى ${visit.clinicName} ${getReminderLabel(leadMinutes)}.`,
        data: { url: "/visits", visitId: visit.id },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderAt),
        channelId: APPOINTMENTS_CHANNEL,
      },
    });
  }));
}
