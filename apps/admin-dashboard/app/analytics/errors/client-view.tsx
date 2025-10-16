"use client";

import {
  ModernMetricCard,
  ModernLineChart,
  ModernBarChart,
  ModernDataTable,
} from "@/components/design-system";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  Activity,
  TrendingDown,
  Users,
  Download,
  Shield,
  ShieldAlert,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";

interface ErrorMonitoringClientViewProps {
  errorSummary: any[];
  errorTrends: any[];
  errorDetails: any[];
  criticalErrors: any[];
}

export function ErrorMonitoringClientView({
  errorSummary,
  errorTrends,
  errorDetails,
  criticalErrors,
}: ErrorMonitoringClientViewProps) {
  const featureErrors = errorSummary;

  // Calculate error statistics
  const totalErrors = errorSummary.reduce((sum, item) => sum + item.error_count, 0);
  const totalAffectedUsers = Math.max(...errorSummary.map((item) => item.affected_users || 0));
  const avgErrorRate =
    errorSummary.length > 0
      ? errorSummary.reduce((sum, item) => sum + item.error_percentage, 0) / errorSummary.length
      : 0;

  // Group errors by type
  const errorsByType = errorDetails.reduce((acc: any, error: any) => {
    const type = error.error_type || "Unknown";
    if (!acc[type]) {
      acc[type] = { count: 0, features: new Set(), users: new Set() };
    }
    acc[type].count++;
    acc[type].features.add(error.feature_name);
    acc[type].users.add(error.user_id);
    return acc;
  }, {});

  // Convert to array and sort by count
  const errorTypeStats = Object.entries(errorsByType)
    .map(([type, stats]: any) => ({
      type,
      count: stats.count,
      featureCount: stats.features.size,
      userCount: stats.users.size,
    }))
    .sort((a, b) => b.count - a.count);

  // Get severity icon and color
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="w-4 h-4" />;
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      case "medium":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "red";
      case "high":
        return "orange";
      case "medium":
        return "yellow";
      default:
        return "blue";
    }
  };

  // Format error trend data for chart
  const errorTrendData = errorTrends.map((day) => ({
    date: new Date(day.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    "Total Errors": day.total_errors,
    "Error Rate (%)": Number((day.error_rate * 100).toFixed(2)),
  }));

  // Get error health status
  const getHealthStatus = (rate: number) => {
    if (rate < 1) return { label: "Healthy", color: "green", icon: "✓" };
    if (rate < 5) return { label: "Warning", color: "yellow", icon: "⚠" };
    if (rate < 10) return { label: "Critical", color: "orange", icon: "!" };
    return { label: "Severe", color: "red", icon: "✗" };
  };

  const healthStatus = getHealthStatus(avgErrorRate);

  // Get health icon
  const getHealthIcon = () => {
    if (avgErrorRate < 1) return <ShieldCheck className="w-5 h-5" />;
    if (avgErrorRate < 5) return <Shield className="w-5 h-5" />;
    if (avgErrorRate < 10) return <ShieldAlert className="w-5 h-5" />;
    return <ShieldOff className="w-5 h-5" />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Error Monitoring</h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor system health, error trends, and critical issues
        </p>
      </div>

      {/* Error Overview Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ModernMetricCard
          title="System Health"
          value={healthStatus.label}
          icon={getHealthIcon()}
          trend={avgErrorRate > 5 ? "down" : avgErrorRate < 1 ? "up" : "neutral"}
          subtitle={`${avgErrorRate.toFixed(2)}% error rate`}
        />

        <ModernMetricCard
          title="Total Errors (7d)"
          value={totalErrors.toLocaleString()}
          icon={<AlertCircle className="w-5 h-5" />}
          subtitle={`${criticalErrors.length} critical (24h)`}
          trend={criticalErrors.length > 0 ? "down" : "neutral"}
        />

        <ModernMetricCard
          title="Error Rate"
          value={`${avgErrorRate.toFixed(2)}%`}
          icon={<TrendingDown className="w-5 h-5" />}
          subtitle={avgErrorRate < 1 ? "Low" : avgErrorRate < 5 ? "Medium" : "High"}
          trend={avgErrorRate > 5 ? "down" : "neutral"}
        />

        <ModernMetricCard
          title="Affected Users"
          value={totalAffectedUsers.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          subtitle={`${((totalAffectedUsers / 1000) * 100).toFixed(1)}% of active`}
        />
      </section>

      {/* Error Trends Chart */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Error Trends</h2>
          <p className="text-sm text-gray-600">Error count and rate over time</p>
        </div>
        <ModernLineChart
          data={errorTrendData}
          lines={[
            {
              key: "Total Errors",
              label: "Total Errors",
              color: "#DC2626",
            },
            {
              key: "Error Rate (%)",
              label: "Error Rate (%)",
              color: "#F59E0B",
            },
          ]}
          xAxisKey="date"
          xAxisLabel="Date"
          yAxisLabel="Count / Rate"
          height={320}
          formatTooltip={(value) => {
            if (typeof value === "number") {
              return value > 100 ? value.toLocaleString() : `${value}%`;
            }
            return value;
          }}
        />
      </section>

      {/* Error Distribution & Critical Errors */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Errors by Feature</h2>
            <p className="text-sm text-gray-600">Features with the highest error rates</p>
          </div>
          <ModernBarChart
            data={featureErrors.slice(0, 8)}
            bars={[
              {
                key: "error_count",
                label: "Error Count",
                color: "#DC2626",
              },
            ]}
            xAxisKey="feature_name"
            xAxisLabel="Feature"
            yAxisLabel="Error Count"
            height={320}
            formatXAxis={(value) => value.replace(/_/g, " ")}
            formatTooltip={(value) => `${value} errors`}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Critical Errors (24h)</h2>
              <p className="text-sm text-gray-600">High-priority errors requiring attention</p>
            </div>
            <Badge className="bg-red-100 text-red-700">
              {criticalErrors.length} Critical
            </Badge>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {criticalErrors.slice(0, 8).map((error: any, index) => (
              <div key={index} className="flex justify-between items-start p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex gap-3">
                  <div className="text-red-600 mt-1">
                    {getSeverityIcon("critical")}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{error.error_type || "Unknown Error"}</p>
                    <p className="text-xs text-gray-500">
                      {error.feature_name} • {new Date(error.occurred_at).toLocaleTimeString()}
                    </p>
                    {error.error_message && (
                      <p className="text-xs mt-1 font-mono bg-gray-100 p-2 rounded truncate max-w-md">
                        {error.error_message.slice(0, 100)}...
                      </p>
                    )}
                  </div>
                </div>
                <Badge className="bg-red-100 text-red-700 text-xs">
                  {error.occurrence_count || 1}x
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Error Type Breakdown */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Error Type Analysis</h2>
          <p className="text-sm text-gray-600">Breakdown of errors by type and impact</p>
        </div>

        <div className="mb-6">
          <ModernBarChart
            data={errorTypeStats.slice(0, 10)}
            bars={[
              {
                key: "count",
                label: "Occurrences",
                color: "#DC2626",
              },
            ]}
            xAxisKey="type"
            xAxisLabel="Error Type"
            yAxisLabel="Count"
            height={250}
            formatTooltip={(value) => `${value} occurrences`}
          />
        </div>

        <ModernDataTable
          data={errorTypeStats.slice(0, 10)}
          columns={[
            {
              key: "type",
              header: "Error Type",
              render: (value) => (
                <span className="font-medium text-gray-900">{value}</span>
              ),
            },
            {
              key: "count",
              header: "Occurrences",
              render: (value) => (
                <Badge className="bg-red-100 text-red-700">{value}</Badge>
              ),
            },
            {
              key: "featureCount",
              header: "Affected Features",
              render: (value) => value,
            },
            {
              key: "userCount",
              header: "Affected Users",
              render: (value) => value,
            },
            {
              key: "count",
              header: "Severity",
              render: (value) => {
                const severity = value > 100 ? "Critical" : value > 50 ? "High" : value > 20 ? "Medium" : "Low";
                const colorMap: Record<string, string> = {
                  Critical: "bg-red-100 text-red-700",
                  High: "bg-orange-100 text-orange-700",
                  Medium: "bg-yellow-100 text-yellow-700",
                  Low: "bg-blue-100 text-blue-700",
                };
                return <Badge className={colorMap[severity]}>{severity}</Badge>;
              },
            },
          ]}
          pageSize={10}
        />
      </section>

      {/* Recent Error Details */}
      <section>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Error Details</h2>
            <p className="text-sm text-gray-600">Latest error occurrences with full details</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Export logic for CSV
              const csvContent = "data:text/csv;charset=utf-8," +
                ["Timestamp,Feature,Error Type,User,Message,Duration"]
                .concat(errorDetails.map(e =>
                  `${e.started_at},${e.feature_name},${e.error_type || "Unknown"},${e.user_email || e.user_id || "N/A"},${e.error_message || "No message"},${e.duration_ms || "N/A"}`
                )).join("\n");
              const link = document.createElement("a");
              link.href = encodeURI(csvContent);
              link.download = "error-details.csv";
              link.click();
            }}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <ModernDataTable
          data={errorDetails}
          columns={[
            {
              key: "started_at",
              header: "Timestamp",
              render: (value) => (
                <span className="text-sm text-gray-600">
                  {new Date(value).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ),
            },
            {
              key: "feature_name",
              header: "Feature",
              render: (value) => (
                <span className="font-medium text-gray-900">
                  {value.replace(/_/g, " ")}
                </span>
              ),
            },
            {
              key: "error_type",
              header: "Error Type",
              render: (value) => (
                <Badge className="bg-red-100 text-red-700">
                  {value || "Unknown"}
                </Badge>
              ),
            },
            {
              key: "user_email",
              header: "User",
              render: (value, row) => (
                <span className="text-sm">
                  {value?.split("@")[0] || row.user_id?.slice(0, 8) || "N/A"}
                </span>
              ),
            },
            {
              key: "error_message",
              header: "Message",
              render: (value) => (
                <span className="text-xs font-mono truncate max-w-xs block" title={value}>
                  {value || "No message"}
                </span>
              ),
            },
            {
              key: "duration_ms",
              header: "Duration",
              render: (value) => (
                <span className="text-sm">
                  {value ? `${value}ms` : "N/A"}
                </span>
              ),
            },
          ]}
          searchable
          searchPlaceholder="Search errors..."
          pageSize={20}
        />
      </section>
    </div>
  );
}
