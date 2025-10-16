"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Download, TrendingUp, AlertCircle, Package, Activity } from "lucide-react";

interface FeatureAdoptionClientViewProps {
  featureAdoption: any[];
  topFeatures: any[];
  featuresByCategory: any[];
  featureTrends: any[];
  featureErrors: any[];
}

export function FeatureAdoptionClientView({
  featureAdoption,
  topFeatures: _topFeatures,
  featuresByCategory,
  featureTrends,
  featureErrors,
}: FeatureAdoptionClientViewProps) {
  // Use featureAdoption (full details) sorted by usage instead of topFeatures (limited fields)
  const topFeatures = [...featureAdoption].sort((a, b) => (b.total_uses || 0) - (a.total_uses || 0));
  // Calculate success rate color (rate is 0-1, not 0-100)
  const getSuccessRateColor = (rate: number) => {
    const ratePercent = rate * 100;
    if (ratePercent >= 95) return "emerald";
    if (ratePercent >= 90) return "yellow";
    if (ratePercent >= 85) return "orange";
    return "red";
  };

  // Format feature name
  const formatFeatureName = (name: string) => {
    return name
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Group features by category
  const categorizedFeatures = featuresByCategory.reduce((acc: any, feature: any) => {
    const category = feature.feature_category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {});

  // Calculate category stats
  const categoryStats = Object.entries(categorizedFeatures)
    .map(([category, features]: any) => {
      const totalUses = features.reduce((sum: number, f: any) => sum + (f.total_uses || 0), 0);
      const uniqueUsers = Math.max(...features.map((f: any) => f.unique_users || 0));
      const avgSuccessRate =
        features.reduce((sum: number, f: any) => sum + (f.success_rate || 0), 0) / features.length;

      return {
        category,
        featureCount: features.length,
        totalUses,
        uniqueUsers,
        avgSuccessRate,
      };
    })
    .sort((a, b) => b.totalUses - a.totalUses);

  // Get feature health status (successRate is 0-1, not 0-100)
  const getFeatureHealth = (successRate: number, errorCount: number) => {
    const ratePercent = successRate * 100;
    if (ratePercent >= 95 && errorCount < 10) return { label: "Healthy", color: "emerald" };
    if (ratePercent >= 90 && errorCount < 50) return { label: "Good", color: "blue" };
    if (ratePercent >= 85 && errorCount < 100) return { label: "Warning", color: "yellow" };
    return { label: "Critical", color: "red" };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Feature Adoption Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor feature usage, success rates, and identify areas for improvement
        </p>
      </div>

      {/* Top Features Overview Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Features</span>
          </div>
          <div className="text-3xl font-semibold">{topFeatures.length}</div>
          <div className="text-xs text-muted-foreground mt-2">
            {categoryStats.length} categories
          </div>
        </div>

        <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-muted-foreground">Total Uses</span>
          </div>
          <div className="text-3xl font-semibold">
            {topFeatures.reduce((sum, f) => sum + (f.total_uses || 0), 0).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-2">Across all features</div>
        </div>

        <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Avg Success Rate</span>
          </div>
          <div className="text-3xl font-semibold">
            {topFeatures.length > 0
              ? (
                  (topFeatures.reduce((sum, f) => sum + (f.success_rate || 0), 0) /
                    topFeatures.length) *
                  100
                ).toFixed(1)
              : "0.0"}
            %
          </div>
          <div className="text-xs text-muted-foreground mt-2">Overall health</div>
        </div>
      </section>

      {/* Category Breakdown */}
      <section className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Feature Categories</h2>
        <p className="text-sm text-muted-foreground mb-4">Usage breakdown by feature category</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryStats.map((cat) => (
            <div
              key={cat.category}
              className="rounded-lg bg-background/30 hover:bg-background/40 transition-colors p-4 border border-white/5"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium">{cat.category}</p>
                  <p className="text-2xl font-semibold mt-1">{cat.totalUses.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total uses</p>
                </div>
                <Badge
                  className={`bg-${getSuccessRateColor(cat.avgSuccessRate * 100)}-500/20 text-${getSuccessRateColor(cat.avgSuccessRate * 100)}-600 backdrop-blur-sm`}
                >
                  {(cat.avgSuccessRate * 100).toFixed(1)}%
                </Badge>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Features</span>
                  <span className="font-semibold">{cat.featureCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unique Users</span>
                  <span className="font-semibold">{cat.uniqueUsers}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Detailed Feature Table */}
      <section className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold">Feature Details</h2>
            <p className="text-sm text-muted-foreground">
              Comprehensive feature usage and performance metrics
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const csvContent =
                "data:text/csv;charset=utf-8," +
                ["Feature,Category,Usage,Users,Success Rate,Avg Duration,Health"]
                  .concat(
                    topFeatures.map((f) => {
                      const errorData = featureErrors.find((e) => e.feature_name === f.feature_name);
                      const health = getFeatureHealth(f.success_rate, errorData?.error_count || 0);
                      return `${f.feature_name},${f.feature_category || "General"},${f.total_uses},${f.unique_users},${(f.success_rate * 100).toFixed(1)}%,${f.avg_duration_ms ? (f.avg_duration_ms / 1000).toFixed(2) + "s" : "N/A"},${health.label}`;
                    }),
                  )
                  .join("\n");
              const link = document.createElement("a");
              link.href = encodeURI(csvContent);
              link.download = "feature-adoption.csv";
              link.click();
            }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Feature
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Category
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Usage
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Users
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Success Rate
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Avg Duration
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Health
                </th>
              </tr>
            </thead>
            <tbody>
              {topFeatures.map((feature: any) => {
                const errorData = featureErrors.find((e: any) => e.feature_name === feature.feature_name);
                const health = getFeatureHealth(feature.success_rate, errorData?.error_count || 0);
                const successRateColor = getSuccessRateColor(feature.success_rate);

                return (
                  <tr
                    key={feature.feature_name}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium">{formatFeatureName(feature.feature_name)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className="bg-blue-500/20 text-blue-600 backdrop-blur-sm">
                        {feature.feature_category || "General"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold">{(feature.total_uses || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {(feature.successful_uses || 0).toLocaleString()} successful
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold">{feature.unique_users || 0}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{((feature.success_rate || 0) * 100).toFixed(1)}%</span>
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${successRateColor}-500`}
                            style={{ width: `${feature.success_rate * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">
                        {feature.avg_duration_ms
                          ? `${(feature.avg_duration_ms / 1000).toFixed(2)}s`
                          : "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        className={`bg-${health.color}-500/20 text-${health.color}-600 backdrop-blur-sm`}
                      >
                        {health.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Feature Trends & Issues */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Trending Features</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Features with increasing usage</p>

          <div className="space-y-3">
            {featureTrends
              .filter((f: any) => f.trend > 0)
              .sort((a: any, b: any) => b.trend - a.trend)
              .slice(0, 10)
              .map((feature: any) => (
                <div
                  key={feature.feature_name}
                  className="flex justify-between items-center p-3 rounded-lg bg-background/30 hover:bg-background/40 transition-colors"
                >
                  <span className="font-medium">{formatFeatureName(feature.feature_name)}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-600 backdrop-blur-sm">
                    ↑ {feature.trend.toFixed(1)}%
                  </Badge>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold">Features with Issues</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Features with high error rates or declining usage
          </p>

          <div className="space-y-3">
            {featureErrors
              .sort((a: any, b: any) => b.error_percentage - a.error_percentage)
              .slice(0, 10)
              .map((feature: any) => (
                <div
                  key={feature.feature_name}
                  className="p-3 rounded-lg bg-background/30 hover:bg-background/40 transition-colors"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{formatFeatureName(feature.feature_name)}</span>
                    <Badge className="bg-red-500/20 text-red-600 backdrop-blur-sm">
                      {feature.error_count} errors
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{feature.error_type || "Unknown error"}</span>
                    <span>{feature.affected_users} users affected</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
