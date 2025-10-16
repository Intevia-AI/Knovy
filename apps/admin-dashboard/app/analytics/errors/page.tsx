import { Suspense } from "react";
import {
  getErrorSummary,
  getErrorTrends,
  getErrorDetails,
  getCriticalErrors,
} from "@/lib/analytics/queries";
import { ErrorMonitoringClientView } from "./client-view";

async function ErrorMonitoringContent() {
  // Fetch all data in parallel
  const [errorSummary, errorTrends, errorDetails, criticalErrors] = await Promise.all([
    getErrorSummary(7), // Last 7 days
    getErrorTrends(30), // Last 30 days
    getErrorDetails(100), // Last 100 errors
    getCriticalErrors(24), // Last 24 hours
  ]);

  return (
    <ErrorMonitoringClientView
      errorSummary={errorSummary}
      errorTrends={errorTrends}
      errorDetails={errorDetails}
      criticalErrors={criticalErrors}
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

export default function ErrorMonitoringPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Error Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Track system errors, identify patterns, and monitor affected users
        </p>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <ErrorMonitoringContent />
      </Suspense>
    </div>
  );
}
