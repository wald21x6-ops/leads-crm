import { InstallAppBanner } from "../layout/InstallAppBanner";
import { PipelineCounts, WaitingForReply } from "./LeadsOverview";
import { TodayList, useTodayItems } from "./TodayList";
import { Welcome } from "./Welcome";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="flex items-center gap-2 text-secondary-foreground no-underline py-3">
          <img
            className="[.light_&]:hidden h-6"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6"
            src={lightModeLogo}
            alt={title}
          />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  );
};

export const MobileDashboard = () => {
  const today = useTodayItems();
  return (
    <Wrapper>
      <div className="flex flex-col gap-6 mt-1">
        <InstallAppBanner />
        <TodayList
          {...today}
          hrefFor={(item) => `/companies/${item.company.id}/show`}
        />
        <WaitingForReply />
        <PipelineCounts />
        {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
      </div>
    </Wrapper>
  );
};
