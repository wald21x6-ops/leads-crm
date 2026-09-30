import { describe, expect, it } from "vitest";
import type { Company, Contact, Task } from "../types";
import type { DealHealth } from "../leads/rules";
import { buildToday, doneToday, lateBy, shortLocalTime } from "./today";

// 14:00 UTC = 09:00 in Chicago, 07:00 in Los Angeles.
const now = new Date("2026-09-29T14:00:00Z");
const company = (id: number, extra: Partial<Company> = {}) =>
  ({
    id,
    name: `Business ${id}`,
    timezone: "America/Chicago",
    phone_number: `+1214555010${id}`,
    ...extra,
  }) as Company;
const health = (company_id: number, extra: Partial<DealHealth>) =>
  ({
    id: company_id,
    company_id,
    stage: "researched",
    created_at: "2026-09-01T00:00:00Z",
    last_touch_at: "2026-09-28T00:00:00Z",
    next_task_due: null,
    open_task_count: 0,
    state: "ok",
    ...extra,
  }) as DealHealth;
const contact = (id: number, company_id: number) =>
  ({ id, company_id, title: "", phone_jsonb: [] }) as unknown as Contact;
const task = (id: number, contact_id: number, due_date: string, done_date: string | null = null) =>
  ({ id, contact_id, type: "call", text: `Task ${id}`, due_date, done_date }) as Task;

describe("today queue", () => {
  it("orders overdue, due today, no next step, untouched, and skips leads with nothing due today", () => {
    const items = buildToday({
      now,
      companies: [1, 2, 3, 4, 5].map((id) => company(id)),
      contacts: [contact(10, 2), contact(20, 5)],
      tasks: [
        task(1, 10, "2026-09-29T17:00:00Z"),
        task(2, 20, "2026-10-04T10:00:00Z"),
      ],
      health: [
        health(1, { state: "stale" }),
        health(2, { next_task_due: "2026-09-29T17:00:00Z", open_task_count: 1 }),
        health(3, { state: "no_next_step" }),
        health(4, { state: "overdue", next_task_due: "2026-09-28T10:00:00Z" }),
        health(5, { next_task_due: "2026-10-04T10:00:00Z", open_task_count: 1 }),
      ],
    });
    expect(items.map((i) => [i.company.id, i.group])).toEqual([
      [4, "overdue"],
      [2, "today"],
      [3, "no_next_step"],
      [1, "stale"],
    ]);
    expect(items[1].nextStep?.text).toBe("Task 1");
  });

  it("puts businesses inside 8am–8pm first and best score first among leads with no next step", () => {
    const items = buildToday({
      now,
      contacts: [],
      tasks: [],
      companies: [
        company(1, { score: 5, timezone: "America/Los_Angeles" }),
        company(2, { score: 1 }),
        company(3, { score: 4 }),
      ],
      health: [1, 2, 3].map((id) => health(id, { state: "no_next_step" })),
    });
    expect(items.map((i) => i.company.id)).toEqual([3, 2, 1]);
    expect(items[2].inHours).toBe(false);
  });

  it("keeps one row per business, at its most urgent group", () => {
    const items = buildToday({
      now,
      contacts: [],
      tasks: [],
      companies: [company(1)],
      health: [
        { ...health(1, { state: "no_next_step" }), id: 7 },
        { ...health(1, { state: "overdue" }), id: 8 },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].group).toBe("overdue");
  });

  it("formats the business's local time and counts tasks done since midnight", () => {
    expect(shortLocalTime("America/Los_Angeles", now)).toBe("7:00 am · Los Angeles");
    expect(shortLocalTime(null, now)).toBeNull();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    expect(
      doneToday(
        [
          task(1, 1, "", new Date(midnight.getTime() + 60000).toISOString()),
          task(2, 1, "", new Date(midnight.getTime() - 60000).toISOString()),
          task(3, 1, ""),
        ],
        now,
      ),
    ).toBe(1);
  });

  it("says how late an overdue step is in the largest whole unit", () => {
    const at = now.getTime();
    expect(lateBy(new Date(at - 3 * 86400000 - 5000).toISOString(), at)).toBe("3d");
    expect(lateBy(new Date(at - 5 * 3600000).toISOString(), at)).toBe("5h");
    expect(lateBy(new Date(at - 20 * 60000).toISOString(), at)).toBe("20m");
  });
});
