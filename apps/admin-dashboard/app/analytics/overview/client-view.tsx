"use client";

import {
  ModernMetricCard,
  ModernLineChart,
  ModernBarChart,
} from "@/components/design-system";
import {
  Users,
  Activity,
  TrendingUp,
  AlertCircle,
  Calendar,
  UserCheck,
} from "lucide-react";

interface AnalyticsOverviewClientViewProps {
  overviewMetrics: any;
  dauData: any[];
  engagementData: any[];
}

export function AnalyticsOverviewClientView({
  overviewMetrics,
  dauData,
  engagementData,
}: AnalyticsOverviewClientViewProps) {
  // Calculate trends (mock data for now, should be calculated from actual data)
  const dauTrend = dauData.length > 1
    ? ((dauData[dauData.length - 1].dau - dauData[0].dau) / dauData[0].dau) * 100
    : 0;

  // Transform engagement data into histogram format
  const engagementDistribution = [
    { range: "0-20", count: 0 },
    { range: "21-40", count: 0 },
    { range: "41-60", count: 0 },
    { range: "61-80", count: 0 },
    { range: "81-100", count: 0 },
  ];

  engagementData.forEach((user: any) => {
    const score = user.engagement_score || 0;
    if (score <= 20) engagementDistribution[0]!.count++;
    else if (score <= 40) engagementDistribution[1]!.count++;
    else if (score <= 60) engagementDistribution[2]!.count++;
    else if (score <= 80) engagementDistribution[3]!.count++;
    else engagementDistribution[4]!.count++;
  });

  // Debug: Check transformation results
  console.log("[Client Debug] Engagement data received:", engagementData.length, "users");
  console.log("[Client Debug] Histogram distribution:", engagementDistribution);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
        <p className="mt-1 text-sm text-gray-600">
          Real-time overview of platform performance and user activity
        </p>
      </div>

      {/* Key Metrics Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ModernMetricCard
          title="Daily Active Users"
          value={overviewMetrics.dau.toLocaleString()}
          change={dauTrend}
          changeLabel="vs last period"
          trend={dauTrend > 0 ? "up" : dauTrend < 0 ? "down" : "neutral"}
          icon={<Users className="w-5 h-5" />}
          subtitle="Current DAU"
        />

        <ModernMetricCard
          title="Weekly Active Users"
          value={overviewMetrics.wau.toLocaleString()}
          icon={<Calendar className="w-5 h-5" />}
          subtitle="7-day active"
        />

        <ModernMetricCard
          title="Monthly Active Users"
          value={overviewMetrics.mau.toLocaleString()}
          icon={<UserCheck className="w-5 h-5" />}
          subtitle="30-day active"
        />

        <ModernMetricCard
          title="Error Rate"
          value={`${overviewMetrics.error_rate.toFixed(2)}%`}
          trend={overviewMetrics.error_rate > 5 ? "down" : "neutral"}
          icon={<AlertCircle className="w-5 h-5" />}
          subtitle="System health"
        />
      </section>

      {/* User Activity Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Daily Active Users</h2>
            <p className="text-sm text-gray-600">Daily unique users over the last 30 days</p>
          </div>
          <ModernLineChart
            data={dauData}
            lines={[
              {
                key: "dau",
                label: "Daily Active Users",
                showArea: true,
              },
            ]}
            xAxisKey="date"
            xAxisLabel="Date"
            yAxisLabel="Users"
            height={320}
            formatXAxis={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
            formatYAxis={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)}k`;
              }
              return value.toString();
            }}
            formatTooltip={(value) => value.toLocaleString()}
          />
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">User Engagement Distribution</h2>
            <p className="text-sm text-gray-600">Distribution of user engagement scores</p>
          </div>
          <ModernBarChart
            data={engagementDistribution}
            bars={[
              {
                key: "count",
                label: "Users",
              },
            ]}
            xAxisKey="range"
            xAxisLabel="Engagement Score Range"
            yAxisLabel="Number of Users"
            height={320}
            formatYAxis={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)}k`;
              }
              return value.toString();
            }}
            formatTooltip={(value) => `${value} users`}
          />
        </div>
      </section>
    </div>
  );
}
