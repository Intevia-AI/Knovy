import { createServerClient } from "@/lib/supabase-server";
import type { DateRange } from "./types";
import {
  extractTokenUsage,
  extractModelName,
  calculateTokenCost,
  aggregateTokenUsage,
  type UserTokenSummary,
} from "./token-utils";

export interface UserActivityData {
  user_id: string;
  email: string;
  // Session data
  total_sessions: number;
  total_minutes: number;
  last_session_at: string | null;
  // Platform data
  platform: string;
  app_version: string | null;
  // Transcription data
  transcription_count: number;
  transcription_minutes: number;
  // AI actions data
  ai_actions_count: number;
  // Token usage data
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  primary_model: string;
  // Feature breakdown
  features_used: string[];
}

export interface UserActivityDetailed extends UserActivityData {
  tokenSummary: UserTokenSummary;
  recentSessions: any[];
  featureUsage: any[];
}

/**
 * Get comprehensive user activity data including token usage
 */
export async function getUserActivityData(
  userId?: string,
  dateRange?: DateRange
): Promise<UserActivityDetailed[]> {
  const supabase = await createServerClient();

  // Build base query
  let sessionsQuery = supabase.from("user_sessions").select("*");
  let featuresQuery = supabase.from("feature_usage").select("*");
  let profilesQuery = supabase.from("profiles").select("*");

  // Apply filters
  if (userId) {
    sessionsQuery = sessionsQuery.eq("user_id", userId);
    featuresQuery = featuresQuery.eq("user_id", userId);
    profilesQuery = profilesQuery.eq("id", userId);
  }

  if (dateRange) {
    sessionsQuery = sessionsQuery
      .gte("started_at", dateRange.from.toISOString())
      .lte("started_at", dateRange.to.toISOString());
    featuresQuery = featuresQuery
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString());
  }

  // Fetch data in parallel
  const [
    { data: sessions, error: sessionsError },
    { data: features, error: featuresError },
    { data: profiles, error: profilesError }
  ] = await Promise.all([
    sessionsQuery,
    featuresQuery,
    profilesQuery
  ]);

  if (sessionsError) throw sessionsError;
  if (featuresError) throw featuresError;
  if (profilesError) throw profilesError;

  // Group data by user
  const userMap = new Map<string, UserActivityDetailed>();

  // Process sessions
  sessions?.forEach(session => {
    if (!userMap.has(session.user_id)) {
      userMap.set(session.user_id, {
        user_id: session.user_id,
        email: "",
        total_sessions: 0,
        total_minutes: 0,
        last_session_at: null,
        platform: session.platform || "desktop_app",
        app_version: session.app_version,
        transcription_count: 0,
        transcription_minutes: 0,
        ai_actions_count: 0,
        total_tokens: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost: 0,
        primary_model: "gemini-2.0-flash-exp",
        features_used: [],
        tokenSummary: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          modelBreakdown: new Map(),
          featureBreakdown: new Map(),
        },
        recentSessions: [],
        featureUsage: [],
      });
    }

    const userData = userMap.get(session.user_id)!;
    userData.total_sessions++;
    userData.total_minutes += (session.duration_seconds || 0) / 60;
    userData.transcription_count += session.transcription_count || 0;
    userData.transcription_minutes += Number(session.transcription_minutes) || 0;
    userData.ai_actions_count += session.ai_actions_count || 0;

    // Update platform and version from most recent session
    if (!userData.last_session_at || new Date(session.started_at) > new Date(userData.last_session_at)) {
      userData.last_session_at = session.started_at;
      userData.platform = session.platform || userData.platform;
      userData.app_version = session.app_version || userData.app_version;
    }

    userData.recentSessions.push(session);
  });

  // Process features and extract token usage
  features?.forEach(feature => {
    const userData = userMap.get(feature.user_id);
    if (!userData) return;

    userData.featureUsage.push(feature);

    // Track unique features
    if (!userData.features_used.includes(feature.feature_name)) {
      userData.features_used.push(feature.feature_name);
    }

    // Extract token usage from metadata
    const tokens = extractTokenUsage(feature.metadata);
    if (tokens) {
      const model = extractModelName(feature.metadata);
      const metrics = calculateTokenCost(tokens, model);

      userData.total_input_tokens += tokens.input;
      userData.total_output_tokens += tokens.output;
      userData.total_tokens += tokens.total;
      userData.total_cost += metrics.totalCost;

      // Track primary model (most used)
      if (!userData.primary_model || model !== "unknown") {
        userData.primary_model = model;
      }
    }
  });

  // Add profile information
  profiles?.forEach(profile => {
    const userData = userMap.get(profile.id);
    if (userData) {
      userData.email = profile.email || "";
    }
  });

  // Calculate token summaries for each user
  userMap.forEach(userData => {
    userData.tokenSummary = aggregateTokenUsage(userData.featureUsage);
  });

  return Array.from(userMap.values());
}

/**
 * Get aggregated user activity metrics
 */
export async function getUserActivityMetrics(dateRange?: DateRange): Promise<{
  totalUsers: number;
  totalSessions: number;
  totalMinutes: number;
  totalTokens: number;
  totalCost: number;
  averageTokensPerUser: number;
  averageCostPerUser: number;
  topModels: { model: string; usage: number }[];
  topFeatures: { feature: string; usage: number }[];
}> {
  const userData = await getUserActivityData(undefined, dateRange);

  const totalUsers = userData.length;
  const totalSessions = userData.reduce((sum, u) => sum + u.total_sessions, 0);
  const totalMinutes = userData.reduce((sum, u) => sum + u.total_minutes, 0);
  const totalTokens = userData.reduce((sum, u) => sum + u.total_tokens, 0);
  const totalCost = userData.reduce((sum, u) => sum + u.total_cost, 0);

  // Aggregate model usage
  const modelUsage = new Map<string, number>();
  userData.forEach(u => {
    u.tokenSummary.modelBreakdown.forEach((metrics, model) => {
      modelUsage.set(model, (modelUsage.get(model) || 0) + metrics.tokens.total);
    });
  });

  // Aggregate feature usage
  const featureUsage = new Map<string, number>();
  userData.forEach(u => {
    u.tokenSummary.featureBreakdown.forEach((tokens, feature) => {
      featureUsage.set(feature, (featureUsage.get(feature) || 0) + tokens.total);
    });
  });

  return {
    totalUsers,
    totalSessions,
    totalMinutes,
    totalTokens,
    totalCost,
    averageTokensPerUser: totalUsers > 0 ? totalTokens / totalUsers : 0,
    averageCostPerUser: totalUsers > 0 ? totalCost / totalUsers : 0,
    topModels: Array.from(modelUsage.entries())
      .map(([model, usage]) => ({ model, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5),
    topFeatures: Array.from(featureUsage.entries())
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5),
  };
}

/**
 * Get user activity data for display in tables
 */
export async function getUserActivityTableData(
  limit: number = 50,
  dateRange?: DateRange
): Promise<any[]> {
  const userData = await getUserActivityData(undefined, dateRange);

  return userData
    .sort((a, b) => b.total_sessions - a.total_sessions)
    .slice(0, limit)
    .map(user => ({
      user_id: user.user_id,
      email: user.email,
      platform: user.platform,
      app_version: user.app_version || "unknown",
      sessions: user.total_sessions,
      minutes: Math.round(user.total_minutes),
      transcriptions: user.transcription_count,
      transcription_minutes: Math.round(user.transcription_minutes * 10) / 10,
      ai_actions: user.ai_actions_count,
      tokens_used: user.total_tokens,
      cost: user.total_cost,
      primary_model: user.primary_model,
      last_active: user.last_session_at,
    }));
}