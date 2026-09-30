import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Company } from "../types";
import { LeadSection } from "./ResearchPanel";
import { SCORE_MAX, scoreFit, scoreReasons } from "./score";

/** Racetrack of ticks; the teal share is score / SCORE_MAX, starting top-left. */
const Meter = ({ fraction }: { fraction: number }) => {
  // useId() yields characters that are not valid inside url(#…).
  const mask = `meter-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const track = {
    x: 12,
    y: 12,
    width: 296,
    height: 116,
    rx: 58,
    fill: "none",
    pathLength: 100,
  } as const;
  return (
    <svg viewBox="0 0 320 140" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <mask id={mask}>
          <rect
            {...track}
            stroke="white"
            strokeWidth={30}
            strokeDasharray={`${fraction * 100} 100`}
          />
        </mask>
      </defs>
      <rect {...track} className="stroke-border" strokeWidth={18} strokeDasharray="0.35 0.55" />
      <rect
        {...track}
        className="stroke-teal"
        strokeWidth={18}
        strokeDasharray="0.35 0.55"
        mask={`url(#${mask})`}
      />
    </svg>
  );
};

export function ScoreCard({ company }: { company: Company }) {
  if (company.score == null)
    return (
      <LeadSection title="Lead score">
        <p className="text-muted-foreground">
          {company.research_status === "to_research"
            ? "Not researched yet. The robot scores it once the research runs."
            : "No score for this lead."}
        </p>
      </LeadSection>
    );
  const fit = scoreFit(company.score);
  const reasons = scoreReasons(company.research?.score_why);
  const fraction = Math.min(1, Math.max(0, company.score / SCORE_MAX));
  return (
    <LeadSection title="Lead score">
      <div className="relative mx-auto aspect-[32/14] w-full max-w-80">
        <Meter fraction={fraction} />
        <div className="absolute inset-0 flex items-center justify-center gap-4">
          <p className="text-6xl font-light tabular-nums leading-none">
            <span className="sr-only">Score </span>
            {company.score}
            <span className="sr-only"> out of {SCORE_MAX}</span>
          </p>
          <div className="flex flex-col items-start gap-1.5">
            <span className="text-sm text-muted-foreground" aria-hidden>
              out of {SCORE_MAX}
            </span>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", fit.tone)}>
              {fit.label}
            </span>
          </div>
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="space-y-2.5 pt-1">
          {reasons.map(({ points, reason }) => (
            <li key={reason} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  "mt-px grid size-6 shrink-0 place-items-center rounded-full border",
                  points != null && points < 0
                    ? "border-danger/30 text-danger"
                    : "border-teal/40 text-teal-text",
                )}
                aria-hidden
              >
                {points != null && points < 0 ? (
                  <Minus className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </span>
              <span>
                {reason}
                {points != null && (
                  <span className="font-semibold">
                    {" "}
                    {points > 0 ? `+${points}` : points}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </LeadSection>
  );
}
