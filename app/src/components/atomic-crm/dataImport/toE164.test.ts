import { describe, expect, it } from "vitest";
import { toE164 } from "./useCompanyImport";

describe("toE164", () => {
  it("adds +1 to bare US numbers", () => {
    expect(toE164("214-555-0100")).toBe("+12145550100");
    expect(toE164("(404) 555 0199")).toBe("+14045550199");
    expect(toE164("1 214 555 0100")).toBe("+12145550100");
  });
  it("keeps numbers that already have a country code", () => {
    expect(toE164("+971 50 123 4567")).toBe("+971501234567");
  });
  it("leaves blanks and unknown shapes as typed", () => {
    expect(toE164("")).toBe("");
    expect(toE164("555-0100")).toBe("555-0100");
  });
});
