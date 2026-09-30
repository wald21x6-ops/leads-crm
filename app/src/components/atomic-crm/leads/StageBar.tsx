import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { useGetList, useNotify, useUpdate } from "ra-core";
import { cn } from "@/lib/utils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Deal } from "../types";

/**
 * Found → … → Won as one track; Lost sits apart. Tapping a stage moves the deal,
 * which fires the existing "what's the next step?" dialog (withStageNudge).
 */
export function StageBar({ company }: { company: Company }) {
  const { dealStages } = useConfigurationContext();
  const notify = useNotify();
  const [update, { isPending: saving }] = useUpdate<Deal>();
  const { data: deals = [] } = useGetList<Deal>("deals", {
    filter: { company_id: company.id },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  const deal = deals[0];
  const scroller = useRef<HTMLElement>(null);
  // On narrow screens the track scrolls; bring the current stage into view
  // without moving the page vertically.
  useEffect(() => {
    const box = scroller.current;
    const here = box?.querySelector<HTMLElement>('[aria-current="step"]');
    if (box && here)
      box.scrollLeft = here.offsetLeft - (box.clientWidth - here.clientWidth) / 2;
  }, [deal?.stage]);
  if (!deal) return null;
  const track = dealStages.filter((stage) => stage.value !== "lost");
  const current = track.findIndex((stage) => stage.value === deal.stage);
  const isLost = deal.stage === "lost";
  const move = (stage: string) => {
    if (stage === deal.stage || saving) return;
    update(
      "deals",
      { id: deal.id, data: { stage }, previousData: deal },
      {
        onError: () =>
          notify("Could not move the lead. Try again.", { type: "error" }),
      },
    );
  };
  return (
    <nav
      ref={scroller}
      aria-label="Stage"
      className="relative -mx-1 overflow-x-auto px-1 py-1 max-md:[mask-image:linear-gradient(to_right,transparent,black_6%,black_88%,transparent)] max-md:px-6"
    >
      <ol className="flex min-w-max items-center gap-1.5">
        {track.map((stage, index) => {
          const done = !isLost && index < current;
          const here = stage.value === deal.stage;
          return (
            <li key={stage.value}>
              <button
                type="button"
                onClick={() => move(stage.value)}
                disabled={saving}
                aria-current={here ? "step" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  here
                    ? "bg-lime text-lime-foreground ring-2 ring-teal-text"
                    : done
                      ? "bg-teal-text text-teal-foreground hover:opacity-90"
                      : "border bg-card/70 text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                {done && <Check className="size-3.5" aria-hidden />}
                {stage.label}
              </button>
            </li>
          );
        })}
        <li className="ml-2">
          <button
            type="button"
            onClick={() => move("lost")}
            disabled={saving}
            aria-current={isLost ? "step" : undefined}
            className={cn(
              "flex h-9 items-center rounded-full px-3.5 text-sm font-semibold transition-colors duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              isLost
                ? "bg-danger text-background"
                : "border border-dashed text-muted-foreground hover:bg-danger-soft hover:text-danger",
            )}
          >
            Lost
          </button>
        </li>
      </ol>
    </nav>
  );
}
