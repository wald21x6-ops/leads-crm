import type { ReactNode } from "react";
import { useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Company } from "../types";

export const LeadSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Card>
    <CardHeader>
      <CardTitle><h2>{title}</h2></CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 min-w-0 break-words">
      {children}
    </CardContent>
  </Card>
);
export const SourceLink = ({
  url,
  children = "Source",
}: {
  url?: string;
  children?: ReactNode;
}) => {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-sm"
    >
      {children}
    </a>
  );
};
export function ResearchPanel({ company }: { company: Company }) {
  const provider = useDataProvider();
  const refresh = useRefresh();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const research = company.research;
  if (company.research_status === "to_research")
    return (
      <LeadSection title="Research">
        <p>Waiting for research</p>
        <p className="text-sm text-muted-foreground">
          Ask Claude to “research the new list” and the robot fills this in.
        </p>
      </LeadSection>
    );
  if (!research) return null;
  const verify = async (index: number, checked: boolean) => {
    setBusy(true);
    try {
      // Re-read before patching to preserve new robot facts added since this page loaded.
      const { data: latest } = await provider.getOne<Company>("companies", {
        id: company.id,
      });
      const complaint = research.complaints?.[index];
      const complaints = latest.research?.complaints?.map((item) =>
        item.quote === complaint?.quote && item.url === complaint?.url
          ? { ...item, verified_by_human: checked }
          : item,
      );
      await provider.update("companies", {
        id: company.id,
        data: { research: { ...latest.research, complaints } },
        previousData: latest,
      });
      refresh();
    } catch {
      notify("Could not save verification. Please try again.", {
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <LeadSection title="Research">
      {company.description && <p>{company.description}</p>}
      {company.score != null && (
        <p className="font-medium">Score: {company.score}</p>
      )}
      {research.score_why && <p>{research.score_why}</p>}
      {research.error && (
        <p className="text-destructive">Research failed: {research.error}</p>
      )}
      {research.facts?.map((fact, index) => (
        <p key={index}>
          {fact.text} <SourceLink url={fact.source} />
        </p>
      ))}
      {research.owner?.name && (
        <p>
          Owner: {research.owner.name}{" "}
          {research.owner.confidence &&
            `(${research.owner.confidence} confidence)`}{" "}
          <SourceLink url={research.owner.source_url} />
        </p>
      )}
      {research.instant_reply && (
        <div className="text-sm space-y-1">
          <p>
            Chat tools:{" "}
            {research.instant_reply.chat_tools == null ? "Unknown" : research.instant_reply.chat_tools.join(", ") || "None found"}
          </p>
          <p>
            Booking tools:{" "}
            {research.instant_reply.booking_tools == null ? "Unknown" : research.instant_reply.booking_tools.join(", ") || "None found"}
          </p>
          {research.instant_reply.has_form != null && (
            <p>
              Enquiry form:{" "}
              {research.instant_reply.has_form ? "Found" : "Not found"}
            </p>
          )}
        </div>
      )}
      {research.complaints?.map((complaint, index) => (
        <div key={index} className="border rounded-md p-3 space-y-2">
          <p>
            “{complaint.quote}” <SourceLink url={complaint.url} />
          </p>
          <label className="flex gap-2 items-center text-sm">
            <input
              type="checkbox"
              checked={!!complaint.verified_by_human}
              disabled={busy}
              onChange={(event) => verify(index, event.target.checked)}
            />
            {complaint.verified_by_human
              ? "Verified by human"
              : "Unverified — tick after checking source"}
          </label>
        </div>
      ))}
      {!!research.marketplaces?.length && (
        <p>
          Marketplaces:{" "}
          {research.marketplaces.map((item, index) => (
            <span key={index} className="mr-2">
              {item.name} <SourceLink url={item.url} />
            </span>
          ))}
        </p>
      )}
      {!!research.unknowns?.length && (
        <p className="text-sm text-muted-foreground">
          Unknown: {research.unknowns.join(", ")}
        </p>
      )}
    </LeadSection>
  );
}
