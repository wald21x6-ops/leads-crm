import { useEffect, useState, type FormEvent } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Contact, Deal } from "../types";
import { NEXT_STEP_REQUESTED, STAGE_CHANGED } from "./withStageNudge";
import { findDealLabel } from "../deals/dealUtils";
import { useConfigurationContext } from "../root/ConfigurationContext";

export function NextStepNudge() {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [stageMoved, setStageMoved] = useState(true);
  const [pending, setPending] = useState(false);
  const provider = useDataProvider();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const { dealStages } = useConfigurationContext();
  useEffect(() => {
    const listener = (event: Event) => {
      setStageMoved(event.type === STAGE_CHANGED);
      setDeal((event as CustomEvent<Deal>).detail);
      refresh();
    };
    window.addEventListener(STAGE_CHANGED, listener);
    window.addEventListener(NEXT_STEP_REQUESTED, listener);
    return () => {
      window.removeEventListener(STAGE_CHANGED, listener);
      window.removeEventListener(NEXT_STEP_REQUESTED, listener);
    };
  }, [refresh]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deal) return;
    const values = new FormData(event.currentTarget);
    const text = String(values.get("text")).trim();
    if (!text) return;
    setPending(true);
    try {
      const { data: contacts } = await provider.getList<Contact>("contacts", {
        filter: { company_id: deal.company_id },
        sort: { field: "id", order: "ASC" },
        pagination: { page: 1, perPage: 1 },
      });
      if (!contacts[0])
        throw new Error(
          "Add a contact to this business before scheduling a next step.",
        );
      await provider.create("tasks", {
        data: {
          contact_id: contacts[0].id,
          text,
          due_date: new Date(String(values.get("due_date"))).toISOString(),
          type: "follow-up",
          sales_id: identity?.id,
          done_date: null,
        },
      });
      setDeal(null);
      refresh();
      notify("Next step saved", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not save next step",
        { type: "error" },
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open={!!deal}
      onOpenChange={(open) => {
        if (!open && !pending) setDeal(null);
      }}
    >
      <DialogContent>
        <DialogTitle>What’s the next step, and when?</DialogTitle>
        <DialogDescription>
          {stageMoved ? (
            <>
              {deal?.name} moved to{" "}
              {deal ? (findDealLabel(dealStages, deal.stage) ?? deal.stage) : ""}.
              You can skip this for now.
            </>
          ) : (
            <>Set the next step for {deal?.name}, so this lead isn’t forgotten.</>
          )}
        </DialogDescription>
        <form
          onSubmit={save}
          className="space-y-4"
          key={deal ? `${deal.id}-${deal.stage}` : "closed"}
        >
          <label className="block text-sm">
            Next step
            <Input
              name="text"
              required
              autoFocus
              placeholder="Call the owner"
            />
          </label>
          <label className="block text-sm">
            When (your local time)
            <Input name="due_date" type="datetime-local" required />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              Save next step
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeal(null)}
            >
              Skip
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
