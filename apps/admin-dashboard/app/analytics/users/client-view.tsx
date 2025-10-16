"use client";

import {
  ModernLineChart,
  ModernMetricCard,
  ModernDataTable,
  ModernBarChart,
} from "@/components/design-system";
import {
  Users,
  Activity,
  TrendingUp,
  Clock,
  UserCheck,
  Monitor,
  Smartphone,
  AlertCircle,
  Download,
  Cpu,
  DollarSign,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { TokenUsageCard } from "@/components/analytics/TokenUsageCard";
import { CostEstimationWidget } from "@/components/analytics/CostEstimationWidget";
import type { UserTokenSummary } from "@/lib/analytics/token-utils";
import { formatTokenCount, formatCost } from "@/lib/analytics/token-utils";

interface UserActivityClientViewProps {
  recentSessions: any[];
  activeUsers: any[];
  dauData: any[];
  wauData: any[];
  mauData: any[];
  sessionMetrics: any;
  growthData: any[];
  retentionData: any[];
  activityMetrics?: {
    totalTokens: number;
    totalCost: number;
    averageTokensPerUser: number;
    averageCostPerUser: number;
  };
  tokenSummary?: UserTokenSummary;
  costEstimation?: {
    currentCost: number;
    projectedCost: number;
    averageDailyCost: number;
  };
}

export function UserActivityClientView({
  recentSessions,
  activeUsers,
  dauData,
  wauData,
  mauData,
  sessionMetrics,
  growthData,
  retentionData,
  activityMetrics,
  tokenSummary,
  costEstimation,
}: UserActivityClientViewProps) {
  // Convert sessionMetrics object to array format for display
  const sessionMetricsArray = sessionMetrics ? [
    {
      label: "Total Sessions",
      value: sessionMetrics.total_sessions?.toLocaleString() || "0",
      description: "Sessions in period"
    },
    {
      label: "Avg Duration",
      value: `${sessionMetrics.avg_duration_minutes?.toFixed(1) || "0"} min`,
      description: "Average session length"
    },
    {
      label: "Normal Exits",
      value: `${sessionMetrics.normal_exit_rate?.toFixed(1) || "0"}%`,
      description: "Healthy completions"
    },
    {
      label: "Crashes",
      value: sessionMetrics.crashes?.toString() || "0",
      description: "Abnormal terminations"
    }
  ] : [];

  // Format session duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get session status color
  const getSessionStatusColor = (session: any) => {
    if (session.is_active) return "emerald";
    if (session.exit_reason === "normal") return "blue";
    if (session.exit_reason === "crash") return "red";
    return "yellow";
  };

  // Get session status text
  const getSessionStatus = (session: any) => {
    if (session.is_active) return "Active";
    if (session.exit_reason === "normal") return "Completed";
    if (session.exit_reason === "crash") return "Crashed";
    if (session.exit_reason === "timeout") return "Timeout";
    return "Unknown";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Activity Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor user engagement, session patterns, activity trends, and AI token costs
        </p>
      </div>

      {/* Token Usage & Cost Overview */}
      {(tokenSummary || costEstimation || activityMetrics) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Token Usage Metrics */}
          {activityMetrics && (
            <>
              <ModernMetricCard
                title="Total Tokens Used"
                value={formatTokenCount(activityMetrics.totalTokens)}
                subtitle={`Last 30 days · ${Math.round(activityMetrics.averageTokensPerUser).toLocaleString()} per user avg`}
                icon={<Cpu className="w-5 h-5" />}
              />
              <ModernMetricCard
                title="Total AI Cost"
                value={formatCost(activityMetrics.totalCost)}
                subtitle={`Last 30 days · ${formatCost(activityMetrics.averageCostPerUser)} per user avg`}
                icon={<DollarSign className="w-5 h-5" />}
              />
            </>
          )}
          {costEstimation && (
            <ModernMetricCard
              title="Projected Monthly"
              value={formatCost(costEstimation.projectedCost)}
              subtitle={`Based on current usage · ${formatCost(costEstimation.averageDailyCost)} daily avg`}
              icon={<TrendingUp className="w-5 h-5" />}
            />
          )}
        </section>
      )}

      {/* Detailed Token Usage & Cost Estimation */}
      {(tokenSummary || costEstimation) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tokenSummary && (
            <TokenUsageCard
              summary={tokenSummary}
              period="Last 30 days"
              showDetails={true}
            />
          )}
          {costEstimation && (
            <CostEstimationWidget
              currentCost={costEstimation.currentCost}
              projectedCost={costEstimation.projectedCost}
              averageDailyCost={costEstimation.averageDailyCost}
              period="month"
            />
          )}
        </section>
      )}

      {/* User Activity Trends */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Daily Active Users</h2>
            <p className="text-sm text-gray-600">Daily unique users</p>
          </div>
          <ModernLineChart
            data={dauData}
            lines={[{ key: "dau", label: "DAU", showArea: true }]}
            xAxisKey="date"
            height={250}
            formatXAxis={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
            formatYAxis={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()}
            formatTooltip={(value) => value.toLocaleString()}
          />
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Active Users</h2>
            <p className="text-sm text-gray-600">7-day active users</p>
          </div>
          <ModernLineChart
            data={wauData}
            lines={[{ key: "wau", label: "WAU", showArea: true }]}
            xAxisKey="week"
            height={250}
            formatXAxis={(value) => {
              const date = new Date(value);
              return `W${Math.ceil(date.getDate() / 7)}`;
            }}
            formatYAxis={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()}
            formatTooltip={(value) => value.toLocaleString()}
          />
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Monthly Active Users</h2>
            <p className="text-sm text-gray-600">30-day active users</p>
          </div>
          <ModernLineChart
            data={mauData}
            lines={[{ key: "mau", label: "MAU", showArea: true }]}
            xAxisKey="month"
            height={250}
            formatXAxis={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString("en-US", { month: "short" });
            }}
            formatYAxis={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()}
            formatTooltip={(value) => value.toLocaleString()}
          />
        </div>
      </section>

      {/* Session Metrics & Active Users */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Session Performance</h2>
            <p className="text-sm text-gray-600">Average session duration and health metrics</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {sessionMetricsArray.slice(0, 4).map((metric: any, index: number) => (
              <ModernMetricCard
                key={index}
                title={metric.label}
                value={metric.value}
                subtitle={metric.description}
                icon={<Clock className="w-5 h-5" />}
              />
            ))}
          </div>
        </div>

        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">Currently Active Users</h2>
              <p className="text-sm text-muted-foreground">Users with active sessions right now</p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 backdrop-blur-sm">
              {activeUsers.length} Active
            </Badge>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <ModernDataTable
              data={activeUsers.slice(0, 10)}
              columns={[
                {
                  key: "user_email",
                  header: "User",
                  render: (value, row) => (
                    <div>
                      <p className="font-medium text-gray-900">{value || row.user_id}</p>
                      <p className="text-xs text-gray-500">Started {formatDate(row.started_at)}</p>
                    </div>
                  ),
                },
                {
                  key: "platform",
                  header: "Platform",
                  render: (value) => (
                    <div className="flex items-center gap-2">
                      {value === "desktop" ? <Monitor className="w-4 h-4 text-gray-500" /> : <Smartphone className="w-4 h-4 text-gray-500" />}
                      <span>{value}</span>
                    </div>
                  ),
                },
                {
                  key: "duration_seconds",
                  header: "Duration",
                  render: (value) => formatDuration(value),
                },
              ]}
              compact
              striped={false}
            />
          </div>
        </div>
      </section>

      {/* User Growth & Retention */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">User Growth</h2>
            <p className="text-sm text-gray-600">New vs returning users over time</p>
          </div>
          <ModernDataTable
            data={growthData.slice(0, 7)}
            columns={[
              {
                key: "date",
                header: "Date",
                render: (value) => formatDate(value),
              },
              {
                key: "new_users",
                header: "New Users",
                render: (value) => (
                  <Badge className="bg-blue-100 text-blue-700">{value}</Badge>
                ),
              },
              {
                key: "returning_users",
                header: "Returning",
                render: (value) => (
                  <Badge className="bg-purple-100 text-purple-700">{value}</Badge>
                ),
              },
              {
                key: "total_users",
                header: "Total",
                render: (value) => (
                  <span className="font-semibold text-gray-900">{value}</span>
                ),
              },
            ]}
            compact
            pageSize={7}
          />
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">User Retention</h2>
            <p className="text-sm text-gray-600">User retention rates by cohort</p>
          </div>
          <ModernDataTable
            data={retentionData.slice(0, 5)}
            columns={[
              {
                key: "cohort_date",
                header: "Cohort",
                render: (value) => formatDate(value),
              },
              {
                key: "day1_retention",
                header: "Day 1",
                render: (value) => (
                  <Badge className={value > 50 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {value.toFixed(1)}%
                  </Badge>
                ),
              },
              {
                key: "day7_retention",
                header: "Day 7",
                render: (value) => (
                  <Badge className={value > 30 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {value.toFixed(1)}%
                  </Badge>
                ),
              },
              {
                key: "day30_retention",
                header: "Day 30",
                render: (value) => (
                  <Badge className={value > 20 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {value.toFixed(1)}%
                  </Badge>
                ),
              },
            ]}
            compact
            pageSize={5}
          />
        </div>
      </section>

      {/* Recent Sessions Table */}
      <section>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
            <p className="text-sm text-gray-600">Latest user session activity</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Export logic for CSV
              const csvContent = "data:text/csv;charset=utf-8," +
                ["User,Platform,Duration,Transcriptions,AI Actions,Status"]
                .concat(recentSessions.map(s =>
                  `${s.user_email || s.user_id},${s.platform},${s.duration_seconds},${s.transcription_count},${s.ai_actions_count},${getSessionStatus(s)}`
                )).join("\n");
              const link = document.createElement("a");
              link.href = encodeURI(csvContent);
              link.download = "user-sessions.csv";
              link.click();
            }}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <ModernDataTable
          data={recentSessions}
          columns={[
            {
              key: "user_email",
              header: "User",
              render: (value, row) => (
                <span className="font-medium text-gray-900">
                  {value || row.user_id.slice(0, 8)}
                </span>
              ),
            },
            {
              key: "started_at",
              header: "Session Info",
              render: (value, row) => (
                <div className="text-xs text-gray-600">
                  {formatDate(value)}
                  {row.ended_at && ` - ${formatDate(row.ended_at)}`}
                </div>
              ),
            },
            {
              key: "platform",
              header: "Platform",
              render: (value, row) => (
                <div>
                  <p className="text-sm">{value}</p>
                  {row.app_version ? (
                    <p className="text-xs text-gray-500">v{row.app_version}</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">version unknown</p>
                  )}
                </div>
              ),
            },
            {
              key: "duration_seconds",
              header: "Duration",
              render: (value) => formatDuration(value),
            },
            {
              key: "transcription_count",
              header: "Transcriptions",
              render: (value, row) => (
                <div>
                  <p className="text-sm">{value || 0}</p>
                  <p className="text-xs text-gray-500">
                    {(row.transcription_minutes || 0).toFixed(1)} min
                  </p>
                </div>
              ),
            },
            {
              key: "ai_actions_count",
              header: "AI Actions",
              render: (value) => value || 0,
            },
            {
              key: "exit_reason",
              header: "Status",
              render: (value, row) => {
                const status = getSessionStatus(row);
                const colorMap: Record<string, string> = {
                  "Active": "bg-green-100 text-green-700",
                  "Completed": "bg-blue-100 text-blue-700",
                  "Crashed": "bg-red-100 text-red-700",
                  "Timeout": "bg-yellow-100 text-yellow-700",
                  "Unknown": "bg-gray-100 text-gray-700",
                };
                return (
                  <Badge className={colorMap[status] || "bg-gray-100 text-gray-700"}>
                    {status}
                  </Badge>
                );
              },
            },
          ]}
          searchable
          searchPlaceholder="Search sessions..."
          pageSize={10}
        />
      </section>
    </div>
  );
}
