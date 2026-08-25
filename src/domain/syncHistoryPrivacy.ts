import type { PatientSyncHistoryEntry } from "./syncHistory";

export const patientSyncHistoryRetentions = ["1_DAY", "7_DAYS", "30_DAYS"] as const;
export type PatientSyncHistoryRetention = typeof patientSyncHistoryRetentions[number];

const retentionDurations: Record<PatientSyncHistoryRetention, number> = {
  "1_DAY": 24 * 60 * 60 * 1000,
  "7_DAYS": 7 * 24 * 60 * 60 * 1000,
  "30_DAYS": 30 * 24 * 60 * 60 * 1000,
};

export function resolvePatientSyncHistoryPreference(enabled: boolean, entries: PatientSyncHistoryEntry[]) {
  return enabled ? entries : [];
}

export function shouldRecordPatientSyncHistory(enabled: boolean) {
  return enabled;
}

export function isPatientSyncHistoryRetention(value: unknown): value is PatientSyncHistoryRetention {
  return typeof value === "string" && patientSyncHistoryRetentions.includes(value as PatientSyncHistoryRetention);
}

export function filterPatientSyncHistoryByRetention(entries: PatientSyncHistoryEntry[], retention: PatientSyncHistoryRetention, now: number) {
  const cutoff = now - retentionDurations[retention];
  return entries.filter(entry => entry.occurredAt >= cutoff);
}

export function getPatientSyncHistoryRetentionLabel(retention: PatientSyncHistoryRetention) {
  return retention === "1_DAY" ? "يوم واحد" : retention === "7_DAYS" ? "7 أيام" : "30 يوماً";
}
