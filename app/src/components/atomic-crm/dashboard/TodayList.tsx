import { useMemo } from "react";
import { useGetList, useGetMany } from "ra-core";
import { Link } from "react-router";
import { Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Contact, Task } from "../types";
import type { DealHealth } from "../leads/rules";
import { scoreFit } from "../leads/score";
import {
  TODAY_GROUPS,
  buildToday,
  doneToday,
  lateBy,
  shortLocalTime,
  startOfDay,
  type TodayItem,
} from "./today";

const ALL = { page: 1, perPage: 1000 };

/** Loads everything the queue needs in parallel and returns the ordered rows. */
export function useTodayItems() {
  const health = useGetList<DealHealth>("deal_health", {
    pagination: ALL,
    sort: { field: "id", order: "ASC" },
  });
  const tasks = useGetList<Task>("tasks", {
    pagination: ALL,
    sort: { field: "due_date", order: "ASC" },
    filter: { "done_date@is": null },
  });
  // Fixed per mount: a new timestamp each render would change the query key and refetch forever.
  const since = useMemo(() => new Date(startOfDay(new Date())).toISOString(), []);
  const doneTasks = useGetList<Task>("tasks", {
    pagination: ALL,
    sort: { field: "due_date", order: "ASC" },
    filter: { "done_date@gte": since },
  });
  const companyIds = useMemo(
    () => [...new Set((health.data ?? []).map((row) => row.company_id))],
    [health.data],
  );
  const companies = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );
  const contacts = useGetList<Contact>(
    "contacts",
    {
      pagination: ALL,
      filter: { "company_id@in": `(${companyIds.join(",")})` },
    },
    { enabled: companyIds.length > 0 },
  );
  const isPending =
    health.isPending ||
    tasks.isPending ||
    (companyIds.length > 0 && (companies.isPending || contacts.isPending));
  const items = useMemo(
    () =>
      isPending
        ? []
        : buildToday({
            health: health.data ?? [],
            tasks: tasks.data ?? [],
            contacts: contacts.data ?? [],
            companies: companies.data ?? [],
          }),
    [isPending, health.data, tasks.data, contacts.data, companies.data],
  );
  const error = health.error ?? tasks.error ?? companies.error ?? contacts.error;
  return {
    items,
    done: doneToday(doneTasks.data ?? []),
    isPending,
    error,
  };
}

/**
 * The evening work queue. `hrefFor` decides where a row opens: the side pane on
 * desktop, the lead page on phone.
 */
export const TodayList = ({
  items,
  done,
  isPending,
  error,
  selectedId,
  hrefFor,
}: ReturnType<typeof useTodayItems> & {
  selectedId?: Company["id"];
  hrefFor: (item: TodayItem) => string;
}) => {
  const heading = (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-3xl font-semibold tracking-tight">Today</h2>
      {!isPending && !error && (
        <p className="text-sm text-muted-foreground pb-1">
          {items.length} to do · {done} done today
        </p>
      )}
    </div>
  );
  if (error)
    return (
      <section className="flex flex-col gap-4">
        {heading}
        <p className="rounded-3xl border bg-card p-4 text-sm text-danger">
          Couldn't load today's list. Pull down or press refresh to try again.
        </p>
      </section>
    );
  if (isPending)
    return (
      <section className="flex flex-col gap-4" aria-busy="true">
        {heading}
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-3xl" />
        ))}
      </section>
    );
  if (items.length === 0)
    return (
      <section className="flex flex-col gap-4">
        {heading}
        <div className="rounded-3xl border bg-card p-5 text-sm">
          <p className="font-semibold">Nothing due. Every lead has a next step.</p>
          <p className="text-muted-foreground mt-1">
            Pick a lead from the{" "}
            <Link to="/deals" className="underline underline-offset-2">
              Leads board
            </Link>{" "}
            or upload a new list there.
          </p>
        </div>
      </section>
    );
  return (
    <section className="flex flex-col gap-4">
      {heading}
      {TODAY_GROUPS.map(({ group, label }) => {
        const rows = items.filter((item) => item.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-2.5">
            <h3 className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
              <span className="h-px flex-1 bg-border" aria-hidden />
              {label} · {rows.length}
              <span className="h-px flex-1 bg-border" aria-hidden />
            </h3>
            <ul className="flex flex-col gap-2.5">
              {rows.map((item) => (
                <TodayRow
                  key={item.company.id}
                  item={item}
                  href={hrefFor(item)}
                  selected={item.company.id === selectedId}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
};

const TodayRow = ({
  item,
  href,
  selected,
}: {
  item: TodayItem;
  href: string;
  selected: boolean;
}) => {
  const { dealStages } = useConfigurationContext();
  const { company, nextStep, phone, group, inHours } = item;
  const stage =
    dealStages.find((s) => s.value === item.stage)?.label ?? item.stage;
  const time = shortLocalTime(company.timezone);
  const summary = nextStep
    ? nextStep.text
    : group === "stale"
      ? "No touch in 7 days. Check in or close it."
      : "No next step yet. Decide one.";
  return (
    <li
      className={cn(
        "relative rounded-3xl border p-4 transition-colors duration-150",
        selected
          ? "bg-lime border-lime text-lime-foreground"
          : "bg-card hover:bg-accent/60",
      )}
    >
      <Link
        to={href}
        aria-current={selected ? "true" : undefined}
        className="block pr-14 outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/60"
      >
        <span className="block text-base font-semibold leading-snug">
          {company.name}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-sm line-clamp-2",
            selected ? "text-lime-foreground/80" : "text-muted-foreground",
          )}
        >
          {summary}
        </span>
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 pr-12 text-xs font-semibold">
        {group === "overdue" && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1",
              selected
                ? "bg-lime-foreground/10 text-danger-on-lime"
                : "bg-danger-soft text-danger",
            )}
          >
            {nextStep ? `${lateBy(nextStep.due_date)} late` : "Overdue"}
          </span>
        )}
        <span
          className={cn(
            "rounded-full border px-2.5 py-1",
            selected ? "border-lime-foreground/20" : "bg-background",
          )}
        >
          {stage}
        </span>
        {time && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-1",
              selected ? "border-lime-foreground/20" : "bg-background",
              !inHours &&
                (selected ? "text-lime-foreground/70" : "text-muted-foreground"),
            )}
            title={inHours ? "Their business hours" : "Outside 8am–8pm there"}
          >
            {inHours ? "Open" : "Closed"} · {time}
          </span>
        )}
      </div>
      {phone.number && (
        <a
          href={`tel:${phone.number}`}
          aria-label={`Call ${company.name} (${phone.label.toLowerCase()})${inHours ? "" : ", closed now"}`}
          className={cn(
            "absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full border transition-colors duration-150",
            !inHours && "border-dashed opacity-60",
            selected
              ? "border-lime-foreground bg-lime-foreground text-lime hover:bg-lime-foreground/85"
              : "bg-card hover:bg-accent",
          )}
        >
          <Phone className="size-4" />
        </a>
      )}
      {company.score != null && (
        <span
          className={cn(
            "absolute bottom-3 right-3 grid size-9 place-items-center rounded-full text-sm font-bold",
            selected ? "bg-lime-foreground text-lime" : scoreFit(company.score).tone,
          )}
          title="Research score (higher = better fit)"
        >
          <span className="sr-only">Score </span>
          {company.score}
        </span>
      )}
    </li>
  );
};
