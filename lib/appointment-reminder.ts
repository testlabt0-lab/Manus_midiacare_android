const REMINDER_LEAD_TIME_MS = 60 * 60 * 1000;

export function getReminderTimestamp(scheduledStart: number, now = Date.now()): number | null {
  const reminderAt = scheduledStart - REMINDER_LEAD_TIME_MS;
  return reminderAt > now + 30_000 ? reminderAt : null;
}
