export const PATIENT_RELEASE_CHECKLIST_PROGRESS_KEY = "medicare_pro_patient_release_checklist_progress";

export const patientLocalStorageKeys = [
  "medicare_pro_patient_sync_history",
  "medicare_pro_patient_sync_history_enabled",
  "medicare_pro_patient_sync_history_retention",
  PATIENT_RELEASE_CHECKLIST_PROGRESS_KEY,
] as const;

export const patientLocalDataResetMessage = "سيحذف التطبيق الجلسة وسجل المزامنة والتفضيلات والبيانات المعروضة محلياً من هذا الجهاز فقط. لن يحذف الزيارات أو التنبيهات المحفوظة في حسابك على MediCare Pro Web.";
