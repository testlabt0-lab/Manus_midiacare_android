import { describe, expect, it } from "vitest";
import { shouldRefreshOnAppResume } from "./foregroundRefresh";

describe("تحديث الحساب عند عودة التطبيق", () => {
  it("يسمح بالتحديث فقط عند العودة للمقدمة مع جلسة موجودة وإعداد مفعّل", () => {
    expect(shouldRefreshOnAppResume({ enabled: true, previousState: "background", nextState: "active", hasSession: true, isSyncing: false })).toBe(true);
  });

  it("يتجنب التحديث عند تعطيل الإعداد أو عدم وجود جلسة أو مزامنة جارية", () => {
    expect(shouldRefreshOnAppResume({ enabled: false, previousState: "background", nextState: "active", hasSession: true, isSyncing: false })).toBe(false);
    expect(shouldRefreshOnAppResume({ enabled: true, previousState: "background", nextState: "active", hasSession: false, isSyncing: false })).toBe(false);
    expect(shouldRefreshOnAppResume({ enabled: true, previousState: "inactive", nextState: "active", hasSession: true, isSyncing: true })).toBe(false);
  });
});
