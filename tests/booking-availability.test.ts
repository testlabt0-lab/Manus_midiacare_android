import { describe, expect, it } from "vitest";

import { createReviewRequiredAvailability, resolveBookingAvailabilityMode } from "../lib/booking-availability";

describe("طبقة إتاحة الحجز", () => {
  it("تبقى في وضع المراجعة إن لم تفعل الخدمة الخادمية", () => {
    expect(resolveBookingAvailabilityMode(false, true)).toBe("REVIEW_REQUIRED");
    expect(resolveBookingAvailabilityMode(true, false)).toBe("REVIEW_REQUIRED");
  });

  it("تتحول إلى المصدر الخادمي فقط عند تفعيل الإتاحة مع جلسة مريض", () => {
    expect(resolveBookingAvailabilityMode(true, true)).toBe("REMOTE");
  });

  it("لا تضع بيانات تجريبية في قائمة الإتاحة المؤكدة", () => {
    expect(createReviewRequiredAvailability()).toMatchObject({ mode: "REVIEW_REQUIRED", clinics: [], services: [], addresses: [], slots: [] });
  });
});
