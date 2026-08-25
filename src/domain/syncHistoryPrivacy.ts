import type { PatientSyncHistoryEntry } from "./syncHistory";

export function resolvePatientSyncHistoryPreference(enabled: boolean, entries: PatientSyncHistoryEntry[]) {
  return enabled ? entries : [];
}

export function shouldRecordPatientSyncHistory(enabled: boolean) {
  return enabled;
}
