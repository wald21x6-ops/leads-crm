import { ShowBase } from "ra-core";
import { useSearchParams } from "react-router";

import { CompanyShowContent } from "../companies/CompanyShow";
import { TasksList } from "./TasksList";
import { TodayList, useTodayItems } from "./TodayList";
import { WaitingForReply } from "./LeadsOverview";
import { Welcome } from "./Welcome";

/** Desktop home: today's queue on the left, the selected lead on the right. */
export const Dashboard = () => {
  const today = useTodayItems();
  const [params] = useSearchParams();
  const fromUrl = Number(params.get("lead"));
  const selectedId = fromUrl || today.items[0]?.company.id;
  return (
    <div className="grid grid-cols-1 items-start gap-6 mt-1 md:grid-cols-[minmax(320px,380px)_1fr]">
      <aside className="flex flex-col gap-6 md:sticky md:top-4 md:max-h-[calc(100dvh-6.5rem)] md:overflow-y-auto md:pr-2 md:pb-4">
        <TodayList
          {...today}
          selectedId={selectedId}
          hrefFor={(item) => `/?lead=${item.company.id}`}
        />
        <WaitingForReply />
        <TasksList />
        {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
      </aside>
      <section className="lead-wash min-w-0 rounded-[2rem] border px-6 pb-6">
        {selectedId != null ? (
          <ShowBase resource="companies" id={selectedId}>
            <CompanyShowContent />
          </ShowBase>
        ) : (
          <p className="py-16 text-center text-muted-foreground">
            Pick a lead on the left to see it here.
          </p>
        )}
      </section>
    </div>
  );
};
