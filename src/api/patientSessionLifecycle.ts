import type { PatientSession } from "./patientApi";
import { isPatientSessionExpiredFailure } from "./patientSessionErrors";

type SessionLifecycleOptions = {
  renew: (session: PatientSession) => Promise<PatientSession>;
  onRenewed: (session: PatientSession) => void | Promise<void>;
  onExpired: () => void | Promise<void>;
};

/**
 * يجدد جلسة المريض قبل أي طلب متزامن. إذا فشل التجديد، تزال الجلسة
 * المخزنة وحالة الواجهة معاً حتى لا تستمر عمليات لاحقة برمز منتهٍ.
 */
export async function renewPatientSessionForAction(session: PatientSession, options: SessionLifecycleOptions) {
  try {
    const renewed = await options.renew(session);
    await options.onRenewed(renewed);
    return renewed;
  } catch (error) {
    if (isPatientSessionExpiredFailure(error)) await options.onExpired();
    throw error;
  }
}
