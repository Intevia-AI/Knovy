import { Suspense } from "react";
import {
  getDailyActiveUsers,
  getOverviewMetrics,
  getUserEngagementScores,
} from "@/lib/analytics/queries";
import { AnalyticsOverviewClientView } from "./client-view";

async function AnalyticsOverviewContent() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all data in parallel
  const [overviewMetrics, dauData, engagementData] = await Promise.all([
    getOverviewMetrics(),
    getDailyActiveUsers({ from: thirtyDaysAgo, to: now }),
    getUserEngagementScores({ from: thirtyDaysAgo, to: now }),
  ]);

  // Debug: Check engagement data
  console.log("[Overview Debug] Engagement data count:", engagementData.length);
  console.log("[Overview Debug] Engagement data sample:", engagementData.slice(0, 3));

  return (
    <AnalyticsOverviewClientView
      overviewMetrics={overviewMetrics}
      dauData={dauData}
      engagementData={engagementData}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsOverviewPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics Overview</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive view of platform metrics, user behavior, and system health
        </p>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <AnalyticsOverviewContent />
      </Suspense>
    </div>
  );
}
