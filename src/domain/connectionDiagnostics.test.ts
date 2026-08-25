import { describe, expect, it } from "vitest";
import { getPatientConnectionDiagnostic } from "./connectionDiagnostics";

describe("تشخيص اتصال المريض", () => {
  it("يعرض حالة آمنة للحساب غير المتصل من دون تفاصيل تقنية", () => {
    const diagnostic = getPatientConnectionDiagnostic({ isConnected: false, isSyncing: false, hasError: false, lastSyncedAt: null, historyEnabled: false, historyEntryCount: 0 });
    expect(diagnostic.overallTitle).toBe("يلزم تسجيل الدخول");
    expect(diagnostic.checks[0].value).toBe("لم يتم تسجيل الدخول");
    expect(JSON.stringify(diagnostic)).not.toContain("token");
  });

  it("يشير إلى إعادة المحاولة عند فشل مزامنة الحساب", () => {
    const diagnostic = getPatientConnectionDiagnostic({ isConnected: true, isSyncing: false, hasError: true, lastSyncedAt: null, historyEnabled: true, historyEntryCount: 2 });
    expect(diagnostic.overallTitle).toBe("تحتاج المزامنة إلى إعادة محاولة");
    expect(diagnostic.checks[1].tone).toBe("ATTENTION");
  });

  it("يفصل تعذر استعادة الجلسة المؤقت عن انتهاء الجلسة أو تسجيل الخروج", () => {
    const diagnostic = getPatientConnectionDiagnostic({ isConnected: true, isSyncing: false, hasError: true, lastSyncedAt: null, historyEnabled: true, historyEntryCount: 0, sessionRestoreState: "OFFLINE" });
    expect(diagnostic.overallTitle).toBe("تعذر التحقق من الجلسة الآن");
    expect(diagnostic.checks[0].value).toBe("الجلسة محفوظة وتحتاج إعادة محاولة");
    expect(JSON.stringify(diagnostic)).not.toContain("token");
  });

  it("يعرض ملخص السجل المحلي بوصف عام فقط", () => {
    const diagnostic = getPatientConnectionDiagnostic({ isConnected: true, isSyncing: false, hasError: false, lastSyncedAt: 1_000, historyEnabled: true, historyEntryCount: 3, now: 1_000 });
    expect(diagnostic.checks[2].value).toBe("مفعّل: 3 نتيجة عامة محفوظة");
  });
});
