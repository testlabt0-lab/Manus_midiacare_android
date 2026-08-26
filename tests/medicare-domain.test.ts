import { describe, expect, it } from "vitest";

import { advanceVisit, createVisit, filterAndSearchVisits, getVisitSummary } from "../lib/medicare-domain";

describe("منطق زيارات MediCare Pro", () => {
  it("ينشئ زيارة محلية بالحالة الابتدائية الصحيحة", () => {
    const visit = createVisit("عيادة الأمل", "متابعة تمريضية", 1000);
    expect(visit).toMatchObject({ id: "V-RS", status: "REQUESTED", clinicName: "عيادة الأمل", serviceName: "متابعة تمريضية" });
  });

  it("يتبع مسار الانتقال التشغيلي حتى اكتمال الزيارة", () => {
    const visit = createVisit("عيادة الأمل", "زيارة منزلية", 1000);
    const complete = advanceVisit(advanceVisit(advanceVisit(advanceVisit(visit))));
    expect(complete.status).toBe("COMPLETED");
    expect(advanceVisit(complete)).toEqual(complete);
  });

  it("يبحث في الزيارات ويحسب المؤشرات من بيانات ثابتة", () => {
    const first = createVisit("عيادة الأمل", "زيارة منزلية", 1000);
    const completed = { ...createVisit("مركز السلام", "متابعة طبية", 2000), status: "COMPLETED" as const };
    expect(filterAndSearchVisits([first, completed], "ALL", "الأمل")).toEqual([first]);
    expect(getVisitSummary([first, completed])).toEqual({ total: 2, active: 1, inProgress: 0, completed: 1 });
  });
});
