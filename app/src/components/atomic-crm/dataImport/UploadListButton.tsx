import { useState, type ChangeEvent } from "react";
import Papa from "papaparse";
import { useDataProvider, useGetIdentity, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { importLeadRows } from "./useCompanyImport";
import type { ImportRow } from "./types";

export function UploadListButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof importLeadRows>
  > | null>(null);
  const provider = useDataProvider();
  const { identity } = useGetIdentity();
  const refresh = useRefresh();
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const parsed = Papa.parse<ImportRow>(await file.text(), {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim().toLowerCase(),
      });
      if (
        !parsed.meta.fields?.includes("name") ||
        !parsed.meta.fields.includes("city")
      )
        throw new Error("CSV needs name and city columns.");
      if (parsed.errors.length)
        throw new Error(parsed.errors.map((error) => error.message).join("; "));
      setResult(await importLeadRows(provider, parsed.data, identity?.id));
      refresh();
    } catch (error) {
      setResult({
        added: 0,
        skipped: 0,
        errors: [
          error instanceof Error ? error.message : "Could not read file",
        ],
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Upload list
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogTitle>Upload a lead list</DialogTitle>
          <DialogDescription>
            CSV columns: name, city. Optional: website, phone, state,
            business_type, source. Each business gets a Found card and a Front
            desk contact.
          </DialogDescription>
          <label className="text-sm space-y-2">
            Choose CSV file
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={upload}
            />
          </label>
          {busy && <p role="status">Adding leads… Keep this page open.</p>}
          {result && (
            <div role="status" className="space-y-2">
              <p>
                Added {result.added}, skipped {result.skipped} duplicates
              </p>
              {result.errors.length > 0 && (
                <div className="text-sm text-destructive max-h-48 overflow-y-auto">
                  <p>{result.errors.length} issues:</p>
                  {result.errors.map((error, index) => (
                    <p key={index}>{error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
