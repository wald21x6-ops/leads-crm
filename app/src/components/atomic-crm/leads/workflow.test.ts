import { describe, expect, it } from "vitest";
import fakeRestDataProvider from "ra-data-fakerest";
import { importLeadRows } from "../dataImport/useCompanyImport";
import { withDemoHealth } from "./demoHealth";

describe("lead workflow data", () => {
  it("imports three linked records, skips duplicates and rejects incomplete rows", async () => {
    const provider = fakeRestDataProvider(
      { companies: [], contacts: [], deals: [] },
      false,
    );
    const result = await importLeadRows(
      provider,
      [
        {
          name: "Demo",
          city: "Dallas",
          state: "TX",
          website: "https://www.example.com",
          phone: "+12025550100",
        },
        {
          name: "Duplicate",
          city: "Dallas",
          website: "https://example.com/another",
        },
        { name: "Missing city", city: "" },
      ],
      1,
    );
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    const params = {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" as const },
      filter: {},
    };
    const companies = await provider.getList("companies", params);
    const contacts = await provider.getList("contacts", params);
    const deals = await provider.getList("deals", params);
    expect(companies.data[0].external_key).toBe("example.com");
    expect(contacts.data[0].first_name).toBe("Front desk");
    expect(deals.data[0]).toMatchObject({
      company_id: companies.data[0].id,
      stage: "found",
      contact_ids: [contacts.data[0].id],
    });
  });
  it("compensates an incomplete import so retry does not skip a lead without a card", async () => {
    const base = fakeRestDataProvider(
      { companies: [], contacts: [], deals: [] },
      false,
    );
    const provider = {
      ...base,
      create: ((resource, params) =>
        resource === "deals"
          ? Promise.reject(new Error("Unavailable"))
          : base.create(resource, params)) as typeof base.create,
    };
    const result = await importLeadRows(provider, [
      { name: "Demo", city: "Dallas" },
    ]);
    expect(result.added).toBe(0);
    expect(result.errors).toHaveLength(1);
    const params = {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" as const },
      filter: {},
    };
    expect((await base.getList("companies", params)).total).toBe(0);
    expect((await base.getList("contacts", params)).total).toBe(0);
  });
  it("updates demo health after a call and a next-step task", async () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString();
    const base = fakeRestDataProvider(
      {
        deals: [
          {
            id: 1,
            company_id: 1,
            stage: "found",
            created_at: old,
            updated_at: old,
          },
        ],
        contacts: [{ id: 1, company_id: 1 }],
        tasks: [],
        call_logs: [],
        whatsapp_opens: [],
        enquiry_tests: [],
        contact_notes: [],
        deal_notes: [],
      },
      false,
    );
    const provider = withDemoHealth(base);
    const params = { ids: [1] };
    expect((await provider.getMany("deal_health", params)).data[0].state).toBe(
      "stale",
    );
    await base.create("call_logs", {
      data: { company_id: 1, called_at: new Date().toISOString() },
    });
    expect((await provider.getMany("deal_health", params)).data[0].state).toBe(
      "no_next_step",
    );
    await base.create("tasks", {
      data: {
        contact_id: 1,
        due_date: new Date(Date.now() + 86400000).toISOString(),
        done_date: null,
      },
    });
    expect((await provider.getMany("deal_health", params)).data[0].state).toBe(
      "ok",
    );
  });
});
