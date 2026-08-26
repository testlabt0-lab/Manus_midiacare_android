import { describe, expect, it } from "vitest";

import { getReminderTimestamp } from "../lib/appointment-reminder";

describe("تذكيرات المواعيد", () => {
  it("يحدد تذكيراً قبل الموعد بساعة عندما تكون المدة كافية", () => {
    const now = Date.UTC(2026, 7, 26, 9, 0, 0);
    const scheduled = Date.UTC(2026, 7, 26, 12, 0, 0);
    expect(getReminderTimestamp(scheduled, now)).toBe(Date.UTC(2026, 7, 26, 11, 0, 0));
  });

  it("لا ينشئ تذكيراً لموعد قريب أو سابق", () => {
    const now = Date.UTC(2026, 7, 26, 9, 0, 0);
    expect(getReminderTimestamp(Date.UTC(2026, 7, 26, 9, 15, 0), now)).toBeNull();
  });
});
