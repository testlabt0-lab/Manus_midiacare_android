import { describe, expect, it } from "vitest";
import { advanceVisit, createLocalVisit, getVisitSummary } from "./clinic";

describe("clinic visit workflow", () => {
  it("creates a new local clinic visit with the requested initial status", () => {
    const visit = createLocalVisit({ clinicName: "عيادة الاختبار", serviceName: "زيارة منزلية" }, 123456);

    expect(visit).toMatchObject({
      id: "V-2N9C",
      clinicName: "عيادة الاختبار",
      serviceName: "زيارة منزلية",
      status: "REQUESTED",
      createdAt: 123456,
    });
  });

  it("moves a visit through the supported operational statuses only", () => {
    const requested = createLocalVisit({ clinicName: "عيادة الاختبار", serviceName: "زيارة منزلية" }, 50);
    const assigned = advanceVisit(requested);
    const enRoute = advanceVisit(assigned);
    const inProgress = advanceVisit(enRoute);
    const completed = advanceVisit(inProgress);

    expect([assigned.status, enRoute.status, inProgress.status, completed.status]).toEqual([
      "ASSIGNED",
      "EN_ROUTE",
      "IN_PROGRESS",
      "COMPLETED",
    ]);
    expect(advanceVisit(completed)).toEqual(completed);
  });

  it("derives dashboard totals from the actual local visit collection", () => {
    const first = createLocalVisit({ clinicName: "عيادة الاختبار", serviceName: "زيارة منزلية" }, 10);
    const second = createLocalVisit({ clinicName: "عيادة ثانية", serviceName: "متابعة" }, 20);
    const active = advanceVisit(advanceVisit(advanceVisit(first)));
    const completed = advanceVisit(advanceVisit(advanceVisit(advanceVisit(second))));

    expect(getVisitSummary([active, completed])).toEqual({ total: 2, active: 1, inProgress: 1, completed: 1 });
  });
});
