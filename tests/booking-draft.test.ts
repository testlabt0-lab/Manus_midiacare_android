import { describe, expect, it } from "vitest";

import { isBookingDraft } from "../lib/booking-draft";

describe("مسودة الحجز", () => {
  it("تقبل تفضيلات حجز سليمة فقط", () => {
    expect(isBookingDraft({ step: 2, service: "طب عام", clinic: "عيادة الحياة", address: "المنزل التجريبي", scheduledAt: "2026-08-30T10:00:00.000Z", savedAt: 1 })).toBe(true);
  });

  it("ترفض المسودات التي تتضمن موعداً غير صالح", () => {
    expect(isBookingDraft({ step: 2, service: "طب عام", clinic: "عيادة الحياة", address: "المنزل التجريبي", scheduledAt: "غير صالح", savedAt: 1 })).toBe(false);
  });

  it("لا تطابق أي بيانات تفتقد حقلاً من حقول المسودة", () => {
    expect(isBookingDraft({ step: 1, service: "طب عام" })).toBe(false);
  });
});
