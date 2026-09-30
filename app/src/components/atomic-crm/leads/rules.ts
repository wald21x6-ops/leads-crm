import type { Identifier, RaRecord } from "ra-core";
import type { Company, Contact } from "../types";

export type HealthState = "overdue" | "stale" | "no_next_step" | "ok";
export type DealHealth = RaRecord & {
  company_id: Identifier;
  stage: string;
  created_at: string;
  last_touch_at: string;
  next_task_due: string | null;
  open_task_count: number;
  state: HealthState;
};
export function healthState(
  health: Omit<DealHealth, "state">,
  now = Date.now(),
): HealthState {
  if (["won", "lost"].includes(health.stage)) return "ok";
  if (health.next_task_due && Date.parse(health.next_task_due) < now)
    return "overdue";
  const cutoff = now - 7 * 86400000;
  if (
    Date.parse(health.created_at) < cutoff &&
    Date.parse(health.last_touch_at) < cutoff
  )
    return "stale";
  return health.open_task_count === 0 ? "no_next_step" : "ok";
}
export const healthLabels: Record<HealthState, string> = {
  overdue: "Overdue",
  stale: "No touch 7d",
  no_next_step: "No next step",
  ok: "",
};
export const healthBorders: Record<HealthState, string> = {
  overdue: "border-danger border-2",
  stale: "border-danger border-2",
  no_next_step: "border-warn border-2",
  ok: "",
};
export const kolkataDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function whatsappWarning(
  opens: { opened_at: string }[],
  now = new Date(),
  todayCount?: number,
) {
  const count =
    todayCount ??
    opens.filter(
      (open) => kolkataDay(new Date(open.opened_at)) === kolkataDay(now),
    ).length;
  const latest = Math.max(...opens.map((open) => Date.parse(open.opened_at)));
  const reasons = [];
  if (count >= 15)
    reasons.push(`${count} chats opened today (India time; limit 15)`);
  if (now.getTime() - latest < 12 * 60000)
    reasons.push("Last chat opened less than 12 minutes ago");
  return { count, reasons, needsWarning: reasons.length > 0 };
}
export const isE164 = (phone: string) => /^\+[1-9]\d{7,14}$/.test(phone);
export function preferredPhone(company: Company, contacts: Contact[]) {
  for (const contact of contacts) {
    if (contact.title?.toLowerCase() !== "owner") continue;
    const mobile = contact.phone_jsonb?.find(
      (phone) => phone.type === "Mobile" && phone.number,
    );
    if (mobile)
      return {
        number: mobile.number,
        label: "Owner mobile",
        contactId: contact.id,
      };
  }
  return {
    number: company.phone_number ?? "",
    label: "Business line",
    contactId: contacts[0]?.id,
  };
}
export function localTime(timezone?: string | null, now = new Date()) {
  if (!timezone)
    return {
      text: "Local time unknown — timezone not supplied",
      outside: false,
    };
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(now),
    );
    return {
      text:
        new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(now) + ` (${timezone})`,
      outside: hour < 8 || hour >= 20,
    };
  } catch {
    return { text: "Local time unknown — invalid timezone", outside: false };
  }
}
export function replyTime(
  sent: string,
  replied?: string | null,
  now = Date.now(),
) {
  const minutes = Math.max(
    0,
    Math.floor(
      ((replied ? Date.parse(replied) : now) - Date.parse(sent)) / 60000,
    ),
  );
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const duration = days ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`;
  return replied ? duration : `No reply after ${duration}`;
}
export function externalKey(
  name: string,
  city: string,
  state: string,
  website?: string,
) {
  if (website?.trim()) {
    const url = new URL(
      /^https?:\/\//i.test(website) ? website : `https://${website}`,
    );
    return url.hostname.toLowerCase().replace(/^www\./, "");
  }
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}|${state.trim()}`;
}
