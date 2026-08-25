export type PatientSyncStatusInput = {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  now?: number;
};

export function getPatientSyncStatus({ isConnected, isSyncing, lastSyncedAt, now = Date.now() }: PatientSyncStatusInput) {
  if (!isConnected) return "سجّل الدخول لمزامنة بيانات حسابك.";
  if (isSyncing) return "جارٍ تحديث الزيارات والتنبيهات المصرح بها…";
  if (!lastSyncedAt) return "لم تتم مزامنة بيانات الحساب بعد.";

  const elapsedMinutes = Math.max(0, Math.floor((now - lastSyncedAt) / 60_000));
  if (elapsedMinutes < 1) return "آخر مزامنة: الآن";
  if (elapsedMinutes < 60) return `آخر مزامنة: منذ ${elapsedMinutes} دقيقة`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `آخر مزامنة: منذ ${elapsedHours} ساعة`;
  return `آخر مزامنة: منذ ${Math.floor(elapsedHours / 24)} يوم`;
}
