import { describe, expect, it } from "vitest";
import { scoreFit, scoreReasons } from "./score";

describe("lead score", () => {
  it("splits the robot's reasons into signed points with a readable label", () => {
    expect(
      scoreReasons("+2 no chat/text tool; +1 owner named; -1 mid-value type"),
    ).toEqual([
      { points: 2, reason: "No chat/text tool" },
      { points: 1, reason: "Owner named" },
      { points: -1, reason: "Mid-value type" },
    ]);
  });

  it("keeps free text it cannot parse and ignores an empty reason list", () => {
    expect(scoreReasons("manual review")).toEqual([
      { points: null, reason: "Manual review" },
    ]);
    expect(scoreReasons(null)).toEqual([]);
  });

  it("names the fit at the same cut-offs the Today list colours use", () => {
    expect(scoreFit(4).label).toBe("Strong fit");
    expect(scoreFit(2).label).toBe("Worth a try");
    expect(scoreFit(-1).label).toBe("Weak fit");
  });
});
