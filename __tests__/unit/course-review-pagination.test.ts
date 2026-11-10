import { describe, expect, it } from "vitest";
import { hasNextReviewPage } from "@/backend/src/courses/review-pagination";

describe("public review paging", () => {
  it("ends on a full page when there is no extra row", () => {
    expect(hasNextReviewPage(0, 5)).toBe(false);
    expect(hasNextReviewPage(0, 6)).toBe(true);
  });

  it("stops after page 9 even when the query sees a sixth row", () => {
    expect(hasNextReviewPage(8, 6)).toBe(true);
    expect(hasNextReviewPage(9, 6)).toBe(false);
  });
});
