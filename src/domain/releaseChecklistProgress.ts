import { patientReleaseChecklist, type ReleaseChecklistItem } from "./releaseChecklist";

export type ReleaseChecklistProgress = Record<string, number>;

export function isReleaseChecklistItemTrackable(item: ReleaseChecklistItem) {
  return item.status !== "VERIFIED";
}

export function parseReleaseChecklistProgress(value: unknown): ReleaseChecklistProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowedIds = new Set(patientReleaseChecklist.filter(isReleaseChecklistItemTrackable).map(item => item.id));
  return Object.entries(value).reduce<ReleaseChecklistProgress>((progress, [id, completedAt]) => {
    if (allowedIds.has(id) && typeof completedAt === "number" && Number.isFinite(completedAt) && completedAt > 0) progress[id] = completedAt;
    return progress;
  }, {});
}

export function toggleReleaseChecklistProgress(progress: ReleaseChecklistProgress, itemId: string, completedAt: number): ReleaseChecklistProgress {
  if (progress[itemId]) {
    const { [itemId]: _completedAt, ...remaining } = progress;
    return remaining;
  }
  return { ...progress, [itemId]: completedAt };
}
