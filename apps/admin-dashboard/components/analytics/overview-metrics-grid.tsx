"use client";

import { OverviewMetrics } from "@/lib/analytics/types";
import {
  Users,
  Activity,
  Calendar,
  AlertCircle,
  TrendingUp,
  Layers,
  AlertTriangle,
  UserCheck,
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  badge?: {
    text: string;
    color: "green" | "yellow" | "red" | "blue" | "emerald";
  };
}

function MetricCard({ title, value, icon, trend, badge }: MetricCardProps) {
  const badgeColors = {
    green: "bg-green-500/20 text-green-600 dark:text-green-400",
    yellow: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    red: "bg-red-500/20 text-red-600 dark:text-red-400",
    blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all duration-200 group">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground group-hover:text-foreground transition-colors">
              {icon}
            </div>
            <span className="text-sm text-muted-foreground">{title}</span>
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
          {trend && (
            <div
              className={`mt-2 text-sm font-medium ${
                trend.isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              <span className="inline-block mr-1">
                {trend.isPositive ? "↑" : "↓"}
              </span>
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        {badge && (
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full backdrop-blur-sm ${
              badgeColors[badge.color]
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

interface OverviewMetricsGridProps {
  data: OverviewMetrics;
  previousData?: OverviewMetrics;
}

export function OverviewMetricsGrid({ data, previousData }: OverviewMetricsGridProps) {
  // Calculate trends if previous data is available
  const calculateTrend = (current: number, previous?: number) => {
    if (!previous || previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      isPositive: change >= 0,
    };
  };

  // Get error status
  const getErrorStatus = (rate: number) => {
    if (rate < 1) return { text: "Healthy", color: "green" as const };
    if (rate < 5) return { text: "Warning", color: "yellow" as const };
    return { text: "Critical", color: "red" as const };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Daily Active Users"
        value={data.dau.toLocaleString()}
        icon={<Users size={20} />}
        trend={calculateTrend(data.dau, previousData?.dau)}
      />

      <MetricCard
        title="Weekly Active Users"
        value={data.wau.toLocaleString()}
        icon={<Activity size={20} />}
        trend={calculateTrend(data.wau, previousData?.wau)}
      />

      <MetricCard
        title="Monthly Active Users"
        value={data.mau.toLocaleString()}
        icon={<Calendar size={20} />}
        trend={calculateTrend(data.mau, previousData?.mau)}
      />

      <MetricCard
        title="Error Rate"
        value={`${data.error_rate.toFixed(2)}%`}
        icon={<AlertCircle size={20} />}
        badge={getErrorStatus(data.error_rate)}
      />

      <MetricCard
        title="Active Now"
        value={data.active_users_now.toLocaleString()}
        icon={<UserCheck size={20} />}
        badge={{ text: "Live", color: "emerald" }}
      />

      <MetricCard
        title="Features Used"
        value={data.total_features.toLocaleString()}
        icon={<Layers size={20} />}
      />

      <MetricCard
        title="Errors Today"
        value={data.total_errors_today.toLocaleString()}
        icon={<AlertTriangle size={20} />}
        badge={
          data.total_errors_today > 100
            ? { text: "High", color: "red" }
            : data.total_errors_today > 50
              ? { text: "Medium", color: "yellow" }
              : { text: "Low", color: "green" }
        }
      />

      <MetricCard
        title="Growth Rate"
        value={
          previousData
            ? `${(((data.mau - previousData.mau) / previousData.mau) * 100).toFixed(1)}%`
            : "N/A"
        }
        icon={<TrendingUp size={20} />}
        badge={
          previousData && data.mau > previousData.mau
            ? { text: "Growing", color: "emerald" }
            : { text: "Stable", color: "blue" }
        }
      />
    </div>
  );
}
