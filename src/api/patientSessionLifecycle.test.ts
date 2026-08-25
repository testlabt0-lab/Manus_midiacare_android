import { describe, expect, it, vi } from "vitest";
import { renewPatientSessionForAction } from "./patientSessionLifecycle";

const expiredSession = { accessToken: "expired-access", refreshToken: "refresh-token", expiresAt: 1 };
const renewedSession = { accessToken: "fresh-access", refreshToken: "fresh-refresh", expiresAt: 9_999_999_999_999 };

describe("renewPatientSessionForAction", () => {
  it("يحفظ الجلسة المتجددة قبل متابعة العملية المتزامنة", async () => {
    const onRenewed = vi.fn();
    const onExpired = vi.fn();

    await expect(renewPatientSessionForAction(expiredSession, {
      renew: vi.fn().mockResolvedValue(renewedSession),
      onRenewed,
      onExpired,
    })).resolves.toEqual(renewedSession);

    expect(onRenewed).toHaveBeenCalledWith(renewedSession);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("ينظف جلسة التطبيق عند فشل تدوير رمز التجديد ثم يعيد الخطأ", async () => {
    const onExpired = vi.fn();
    const failure = new Error("انتهت جلسة الحساب");

    await expect(renewPatientSessionForAction(expiredSession, {
      renew: vi.fn().mockRejectedValue(failure),
      onRenewed: vi.fn(),
      onExpired,
    })).rejects.toThrow("انتهت جلسة الحساب");

    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
