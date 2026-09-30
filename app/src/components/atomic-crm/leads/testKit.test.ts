import { describe, expect, it } from "vitest";
import { buildOwnerReport, CHANNEL_GUIDES, TEST_GROUND_RULES } from "./testKit";

const company = {
  name: "Acme Roofing",
  city: "Dallas",
  timezone: "America/Chicago",
};
const now = Date.parse("2026-10-01T15:00:00Z");

describe("buildOwnerReport", () => {
  it("states each test in the business's local time, oldest first", () => {
    const report = buildOwnerReport(
      company,
      [
        { channel: "phone", what_sent: "x", sent_at: "2026-09-30T01:10:00Z" },
        {
          channel: "web_form",
          what_sent: "x",
          sent_at: "2026-09-29T14:04:00Z",
          replied_at: "2026-09-29T17:16:00Z",
        },
      ],
      now,
    );
    const lines = report.split("\n");
    expect(lines[0]).toBe(
      "What we saw when we contacted Acme Roofing the way a customer would:",
    );
    expect(lines[1]).toBe(
      "• Tue, Sep 29, 9:04 AM (Dallas time): we asked for a quote through your website form. First reply after 3h 12m.",
    );
    expect(lines[2]).toBe(
      "• Tue, Sep 29, 8:10 PM (Dallas time): we called your business line. No reply after 1d 13h.",
    );
  });

  it("appends observed facts and never adds judgement words", () => {
    const report = buildOwnerReport(
      company,
      [
        {
          channel: "phone",
          what_sent: "x",
          sent_at: "2026-09-30T01:10:00Z",
          observed: "Rang 8 times, then voicemail.",
        },
      ],
      now,
    );
    expect(report).toContain("Rang 8 times, then voicemail.");
    expect(report).not.toMatch(/losing|missed out|slow|bad/i);
  });
});

describe("check kit content", () => {
  it("never tells anyone to record a call", () => {
    const text = [
      ...TEST_GROUND_RULES,
      ...Object.values(CHANNEL_GUIDES).flatMap((g) => g.steps),
    ].join(" ");
    expect(text).toContain("Calls are never recorded.");
    expect(text).toContain("Do not record the call.");
    const withoutProhibitions = text
      .replace("Calls are never recorded.", "")
      .replace("Do not record the call.", "");
    expect(withoutProhibitions).not.toMatch(
      /record(ing)? (the |a |your )?call/i,
    );
  });
});
