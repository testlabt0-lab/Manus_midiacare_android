import { describe, expect, it } from "vitest";
import { resolvePatientSyncHistoryPreference, shouldRecordPatientSyncHistory } from "./syncHistoryPrivacy";

const entries = [{ id: "1-SUCCESS", occurredAt: 1, outcome: "SUCCESS" as const }];

describe("خصوصية سجل مزامنة المريض", () => {
  it("يحذف النتائج المعروضة محلياً عند تعطيل حفظ السجل", () => {
    expect(resolvePatientSyncHistoryPreference(false, entries)).toEqual([]);
  });

  it("يمنع تسجيل نتائج جديدة عندما يكون الإعداد معطلاً", () => {
    expect(shouldRecordPatientSyncHistory(false)).toBe(false);
    expect(shouldRecordPatientSyncHistory(true)).toBe(true);
  });
});
