import { useEffect, useRef, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Company, Contact, Deal } from "../types";
import { LeadSection } from "./ResearchPanel";
import {
  isE164,
  localTime,
  preferredPhone,
  whatsappWarning,
  kolkataDay,
} from "./rules";

const outcomes = [
  ["no_answer", "No answer"],
  ["voicemail", "Voicemail"],
  ["gatekeeper", "Gatekeeper"],
  ["spoke_owner", "Spoke to owner"],
  ["booked", "Booked"],
  ["not_interested", "Not interested"],
  ["wrong_number", "Wrong number"],
];
/**
 * Call, WhatsApp and call-outcome logging. `bare` drops the card wrapper so the
 * lead page can place it inside "Up next". On phones the Call/WhatsApp pair is
 * pinned above the bottom navigation so it stays under the thumb.
 */
export function ContactActions({
  company,
  bare = false,
}: {
  company: Company;
  bare?: boolean;
}) {
  const provider = useDataProvider();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const {
    data: contacts = [],
    isPending,
    error,
  } = useGetList<Contact>("contacts", {
    filter: { company_id: company.id },
    sort: { field: "id", order: "ASC" },
    pagination: { page: 1, perPage: 100 },
  });
  const [now, setNow] = useState(new Date());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [offerLost, setOfferLost] = useState(false);
  const warningRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (warning) warningRef.current?.scrollIntoView({ block: "center" });
  }, [warning]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setWarning(null);
    setCount(null);
    setOfferLost(false);
    setNote("");
  }, [company.id]);
  const phone = preferredPhone(company, contacts);
  const time = localTime(company.timezone, now);
  const valid = isE164(phone.number);
  const log = async (outcome: string) => {
    setBusy(true);
    try {
      await provider.create("call_logs", {
        data: {
          company_id: company.id,
          contact_id: phone.contactId ?? null,
          outcome,
          note: note.trim() || null,
          called_at: new Date().toISOString(),
          sales_id: identity?.id,
        },
      });
      setNote("");
      notify("Call outcome saved", { type: "success" });
      refresh();
      if (outcome === "not_interested") setOfferLost(true);
    } catch {
      notify("Could not save call outcome. Please try again.", {
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const lose = async () => {
    setBusy(true);
    try {
      const { data: deals } = await provider.getList<Deal>("deals", {
        filter: { company_id: company.id },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (!deals[0]) throw new Error();
      await provider.update("deals", {
        id: deals[0].id,
        data: { stage: "lost" },
        previousData: deals[0],
      });
      setOfferLost(false);
      refresh();
    } catch {
      notify("Could not move the lead to Lost", { type: "error" });
    } finally {
      setBusy(false);
    }
  };
  const openWhatsApp = async () => {
    if (!valid) return;
    setBusy(true);
    // Reserve a tab on the user's click; async logging must finish before navigation.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const today = new Date();
      const dayStart = new Date(
        `${kolkataDay(today)}T00:00:00+05:30`,
      ).toISOString();
      const [latest, daily] = await Promise.all([
        provider.getList("whatsapp_opens", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "opened_at", order: "DESC" },
          filter: {},
        }),
        provider.getList("whatsapp_opens", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "opened_at", order: "DESC" },
          filter: { "opened_at@gte": dayStart },
        }),
      ]);
      if (daily.total == null)
        throw new Error(
          "Could not check today's WhatsApp count. Please retry.",
        );
      const status = whatsappWarning(
        latest.data as { opened_at: string }[],
        today,
        daily.total,
      );
      setCount(status.count);
      if (status.needsWarning && !warning) {
        tab?.close();
        setWarning(status.reasons);
        return;
      }
      if (!tab) throw new Error("Allow pop-ups, then try again.");
      await provider.create("whatsapp_opens", {
        data: {
          company_id: company.id,
          opened_at: new Date().toISOString(),
          sales_id: identity?.id,
        },
      });
      tab.location.href = `https://wa.me/${phone.number.slice(1)}?text=${encodeURIComponent(company.first_line ?? "")}`;
      setCount(status.count + 1);
      setWarning(null);
      refresh();
    } catch (error) {
      tab?.close();
      notify(
        error instanceof Error
          ? error.message
          : "Could not log WhatsApp open. Please try again.",
        { type: "error" },
      );
    } finally {
      setBusy(false);
    }
  };
  const content = (
    <>
      {!bare && <p>{time.text}</p>}
      {time.outside && (
        <p className="text-warn">
          Outside 8am–8pm at this business.
        </p>
      )}
      {error ? (
        <p className="text-destructive">
          Could not load contacts. Retry before calling.
        </p>
      ) : (
        <p>
          {phone.label}: {phone.number || "No number supplied"}
        </p>
      )}
      {!valid && phone.number && (
        <p className="text-destructive">
          Number needs country code (E.164: + followed by digits).
        </p>
      )}
      <div className="flex flex-wrap gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-[var(--mobile-nav-h)] max-md:z-40 max-md:grid max-md:auto-cols-fr max-md:grid-flow-col max-md:border-t max-md:bg-card max-md:px-4 max-md:py-2.5">
        {valid && !isPending && !error && (
          <Button asChild>
            <a href={`tel:${phone.number}`}>Call {phone.label.toLowerCase()}</a>
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy || !valid || isPending || !!error}
          onClick={openWhatsApp}
        >
          {warning ? "Open WhatsApp anyway" : "WhatsApp"}
        </Button>
      </div>
      {count != null && (
        <p className="text-sm">{count} opens today · India time</p>
      )}
      {warning && (
        <div
          ref={warningRef}
          role="alert"
          className="border border-warn bg-warn-soft rounded-2xl p-3 space-y-2"
        >
          <p>
            Your number was restricted on 26 Sep for sending too many cold chats
          </p>
          {warning.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          <p>Click “Open WhatsApp anyway” again to continue.</p>
          <Button variant="outline" onClick={() => setWarning(null)}>
            Cancel
          </Button>
        </div>
      )}
      <label htmlFor="call-note" className="text-sm">
        Call note (optional)
      </label>
      <Textarea
        id="call-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="text-sm font-medium">Log the outcome after your call</p>
      <div className="flex flex-wrap gap-2">
        {outcomes.map(([value, label]) => (
          <Button
            key={value}
            variant="outline"
            disabled={busy || isPending || !!error}
            onClick={() => log(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {offerLost && (
        <div role="status" className="space-y-2">
          <p>Move this lead to Lost?</p>
          <Button onClick={lose} disabled={busy}>
            Move to Lost
          </Button>{" "}
          <Button variant="outline" onClick={() => setOfferLost(false)}>
            Keep current stage
          </Button>
        </div>
      )}
    </>
  );
  // A plain element (not a component made during render) so typing in the note keeps focus.
  return bare ? (
    <div className="space-y-3 pt-2">{content}</div>
  ) : (
    <LeadSection title="Call or WhatsApp">{content}</LeadSection>
  );
}
