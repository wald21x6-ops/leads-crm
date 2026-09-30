import { HealthLabel, useDealHealth } from "../leads/HealthLabel";
import { healthBorders } from "../leads/rules";
import { Draggable } from "@hello-pangea/dnd";
import { useRedirect, RecordContextProvider, useRecordContext } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import type { Company, Deal } from "../types";

/** What helps pick who to work next: kind of business, city, research score. */
const LeadSummary = () => {
  const company = useRecordContext<Company>();
  if (!company) return null;
  const parts = [
    company.business_type,
    company.city,
    company.score != null ? `score ${company.score}` : null,
  ].filter(Boolean);
  return <>{parts.join(" · ")}</>;
};

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
}) => {
  const redirect = useRedirect();
  const health = useDealHealth(deal.id);
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={`py-3 transition-all duration-200 ${healthBorders[health.state]} ${
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
        >
          <CardContent className="px-3 flex flex-col gap-1">
            <HealthLabel {...health} />
            <div className="flex-1 flex">
              <p className="flex-1 text-sm font-medium mb-2">{deal.name}</p>
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              >
                <CompanyAvatar width={20} height={20} />
              </ReferenceField>
            </div>
            <p className="text-xs text-muted-foreground">
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              >
                <LeadSummary />
              </ReferenceField>
            </p>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
