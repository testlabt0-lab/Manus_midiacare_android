import { describe, expect, it } from "vitest";
import { filterPatientSyncHistoryByRetention, getPatientSyncHistoryRetentionLabel, isPatientSyncHistoryRetention, resolvePatientSyncHistoryPreference, shouldRecordPatientSyncHistory } from "./syncHistoryPrivacy";

const entries = [{ id: "1-SUCCESS", occurredAt: 1, outcome: "SUCCESS" as const }];

describe("خصوصية سجل مزامنة المريض", () => {
  it("يحذف النتائج المعروضة محلياً عند تعطيل حفظ السجل", () => {
    expect(resolvePatientSyncHistoryPreference(false, entries)).toEqual([]);
  });

  it("يمنع تسجيل نتائج جديدة عندما يكون الإعداد معطلاً", () => {
    expect(shouldRecordPatientSyncHistory(false)).toBe(false);
    expect(shouldRecordPatientSyncHistory(true)).toBe(true);
  });

  it("ينقي النتائج الأقدم من مدة الاحتفاظ المحددة", () => {
    const now = 1_000_000_000;
    const recent = { id: "recent", occurredAt: now - 6 * 24 * 60 * 60 * 1000, outcome: "SUCCESS" as const };
    const old = { id: "old", occurredAt: now - 8 * 24 * 60 * 60 * 1000, outcome: "FAILURE" as const };
    expect(filterPatientSyncHistoryByRetention([recent, old], "7_DAYS", now)).toEqual([recent]);
  });

  it("يتحقق من المدد المعتمدة ويعرض وصفاً عربياً موجزاً", () => {
    expect(isPatientSyncHistoryRetention("30_DAYS")).toBe(true);
    expect(isPatientSyncHistoryRetention("FOREVER")).toBe(false);
    expect(getPatientSyncHistoryRetentionLabel("1_DAY")).toBe("يوم واحد");
  });
});
