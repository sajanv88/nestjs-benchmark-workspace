import { Skeleton } from "@nuvui/react";
import "./benchmark-showcase.scss";

export function ShowcaseSkeleton() {
  return (
    <div className="benchmark-showcase" aria-busy="true">
      <Skeleton className="benchmark-showcase__skeleton-heading" />
      <Skeleton className="benchmark-showcase__skeleton-stats" />
      <Skeleton className="benchmark-showcase__skeleton-chart" />
    </div>
  );
}
