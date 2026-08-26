import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "medicare-pro-booking-draft-v1";

export type BookingDraft = {
  step: number;
  service: string;
  clinic: string;
  address: string;
  scheduledAt: string;
  savedAt: number;
};

export function isBookingDraft(value: unknown): value is BookingDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<BookingDraft>;
  return Number.isInteger(draft.step)
    && typeof draft.service === "string"
    && typeof draft.clinic === "string"
    && typeof draft.address === "string"
    && typeof draft.scheduledAt === "string"
    && Number.isFinite(new Date(draft.scheduledAt).getTime())
    && typeof draft.savedAt === "number";
}

export function formatBookingDraftUpdatedAt(savedAt: number, now = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - savedAt) / 60_000));
  if (elapsedMinutes === 0) return "حُفظت المسودة الآن";
  if (elapsedMinutes < 60) return `حُفظت المسودة قبل ${elapsedMinutes} دقيقة`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `حُفظت المسودة قبل ${elapsedHours} ساعة`;
  return `آخر حفظ: ${new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(savedAt))}`;
}

export async function loadBookingDraft(): Promise<BookingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBookingDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveBookingDraft(draft: Omit<BookingDraft, "savedAt">): Promise<void> {
  const safeDraft: BookingDraft = { ...draft, step: Math.max(0, Math.min(3, draft.step)), savedAt: Date.now() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(safeDraft));
}

export async function clearBookingDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
