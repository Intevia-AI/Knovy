import { Suspense } from "react";
import {
  getFeatureAdoption,
  getTopFeatures,
  getErrorsByFeature,
} from "@/lib/analytics/queries";
import { FeatureAdoptionClientView } from "./client-view";

async function FeatureAdoptionContent() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all data in parallel
  const [featureAdoption, topFeatures, featureErrors] = await Promise.all([
    getFeatureAdoption({ from: thirtyDaysAgo, to: now }), // Last 30 days
    getTopFeatures(50), // Top 50 features
    getErrorsByFeature({ from: thirtyDaysAgo, to: now }),
  ]);

  // Use featureAdoption for all data since we don't have separate category/trend functions
  const featuresByCategory = featureAdoption;
  const featureTrends = featureAdoption.map((f) => ({ ...f, trend: 0 })); // Stub trend data

  return (
    <FeatureAdoptionClientView
      featureAdoption={featureAdoption}
      topFeatures={topFeatures}
      featuresByCategory={featuresByCategory}
      featureTrends={featureTrends}
      featureErrors={featureErrors}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
      <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

export default function FeatureAdoptionPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Feature Adoption</h1>
        <p className="text-muted-foreground mt-2">
          Track feature usage, adoption rates, and performance metrics
        </p>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <FeatureAdoptionContent />
      </Suspense>
    </div>
  );
}
