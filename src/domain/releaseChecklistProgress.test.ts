import { describe, expect, it } from "vitest";
import { parseReleaseChecklistProgress, toggleReleaseChecklistProgress } from "./releaseChecklistProgress";

describe("متابعة تحقق إصدار تطبيق المريض", () => {
  it("يقبل تعليم العناصر التي تتطلب جهازاً فقط ويرفض العناصر غير المسموح بها", () => {
    expect(parseReleaseChecklistProgress({ "oauth-deep-link": 100, "development-tests": 200, unknown: 300 })).toEqual({ "oauth-deep-link": 100 });
  });

  it("يبدل الحالة المحلية للعنصر من دون ادعاء تحقق آلي", () => {
    const marked = toggleReleaseChecklistProgress({}, "oauth-deep-link", 100);
    expect(marked).toEqual({ "oauth-deep-link": 100 });
    expect(toggleReleaseChecklistProgress(marked, "oauth-deep-link", 200)).toEqual({});
  });
});
