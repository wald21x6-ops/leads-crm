import { CalendarClock, Check } from "lucide-react";
import { useGetList, useNotify, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Company, Contact, Deal, Task } from "../types";
import { ContactActions } from "./ContactActions";
import { LeadSection } from "./ResearchPanel";
import { NEXT_STEP_REQUESTED } from "./withStageNudge";

const dueText = (due: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(due));

/** The one thing to do next, then the call/WhatsApp tools to do it with. */
export function UpNext({ company }: { company: Company }) {
  const notify = useNotify();
  const [update, { isPending: saving }] = useUpdate<Task>();
  const { data: contacts = [], isPending: contactsPending } = useGetList<Contact>("contacts", {
    filter: { company_id: company.id },
    sort: { field: "id", order: "ASC" },
    pagination: { page: 1, perPage: 100 },
  });
  const contactIds = contacts.map((contact) => contact.id);
  const { data: tasks = [], isPending } = useGetList<Task>(
    "tasks",
    {
      filter: {
        "contact_id@in": `(${contactIds.join(",")})`,
        "done_date@is": null,
      },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 20 },
    },
    { enabled: contactIds.length > 0 },
  );
  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>("deals", {
    filter: { company_id: company.id },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  const [next, ...later] = tasks;
  const askNextStep = () => {
    if (!deals[0]) {
      notify("This business has no lead card yet. Add it to the board first.", {
        type: "warning",
      });
      return;
    }
    window.dispatchEvent(
      new CustomEvent(NEXT_STEP_REQUESTED, { detail: deals[0] }),
    );
  };
  const markDone = (task: Task) =>
    update(
      "tasks",
      {
        id: task.id,
        data: { done_date: new Date().toISOString() },
        previousData: task,
      },
      {
        onSuccess: () => {
          notify("Done. What’s next?", { type: "success" });
          askNextStep();
        },
        onError: () =>
          notify("Could not mark the task done. Try again.", { type: "error" }),
      },
    );
  const overdue = next && Date.parse(next.due_date) < Date.now();
  return (
    <LeadSection title="Up next">
      {contactsPending || (contactIds.length > 0 && isPending) ? (
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      ) : next ? (
        <div className="space-y-3 rounded-2xl bg-lime p-4 text-lime-foreground">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-lime-foreground/20">
              <CalendarClock className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{next.text}</p>
              <p className="text-sm">
                {overdue && <span className="font-semibold text-danger-on-lime">Overdue · </span>}
                Due {dueText(next.due_date)}
                <span className="sr-only"> (your time)</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-lime-foreground/25 bg-transparent hover:bg-card/60 dark:border-lime-foreground/30 dark:bg-transparent dark:text-lime-foreground"
              disabled={saving || dealsPending}
              onClick={() => markDone(next)}
            >
              <Check aria-hidden />
              Mark done
            </Button>
          </div>
          {later.length > 0 && (
            <ul className="space-y-1 border-t border-lime-foreground/15 pt-3 text-sm">
              {later.slice(0, 2).map((task) => (
                <li key={task.id}>
                  Then: {task.text}{" "}
                  <span className="text-lime-foreground/75">· {dueText(task.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4",
            "bg-warn-soft text-warn",
          )}
        >
          <p className="font-semibold">No next step yet.</p>
          <Button
            variant="outline"
            className="bg-card"
            disabled={dealsPending}
            onClick={askNextStep}
          >
            Set next step
          </Button>
        </div>
      )}
      <ContactActions company={company} bare />
    </LeadSection>
  );
}
