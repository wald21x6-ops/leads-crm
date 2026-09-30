import { externalKey } from "../leads/rules";
import { createFoundDeal } from "./useDealImport";
import { useCallback } from "react";
import { useDataProvider, useGetIdentity } from "ra-core";

import { mapSizeToCategory } from "../companies/sizes";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { createEachRow } from "./createEachRow";
import { toConfiguredValue, toNumber, toText } from "./parseCell";
import type { ImportCell, ProcessImportBatch } from "./types";

/**
 * Creates a company per CSV row. Unknown columns are ignored, missing ones are
 * left empty — except `name`, which the database requires.
 */
export function useCompanyImport(): ProcessImportBatch {
  const { companySectors } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();

  return useCallback(
    (batch) =>
      createEachRow(
        batch.map((row) =>
          dataProvider.create("companies", {
            data: {
              name: toText(row.name),
              sector: toConfiguredValue(row.sector, companySectors),
              size: sizeOf(row.size),
              linkedin_url: toText(row.linkedin_url),
              website: toText(row.website),
              phone_number: toText(row.phone_number ?? row.phone),
              address: toText(row.address),
              zipcode: toText(row.zipcode),
              city: toText(row.city),
              state_abbr: toText(row.state_abbr ?? row.state),
              country: toText(row.country),
              description: toText(row.description),
              revenue: toText(row.revenue),
              tax_identifier: toText(row.tax_identifier),
              sales_id: identity?.id,
              created_at: new Date().toISOString(),
            },
          }),
        ),
      ),
    [companySectors, dataProvider, identity?.id],
  );
}

/**
 * `size` is a bucket id, not a headcount, so an arbitrary CSV number is coerced
 * into the nearest bucket the company screens can render.
 */
const sizeOf = (cell: ImportCell) => {
  const size = toNumber(cell);
  return size === undefined ? undefined : mapSizeToCategory(size);
};

/** Call/WhatsApp buttons need E.164. Bare 10-digit numbers are US (+1); anything else stays as typed. */
export const toE164 = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw.trim();
};

/** Local time on the lead page; states outside this map get their timezone from the robot. */
const STATE_TZ: Record<string, string> = {
  TX: "America/Chicago",
  GA: "America/New_York",
};

/** Import one business, placeholder contact and found card per row. */
export async function importLeadRows(
  provider: import("ra-core").DataProvider,
  rows: import("./types").ImportRow[],
  salesId?: import("ra-core").Identifier,
) {
  const result = { added: 0, skipped: 0, errors: [] as string[] };
  for (const [index, row] of rows.entries()) {
    const name = toText(row.name)?.trim();
    const city = toText(row.city)?.trim();
    if (!name || !city) {
      result.errors.push(`Row ${index + 2}: name and city are required`);
      continue;
    }
    let company: import("ra-core").RaRecord | undefined;
    let contact: import("ra-core").RaRecord | undefined;
    try {
      const website = toText(row.website)?.trim();
      const state = toText(row.state)?.trim() ?? "";
      const key = externalKey(name, city, state, website);
      const existing = await provider.getList("companies", {
        filter: { external_key: key },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (existing.data.length) {
        result.skipped++;
        continue;
      }
      const now = new Date().toISOString();
      const phone = toE164(toText(row.phone) ?? "");
      company = (
        await provider.create("companies", {
          data: {
            name,
            city,
            state_abbr: state,
            timezone: STATE_TZ[state.toUpperCase()] ?? null,
            website,
            phone_number: phone,
            business_type: toText(row.business_type),
            source: toText(row.source),
            external_key: key,
            research_status: "to_research",
            sales_id: salesId,
            created_at: now,
          },
        })
      ).data;
      if (!company) throw new Error("Company was not created");
      contact = (
        await provider.create("contacts", {
          data: {
            first_name: "Front desk",
            last_name: "",
            company_id: company.id,
            phone_jsonb: phone ? [{ number: phone, type: "Work" }] : [],
            email_jsonb: [],
            tags: [],
            first_seen: now,
            last_seen: now,
            sales_id: salesId,
          },
        })
      ).data;
      if (!contact) throw new Error("Contact was not created");
      await createFoundDeal(
        provider,
        { id: company.id, name },
        contact.id,
        salesId,
      );
      result.added++;
    } catch (error) {
      // Compensate a partial row so retrying cannot silently skip a business without its card.
      try {
        if (contact)
          await provider.delete("contacts", {
            id: contact.id,
            previousData: contact,
          });
        if (company)
          await provider.delete("companies", {
            id: company.id,
            previousData: company,
          });
      } catch {
        result.errors.push(
          `Row ${index + 2}: partial import needs manual cleanup for ${name}`,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      if (!company && /23505|duplicate key/i.test(message)) result.skipped++;
      else result.errors.push(`Row ${index + 2}: ${message}`);
    }
  }
  return result;
}
