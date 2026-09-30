import type { Identifier } from "ra-core";
import type { Company, Contact, Task } from "../types";
import { localTime, preferredPhone, type DealHealth } from "../leads/rules";

export type TodayGroup = "overdue" | "today" | "no_next_step" | "stale";

export const TODAY_GROUPS: { group: TodayGroup; label: string }[] = [
  { group: "overdue", label: "Overdue" },
  { group: "today", label: "Due today" },
  { group: "no_next_step", label: "No next step" },
  { group: "stale", label: "No touch in 7 days" },
];

export type TodayItem = {
  company: Company;
  group: TodayGroup;
  stage: string;
  nextStep: Task | null;
  phone: { number: string; label: string };
  inHours: boolean;
};

const rank = (group: TodayGroup) =>
  TODAY_GROUPS.findIndex((entry) => entry.group === group);

export const endOfDay = (now: Date) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
export const startOfDay = (now: Date) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

function groupOf(health: DealHealth, dayEnd: number): TodayGroup | null {
  if (health.state === "ok")
    return health.next_task_due && Date.parse(health.next_task_due) < dayEnd
      ? "today"
      : null;
  return health.state;
}

/**
 * Today's work queue, one row per business: overdue first, then due today, then
 * leads with no next step (best score first), then untouched leads. Inside a group,
 * businesses whose local time is 8am–8pm come first so calls land in their day.
 */
export function buildToday({
  health,
  tasks,
  contacts,
  companies,
  now = new Date(),
}: {
  health: DealHealth[];
  tasks: Task[];
  contacts: Contact[];
  companies: Company[];
  now?: Date;
}): TodayItem[] {
  const dayEnd = endOfDay(now);
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const contactsByCompany = new Map<Identifier, Contact[]>();
  const companyOfContact = new Map<Identifier, Identifier>();
  for (const contact of contacts) {
    const companyId = contact.company_id;
    if (companyId == null) continue;
    companyOfContact.set(contact.id, companyId);
    contactsByCompany.set(companyId, [
      ...(contactsByCompany.get(companyId) ?? []),
      contact,
    ]);
  }
  const nextTask = new Map<Identifier, Task>();
  for (const task of tasks) {
    if (task.done_date) continue;
    const companyId = companyOfContact.get(task.contact_id);
    if (companyId == null) continue;
    const current = nextTask.get(companyId);
    if (!current || Date.parse(task.due_date) < Date.parse(current.due_date))
      nextTask.set(companyId, task);
  }

  const byCompany = new Map<Identifier, TodayItem>();
  for (const row of health) {
    const group = groupOf(row, dayEnd);
    const company = companyById.get(row.company_id);
    if (!group || !company) continue;
    const existing = byCompany.get(company.id);
    if (existing && rank(existing.group) <= rank(group)) continue;
    const phone = preferredPhone(
      company,
      contactsByCompany.get(company.id) ?? [],
    );
    byCompany.set(company.id, {
      company,
      group,
      stage: row.stage,
      nextStep: nextTask.get(company.id) ?? null,
      phone: { number: phone.number, label: phone.label },
      inHours: !localTime(company.timezone, now).outside,
    });
  }

  const due = (item: TodayItem) =>
    item.nextStep ? Date.parse(item.nextStep.due_date) : Infinity;
  return [...byCompany.values()].sort(
    (a, b) =>
      rank(a.group) - rank(b.group) ||
      Number(b.inHours) - Number(a.inHours) ||
      (a.group === "no_next_step"
        ? (b.company.score ?? -1) - (a.company.score ?? -1)
        : due(a) - due(b)) ||
      a.company.name.localeCompare(b.company.name),
  );
}

/** "9:02 am · Chicago" in the business's own timezone, or null when unknown. */
export function shortLocalTime(timezone?: string | null, now = new Date()) {
  if (!timezone) return null;
  try {
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    })
      .format(now)
      .toLowerCase();
    const place = timezone.split("/").pop()?.replaceAll("_", " ");
    return place ? `${time} · ${place}` : time;
  } catch {
    return null;
  }
}

/** "3d" / "5h" / "20m": how far past due, for the Overdue chip. */
export function lateBy(due: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(due)) / 60000));
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`;
  return `${minutes}m`;
}

/** Tasks ticked off since midnight (viewer's day). */
export const doneToday = (tasks: Task[], now = new Date()) =>
  tasks.filter(
    (task) => task.done_date && Date.parse(task.done_date) >= startOfDay(now),
  ).length;
