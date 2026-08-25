import { describe, expect, it } from "vitest";
import { createLocalVisit } from "./clinic";
import {
  countUnreadNotifications,
  createAppointmentNotification,
  createMedicalInfoNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications";

describe("clinic notifications", () => {
  it("creates an unread appointment notice linked to its visit", () => {
    const visit = createLocalVisit({ clinicName: "عيادة الحياة", serviceName: "زيارة منزلية" }, 100);
    const notice = createAppointmentNotification(visit, 200);

    expect(notice).toMatchObject({
      category: "APPOINTMENT",
      read: false,
      visitId: visit.id,
      createdAt: 200,
    });
    expect(notice.body).toContain("عيادة الحياة");
  });

  it("keeps the medical notice informational and counts only unread notices", () => {
    const medical = createMedicalInfoNotification(300);
    const appointment = { ...medical, id: "N-2", category: "APPOINTMENT" as const, read: true };

    expect(medical.category).toBe("MEDICAL");
    expect(medical.body).toContain("فريق الرعاية");
    expect(countUnreadNotifications([medical, appointment])).toBe(1);
  });

  it("marks selected or all notifications as read without deleting the audit trail", () => {
    const first = createMedicalInfoNotification(1);
    const second = createMedicalInfoNotification(2);
    const selected = markNotificationRead([first, second], first.id);

    expect(selected).toHaveLength(2);
    expect(selected[0]?.read).toBe(true);
    expect(selected[1]?.read).toBe(false);
    expect(markAllNotificationsRead(selected).every(notification => notification.read)).toBe(true);
  });
});
