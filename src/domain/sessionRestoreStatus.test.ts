import { describe, expect, it } from "vitest";
import { getPatientSessionRestoreStatus } from "./sessionRestoreStatus";

describe("حالة استعادة جلسة المريض", () => {
  it("يفصل بين تعذر الاتصال وانتهاء الجلسة", () => {
    expect(getPatientSessionRestoreStatus("OFFLINE").title).toBe("تعذر التحقق من الجلسة الآن");
    expect(getPatientSessionRestoreStatus("EXPIRED").title).toBe("انتهت جلسة الحساب");
  });

  it("يعرض وصفاً آمناً لا يكشف رمز الوصول أو رمز التجديد", () => {
    const status = getPatientSessionRestoreStatus("RESTORED");
    expect(JSON.stringify(status)).not.toContain("token");
    expect(JSON.stringify(status)).not.toContain("refresh");
  });
});
