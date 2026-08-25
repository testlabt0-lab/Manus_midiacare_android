import { describe, expect, it } from "vitest";
import { getReleaseChecklistStatusLabel, patientReleaseChecklist } from "./releaseChecklist";

describe("قائمة تحقق إصدار تطبيق المريض", () => {
  it("تفصل بين التحقق المنجز والتحقق الذي يتطلب جهاز Android", () => {
    expect(patientReleaseChecklist.some(item => item.status === "VERIFIED")).toBe(true);
    expect(patientReleaseChecklist.some(item => item.status === "DEVICE_REQUIRED" && item.id === "oauth-deep-link")).toBe(true);
  });

  it("توضح أن تثبيت APK الموقّع مطلوب قبل التوزيع العام", () => {
    expect(patientReleaseChecklist.find(item => item.id === "signed-apk")?.status).toBe("RELEASE_REQUIRED");
    expect(getReleaseChecklistStatusLabel("RELEASE_REQUIRED")).toBe("مطلوب قبل التوزيع");
  });
});
