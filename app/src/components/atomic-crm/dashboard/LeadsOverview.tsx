import { useGetList } from "ra-core";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { replyTime } from "../leads/rules";

const ALL = { page: 1, perPage: 1000 };

/** Leads per stage, so the board's shape is visible at a glance. */
export const PipelineCounts = () => {
  const { dealStages } = useConfigurationContext();
  const { data = [], isPending } = useGetList<Deal>("deals", {
    pagination: ALL,
    filter: { "archived_at@is": null },
  });
  if (isPending) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold text-muted-foreground">Pipeline</h2>
      <Card className="p-4">
        {data.length === 0 ? (
          <p className="text-sm">
            No leads yet. Use{" "}
            <Link to="/deals" className="underline">
              Upload list
            </Link>{" "}
            on the board.
          </p>
        ) : (
          <ul className="space-y-1">
            {dealStages.map((stage) => (
              <li key={stage.value} className="flex justify-between text-sm">
                <Link to="/deals" className="hover:underline">
                  {stage.label}
                </Link>
                <span className="tabular-nums">
                  {data.filter((d) => d.stage === stage.value).length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
};

interface OpenTest {
  id: number;
  company_id: number;
  channel: string;
  sent_at: string;
}

/** Outside-in tests with no reply yet: the proof being collected right now. */
export const WaitingForReply = () => {
  const { data = [], isPending } = useGetList<OpenTest>("enquiry_tests", {
    pagination: { page: 1, perPage: 20 },
    filter: { "replied_at@is": null },
    sort: { field: "sent_at", order: "ASC" },
  });
  if (isPending) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold text-muted-foreground">
        Tests waiting for a reply
      </h2>
      <Card className="p-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None open. Log a test from a lead's page.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((test) => (
              <li key={test.id} className="flex justify-between gap-3 text-sm">
                <Link
                  to={`/companies/${test.company_id}/show`}
                  className="hover:underline min-w-0 truncate"
                >
                  <ReferenceField
                    record={test}
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <TextField source="name" />
                  </ReferenceField>
                </Link>
                <span className="shrink-0 text-muted-foreground">
                  {replyTime(test.sent_at, null)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
};
