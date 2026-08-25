import { describe, expect, it } from "vitest";
import { patientPrivacyInformation } from "./privacyInfo";

describe("معلومات خصوصية المريض", () => {
  it("تشرح التخزين المحلي والحذف من دون تضمين بيانات صحية في سجل المزامنة", () => {
    expect(patientPrivacyInformation).toHaveLength(4);
    expect(patientPrivacyInformation.map(section => section.title)).toContain("ما لا يُحفظ في سجل المزامنة");
    expect(patientPrivacyInformation.find(section => section.title === "ما لا يُحفظ في سجل المزامنة")?.body).toContain("التشخيص");
  });

  it("توضح أن إيقاف السجل يحذف النتائج ويمنع النتائج الجديدة", () => {
    expect(patientPrivacyInformation.find(section => section.title === "التحكم والحذف")?.body).toContain("يحذف التطبيق النتائج المحفوظة محلياً");
    expect(patientPrivacyInformation.find(section => section.title === "التحكم والحذف")?.body).toContain("لا يضيف نتائج جديدة");
  });
});
