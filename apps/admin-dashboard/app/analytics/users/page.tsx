import { Suspense } from "react";
import {
  getRecentSessions,
  getActiveUsers,
  getUserRetention,
  getDailyActiveUsers,
  getWeeklyActiveUsers,
  getMonthlyActiveUsers,
  getSessionMetrics,
  getUserGrowth,
} from "@/lib/analytics/queries";
import { getUserActivityMetrics } from "@/lib/analytics/user-activity-queries";
import { getCostEstimation, aggregateTokenUsage } from "@/lib/analytics/token-utils";
import { UserActivityClientView } from "./client-view";
import { createServerClient } from "@/lib/supabase-server";

async function UserActivityContent() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);

  // Fetch all data in parallel
  const [
    recentSessions,
    activeUsers,
    dauData,
    wauData,
    mauData,
    sessionMetrics,
    growthData,
    retentionData,
    activityMetrics,
  ] = await Promise.all([
    getRecentSessions(50), // Last 50 sessions
    getActiveUsers(), // Currently active users
    getDailyActiveUsers({ from: thirtyDaysAgo, to: now }),
    getWeeklyActiveUsers({ from: twelveWeeksAgo, to: now }),
    getMonthlyActiveUsers({ from: sixMonthsAgo, to: now }),
    getSessionMetrics({ from: thirtyDaysAgo, to: now }),
    getUserGrowth(30),
    getUserRetention(30),
    getUserActivityMetrics({ from: thirtyDaysAgo, to: now }),
  ]);

  // Get feature usage for cost estimation
  const supabase = await createServerClient();
  const { data: features } = await supabase
    .from("feature_usage")
    .select("*")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .lte("created_at", now.toISOString());

  const tokenSummary = aggregateTokenUsage(features || []);
  const costEstimation = await getCostEstimation(features || [], "month");

  return (
    <UserActivityClientView
      recentSessions={recentSessions}
      activeUsers={activeUsers}
      dauData={dauData}
      wauData={wauData}
      mauData={mauData}
      sessionMetrics={sessionMetrics}
      growthData={growthData}
      retentionData={retentionData}
      activityMetrics={activityMetrics}
      tokenSummary={tokenSummary}
      costEstimation={costEstimation}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

export default function UserActivityPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">User Activity</h1>
        <p className="text-muted-foreground mt-2">
          Monitor user sessions, activity patterns, and retention metrics
        </p>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <UserActivityContent />
      </Suspense>
    </div>
  );
}
