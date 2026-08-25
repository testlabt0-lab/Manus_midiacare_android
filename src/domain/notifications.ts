import type { ClinicVisit } from "./clinic";

export type NotificationCategory = "APPOINTMENT" | "MEDICAL";

export type ClinicNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  visitId?: string;
};

export function createAppointmentNotification(visit: ClinicVisit, now = Date.now()): ClinicNotification {
  return {
    id: `N-${visit.id}-${now.toString(36).toUpperCase()}`,
    category: "APPOINTMENT",
    title: "تمت إضافة زيارة جديدة",
    body: `${visit.serviceName} · ${visit.clinicName}. راجع مسارها من شاشة التشغيل.`,
    createdAt: now,
    read: false,
    visitId: visit.id,
  };
}

export function createMedicalInfoNotification(now = Date.now()): ClinicNotification {
  return {
    id: `N-MED-${now.toString(36).toUpperCase()}`,
    category: "MEDICAL",
    title: "تنبيه معلوماتي من العيادة",
    body: "لأي استفسار حول الرعاية، راجع تعليمات العيادة أو تواصل مع فريق الرعاية المخوّل.",
    createdAt: now,
    read: false,
  };
}

export function markNotificationRead(notifications: ClinicNotification[], id: string) {
  return notifications.map(notification => notification.id === id ? { ...notification, read: true } : notification);
}

export function markAllNotificationsRead(notifications: ClinicNotification[]) {
  return notifications.map(notification => notification.read ? notification : { ...notification, read: true });
}

export function countUnreadNotifications(notifications: ClinicNotification[]) {
  return notifications.filter(notification => !notification.read).length;
}
