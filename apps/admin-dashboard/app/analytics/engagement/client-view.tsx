"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Download, TrendingUp, Users, AlertCircle, Activity } from "lucide-react";

interface UserEngagementClientViewProps {
  engagementScores: any[];
  retentionData: any[];
  userSegments: any[];
  topUsers: any[];
  inactiveUsers: any[];
  engagementTrends: any[];
}

export function UserEngagementClientView({
  engagementScores,
  retentionData,
  userSegments,
  topUsers,
  inactiveUsers,
  engagementTrends,
}: UserEngagementClientViewProps) {
  // Calculate engagement metrics
  const avgEngagement =
    engagementScores.length > 0
      ? engagementScores.reduce((sum, user) => sum + user.engagement_score, 0) /
        engagementScores.length
      : 0;

  const highlyEngaged = engagementScores.filter((u) => u.engagement_score > 80).length;
  const mediumEngaged = engagementScores.filter(
    (u) => u.engagement_score >= 40 && u.engagement_score <= 80,
  ).length;
  const lowEngaged = engagementScores.filter((u) => u.engagement_score < 40).length;

  // Get engagement level color and label
  const getEngagementLevel = (score: number) => {
    if (score >= 80) return { label: "Power User", color: "emerald" };
    if (score >= 60) return { label: "Active", color: "blue" };
    if (score >= 40) return { label: "Regular", color: "violet" };
    if (score >= 20) return { label: "Casual", color: "yellow" };
    return { label: "At Risk", color: "red" };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">User Engagement Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor user engagement levels, retention, and activity patterns
        </p>
      </div>

      {/* Engagement Overview Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Average Engagement</span>
          </div>
          <div className="text-3xl font-semibold">{avgEngagement.toFixed(1)}</div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                avgEngagement >= 60
                  ? "bg-emerald-500"
                  : avgEngagement >= 40
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${avgEngagement}%` }}
            />
          </div>
        </div>

        <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-muted-foreground">Power Users</span>
          </div>
          <div className="text-3xl font-semibold">{highlyEngaged}</div>
          <div className="text-xs text-muted-foreground mt-2">Score &gt; 80</div>
        </div>

        <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Active Users</span>
          </div>
          <div className="text-3xl font-semibold">{mediumEngaged}</div>
          <div className="text-xs text-muted-foreground mt-2">Score 40-80</div>
        </div>

        <div className="p-6 rounded-lg bg-background/60 backdrop-blur-xl border border-white/10 hover:bg-background/70 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-muted-foreground">At Risk Users</span>
          </div>
          <div className="text-3xl font-semibold">{lowEngaged}</div>
          <div className="text-xs text-muted-foreground mt-2">Score &lt; 40</div>
        </div>
      </section>

      {/* Top Users Table */}
      <section className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold">Top Engaged Users</h2>
            <p className="text-sm text-muted-foreground">Most active and engaged users</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const csvContent =
                "data:text/csv;charset=utf-8," +
                ["User,Score,Days Active,Sessions,Features,Level"]
                  .concat(
                    topUsers.map((u) =>
                      `${u.email || u.user_id},${u.engagement_score},${u.days_active},${u.total_sessions},${u.features_used},${getEngagementLevel(u.engagement_score).label}`.replace(
                        /,/g,
                        ";",
                      ),
                    ),
                  )
                  .join("\n");
              const link = document.createElement("a");
              link.href = encodeURI(csvContent);
              link.download = "top-users.csv";
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
                  User
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Score
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Activity
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Level
                </th>
              </tr>
            </thead>
            <tbody>
              {topUsers.slice(0, 10).map((user: any) => {
                const level = getEngagementLevel(user.engagement_score);
                return (
                  <tr
                    key={user.user_id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">
                          {user.display_name || user.email?.split("@")[0] || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.email || user.user_id.slice(0, 8)}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{user.engagement_score.toFixed(0)}</span>
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${level.color}-500`}
                            style={{ width: `${user.engagement_score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs space-y-0.5 text-muted-foreground">
                        <div>{user.days_active} days active</div>
                        <div>{user.total_sessions} sessions</div>
                        <div>{user.features_used} features</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        className={`bg-${level.color}-500/20 text-${level.color}-600 backdrop-blur-sm`}
                      >
                        {level.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Retention & Segments */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Retention Cohorts</h2>
          <p className="text-sm text-muted-foreground mb-4">User retention by signup cohort</p>

          <div className="space-y-3">
            {retentionData.slice(0, 8).map((cohort: any) => (
              <div key={cohort.cohort_date} className="border-b border-white/5 pb-3">
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-sm">
                    {new Date(cohort.cohort_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">{cohort.cohort_size} users</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  {["day1", "day7", "day14", "day30"].map((period) => (
                    <div key={period}>
                      <div className="text-muted-foreground mb-1">
                        {period.replace("day", "Day ")}
                      </div>
                      <Badge
                        className={`${
                          cohort[`${period}_retention`] >= 70
                            ? "bg-green-500/20 text-green-600"
                            : cohort[`${period}_retention`] >= 50
                              ? "bg-yellow-500/20 text-yellow-600"
                              : "bg-red-500/20 text-red-600"
                        } backdrop-blur-sm`}
                      >
                        {cohort[`${period}_retention`]?.toFixed(1) || "N/A"}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Inactive Users</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Users who haven't been active recently
          </p>

          <div className="space-y-3">
            {inactiveUsers.slice(0, 10).map((user: any) => (
              <div
                key={user.user_id}
                className="flex justify-between items-center p-3 rounded-lg bg-background/30 hover:bg-background/40 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">
                    {user.display_name || user.email?.split("@")[0] || "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active: {new Date(user.last_active_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className="bg-red-500/20 text-red-600 backdrop-blur-sm mb-1">
                    {user.days_inactive} days inactive
                  </Badge>
                  <p className="text-xs text-muted-foreground">{user.total_sessions} sessions</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
            <span className="text-sm text-muted-foreground">Total Inactive Users</span>
            <Badge className="bg-red-500/20 text-red-600 backdrop-blur-sm">
              {inactiveUsers.length}
            </Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
