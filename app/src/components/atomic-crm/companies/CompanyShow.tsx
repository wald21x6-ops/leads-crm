import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { SortButton } from "@/components/admin/sort-button";
import { EditButton } from "@/components/admin/edit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import {
  RecordContextProvider,
  ShowBase,
  useListContext,
  useLocaleState,
  useRecordContext,
  useShowContext,
  useTranslate,
} from "ra-core";
import {
  Link as RouterLink,
  useLocation,
  useSearchParams,
} from "react-router-dom";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ActivityLog } from "../activity/ActivityLog";
import { Avatar } from "../contacts/Avatar";
import { TagsList } from "../contacts/TagsList";
import { shortLocalTime } from "../dashboard/today";
import { EnquiryTests } from "../leads/EnquiryTests";
import { FirstLineBox } from "../leads/FirstLineBox";
import { useCompanyHealth } from "../leads/HealthLabel";
import { LeadSection, ResearchPanel } from "../leads/ResearchPanel";
import { healthLabels } from "../leads/rules";
import { ScoreCard } from "../leads/ScoreCard";
import { StageBar } from "../leads/StageBar";
import { UpNext } from "../leads/UpNext";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { MobileBackButton } from "../misc/MobileBackButton";
import { formatRelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import type { Company, Contact } from "../types";
import {
  AdditionalInfo,
  AddressInfo,
  CompanyInfo,
  ContextInfo,
} from "./CompanyAside";

export const CompanyShow = () => {
  const isMobile = useIsMobile();

  return (
    <ShowBase>
      {isMobile ? (
        <CompanyShowContentMobile />
      ) : (
        <section className="lead-wash mt-2 rounded-[2rem] border px-6 pb-6">
          <CompanyShowContent />
        </section>
      )}
    </ShowBase>
  );
};

const CompanyShowContentMobile = () => {
  const { record, isPending } = useShowContext<Company>();
  if (isPending || !record) return null;
  return (
    <>
      <MobileHeader>
        <MobileBackButton to="/" />
        <div className="flex flex-1">
          <RouterLink to="/">
            <p className="text-xl font-semibold">Today</p>
          </RouterLink>
        </div>
      </MobileHeader>
      <MobileContent>
        {/* Full-bleed wash; extra bottom space clears the pinned Call/WhatsApp bar. */}
        <div className="lead-wash -mx-4 -mt-4 min-h-full px-4 pb-20">
          <LeadBody record={record} />
        </div>
      </MobileContent>
    </>
  );
};

/** Lead page without its wash container; the Today pane and the full page both wrap it. */
export const CompanyShowContent = () => {
  const { record, isPending } = useShowContext<Company>();
  if (isPending || !record) return null;
  return <LeadBody record={record} />;
};

const TABS = ["summary", "research", "tests", "activity", "contacts"];

/** Tab lives in ?tab= so it survives refresh and works inside the Today pane. */
function useLeadTab() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") ?? "summary";
  const tab = TABS.includes(requested) ? requested : "summary";
  const setTab = (value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === "summary") next.delete("tab");
        else next.set("tab", value);
        return next;
      },
      { replace: true },
    );
  return [tab, setTab] as const;
}

const Tag = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "rounded-full border bg-card/70 px-3 py-1 text-xs font-semibold",
      className,
    )}
  >
    {children}
  </span>
);

const LeadBody = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const [tab, setTab] = useLeadTab();
  const { state } = useCompanyHealth(record.id);
  const time = shortLocalTime(record.timezone);
  return (
    <div className="flex min-w-0 flex-col gap-5 pt-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {record.name}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {record.business_type && <Tag>{record.business_type}</Tag>}
            {record.city && <Tag>{record.city}</Tag>}
            {time && <Tag>{time}</Tag>}
            {state !== "ok" && (
              <Tag
                className={
                  state === "no_next_step"
                    ? "border-transparent bg-warn-soft text-warn"
                    : "border-transparent bg-danger-soft text-danger"
                }
              >
                {healthLabels[state]}
              </Tag>
            )}
          </div>
        </div>
        <div className="shrink-0 max-md:hidden">
          <EditButton label={translate("resources.companies.action.edit")} />
        </div>
      </header>
      <StageBar company={record} />
      <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 max-md:[mask-image:linear-gradient(to_right,black_85%,transparent)] max-md:pr-8">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="activity">
              {translate("crm.common.activity")}
            </TabsTrigger>
            <TabsTrigger value="contacts">
              {record.nb_contacts === 0
                ? translate("resources.companies.no_contacts")
                : translate("resources.companies.nb_contacts", {
                    smart_count: record.nb_contacts ?? 0,
                  })}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="summary">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <UpNext company={record} />
              <FirstLineBox company={record} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <ScoreCard company={record} />
              <LeadSection title="Details">
                <CompanyInfo record={record} />
                <AddressInfo record={record} />
                <ContextInfo record={record} />
                <AdditionalInfo record={record} />
              </LeadSection>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="research">
          {record.research || record.research_status === "to_research" ? (
            <ResearchPanel company={record} />
          ) : (
            <LeadSection title="Research">
              <p className="text-muted-foreground">
                No research for this lead yet.
              </p>
            </LeadSection>
          )}
        </TabsContent>
        <TabsContent value="tests">
          <EnquiryTests company={record} />
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent>
              <ActivityLog companyId={record.id} context="company" />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="contacts">
          <Card>
            <CardContent>
              {record.nb_contacts ? (
                <ReferenceManyField
                  reference="contacts_summary"
                  target="company_id"
                  sort={{ field: "last_name", order: "ASC" }}
                >
                  <div className="flex flex-col gap-4">
                    <div className="mt-1 flex flex-row justify-end space-x-2">
                      <SortButton
                        fields={["last_name", "first_name", "last_seen"]}
                      />
                      <CreateRelatedContactButton />
                    </div>
                    <ContactsIterator />
                  </div>
                </ReferenceManyField>
              ) : (
                <div className="flex justify-end">
                  <CreateRelatedContactButton />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ContactsIterator = () => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const location = useLocation();
  const { data: contacts, error, isPending } = useListContext<Contact>();

  if (isPending || error) return null;

  return (
    <div className="pt-0">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <div className="p-0 text-sm">
            <RouterLink
              to={`/contacts/${contact.id}/show`}
              state={{ from: location.pathname }}
              className="flex items-center justify-between hover:bg-muted py-2 transition-colors"
            >
              <div className="mr-4">
                <Avatar />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {`${contact.first_name} ${contact.last_name}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {contact.title}
                  {contact.nb_tasks
                    ? ` - ${translate("crm.common.task_count", {
                        smart_count: contact.nb_tasks ?? 0,
                      })}`
                    : ""}
                  &nbsp; &nbsp;
                  <TagsList />
                </div>
              </div>
              {contact.last_seen && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {translate("crm.common.last_activity_with_date", {
                      date: formatRelativeDate(contact.last_seen, locale),
                    })}{" "}
                    <Status status={contact.status} />
                  </div>
                </div>
              )}
            </RouterLink>
          </div>
        </RecordContextProvider>
      ))}
    </div>
  );
};

const CreateRelatedContactButton = () => {
  const translate = useTranslate();
  const company = useRecordContext<Company>();
  return (
    <Button variant="outline" asChild size="sm" className="h-9">
      <RouterLink
        to="/contacts/create"
        state={company ? { record: { company_id: company.id } } : undefined}
        className="flex items-center gap-2"
      >
        <UserPlus className="h-4 w-4" />
        {translate("resources.contacts.action.add")}
      </RouterLink>
    </Button>
  );
};
