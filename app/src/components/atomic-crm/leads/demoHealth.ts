import type { DataProvider, RaRecord } from "ra-core";
import { healthState } from "./rules";

// Emulate the security-invoker SQL view from current FakeRest rows on each read.
export function withDemoHealth<T extends DataProvider>(provider: T): T {
  const compute = async () => {
    const resources = [
      "deals",
      "contacts",
      "tasks",
      "deal_notes",
      "contact_notes",
      "call_logs",
      "whatsapp_opens",
      "enquiry_tests",
    ];
    const rows = await Promise.all(
      resources.map((resource) =>
        provider.getList(resource, {
          pagination: { page: 1, perPage: 100000 },
          sort: { field: "id", order: "ASC" },
          filter: {},
        }),
      ),
    );
    const [
      deals,
      contacts,
      tasks,
      dealNotes,
      contactNotes,
      calls,
      opens,
      tests,
    ] = rows.map((result) => result.data);
    const same = (a: unknown, b: unknown) => String(a) === String(b);
    const dates = (records: RaRecord[], field: string) =>
      records.map((row) => row[field]).filter(Boolean);
    return deals.map((deal) => {
      const ids = contacts
        .filter((contact) => same(contact.company_id, deal.company_id))
        .map((contact) => String(contact.id));
      const companyTasks = tasks.filter((task) =>
        ids.includes(String(task.contact_id)),
      );
      const openTasks = companyTasks.filter((task) => !task.done_date);
      const companyTests = tests.filter((test) =>
        same(test.company_id, deal.company_id),
      );
      const touches = [
        deal.created_at,
        deal.updated_at,
        ...dates(
          dealNotes.filter((note) => same(note.deal_id, deal.id)),
          "date",
        ),
        ...dates(
          contactNotes.filter((note) => ids.includes(String(note.contact_id))),
          "date",
        ),
        ...dates(
          calls.filter((call) => same(call.company_id, deal.company_id)),
          "called_at",
        ),
        ...dates(
          opens.filter((open) => same(open.company_id, deal.company_id)),
          "opened_at",
        ),
        ...dates(companyTests, "sent_at"),
        ...dates(companyTests, "replied_at"),
        ...dates(companyTasks, "done_date"),
      ]
        .filter(Boolean)
        .map((date) => Date.parse(date));
      const due = dates(openTasks, "due_date").sort();
      const health = {
        id: deal.id,
        company_id: deal.company_id,
        stage: deal.stage,
        created_at: deal.created_at,
        last_touch_at: new Date(Math.max(...touches)).toISOString(),
        next_task_due: due[0] ?? null,
        open_task_count: openTasks.length,
      };
      return { ...health, state: healthState(health) };
    });
  };
  let pending: ReturnType<typeof compute> | undefined;
  const view = () =>
    pending ??
    (pending = compute().finally(() => {
      pending = undefined;
    }));
  return {
    ...provider,
    async getList(resource, params) {
      if (resource !== "deal_health") return provider.getList(resource, params);
      let data = await view();
      const filter = params.filter ?? {};
      if (filter.company_id != null)
        data = data.filter(
          (row) => String(row.company_id) === String(filter.company_id),
        );
      if (filter["company_id@in"])
        data = data.filter((row) =>
          filter["company_id@in"].map(String).includes(String(row.company_id)),
        );
      const total = data.length;
      const { page = 1, perPage = 100 } = params.pagination ?? {};
      return {
        data: data.slice((page - 1) * perPage, page * perPage),
        total,
      } as never;
    },
    async getMany(resource, params) {
      if (resource !== "deal_health") return provider.getMany(resource, params);
      return {
        data: (await view()).filter((row) =>
          params.ids.map(String).includes(String(row.id)),
        ),
      } as never;
    },
  };
}
