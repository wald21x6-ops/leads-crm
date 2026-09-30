import { useEffect, useState, type FormEvent } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  type RaRecord,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Company, Deal } from "../types";
import { LeadSection } from "./ResearchPanel";
import { replyTime } from "./rules";
import {
  buildOwnerReport,
  CHANNEL_GUIDES,
  CHANNELS,
  TEST_GROUND_RULES,
} from "./testKit";

interface EnquiryTest extends RaRecord {
  company_id: Company["id"];
  channel: string;
  what_sent: string;
  sent_at: string;
  replied_at?: string | null;
  reply_summary?: string;
  observed?: string;
}
const localInput = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function EnquiryTests({ company }: { company: Company }) {
  const provider = useDataProvider();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [editing, setEditing] = useState<EnquiryTest | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [offerTested, setOfferTested] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("web_form");
  const guide = CHANNEL_GUIDES[channel] ?? CHANNEL_GUIDES.other;
  const openForm = (test: EnquiryTest | null) => {
    setChannel(test?.channel ?? "web_form");
    setEditing(test);
  };
  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildOwnerReport(company, data, now));
      notify("Report copied. Paste it into your message to the owner.", {
        type: "success",
      });
    } catch {
      notify("Copy unavailable in this browser.", { type: "warning" });
    }
  };
  const {
    data = [],
    total = 0,
    isPending,
    error,
  } = useGetList<EnquiryTest>("enquiry_tests", {
    filter: { company_id: company.id },
    sort: { field: "sent_at", order: "DESC" },
    pagination: { page, perPage: 10 },
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const sent = new Date(String(values.get("sent_at"))).toISOString();
    const replied = values.get("replied_at")
      ? new Date(String(values.get("replied_at"))).toISOString()
      : null;
    if (replied && replied < sent) {
      notify("Reply time must be after the enquiry was sent.", {
        type: "warning",
      });
      return;
    }
    const whatSent = String(values.get("what_sent")).trim();
    if (!whatSent) {
      notify("Describe what was sent or done.", { type: "warning" });
      return;
    }
    const row = {
      company_id: company.id,
      channel: values.get("channel"),
      what_sent: whatSent,
      sent_at: sent,
      replied_at: replied,
      reply_summary: values.get("reply_summary"),
      observed: values.get("observed"),
      sales_id: identity?.id,
    };
    setBusy(true);
    try {
      if (editing)
        await provider.update("enquiry_tests", {
          id: editing.id,
          data: row,
          previousData: editing,
        });
      else await provider.create("enquiry_tests", { data: row });
      if (!editing && total === 0) setOfferTested(true);
      setEditing(undefined);
      notify("Enquiry test saved", { type: "success" });
      refresh();
    } catch {
      notify("Could not save the test. Your entries are still here.", {
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const move = async () => {
    setBusy(true);
    try {
      const { data: deals } = await provider.getList<Deal>("deals", {
        filter: { company_id: company.id },
        sort: { field: "id", order: "ASC" },
        pagination: { page: 1, perPage: 1 },
      });
      if (!deals[0]) throw new Error();
      await provider.update("deals", {
        id: deals[0].id,
        data: { stage: "tested" },
        previousData: deals[0],
      });
      setOfferTested(false);
      refresh();
    } catch {
      notify("Could not move the lead to Tested", { type: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <LeadSection title="Outside-in enquiry tests">
      <p className="text-sm text-muted-foreground">
        Contact this business the way a customer would, then log exactly what
        happened. Times below use your device timezone.
      </p>
      <details className="text-sm border rounded-md p-3">
        <summary className="cursor-pointer font-medium">
          Before you test
        </summary>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          {TEST_GROUND_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>
      {isPending && <p>Loading tests…</p>}
      {error && <p className="text-destructive">Could not load tests.</p>}
      {!isPending && !error && !data.length && <p>No tests recorded yet.</p>}
      {data.map((test) => (
        <div key={test.id} className="border rounded-md p-3 space-y-2">
          <div className="flex justify-between gap-2">
            <h3 className="font-medium">
              {CHANNEL_GUIDES[test.channel]?.label ?? test.channel}
            </h3>
            <Button variant="outline" size="sm" onClick={() => openForm(test)}>
              Edit test
            </Button>
          </div>
          <p>{test.what_sent}</p>
          <p className="text-sm">
            Sent {new Date(test.sent_at).toLocaleString()}
          </p>
          <p className="font-medium">
            {replyTime(test.sent_at, test.replied_at, now)}
          </p>
          {test.reply_summary && <p>Reply: {test.reply_summary}</p>}
          {test.observed && <p>Observed: {test.observed}</p>}
        </div>
      ))}
      {total > 10 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page * 10 >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {editing === undefined ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => openForm(null)}
            disabled={isPending || !!error}
          >
            Add enquiry test
          </Button>
          {data.length > 0 && (
            <Button variant="outline" onClick={copyReport}>
              Copy report for the owner
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={save} key={editing?.id ?? "new"} className="space-y-3">
          <label className="block text-sm">
            Channel
            <select
              name="channel"
              className="block w-full border rounded-md p-2 bg-background"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              {CHANNELS.map((value) => (
                <option key={value} value={value}>
                  {CHANNEL_GUIDES[value].label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm rounded-md bg-muted p-3">
            <p className="font-medium mb-1">How to run this test</p>
            <ol className="list-decimal pl-5 space-y-1">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <label className="block text-sm">
            What was sent or done
            <Textarea
              name="what_sent"
              required
              defaultValue={editing?.what_sent}
              placeholder={guide.example}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm min-w-0">
              Sent at
              <Input
                name="sent_at"
                type="datetime-local"
                required
                defaultValue={localInput(
                  editing?.sent_at ?? new Date().toISOString(),
                )}
              />
            </label>
            <label className="block text-sm min-w-0">
              Replied at (leave blank if no reply)
              <Input
                name="replied_at"
                type="datetime-local"
                defaultValue={localInput(editing?.replied_at)}
              />
            </label>
          </div>
          <label className="block text-sm">
            Reply summary
            <Textarea
              name="reply_summary"
              defaultValue={editing?.reply_summary ?? ""}
            />
          </label>
          <label className="block text-sm">
            Observed facts
            <Textarea
              name="observed"
              defaultValue={editing?.observed ?? ""}
              placeholder="Facts only, without judgement"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Save test
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {offerTested && (
        <div role="status" className="space-y-2">
          <p>First test saved. Move this lead to Tested?</p>
          <Button onClick={move} disabled={busy}>
            Move to Tested
          </Button>{" "}
          <Button variant="outline" onClick={() => setOfferTested(false)}>
            Keep current stage
          </Button>
        </div>
      )}
    </LeadSection>
  );
}
