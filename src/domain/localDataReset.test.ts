import { describe, expect, it } from "vitest";
import { patientLocalDataResetMessage, patientLocalStorageKeys } from "./localDataReset";

describe("حذف بيانات المريض المحلية", () => {
  it("يحدد مفاتيح التخزين المحلية فقط من دون أي مسار خادمي", () => {
    expect(patientLocalStorageKeys).toHaveLength(3);
    expect(patientLocalStorageKeys.every(key => key.startsWith("medicare_pro_patient_"))).toBe(true);
    expect(patientLocalStorageKeys.join(" ")).not.toContain("api/");
  });

  it("يوضح أن الحذف لا يؤثر على بيانات حساب المريض في الويب", () => {
    expect(patientLocalDataResetMessage).toContain("من هذا الجهاز فقط");
    expect(patientLocalDataResetMessage).toContain("لن يحذف الزيارات أو التنبيهات");
  });
});
