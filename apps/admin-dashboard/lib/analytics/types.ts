// Analytics data types

export interface UserSession {
  session_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  last_heartbeat_at?: string;
  platform: string;
  app_version?: string;
  os_name?: string;
  os_version?: string;
  transcription_count: number;
  transcription_minutes: number;
  ai_actions_count: number;
  errors_count: number;
  is_active: boolean;
  exit_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureUsage {
  id: number;
  user_id: string;
  session_id?: string;
  feature_name: string;
  feature_category: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  success: boolean;
  error_type?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  job_title?: string;
  industry?: string;
  company_size?: string;
  use_case?: string;
  acquisition_source?: string;
  acquisition_campaign?: string;
  first_seen_at?: string;
  last_active_at?: string;
  onboarding_completed_at?: string;
  total_sessions?: number;
  total_minutes?: number;
}

// Metrics types
export interface DauData {
  date: string;
  dau: number;
}

export interface WauData {
  week: string;
  wau: number;
}

export interface MauData {
  month: string;
  mau: number;
}

export interface FeatureAdoptionData {
  feature_name: string;
  unique_users: number;
  total_uses: number;
  successful_uses: number;
  failed_uses: number;
  success_rate: number;
  avg_duration_ms?: number;
}

export interface EngagementScoreData {
  user_id: string;
  email: string;
  display_name?: string;
  days_active: number;
  total_sessions: number;
  features_used: number;
  engagement_score: number;
}

export interface ErrorData {
  feature_name: string;
  error_type?: string;
  error_count: number;
  affected_users: number;
  error_percentage: number;
}

export interface SessionMetrics {
  total_sessions: number;
  avg_duration_minutes: number;
  normal_exits: number;
  crashes: number;
  timeouts: number;
  normal_exit_rate: number;
}

export interface OverviewMetrics {
  dau: number;
  wau: number;
  mau: number;
  error_rate: number;
  active_users_now: number;
  total_features: number;
  total_errors_today: number;
}

// Date range type
export type DateRange = {
  from: Date;
  to: Date;
};
