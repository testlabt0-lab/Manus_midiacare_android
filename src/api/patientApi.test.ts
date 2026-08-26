import { describe, expect, it } from "vitest";
import { API_ORIGIN, DEFAULT_API_ORIGIN, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI, mapRemotePatientNotification, mapRemoteVisit, resolveApiOrigin } from "./patientApiShared";

describe("patient API mapping", () => {
  it("uses the deployed MediCare Pro fallback origin and constrained Android callback URI", () => {
    expect(API_ORIGIN).toBe(DEFAULT_API_ORIGIN);
    expect(DEFAULT_API_ORIGIN).toBe("https://medicarepro-myvdwgyk.manus.space");
    expect(MOBILE_CLIENT_ID).toBe("medicare-pro-mobile-android");
    expect(MOBILE_REDIRECT_URI).toBe("medicarepro://auth");
  });

  it("accepts a secure configured origin and rejects malformed or path-based values", () => {
    expect(resolveApiOrigin("https://staging.medicarepro.example")).toBe("https://staging.medicarepro.example");
    expect(resolveApiOrigin("https://staging.medicarepro.example/")).toBe("https://staging.medicarepro.example");
    expect(resolveApiOrigin("http://staging.medicarepro.example")).toBe(DEFAULT_API_ORIGIN);
    expect(resolveApiOrigin("https://staging.medicarepro.example/api")).toBe(DEFAULT_API_ORIGIN);
    expect(resolveApiOrigin("not a URL")).toBe(DEFAULT_API_ORIGIN);
  });

  it("maps a patient-owned web visit to the mobile UI shape", () => {
    const visit = mapRemoteVisit({
      id: 12,
      reference: "V-1200",
      clinicName: "عيادة الحياة",
      serviceName: "زيارة منزلية",
      districtLabel: "الوسط",
      state: "CONFIRMED",
      createdAt: "2026-08-24T10:00:00.000Z",
      scheduledStart: "2026-08-25T10:00:00.000Z",
    });

    expect(visit).toMatchObject({ id: "V-1200", status: "CONFIRMED", source: "REMOTE", districtLabel: "الوسط" });
    expect(visit.scheduledStart).toBeGreaterThan(0);
  });

  it("maps a synchronized patient notification without exposing any extra medical detail", () => {
    const notice = mapRemotePatientNotification({ id: 7, visitId: 12, kind: "VISIT_STATUS_CHANGED", title: "تم تحديث حالة زيارة", body: "تغيرت حالة الزيارة إلى: CONFIRMED.", readAt: null, createdAt: "2026-08-25T10:00:00.000Z" });
    expect(notice).toMatchObject({ id: "WEB-N-7", category: "MEDICAL", read: false });
  });
});
