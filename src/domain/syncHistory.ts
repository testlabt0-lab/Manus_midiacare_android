export type PatientSyncOutcome = "SUCCESS" | "FAILURE";

export type PatientSyncHistoryEntry = {
  id: string;
  occurredAt: number;
  outcome: PatientSyncOutcome;
};

const MAX_SYNC_HISTORY_ENTRIES = 3;

export function appendPatientSyncHistory(entries: PatientSyncHistoryEntry[], outcome: PatientSyncOutcome, occurredAt: number) {
  return [{ id: `${occurredAt}-${outcome}`, occurredAt, outcome }, ...entries].slice(0, MAX_SYNC_HISTORY_ENTRIES);
}

export function parsePatientSyncHistory(value: unknown): PatientSyncHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is PatientSyncHistoryEntry => Boolean(
      entry && typeof entry === "object" &&
      typeof (entry as PatientSyncHistoryEntry).id === "string" &&
      typeof (entry as PatientSyncHistoryEntry).occurredAt === "number" &&
      ((entry as PatientSyncHistoryEntry).outcome === "SUCCESS" || (entry as PatientSyncHistoryEntry).outcome === "FAILURE"),
    ))
    .slice(0, MAX_SYNC_HISTORY_ENTRIES);
}

export function getPatientSyncHistoryLabel(outcome: PatientSyncOutcome) {
  return outcome === "SUCCESS" ? "اكتملت مزامنة الحساب" : "لم تكتمل مزامنة الحساب";
}
