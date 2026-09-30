import { describe, expect, it } from "vitest";
import {
  externalKey,
  healthState,
  isE164,
  localTime,
  replyTime,
  whatsappWarning,
} from "./rules";

const now = Date.parse("2026-09-28T12:00:00Z");
const health = {
  id: 1,
  company_id: 1,
  stage: "found",
  created_at: "2026-09-01T00:00:00Z",
  last_touch_at: "2026-09-27T00:00:00Z",
  next_task_due: null,
  open_task_count: 0,
};
describe("deal health", () => {
  it("shows amber without an open task, overdue before stale, and exempts closed deals", () => {
    expect(healthState(health, now)).toBe("no_next_step");
    const overdue = {
      ...health,
      next_task_due: "2026-09-27T12:00:00Z",
      open_task_count: 1,
      last_touch_at: "2026-09-01T00:00:00Z",
    };
    expect(healthState(overdue, now)).toBe("overdue");
    expect(healthState({ ...overdue, stage: "won" }, now)).toBe("ok");
    expect(healthState({ ...overdue, stage: "lost" }, now)).toBe("ok");
  });
  it("handles exactly seven days and recent creation without false stale warnings", () => {
    expect(
      healthState({ ...health, last_touch_at: "2026-09-21T12:00:00Z" }, now),
    ).toBe("no_next_step");
    expect(
      healthState({ ...health, last_touch_at: "2026-09-21T11:59:59Z" }, now),
    ).toBe("stale");
    expect(
      healthState(
        {
          ...health,
          created_at: "2026-09-27T00:00:00Z",
          last_touch_at: "2026-09-01T00:00:00Z",
        },
        now,
      ),
    ).toBe("no_next_step");
    expect(healthState({ ...health, open_task_count: 1 }, now)).toBe("ok");
  });
});
describe("WhatsApp warning", () => {
  it("warns at 15 opens and strictly less than 12 minutes", () => {
    const opens = Array.from({ length: 15 }, () => ({
      opened_at: "2026-09-28T10:00:00Z",
    }));
    expect(whatsappWarning(opens, new Date(now)).needsWarning).toBe(true);
    expect(
      whatsappWarning(opens.slice(0, 14), new Date(now)).needsWarning,
    ).toBe(false);
    expect(
      whatsappWarning([{ opened_at: "2026-09-28T11:48:01Z" }], new Date(now))
        .needsWarning,
    ).toBe(true);
    expect(
      whatsappWarning([{ opened_at: "2026-09-28T11:48:00Z" }], new Date(now))
        .needsWarning,
    ).toBe(false);
  });
  it("resets daily count at Kolkata midnight but preserves the spacing warning", () => {
    const opens = Array.from({ length: 15 }, () => ({
      opened_at: "2026-09-28T18:29:00Z",
    }));
    const result = whatsappWarning(opens, new Date("2026-09-28T18:30:00Z"));
    expect(result.count).toBe(0);
    expect(result.reasons).toEqual([
      "Last chat opened less than 12 minutes ago",
    ]);
    expect(whatsappWarning([], new Date(now)).needsWarning).toBe(false);
  });
});
it("formats elapsed replies, validates numbers, and deduplicates domains", () => {
  expect(replyTime("2026-09-28T00:00:00Z", "2026-09-28T03:12:00Z")).toBe(
    "3h 12m",
  );
  expect(replyTime("2026-09-26T08:00:00Z", null, now)).toBe(
    "No reply after 2d 4h",
  );
  expect(isE164("+12025550100")).toBe(true);
  expect(isE164("2025550100")).toBe(false);
  expect(
    externalKey("Name", "City", "TX", "https://www.EXAMPLE.com/path"),
  ).toBe("example.com");
  expect(externalKey(" Name ", " CITY ", "TX")).toBe("name|city|TX");
  expect(
    localTime("America/New_York", new Date("2026-09-28T11:00:00Z")).outside,
  ).toBe(true);
  expect(
    localTime("America/New_York", new Date("2026-09-28T12:00:00Z")).outside,
  ).toBe(false);
});
