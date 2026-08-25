import { describe, expect, it } from "vitest";
import { appendPatientSyncHistory, getPatientSyncHistoryLabel, parsePatientSyncHistory } from "./syncHistory";

describe("سجل نتائج مزامنة المريض", () => {
  it("يحتفظ بآخر ثلاث نتائج فقط ومن دون أي نص قادم من الخادم", () => {
    let history = appendPatientSyncHistory([], "SUCCESS", 100);
    history = appendPatientSyncHistory(history, "FAILURE", 200);
    history = appendPatientSyncHistory(history, "SUCCESS", 300);
    history = appendPatientSyncHistory(history, "SUCCESS", 400);

    expect(history).toEqual([
      { id: "400-SUCCESS", occurredAt: 400, outcome: "SUCCESS" },
      { id: "300-SUCCESS", occurredAt: 300, outcome: "SUCCESS" },
      { id: "200-FAILURE", occurredAt: 200, outcome: "FAILURE" },
    ]);
  });

  it("يتجاهل بيانات التخزين المحلي غير الصالحة ويعرض وصفاً عاماً للنتيجة", () => {
    expect(parsePatientSyncHistory([{ id: "ok", occurredAt: 1, outcome: "SUCCESS" }, { message: "تفاصيل حساسة" }])).toEqual([{ id: "ok", occurredAt: 1, outcome: "SUCCESS" }]);
    expect(getPatientSyncHistoryLabel("FAILURE")).toBe("لم تكتمل مزامنة الحساب");
  });
});
