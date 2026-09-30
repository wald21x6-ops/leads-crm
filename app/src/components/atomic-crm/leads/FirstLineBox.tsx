import { useEffect, useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Company } from "../types";
import { LeadSection } from "./ResearchPanel";

export function FirstLineBox({ company }: { company: Company }) {
  const [value, setValue] = useState(company.first_line ?? "");
  const [pending, setPending] = useState(false);
  const provider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  useEffect(
    () => setValue(company.first_line ?? ""),
    [company.id, company.first_line],
  );
  const save = async () => {
    if (value.trim().split(/\s+/).length > 25) {
      notify("Keep the first line to 25 words or fewer.", { type: "warning" });
      return;
    }
    setPending(true);
    try {
      await provider.update("companies", {
        id: company.id,
        data: { first_line: value.trim() },
        previousData: company,
      });
      notify("First line saved", { type: "success" });
      refresh();
    } catch {
      notify("Could not save first line", { type: "error" });
    } finally {
      setPending(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied", { type: "success" });
    } catch {
      notify("Copy unavailable. Select and copy the sentence.", {
        type: "warning",
      });
    }
  };
  return (
    <LeadSection title="First line">
      <label htmlFor="first-line" className="text-sm">
        Use one sentence based on observed facts, up to 25 words.
      </label>
      <Textarea
        id="first-line"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={save}
          disabled={pending || value === (company.first_line ?? "")}
        >
          Save first line
        </Button>
        <Button variant="outline" onClick={copy} disabled={!value}>
          Copy
        </Button>
      </div>
    </LeadSection>
  );
}
