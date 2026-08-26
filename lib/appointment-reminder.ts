export const REMINDER_LEAD_OPTIONS = [60, 120, 1440] as const;

export type ReminderLeadMinutes = (typeof REMINDER_LEAD_OPTIONS)[number];

export function isReminderLeadMinutes(value: unknown): value is ReminderLeadMinutes {
  return typeof value === "number" && REMINDER_LEAD_OPTIONS.includes(value as ReminderLeadMinutes);
}

export function getReminderLabel(minutes: ReminderLeadMinutes): string {
  if (minutes === 60) return "قبل ساعة";
  if (minutes === 120) return "قبل ساعتين";
  return "قبل يوم";
}

export function getReminderTimestamp(scheduledStart: number, leadMinutes: ReminderLeadMinutes, now = Date.now()): number | null {
  const reminderAt = scheduledStart - leadMinutes * 60 * 1000;
  return reminderAt > now + 30_000 ? reminderAt : null;
}
