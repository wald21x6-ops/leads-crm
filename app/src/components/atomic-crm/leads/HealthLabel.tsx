import { useGetManyAggregate, useGetList } from "ra-core";
import type { Identifier } from "ra-core";
import { healthLabels, type DealHealth, type HealthState } from "./rules";

export function useDealHealth(id: Identifier) {
  const { data, error } = useGetManyAggregate<DealHealth>(
    "deal_health",
    { ids: [id] },
    { refetchInterval: 60000 },
  );
  return { state: data?.[0]?.state ?? "ok", error };
}
export function useCompanyHealth(id?: Identifier) {
  const { data, error } = useGetList<DealHealth>(
    "deal_health",
    {
      filter: { company_id: id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: id != null, refetchInterval: 60000 },
  );
  const priority: HealthState[] = ["overdue", "stale", "no_next_step", "ok"];
  return {
    state:
      priority.find((state) => data?.some((row) => row.state === state)) ??
      "ok",
    error,
  };
}
export const HealthLabel = ({
  state,
  error,
}: {
  state: HealthState;
  error?: unknown;
}) =>
  error ? (
    <p className="text-xs text-destructive">Follow-up status unavailable</p>
  ) : state === "ok" ? null : (
    <p
      className={
        state === "no_next_step"
          ? "text-xs font-semibold text-warn"
          : "text-xs font-semibold text-danger"
      }
    >
      {healthLabels[state]}
    </p>
  );
