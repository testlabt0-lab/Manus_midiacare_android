import { getPatientSyncStatus } from "./syncStatus";

export type DiagnosticTone = "OK" | "ATTENTION" | "NEUTRAL";

export type PatientConnectionDiagnosticInput = {
  isConnected: boolean;
  isSyncing: boolean;
  hasError: boolean;
  lastSyncedAt: number | null;
  historyEnabled: boolean;
  historyEntryCount: number;
  now?: number;
};

export type PatientConnectionDiagnostic = {
  overallTitle: string;
  overallDescription: string;
  tone: DiagnosticTone;
  checks: Array<{ label: string; value: string; tone: DiagnosticTone }>;
};

export function getPatientConnectionDiagnostic(input: PatientConnectionDiagnosticInput): PatientConnectionDiagnostic {
  const syncStatus = getPatientSyncStatus(input);
  const connectedTone: DiagnosticTone = input.isConnected ? "OK" : "ATTENTION";
  const syncTone: DiagnosticTone = input.hasError ? "ATTENTION" : input.isConnected ? "OK" : "NEUTRAL";
  const overall = !input.isConnected
    ? { overallTitle: "يلزم تسجيل الدخول", overallDescription: "سجّل الدخول لربط بيانات المريض المصرح بها ومزامنتها.", tone: "ATTENTION" as const }
    : input.hasError
      ? { overallTitle: "تحتاج المزامنة إلى إعادة محاولة", overallDescription: "تحقّق من الاتصال ثم حدّث بيانات الحساب من التطبيق.", tone: "ATTENTION" as const }
      : input.isSyncing
        ? { overallTitle: "يُجرى تحديث الحساب", overallDescription: "يجري تحديث الزيارات والتنبيهات المصرح بها الآن.", tone: "NEUTRAL" as const }
        : { overallTitle: "الحساب جاهز للمزامنة", overallDescription: "يمكنك تحديث بيانات الحساب عند الحاجة.", tone: "OK" as const };

  return {
    ...overall,
    checks: [
      { label: "حالة الحساب", value: input.isConnected ? "حساب المريض متصل" : "لم يتم تسجيل الدخول", tone: connectedTone },
      { label: "حالة المزامنة", value: syncStatus, tone: syncTone },
      { label: "سجل المزامنة المحلي", value: input.historyEnabled ? `مفعّل: ${input.historyEntryCount} نتيجة عامة محفوظة` : "متوقف على هذا الجهاز", tone: input.historyEnabled ? "OK" : "NEUTRAL" },
    ],
  };
}
