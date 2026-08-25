import { describe, expect, it } from "vitest";
import { advanceVisit, createLocalVisit, getUpcomingVisit, getVisitSummary } from "./clinic";

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

  it("selects the nearest valid future appointment while ignoring completed, cancelled, and past visits", () => {
    const upcoming = getUpcomingVisit([
      { id: "completed", clinicName: "عيادة أ", serviceName: "خدمة", status: "COMPLETED", createdAt: 1, scheduledStart: 1_300 },
      { id: "cancelled", clinicName: "عيادة ب", serviceName: "خدمة", status: "CANCELLED", createdAt: 1, scheduledStart: 1_100 },
      { id: "later", clinicName: "عيادة ج", serviceName: "خدمة", status: "CONFIRMED", createdAt: 1, scheduledStart: 1_500 },
      { id: "next", clinicName: "عيادة د", serviceName: "خدمة", status: "ASSIGNED", createdAt: 1, scheduledStart: 1_200 },
      { id: "past", clinicName: "عيادة هـ", serviceName: "خدمة", status: "CONFIRMED", createdAt: 1, scheduledStart: 900 },
    ], 1_000);

    expect(upcoming?.id).toBe("next");
  });

  it("returns no appointment when there is no valid future visit", () => {
    expect(getUpcomingVisit([{ id: "local", clinicName: "عيادة", serviceName: "خدمة", status: "REQUESTED", createdAt: 1 }], 1_000)).toBeNull();
  });
});
