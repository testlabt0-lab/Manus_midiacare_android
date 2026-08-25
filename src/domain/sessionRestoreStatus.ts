export type PatientSessionRestoreState = "CHECKING" | "RESTORED" | "OFFLINE" | "EXPIRED" | "NONE";

export function getPatientSessionRestoreStatus(state: PatientSessionRestoreState) {
  if (state === "CHECKING") return { title: "يجري استعادة جلسة الحساب", description: "يتحقق التطبيق من جلسة المريض المحفوظة بأمان على هذا الجهاز." };
  if (state === "RESTORED") return { title: "تمت استعادة جلسة الحساب", description: "أصبح الحساب جاهزاً لمزامنة بيانات المريض المصرح بها." };
  if (state === "OFFLINE") return { title: "تعذر التحقق من الجلسة الآن", description: "احتفظ التطبيق بالجلسة محلياً؛ تحقّق من الاتصال ثم حدّث الحساب عند الحاجة." };
  if (state === "EXPIRED") return { title: "انتهت جلسة الحساب", description: "سجّل الدخول من جديد لربط حساب المريض بأمان." };
  return { title: "لا توجد جلسة محفوظة", description: "سجّل الدخول لمزامنة بيانات حسابك مع تطبيق الويب." };
}
