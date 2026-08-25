import { describe, expect, it } from "vitest";
import { getPatientSyncStatus } from "./syncStatus";

describe("getPatientSyncStatus", () => {
  it("يوضح أن البيانات لن تتزامن قبل ربط حساب المريض", () => {
    expect(getPatientSyncStatus({ isConnected: false, isSyncing: false, lastSyncedAt: null })).toBe("سجّل الدخول لمزامنة بيانات حسابك.");
  });

  it("يعطي الأولوية لحالة التحديث النشط", () => {
    expect(getPatientSyncStatus({ isConnected: true, isSyncing: true, lastSyncedAt: 0 })).toBe("جارٍ تحديث الزيارات والتنبيهات المصرح بها…");
  });

  it("يعرض رسالة فشل عامة قابلة لإعادة المحاولة من دون تفاصيل تقنية", () => {
    expect(getPatientSyncStatus({ isConnected: true, isSyncing: false, hasError: true, lastSyncedAt: 1_000_000 })).toBe("تعذر تحديث بيانات الحساب. تحقّق من الاتصال ثم أعد المحاولة.");
  });

  it("يعرض وقت آخر مزامنة بصيغة نسبية قابلة للقراءة", () => {
    expect(getPatientSyncStatus({ isConnected: true, isSyncing: false, lastSyncedAt: 1_000_000, now: 1_125_000 })).toBe("آخر مزامنة: منذ 2 دقيقة");
  });
});
