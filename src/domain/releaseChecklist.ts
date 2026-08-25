export type ReleaseChecklistStatus = "VERIFIED" | "DEVICE_REQUIRED" | "RELEASE_REQUIRED";

export type ReleaseChecklistItem = {
  id: string;
  section: string;
  status: ReleaseChecklistStatus;
  title: string;
  description: string;
};

export const patientReleaseChecklist: ReleaseChecklistItem[] = [
  {
    id: "development-tests",
    section: "تم التحقق في بيئة التطوير",
    status: "VERIFIED",
    title: "اختبارات المنطق وفحص النوع",
    description: "تشمل منطق الجلسة والمزامنة والخصوصية والتشخيص، مع فحص TypeScript قبل البناء.",
  },
  {
    id: "android-export",
    section: "تم التحقق في بيئة التطوير",
    status: "VERIFIED",
    title: "تجميع حزمة Android المصدرية",
    description: "يجب أن ينجح تصدير Android بعد أي تعديل قبل متابعة إجراءات الإصدار.",
  },
  {
    id: "oauth-deep-link",
    section: "يتطلب جهاز Android أو محاكي",
    status: "DEVICE_REQUIRED",
    title: "تسجيل الدخول والرابط العميق",
    description: "اختبر إتمام OAuth والعودة إلى التطبيق عبر medicarepro://auth على جهاز أو محاكي Android.",
  },
  {
    id: "session-refresh",
    section: "يتطلب جهاز Android أو محاكي",
    status: "DEVICE_REQUIRED",
    title: "تجديد الجلسة ومزامنة بيانات الحساب",
    description: "تحقق من الزيارات والتنبيهات المصرح بها وتجدد الجلسة عند الاستئناف أو التحديث اليدوي.",
  },
  {
    id: "device-privacy",
    section: "يتطلب جهاز Android أو محاكي",
    status: "DEVICE_REQUIRED",
    title: "خصوصية الجهاز وحذف البيانات المحلية",
    description: "تحقق من إعدادات السجل ومن حذف البيانات المحلية مع بقاء بيانات حساب الويب دون تغيير.",
  },
  {
    id: "signed-apk",
    section: "قبل التوزيع العام",
    status: "RELEASE_REQUIRED",
    title: "توقيع APK والتثبيت التجريبي",
    description: "أنشئ نسخة موقعة وثبّتها على جهاز اختبار قبل أي توزيع للمستخدمين.",
  },
];

export function getReleaseChecklistStatusLabel(status: ReleaseChecklistStatus) {
  return status === "VERIFIED" ? "متحقق في بيئة التطوير" : status === "DEVICE_REQUIRED" ? "مطلوب على جهاز Android" : "مطلوب قبل التوزيع";
}
