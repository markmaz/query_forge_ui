// src/features/no-code-sql/ui/components/home/ActivitySummary.tsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hydrateQueryTree } from "../../../../shared/api/queryTreeApi";
import type { RecentItem } from "../../../../shared/model/savedQueries";

export type ActivitySummaryProps = {
  savedCount: number;
  sharedWithMeCount: number;
  draftsCount: number;
  onOpenSaved?: () => void;
  onOpenShared?: () => void;
  onOpenDrafts?: () => void;
};

const formatUpdated = (iso?: string | null) => {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Date(time).toLocaleString();
};

const pickMostRecent = (items: RecentItem[]) =>
  items.reduce<RecentItem | null>((best, item) => {
    const bestTime = best?.updatedAt ? Date.parse(best.updatedAt) : Number.NEGATIVE_INFINITY;
    const itemTime = item.updatedAt ? Date.parse(item.updatedAt) : Number.NEGATIVE_INFINITY;
    if (Number.isNaN(bestTime) && Number.isNaN(itemTime)) return best ?? item;
    if (Number.isNaN(bestTime)) return item;
    if (Number.isNaN(itemTime)) return best ?? item;
    return itemTime > bestTime ? item : best ?? item;
  }, null);

const Stat: React.FC<{
  label: string;
  value: number;
  onClick?: () => void;
}> = ({ label, value, onClick }) => {
  const Tag = onClick ? ("button" as const) : ("div" as const);
  return (
    <Tag
      className={`card border text-start ${onClick ? "btn btn-light p-0" : ""}`}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="card-body">
        <div className="text-muted small">{label}</div>
        <div className="fs-3 fw-semibold">{value}</div>
      </div>
    </Tag>
  );
};

const ActivitySummary: React.FC<ActivitySummaryProps> = ({
  savedCount,
  sharedWithMeCount,
  draftsCount,
  onOpenSaved,
  onOpenShared,
  onOpenDrafts,
}) => {
  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
  });
  const recentItems = queryTreeQuery.data?.recent ?? [];
  const mostRecent = useMemo(() => pickMostRecent(recentItems), [recentItems]);

  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body">
        <div className="fw-semibold">Your activity</div>
      </div>

      <div className="card-body">
        <div className="row g-2">
          <div className="col-12">
            <Stat label="Saved queries" value={savedCount} onClick={onOpenSaved} />
          </div>
          <div className="col-12">
            <Stat label="Shared with you" value={sharedWithMeCount} onClick={onOpenShared} />
          </div>
          <div className="col-12">
            <Stat label="Drafts" value={draftsCount} onClick={onOpenDrafts} />
          </div>
        </div>

        <div className="text-muted small mt-3">
          {queryTreeQuery.isLoading
            ? "Loading recent activity..."
            : mostRecent
            ? `Most recent: ${mostRecent.title}${formatUpdated(mostRecent.updatedAt) ? ` · ${formatUpdated(mostRecent.updatedAt)}` : ""}`
            : "No recent activity yet."}
        </div>
      </div>
    </div>
  );
};

export default ActivitySummary;
