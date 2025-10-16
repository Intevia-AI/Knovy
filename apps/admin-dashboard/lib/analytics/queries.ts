import { createServerClient } from "@/lib/supabase-server";
import type {
  DauData,
  WauData,
  MauData,
  FeatureAdoptionData,
  EngagementScoreData,
  ErrorData,
  SessionMetrics,
  OverviewMetrics,
  UserSession,
  FeatureUsage,
  DateRange,
} from "./types";

// Helper to format dates for SQL
function formatDate(date: Date): string {
  return date.toISOString();
}

// DAU/WAU/MAU Queries
export async function getDailyActiveUsers(dateRange: DateRange): Promise<DauData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select("started_at, user_id")
    .gte("started_at", formatDate(dateRange.from))
    .lte("started_at", formatDate(dateRange.to));

  if (error) throw error;

  // Aggregate to DAU
  const dauMap = new Map<string, Set<string>>();
  data?.forEach(({ started_at, user_id }) => {
    const date = new Date(started_at).toISOString().split("T")[0]!;
    if (!dauMap.has(date)) {
      dauMap.set(date, new Set());
    }
    dauMap.get(date)!.add(user_id);
  });

  return Array.from(dauMap.entries())
    .map(([date, users]) => ({
      date,
      dau: users.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getWeeklyActiveUsers(dateRange: DateRange): Promise<WauData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select("started_at, user_id")
    .gte("started_at", formatDate(dateRange.from))
    .lte("started_at", formatDate(dateRange.to));

  if (error) throw error;

  // Aggregate to WAU (week starts on Sunday)
  const wauMap = new Map<string, Set<string>>();
  data?.forEach(({ started_at, user_id }) => {
    const date = new Date(started_at);
    // Get the Sunday of the week
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());
    const weekKey = sunday.toISOString().split("T")[0]!;

    if (!wauMap.has(weekKey)) {
      wauMap.set(weekKey, new Set());
    }
    wauMap.get(weekKey)!.add(user_id);
  });

  return Array.from(wauMap.entries())
    .map(([week, users]) => ({
      week,
      wau: users.size,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export async function getMonthlyActiveUsers(dateRange: DateRange): Promise<MauData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select("started_at, user_id")
    .gte("started_at", formatDate(dateRange.from))
    .lte("started_at", formatDate(dateRange.to));

  if (error) throw error;

  // Aggregate to MAU (by month)
  const mauMap = new Map<string, Set<string>>();
  data?.forEach(({ started_at, user_id }) => {
    const date = new Date(started_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!mauMap.has(monthKey)) {
      mauMap.set(monthKey, new Set());
    }
    mauMap.get(monthKey)!.add(user_id);
  });

  return Array.from(mauMap.entries())
    .map(([month, users]) => ({
      month,
      mau: users.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// Feature Adoption Queries
export async function getFeatureAdoption(dateRange: DateRange): Promise<FeatureAdoptionData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("feature_usage")
    .select("*")
    .gte("created_at", formatDate(dateRange.from))
    .lte("created_at", formatDate(dateRange.to));

  if (error) throw error;

  // Aggregate by feature
  const featureMap = new Map<
    string,
    {
      users: Set<string>;
      total: number;
      successful: number;
      failed: number;
      durations: number[];
    }
  >();

  data?.forEach((usage: FeatureUsage) => {
    if (!featureMap.has(usage.feature_name)) {
      featureMap.set(usage.feature_name, {
        users: new Set(),
        total: 0,
        successful: 0,
        failed: 0,
        durations: [],
      });
    }

    const feature = featureMap.get(usage.feature_name)!;
    feature.users.add(usage.user_id);
    feature.total++;
    if (usage.success) {
      feature.successful++;
    } else {
      feature.failed++;
    }
    if (usage.duration_ms) {
      feature.durations.push(usage.duration_ms);
    }
  });

  return Array.from(featureMap.entries()).map(([name, stats]) => ({
    feature_name: name,
    feature_category: data?.find((u) => u.feature_name === name)?.feature_category || "Uncategorized",
    unique_users: stats.users.size,
    total_uses: stats.total,
    successful_uses: stats.successful,
    failed_uses: stats.failed,
    success_rate: stats.total > 0 ? (stats.successful / stats.total) : 0,
    avg_duration_ms:
      stats.durations.length > 0
        ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        : undefined,
  }));
}

export async function getFeatureUsageTrend(
  featureName: string,
  dateRange: DateRange,
): Promise<{ date: string; uses: number }[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("feature_usage")
    .select("created_at")
    .eq("feature_name", featureName)
    .gte("created_at", formatDate(dateRange.from))
    .lte("created_at", formatDate(dateRange.to));

  if (error) throw error;

  // Aggregate by date
  const dateMap = new Map<string, number>();
  data?.forEach(({ created_at }) => {
    const date = new Date(created_at).toISOString().split("T")[0]!;
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  });

  return Array.from(dateMap.entries())
    .map(([date, uses]) => ({ date, uses }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// User Engagement Queries
export async function getUserEngagementScores(
  dateRange: DateRange,
): Promise<EngagementScoreData[]> {
  const supabase = await createServerClient();

  // Get user profiles
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email");

  if (profileError) throw profileError;

  // Get session data
  const { data: sessions, error: sessionError } = await supabase
    .from("user_sessions")
    .select("user_id, started_at")
    .gte("started_at", formatDate(dateRange.from))
    .lte("started_at", formatDate(dateRange.to));

  if (sessionError) throw sessionError;

  // Get feature usage data
  const { data: features, error: featureError } = await supabase
    .from("feature_usage")
    .select("user_id, feature_name")
    .gte("created_at", formatDate(dateRange.from))
    .lte("created_at", formatDate(dateRange.to));

  if (featureError) throw featureError;

  // Calculate engagement scores
  const userStats = new Map<
    string,
    {
      email: string;
      days: Set<string>;
      sessions: number;
      features: Set<string>;
    }
  >();

  // Initialize with profiles
  profiles?.forEach((profile) => {
    userStats.set(profile.id, {
      email: profile.email,
      days: new Set(),
      sessions: 0,
      features: new Set(),
    });
  });

  // Process sessions
  sessions?.forEach((session) => {
    const stats = userStats.get(session.user_id);
    if (stats) {
      const date = new Date(session.started_at).toISOString().split("T")[0]!;
      stats.days.add(date);
      stats.sessions++;
    }
  });

  // Process features
  features?.forEach((feature) => {
    const stats = userStats.get(feature.user_id);
    if (stats) {
      stats.features.add(feature.feature_name);
    }
  });

  // Calculate scores
  return Array.from(userStats.entries()).map(([userId, stats]) => ({
    user_id: userId,
    email: stats.email,
    days_active: stats.days.size,
    total_sessions: stats.sessions,
    features_used: stats.features.size,
    engagement_score: Math.min(
      100,
      stats.days.size * 5 + stats.features.size * 10 + Math.min(stats.sessions, 20) * 2,
    ),
  }));
}

// Error Monitoring Queries
export async function getErrorsByFeature(dateRange: DateRange): Promise<ErrorData[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("feature_usage")
    .select("feature_name, error_type, user_id")
    .eq("success", false)
    .gte("created_at", formatDate(dateRange.from))
    .lte("created_at", formatDate(dateRange.to));

  if (error) throw error;

  // Aggregate errors
  const errorMap = new Map<
    string,
    {
      errors: Map<string, number>;
      users: Set<string>;
      total: number;
    }
  >();

  data?.forEach((usage) => {
    const key = usage.feature_name;
    if (!errorMap.has(key)) {
      errorMap.set(key, {
        errors: new Map(),
        users: new Set(),
        total: 0,
      });
    }

    const feature = errorMap.get(key)!;
    const errorType = usage.error_type || "unknown";
    feature.errors.set(errorType, (feature.errors.get(errorType) || 0) + 1);
    feature.users.add(usage.user_id);
    feature.total++;
  });

  const results: ErrorData[] = [];
  errorMap.forEach((stats, featureName) => {
    stats.errors.forEach((count, errorType) => {
      results.push({
        feature_name: featureName,
        error_type: errorType,
        error_count: count,
        affected_users: stats.users.size,
        error_percentage: (count / stats.total) * 100,
      });
    });
  });

  return results;
}

export async function getErrorTrend(dateRange: DateRange): Promise<
  {
    date: string;
    errors: number;
    total: number;
    error_rate: number;
  }[]
> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("feature_usage")
    .select("created_at, success")
    .gte("created_at", formatDate(dateRange.from))
    .lte("created_at", formatDate(dateRange.to));

  if (error) throw error;

  // Aggregate by date
  const dateMap = new Map<string, { errors: number; total: number }>();
  data?.forEach((usage) => {
    const date = new Date(usage.created_at).toISOString().split("T")[0]!;
    if (!dateMap.has(date)) {
      dateMap.set(date, { errors: 0, total: 0 });
    }
    const stats = dateMap.get(date)!;
    stats.total++;
    if (!usage.success) {
      stats.errors++;
    }
  });

  return Array.from(dateMap.entries())
    .map(([date, stats]) => ({
      date,
      errors: stats.errors,
      total: stats.total,
      error_rate: stats.total > 0 ? (stats.errors / stats.total) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Session Metrics Queries
export async function getSessionMetrics(dateRange: DateRange): Promise<SessionMetrics> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select("duration_seconds, exit_reason")
    .gte("started_at", formatDate(dateRange.from))
    .lte("started_at", formatDate(dateRange.to));

  if (error) throw error;

  const metrics: SessionMetrics = {
    total_sessions: data?.length || 0,
    avg_duration_minutes: 0,
    normal_exits: 0,
    crashes: 0,
    timeouts: 0,
    normal_exit_rate: 0,
  };

  if (data && data.length > 0) {
    let totalDuration = 0;
    let durationCount = 0;

    data.forEach((session) => {
      if (session.duration_seconds) {
        totalDuration += session.duration_seconds;
        durationCount++;
      }

      switch (session.exit_reason) {
        case "normal":
          metrics.normal_exits++;
          break;
        case "crash":
          metrics.crashes++;
          break;
        case "timeout":
          metrics.timeouts++;
          break;
      }
    });

    metrics.avg_duration_minutes = durationCount > 0 ? totalDuration / durationCount / 60 : 0;
    metrics.normal_exit_rate =
      metrics.total_sessions > 0 ? (metrics.normal_exits / metrics.total_sessions) * 100 : 0;
  }

  return metrics;
}

// Recent Sessions Query
export async function getRecentSessions(limit: number = 10): Promise<UserSession[]> {
  const supabase = await createServerClient();

  const { data: sessions, error } = await supabase
    .from("user_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Get feature usage for these sessions to calculate accurate counts
  const sessionIds = sessions?.map(s => s.session_id) || [];

  const { data: features } = await supabase
    .from("feature_usage")
    .select("session_id, feature_name, feature_category, metadata, duration_ms")
    .in("session_id", sessionIds);

  // Calculate metrics from feature_usage
  const sessionMetrics = new Map<string, {
    ai_actions_count: number;
    transcription_count: number;
    transcription_minutes: number;
  }>();

  features?.forEach(feature => {
    if (!feature.session_id) return;

    if (!sessionMetrics.has(feature.session_id)) {
      sessionMetrics.set(feature.session_id, {
        ai_actions_count: 0,
        transcription_count: 0,
        transcription_minutes: 0,
      });
    }

    const metrics = sessionMetrics.get(feature.session_id)!;

    // Count AI actions - includes both 'ai-action' category and 'ai' category
    // But exclude transcription enhancement (counted separately as transcriptions)
    if (
      (feature.feature_category === 'ai-action' || feature.feature_category === 'ai') &&
      feature.feature_name !== 'ai-transcription-enhance'
    ) {
      metrics.ai_actions_count++;
    }

    // Count transcription enhancement operations
    // Each ai-transcription-enhance call processes one or more transcription segments
    if (feature.feature_name === 'ai-transcription-enhance' && feature.metadata) {
      // Check for segment_count in metadata, default to 1 if not present
      const segmentCount = feature.metadata.segment_count || 1;
      metrics.transcription_count += segmentCount;

      // Calculate duration from metadata if available, otherwise estimate
      if (feature.metadata.audio_duration_seconds) {
        metrics.transcription_minutes += feature.metadata.audio_duration_seconds / 60;
      } else {
        // Estimate 3 seconds per segment
        const estimatedMinutes = (segmentCount * 3) / 60;
        metrics.transcription_minutes += estimatedMinutes;
      }
    }

    // Also count raw transcription features
    if (feature.feature_name === 'transcription' && feature.metadata) {
      metrics.transcription_count += 1;
      if (feature.metadata.duration_seconds) {
        metrics.transcription_minutes += feature.metadata.duration_seconds / 60;
      }
    }
  });

  // Fix platform version display and merge calculated metrics
  return (sessions || []).map(session => {
    const metrics = sessionMetrics.get(session.session_id);

    // Fix version display - handle 'unknown', 'vunknown', or any variant containing 'unknown'
    let fixedVersion = session.app_version;
    if (!fixedVersion || fixedVersion.toLowerCase().includes('unknown')) {
      fixedVersion = null;
    }

    return {
      ...session,
      app_version: fixedVersion,
      platform: session.platform || "desktop_app",
      // Override with calculated values from feature_usage
      ai_actions_count: metrics?.ai_actions_count || 0,
      transcription_count: metrics?.transcription_count || 0,
      transcription_minutes: metrics?.transcription_minutes || 0,
    };
  });
}

// Overview Metrics Query
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const supabase = await createServerClient();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get DAU
  const { data: dauData } = await supabase
    .from("user_sessions")
    .select("user_id")
    .gte("started_at", formatDate(oneDayAgo));

  const dau = new Set(dauData?.map((d) => d.user_id) || []).size;

  // Get WAU
  const { data: wauData } = await supabase
    .from("user_sessions")
    .select("user_id")
    .gte("started_at", formatDate(oneWeekAgo));

  const wau = new Set(wauData?.map((d) => d.user_id) || []).size;

  // Get MAU
  const { data: mauData } = await supabase
    .from("user_sessions")
    .select("user_id")
    .gte("started_at", formatDate(oneMonthAgo));

  const mau = new Set(mauData?.map((d) => d.user_id) || []).size;

  // Get active users now
  const { data: activeData } = await supabase
    .from("user_sessions")
    .select("user_id")
    .eq("is_active", true);

  const active_users_now = new Set(activeData?.map((d) => d.user_id) || []).size;

  // Get today's error rate
  const { data: todayUsage } = await supabase
    .from("feature_usage")
    .select("success")
    .gte("created_at", formatDate(oneDayAgo));

  const totalToday = todayUsage?.length || 0;
  const errorsToday = todayUsage?.filter((u) => !u.success).length || 0;
  const error_rate = totalToday > 0 ? (errorsToday / totalToday) * 100 : 0;

  // Get total features
  const { data: featureList } = await supabase
    .from("feature_usage")
    .select("feature_name")
    .gte("created_at", formatDate(oneWeekAgo));

  const total_features = new Set(featureList?.map((f) => f.feature_name) || []).size;

  return {
    dau,
    wau,
    mau,
    error_rate,
    active_users_now,
    total_features,
    total_errors_today: errorsToday,
  };
}

// Top Features Query
export async function getTopFeatures(limit: number = 5): Promise<
  {
    feature_name: string;
    uses_today: number;
  }[]
> {
  const supabase = await createServerClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("feature_usage")
    .select("feature_name")
    .gte("created_at", formatDate(oneDayAgo));

  if (error) throw error;

  // Count uses per feature
  const featureCount = new Map<string, number>();
  data?.forEach(({ feature_name }) => {
    featureCount.set(feature_name, (featureCount.get(feature_name) || 0) + 1);
  });

  // Sort and return top features
  return Array.from(featureCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([feature_name, uses_today]) => ({ feature_name, uses_today }));
}

// Power Users Query
export async function getPowerUsers(limit: number = 10): Promise<
  {
    user_id: string;
    email: string;
    sessions: number;
    total_minutes: number;
  }[]
> {
  const supabase = await createServerClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: sessions, error: sessionError } = await supabase
    .from("user_sessions")
    .select("user_id, duration_seconds")
    .gte("started_at", formatDate(thirtyDaysAgo));

  if (sessionError) throw sessionError;

  // Aggregate by user
  const userStats = new Map<string, { sessions: number; totalSeconds: number }>();
  sessions?.forEach((session) => {
    const stats = userStats.get(session.user_id) || { sessions: 0, totalSeconds: 0 };
    stats.sessions++;
    stats.totalSeconds += session.duration_seconds || 0;
    userStats.set(session.user_id, stats);
  });

  // Get user profiles
  const userIds = Array.from(userStats.keys());
  const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);

  // Combine and sort
  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
  return Array.from(userStats.entries())
    .map(([userId, stats]) => {
      const profile = profileMap.get(userId);
      return {
        user_id: userId,
        email: profile?.email || "Unknown",
        sessions: stats.sessions,
        total_minutes: Math.round(stats.totalSeconds / 60),
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

// User Retention Query - stub implementation returning empty data
export async function getUserRetention(_days: number = 30): Promise<any[]> {
  // TODO: Implement retention cohort analysis
  return [];
}

// User Segmentation Query
export async function getUserSegmentation(): Promise<any[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const engagementScores = await getUserEngagementScores({
    from: thirtyDaysAgo,
    to: new Date(),
  });

  const segments = [
    { name: "Power Users", min: 80, max: 100 },
    { name: "Active Users", min: 60, max: 79 },
    { name: "Regular Users", min: 40, max: 59 },
    { name: "Casual Users", min: 20, max: 39 },
    { name: "At-Risk Users", min: 0, max: 19 },
  ];

  return segments.map((segment) => {
    const usersInSegment = engagementScores.filter(
      (user) => user.engagement_score >= segment.min && user.engagement_score <= segment.max,
    );

    const avgScore =
      usersInSegment.length > 0
        ? usersInSegment.reduce((sum, user) => sum + user.engagement_score, 0) /
          usersInSegment.length
        : 0;

    return {
      segment_name: segment.name,
      user_count: usersInSegment.length,
      avg_engagement_score: avgScore,
    };
  });
}

// Top Users Query
export async function getTopUsers(limit: number = 20): Promise<any[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const engagementScores = await getUserEngagementScores({
    from: thirtyDaysAgo,
    to: new Date(),
  });

  return engagementScores.sort((a, b) => b.engagement_score - a.engagement_score).slice(0, limit);
}

// Inactive Users Query
export async function getInactiveUsers(days: number = 30): Promise<any[]> {
  const supabase = await createServerClient();
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data: sessions, error } = await supabase
    .from("user_sessions")
    .select("user_id, started_at")
    .order("started_at", { ascending: false });

  if (error) throw error;

  const userLastSession = new Map<string, Date>();
  const userSessionCount = new Map<string, number>();

  sessions?.forEach((session) => {
    if (!userLastSession.has(session.user_id)) {
      userLastSession.set(session.user_id, new Date(session.started_at));
    }
    userSessionCount.set(session.user_id, (userSessionCount.get(session.user_id) || 0) + 1);
  });

  const { data: profiles } = await supabase.from("profiles").select("id, email");

  const inactiveUsers = profiles
    ?.map((profile) => {
      const lastActive = userLastSession.get(profile.id) || new Date(0);
      const daysInactive = Math.floor((Date.now() - lastActive.getTime()) / (24 * 60 * 60 * 1000));

      return {
        user_id: profile.id,
        email: profile.email,
        last_active_at: lastActive.toISOString(),
        days_inactive: daysInactive,
        total_sessions: userSessionCount.get(profile.id) || 0,
      };
    })
    .filter((user) => user.days_inactive >= days)
    .sort((a, b) => b.days_inactive - a.days_inactive);

  return inactiveUsers || [];
}

// Engagement Trends Query - stub implementation
export async function getEngagementTrends(_days: number = 30): Promise<any[]> {
  // TODO: Implement engagement trends analysis
  return [];
}

// Error Summary Query (alias for getErrorsByFeature)
export async function getErrorSummary(days: number = 7): Promise<any[]> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return getErrorsByFeature({ from: startDate, to: new Date() });
}

// Error Trends Query (alias for getErrorTrend with different return type)
export async function getErrorTrends(days: number = 30): Promise<any[]> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const trendData = await getErrorTrend({ from: startDate, to: new Date() });
  return trendData.map((d) => ({
    ...d,
    total_errors: d.errors,
  }));
}

// Error Details Query
export async function getErrorDetails(_limit: number = 100): Promise<any[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("feature_usage")
    .select("*")
    .eq("success", false)
    .order("started_at", { ascending: false })
    .limit(_limit);

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    occurred_at: item.started_at,
    user_email: null, // Email not available without cross-schema join
  }));
}

// Affected Users Query
export async function getAffectedUsers(_days: number = 30): Promise<any[]> {
  // Stub implementation
  return [];
}

// Critical Errors Query
export async function getCriticalErrors(_hours: number = 24): Promise<any[]> {
  const supabase = await createServerClient();
  const cutoffDate = new Date(Date.now() - _hours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("feature_usage")
    .select("*")
    .eq("success", false)
    .gte("created_at", formatDate(cutoffDate))
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data || [];
}

// Active Users Query
export async function getActiveUsers(): Promise<any[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("is_active", true)
    .order("started_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((session: any) => ({
    ...session,
    user_email: null, // Email not available without cross-schema join
  }));
}

// User Growth Query
export async function getUserGrowth(days: number = 30): Promise<any[]> {
  const supabase = await createServerClient();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get all sessions in the date range
  const { data: sessions, error } = await supabase
    .from("user_sessions")
    .select("user_id, started_at")
    .gte("started_at", formatDate(startDate))
    .order("started_at", { ascending: true });

  if (error) throw error;

  // Get all user profiles to determine first session date
  const { data: allSessions } = await supabase
    .from("user_sessions")
    .select("user_id, started_at")
    .order("started_at", { ascending: true });

  // Map each user to their first session date
  const userFirstSession = new Map<string, Date>();
  allSessions?.forEach((session) => {
    if (!userFirstSession.has(session.user_id)) {
      userFirstSession.set(session.user_id, new Date(session.started_at));
    }
  });

  // Group sessions by date and classify as new or returning
  const dailyStats = new Map<string, { newUsers: Set<string>; returningUsers: Set<string> }>();

  sessions?.forEach((session) => {
    const date = new Date(session.started_at).toISOString().split("T")[0]!;
    if (!dailyStats.has(date)) {
      dailyStats.set(date, { newUsers: new Set(), returningUsers: new Set() });
    }

    const stats = dailyStats.get(date)!;
    const firstSession = userFirstSession.get(session.user_id);
    const sessionDate = new Date(session.started_at);
    const isNewUser = firstSession && Math.abs(sessionDate.getTime() - firstSession.getTime()) < 60000; // Within 1 minute

    if (isNewUser) {
      stats.newUsers.add(session.user_id);
    } else {
      stats.returningUsers.add(session.user_id);
    }
  });

  // Convert to array format
  return Array.from(dailyStats.entries())
    .map(([date, stats]) => ({
      date,
      new_users: stats.newUsers.size,
      returning_users: stats.returningUsers.size,
      total_users: stats.newUsers.size + stats.returningUsers.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
