import { Suspense } from "react";
import {
  getUserEngagementScores,
  getUserRetention,
  getUserSegmentation,
  getTopUsers,
  getInactiveUsers,
  getEngagementTrends,
} from "@/lib/analytics/queries";
import { UserEngagementClientView } from "./client-view";

async function UserEngagementContent() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all data in parallel
  const [engagementScores, retentionData, userSegments, topUsers, inactiveUsers, engagementTrends] =
    await Promise.all([
      getUserEngagementScores({ from: thirtyDaysAgo, to: now }),
      getUserRetention(30),
      getUserSegmentation(),
      getTopUsers(20),
      getInactiveUsers(30),
      getEngagementTrends(30),
    ]);

  return (
    <UserEngagementClientView
      engagementScores={engagementScores}
      retentionData={retentionData}
      userSegments={userSegments}
      topUsers={topUsers}
      inactiveUsers={inactiveUsers}
      engagementTrends={engagementTrends}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
      <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function UserEngagementPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">User Engagement</h1>
        <p className="text-muted-foreground mt-2">
          Analyze user engagement patterns, retention, and identify at-risk users
        </p>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <UserEngagementContent />
      </Suspense>
    </div>
  );
}
