# User Behavior and Preferences Analytics - Lean Implementation Plan

## 📊 Current Implementation Status (Updated: 2025-10-15)

### Implementation Progress

| Phase | Status | Completion |
|-------|--------|------------|
| **Phase 1: Database Migration** | ✅ Complete | 100% |
| **Phase 2: Session Tracking** | ✅ Complete | 100% |
| **Phase 3: Feature Instrumentation** | ✅ Complete | 100% |
| **Phase 4: Grafana Dashboards** | ⏸️ Pending | 0% |
| **Phase 5: User Profile Collection** | 🔮 Future | 0% |

### Features Currently Tracked

✅ **Session Analytics** (Fully Operational)
- Session start/end times and duration
- Platform, app version, OS information
- 60-second heartbeat for active session tracking
- Session metrics: transcription count, transcription minutes, AI actions count, errors count
- Exit reasons: normal, crash, timeout

✅ **Transcription Sessions** (Basic Tracking)
- Duration tracking via `analyticsService.incrementTranscription(durationMinutes)`
- Aggregated session metrics only
- **Missing:** Detailed per-transcription metadata (language, source type)

✅ **AI Summarize** (Fully Instrumented)
- Feature usage tracking with start/complete/error states
- Input/output token counts
- API cost tracking (Gemini Flash pricing)
- Execution time (duration_ms)
- Metadata: input_length, has_existing_summary, language, model
- Success/failure rates with error details

✅ **AI Chat** (Fully Instrumented)
- Feature usage tracking with start/complete/error states
- Input/output token counts
- API cost tracking (Gemini Flash pricing)
- Execution time (duration_ms)
- Metadata: input_length, response_length, has_existing_summary, has_recent_transcriptions, language, model
- Success/failure rates with error details

✅ **Keyword Search** (Fully Instrumented)
- Feature usage tracking with start/complete/error states
- Input/output token counts
- API cost tracking (Gemini Flash pricing)
- Execution time (duration_ms)
- Metadata: input_length, response_length, has_existing_summary, has_recent_transcriptions, language, model
- Success/failure rates with error details

✅ **Recommend Response** (Fully Instrumented)
- Feature usage tracking with start/complete/error states
- Input/output token counts
- API cost tracking (Gemini Flash pricing)
- Execution time (duration_ms)
- Metadata: input_length, response_length, language, model
- Success/failure rates with error details

✅ **Screenshot Analysis** (Fully Instrumented)
- Feature usage tracking with start/complete/error states
- Input/output token counts
- API cost tracking (Gemini Flash pricing)
- Execution time (duration_ms)
- Metadata: input_length, response_length, has_image, has_existing_summary, has_recent_transcriptions, language, model
- Success/failure rates with error details

✅ **Transcription Enhancement** (Fully Instrumented)
- Feature usage tracking with start/complete/error states
- Input/output token counts
- API cost tracking (Gemini Flash pricing)
- Execution time (duration_ms)
- Metadata: segment_count, enhanced_count, error_count, language
- Success/failure rates with error details

### Features NOT Yet Tracked

❌ **Detailed Transcription Metadata**
- Need to add individual `feature_usage` entries per transcription
- Should track: language, source_type (mic/system), segment count, detected language

### Next Steps

1. ~~**Complete Phase 3**: Instrument remaining AI actions and transcription features~~ ✅ **COMPLETED**
2. ~~**Fix Analytics Session ID Issue**: Ensure all features use the same analytics session_id~~ ✅ **COMPLETED (2025-10-16)**
3. **Validate Data**: Test analytics end-to-end in local environment (verify all features are logging correctly)
4. **Create Grafana Dashboards**: Build visualizations to monitor user behavior and feature adoption
5. **Monitor Production**: Deploy and observe real user analytics
6. **Optional**: Add detailed transcription metadata tracking (individual feature_usage entries per transcription)

---

## Executive Summary

This plan implements a **lean, pragmatic analytics system** for Knovy following startup best practices: **start simple, measure what matters, iterate based on data**. We focus on essential metrics that answer key business questions without over-engineering.

## Philosophy: Lean Startup Approach

> "Build the simplest thing that could possibly work, then iterate based on real user feedback."

**Guiding Principles:**
- ✅ **Simple > Complex** - Three core tables, not enterprise event-sourcing
- ✅ **Batch > Real-time** - Log every minute, not millisecond-by-millisecond
- ✅ **Essential > Comprehensive** - Track what we'll actually use
- ✅ **Grafana > PostHog** - Use what we already have
- ✅ **Evolve > Big Bang** - Start minimal, add complexity only when proven necessary

## Core Business Questions to Answer

1. **Who are our users?** (Demographics, use cases, acquisition)
2. **How often do they use Knovy?** (DAU, MAU, session patterns)
3. **Which features do they love?** (Feature adoption, usage frequency)
4. **Where do they struggle?** (Error rates, drop-off points)
5. **Are they getting value?** (Engagement scores, retention)

## Database Schema - Simple & Normalized

### 1. Enhanced User Profiles

**Purpose:** Understand who our users are and how they found us.

```sql
-- Extend existing user_profiles table
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS company_size TEXT, -- 'solo', '2-10', '11-50', '51-200', '201+'
  ADD COLUMN IF NOT EXISTS use_case TEXT, -- Primary use case
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT, -- 'google', 'twitter', 'friend', etc.
  ADD COLUMN IF NOT EXISTS acquisition_campaign TEXT,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0;

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_activity
  ON user_profiles(last_active_at DESC, first_seen_at);
```

**Collection Strategy:**
- ✅ **Now:** Auto-populate from OAuth (email, display_name, avatar_url)
- 🔮 **Future:** Collect job_title, industry, company_size during improved onboarding flow
- 📊 **Analytics:** Track acquisition_source via UTM parameters

### 2. User Sessions Table

**Purpose:** Track when and how users engage with Knovy. Replaces `transcription_ledger`.

```sql
CREATE TABLE IF NOT EXISTS public.user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(), -- Updated every minute

  -- Session context
  platform TEXT NOT NULL, -- 'desktop_app', 'web'
  app_version TEXT,
  os_name TEXT,
  os_version TEXT,

  -- Session metrics (incremented throughout session)
  transcription_count INTEGER DEFAULT 0,
  transcription_minutes NUMERIC(10,2) DEFAULT 0,
  ai_actions_count INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,

  -- Session quality
  is_active BOOLEAN DEFAULT TRUE,
  exit_reason TEXT, -- 'normal', 'crash', 'timeout'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_sessions_user_time ON user_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_platform ON user_sessions(platform, started_at);
CREATE INDEX idx_sessions_date ON user_sessions(DATE(started_at));

-- Function to automatically update user_profiles.last_active_at
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET last_active_at = NEW.last_heartbeat_at
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_last_active
  AFTER UPDATE OF last_heartbeat_at ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active();
```

**Tracking Strategy:**
- Session starts when user begins screen-share/transcription
- Heartbeat every 60 seconds updates `last_heartbeat_at` and metrics
- Session ends when user stops screen-share
- Metrics (`transcription_count`, `ai_actions_count`) increment as features are used during the session
- **Implementation:** Session tracking in `useScreenShare.ts` (not App.tsx)

### 3. Feature Usage Table

**Purpose:** Track which features users engage with and how they perform. Replaces `action_logs`.

```sql
CREATE TABLE IF NOT EXISTS public.feature_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES user_sessions(session_id) ON DELETE SET NULL,

  -- Feature identification
  feature_name TEXT NOT NULL, -- 'transcription', 'ai-summarize', 'ai-chat', etc.
  feature_category TEXT NOT NULL, -- 'transcription', 'ai-action', 'enhancement'

  -- Usage timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Outcome
  success BOOLEAN DEFAULT TRUE,
  error_type TEXT,
  error_message TEXT,

  -- Feature-specific metadata (flexible JSONB)
  metadata JSONB DEFAULT '{}',
  -- Examples:
  -- Transcription: {"language": "zh-TW", "duration_seconds": 45, "source_type": "microphone"}
  -- AI Summarize: {"input_length": 500, "output_length": 100, "model": "gemini-1.5-flash"}
  -- Enhancement: {"segments_enhanced": 5, "batch_size": 3}

  -- Cost tracking (for AI features)
  api_cost_usd NUMERIC(10,6), -- Track API costs per feature use

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX idx_feature_usage_user ON feature_usage(user_id, created_at DESC);
CREATE INDEX idx_feature_usage_feature ON feature_usage(feature_name, created_at DESC);
CREATE INDEX idx_feature_usage_session ON feature_usage(session_id, created_at);
CREATE INDEX idx_feature_usage_success ON feature_usage(success, error_type);
CREATE INDEX idx_feature_usage_date ON feature_usage(DATE(created_at), feature_category);

-- GIN index for metadata queries
CREATE INDEX idx_feature_usage_metadata ON feature_usage USING GIN (metadata);
```

**Tracking Strategy:**
- Log entry when feature starts (with `started_at`)
- Update entry when feature completes (with `completed_at`, `success`, `metadata`)
- Track errors with `error_type` and `error_message`
- Store feature-specific details in flexible `metadata` JSONB field

### 4. Subscription Events (Reserved for Future)

**Purpose:** Track subscription lifecycle when payment system is implemented.

```sql
-- Create table structure now, use later
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'started', 'upgraded', 'downgraded', 'cancelled', 'renewed'
  from_plan TEXT, -- Previous plan (null for new subscriptions)
  to_plan TEXT NOT NULL, -- 'free', 'pro', 'enterprise'

  -- Financial
  plan_price NUMERIC(10,2),
  plan_interval TEXT, -- 'monthly', 'annual'
  currency TEXT DEFAULT 'USD',

  -- Tracking
  subscription_id TEXT, -- External payment provider ID
  payment_provider TEXT, -- 'stripe', 'paddle', etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_events_user ON subscription_events(user_id, created_at DESC);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type, created_at DESC);
```

**Note:** Table created now but won't be used until subscription system is implemented.

## Analytics Views & Queries

### Key Metrics (Grafana Queries)

#### 1. Daily/Weekly/Monthly Active Users

```sql
-- DAU (Daily Active Users)
SELECT
  DATE(started_at) as date,
  COUNT(DISTINCT user_id) as dau
FROM user_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(started_at)
ORDER BY date;

-- WAU (Weekly Active Users)
SELECT
  DATE_TRUNC('week', started_at) as week,
  COUNT(DISTINCT user_id) as wau
FROM user_sessions
WHERE started_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', started_at)
ORDER BY week;

-- MAU (Monthly Active Users)
SELECT
  DATE_TRUNC('month', started_at) as month,
  COUNT(DISTINCT user_id) as mau
FROM user_sessions
WHERE started_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', started_at)
ORDER BY month;
```

#### 2. Feature Adoption & Usage Distribution

```sql
-- Feature adoption rate (unique users per feature)
SELECT
  feature_name,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_uses,
  COUNT(*) FILTER (WHERE success = TRUE) as successful_uses,
  COUNT(*) FILTER (WHERE success = FALSE) as failed_uses,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = TRUE) / COUNT(*), 2) as success_rate,
  ROUND(AVG(duration_ms), 0) as avg_duration_ms,
  ROUND(SUM(api_cost_usd), 4) as total_cost_usd
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY feature_name
ORDER BY unique_users DESC;

-- Feature usage trend (daily)
SELECT
  DATE(created_at) as date,
  feature_name,
  COUNT(*) as uses,
  COUNT(DISTINCT user_id) as unique_users
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), feature_name
ORDER BY date, feature_name;
```

#### 3. User Engagement Score

```sql
-- Simple engagement scoring
SELECT
  u.user_id,
  u.email,
  u.first_seen_at,
  u.last_active_at,
  COALESCE(session_metrics.days_active, 0) as days_active,
  COALESCE(session_metrics.total_sessions, 0) as total_sessions,
  COALESCE(session_metrics.total_minutes, 0) as total_minutes,
  COALESCE(feature_metrics.features_used, 0) as features_used,
  COALESCE(feature_metrics.total_actions, 0) as total_actions,
  -- Simple engagement score (0-100)
  LEAST(100, ROUND(
    (COALESCE(session_metrics.days_active, 0) * 5) +
    (COALESCE(feature_metrics.features_used, 0) * 10) +
    (LEAST(COALESCE(session_metrics.total_sessions, 0), 20) * 2)
  )) as engagement_score
FROM user_profiles u
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT DATE(started_at)) as days_active,
    COUNT(*) as total_sessions,
    ROUND(SUM(duration_seconds) / 60.0) as total_minutes
  FROM user_sessions
  WHERE user_id = u.user_id
    AND started_at >= NOW() - INTERVAL '30 days'
) session_metrics ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT feature_name) as features_used,
    COUNT(*) as total_actions
  FROM feature_usage
  WHERE user_id = u.user_id
    AND created_at >= NOW() - INTERVAL '30 days'
) feature_metrics ON TRUE
ORDER BY engagement_score DESC;
```

#### 4. Error Tracking

```sql
-- Error rates by feature
SELECT
  feature_name,
  error_type,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY feature_name), 2) as error_percentage
FROM feature_usage
WHERE success = FALSE
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY feature_name, error_type
ORDER BY error_count DESC;

-- Error trend over time
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE success = FALSE) as errors,
  COUNT(*) as total_uses,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = FALSE) / COUNT(*), 2) as error_rate
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

#### 5. Retention Analysis

```sql
-- User retention cohorts (simplified)
WITH user_cohorts AS (
  SELECT
    user_id,
    DATE_TRUNC('week', first_seen_at) as cohort_week
  FROM user_profiles
),
cohort_activity AS (
  SELECT
    uc.cohort_week,
    uc.user_id,
    DATE_TRUNC('week', s.started_at) as activity_week,
    EXTRACT(WEEK FROM AGE(s.started_at, uc.cohort_week * INTERVAL '1 week')) as weeks_since_signup
  FROM user_cohorts uc
  JOIN user_sessions s ON uc.user_id = s.user_id
  WHERE s.started_at >= NOW() - INTERVAL '12 weeks'
)
SELECT
  cohort_week,
  COUNT(DISTINCT user_id) as cohort_size,
  COUNT(DISTINCT user_id) FILTER (WHERE weeks_since_signup = 0) as week_0,
  COUNT(DISTINCT user_id) FILTER (WHERE weeks_since_signup = 1) as week_1,
  COUNT(DISTINCT user_id) FILTER (WHERE weeks_since_signup = 2) as week_2,
  COUNT(DISTINCT user_id) FILTER (WHERE weeks_since_signup = 4) as week_4
FROM cohort_activity
GROUP BY cohort_week
ORDER BY cohort_week DESC;
```

## Implementation Plan

### Phase 1: Database Migration (Day 1) ✅ COMPLETED

**Tasks:**

1. ✅ **Create migration file**
   - Drop old tables (`action_logs`, `transcription_ledger`)
   - Create new tables (`user_sessions`, `feature_usage`, `subscription_events`)
   - Extend `profiles` table with new fields (corrected from user_profiles)
   - Add all indexes and triggers
   - **Files:** `supabase/migrations/20251015181639_analytics_lean_implementation.sql`

2. ✅ **Fix RLS policies**
   - Added INSERT and UPDATE policies for authenticated users
   - Fixed 403 error when creating sessions
   - **Files:** `supabase/migrations/20251015183745_fix_analytics_rls_policies.sql`

3. ✅ **Test migration locally**
   - Run migration on local Supabase
   - Verify schema with sample data
   - Test all indexes
   - All migrations applied successfully

**Deliverables:**
- ✅ Migration SQL file: `supabase/migrations/20251015181639_analytics_lean_implementation.sql`
- ✅ RLS fix migration: `supabase/migrations/20251015183745_fix_analytics_rls_policies.sql`

**Issues Fixed:**
- Fixed table name: `user_profiles` → `profiles` (using existing table)
- Fixed DATE() function index issue (removed non-IMMUTABLE index)
- Fixed RLS policies for INSERT and UPDATE on user_sessions and feature_usage

**Status:** ✅ Complete - All migrations applied to local Supabase

### Phase 2: Session Tracking (Day 2) ✅ COMPLETED

**Tasks:**

1. ✅ **Create session manager service**
   - Created `apps/app/src/renderer/src/services/analytics-service.ts`
   - Singleton service pattern with session management
   - Heartbeat every 60 seconds updates `last_heartbeat_at` and metrics
   - End session gracefully on app close
   - Handle crash/timeout scenarios with `exit_reason`
   - Session metrics: `transcriptionCount`, `transcriptionMinutes`, `aiActionsCount`, `errorsCount`

2. ✅ **Integrate with desktop app**
   - ~~Integrated in `apps/app/src/renderer/src/app/App.tsx`~~ (LATER REFACTORED - see Phase 3b)
   - ~~Auto-starts session when user logs in~~ (CHANGED: now on screen-share start)
   - ~~Auto-ends session on app unmount~~ (CHANGED: now on screen-share stop)
   - **Final Implementation:** Session tracking moved to `useScreenShare.ts` in Phase 3b
   - Excludes waitlisted users from session tracking
   - Direct database access (no IPC needed, using Supabase client)

**Deliverables:**
- ✅ `apps/app/src/renderer/src/services/analytics-service.ts` (simplified in Phase 3b)
- ✅ Updated `apps/app/src/renderer/src/hooks/useScreenShare.ts` with session lifecycle (Phase 3b)
- ✅ Helper methods: `incrementTranscription()`, `incrementAiAction()`, `incrementError()`
- ~~Feature tracking: `trackFeatureStart()`, `trackFeatureComplete()`, `trackFeatureError()`~~ (REMOVED in Phase 3b)

**Implementation Details (Simplified in Phase 3b):**
```typescript
class AnalyticsService {
  private currentSession: SessionData | null = null
  private sessionMetrics: SessionMetrics = {...}
  private heartbeatInterval: NodeJS.Timeout | null = null

  async startSession(userId: string): Promise<string | null> // Returns session_id
  async endSession(exitReason: 'normal' | 'crash' | 'timeout'): Promise<void>
  incrementTranscription(durationMinutes: number): void
  incrementAiAction(): void
  incrementError(): void
  getSessionId(): string | null
  isSessionActive(): boolean

  // Removed in Phase 3b (dead code):
  // - trackFeatureStart()
  // - trackFeatureComplete()
  // - trackFeatureError()
  // - featureUsageMap property
}
```

**Status:** ✅ Complete - Session tracking operational in desktop app

### Phase 3: Feature Usage Tracking (Day 3) 🔄 IN PROGRESS

**Tasks:**

1. ✅ **Add feature tracking to analytics service**
   - Methods implemented: `trackFeatureStart()`, `trackFeatureComplete()`, `trackFeatureError()`
   - Auto-track start/end times via `featureUsageMap`
   - Error capture with `error_type` and `error_message`
   - Cost tracking for AI features via `api_cost_usd`

2. ✅ **Instrument transcription features**
   - ✅ Track transcription duration in `RealTimeAnalysis.tsx`
   - ✅ Calculate duration and call `analyticsService.incrementTranscription(durationMinutes)`
   - ✅ Uses `transcriptionStartTimeRef` to track session start/end
   - ❌ **TODO:** Add detailed feature_usage logging with metadata (language, source type)

3. ✅ **Instrument AI actions** (COMPLETED)
   - ✅ **AI Summarize** - Fully instrumented in `supabase/functions/ai-action-summarize/index.ts`
     - Tracks input/output tokens, API costs, execution time
     - Logs metadata: input_length, has_existing_summary, language, model
     - Error tracking with try/catch blocks
   - ✅ **AI Chat** - Fully instrumented in `supabase/functions/ai-action-chat/index.ts`
     - Tracks input/output tokens, API costs, execution time
     - Logs metadata: input_length, response_length, has_existing_summary, has_recent_transcriptions, language, model
     - Error tracking with try/catch blocks
   - ✅ **Keyword Search** - Fully instrumented in `supabase/functions/ai-action-keyword-search/index.ts`
     - Tracks input/output tokens, API costs, execution time
     - Logs metadata: input_length, response_length, has_existing_summary, has_recent_transcriptions, language, model
     - Error tracking with try/catch blocks
   - ✅ **Recommend Response** - Fully instrumented in `supabase/functions/ai-action-recommend-response/index.ts`
     - Tracks input/output tokens, API costs, execution time
     - Logs metadata: input_length, response_length, language, model
     - Error tracking with try/catch blocks
   - ✅ **Screenshot Analysis** - Fully instrumented in `supabase/functions/ai-action-screenshot-analysis/index.ts`
     - Tracks input/output tokens, API costs, execution time
     - Logs metadata: input_length, response_length, has_image, has_existing_summary, has_recent_transcriptions, language, model
     - Error tracking with try/catch blocks
   - ✅ **Transcription Enhancement** - Fully instrumented in `supabase/functions/transcription-enhance/index.ts`
     - Tracks input/output tokens, API costs, execution time
     - Logs metadata: segment_count, enhanced_count, error_count, language
     - Error tracking with try/catch blocks

4. ✅ **Add error tracking** (COMPLETED)
   - ✅ All AI actions have comprehensive error tracking
   - ✅ Errors logged to `feature_usage` table with error_type and error_message

**Deliverables:**
- ✅ Updated `apps/app/src/renderer/src/services/analytics-service.ts`
- ✅ Updated `supabase/functions/ai-action-summarize/index.ts` with full tracking
- ✅ Updated `supabase/functions/ai-action-chat/index.ts` with full tracking
- ✅ Updated `supabase/functions/ai-action-keyword-search/index.ts` with full tracking
- ✅ Updated `supabase/functions/ai-action-recommend-response/index.ts` with full tracking
- ✅ Updated `supabase/functions/ai-action-screenshot-analysis/index.ts` with full tracking
- ✅ Updated `supabase/functions/transcription-enhance/index.ts` with full tracking
- ✅ Updated `apps/app/src/renderer/src/components/RealTimeAnalysis.tsx` with transcription duration

**Features Tracked:**
- ✅ **Transcription Sessions** - Duration tracking via `incrementTranscription()`
- ✅ **AI Summarize** - Full tracking (start, complete, error, cost, metadata)
- ✅ **AI Chat** - Full tracking (start, complete, error, cost, metadata)
- ✅ **Keyword Search** - Full tracking (start, complete, error, cost, metadata)
- ✅ **Recommend Response** - Full tracking (start, complete, error, cost, metadata)
- ✅ **Screenshot Analysis** - Full tracking (start, complete, error, cost, metadata)
- ✅ **Transcription Enhancement** - Full tracking (start, complete, error, cost, metadata)

**Features NOT Yet Tracked:**
- ❌ **Detailed Transcription Metadata** - Need to add feature_usage entries (not just session metrics)

**Status:** ✅ Complete - All AI actions fully instrumented with comprehensive tracking

### Phase 3b: Analytics Refactoring (Day 3 cont.) ✅ COMPLETED

**Tasks:**

1. ✅ **Remove api_cost_usd from schema**
   - Created migration `20251015200000_remove_api_cost_usd.sql`
   - Dropped `api_cost_usd` column from `feature_usage` table
   - Removed `apiCostUsd` from analytics service interfaces
   - **Rationale:** Simplify analytics, focus on usage patterns instead of costs

2. ✅ **Create AI actions wrapper service**
   - Created `apps/app/src/renderer/src/services/ai-actions.ts`
   - Central wrapper function `invokeAIAction()` with automatic `session_id` injection
   - Type-safe interfaces for all AI action requests/responses
   - **Benefits:** DRY, scalable, maintainable, consistent across all AI actions

3. ✅ **Update useAIInteraction hook**
   - Replaced manual `session_id` handling with `invokeAIAction()` wrapper
   - Removed redundant authentication checks (handled by wrapper)
   - Cleaner code, less repetition

4. ✅ **Verify no other direct AI action calls**
   - Searched codebase for `supabase.functions.invoke.*ai-action`
   - Confirmed: Only useAIInteraction uses AI actions
   - All future AI actions will automatically get `session_id`

5. ✅ **Fix session tracking architecture**
   - **Issue Identified:** Sessions were tracking app-level (login to logout) instead of screen-share sessions
   - **Root Cause:** Misunderstood what "session" means in analytics context
   - **Fix:** Moved session tracking from App.tsx to useScreenShare.ts
   - **Result:** Each screen-share = one user_sessions row with correct duration
   - **Commits:**
     - `Fix(app): Track screen-share sessions instead of app sessions` (commit 238e9a2)
     - Removed app-level session tracking (71 lines removed from App.tsx)
     - Added screen-share session tracking to useScreenShare.ts

6. ✅ **Remove redundant feature tracking**
   - **Issue Identified:** Screen-share was being tracked in BOTH user_sessions and feature_usage
   - **Design Error:** Screen-share is the SESSION, not a feature
   - **Fix:** Removed trackFeatureStart/Complete for screen-share
   - **Result:** Clean separation - user_sessions tracks sessions, feature_usage tracks AI actions
   - **Commit:** `Refactor(app): Remove redundant screen-share feature tracking` (commit 5f4135e)

7. ✅ **Remove dead code from analytics service**
   - **Issue Identified:** trackFeatureStart/Complete/Error methods are dead code
   - **Rationale:** All feature_usage tracking happens server-side in Edge Functions
   - **Removed:** 134 lines of dead code (methods, interfaces, state)
   - **Simplified:** Analytics service now only manages sessions and provides session_id
   - **Commit:** `Refactor(app): Remove client-side feature tracking from analytics service` (commit df95d9a)

**Deliverables:**
- ✅ Migration: `supabase/migrations/20251015200000_remove_api_cost_usd.sql`
- ✅ Service: `apps/app/src/renderer/src/services/ai-actions.ts` (180 lines)
- ✅ Updated: `apps/app/src/renderer/src/hooks/useAIInteraction.ts`
- ✅ Updated: `apps/app/src/renderer/src/services/analytics-service.ts` (simplified, 134 lines removed)
- ✅ Updated: `apps/app/src/renderer/src/app/App.tsx` (removed session tracking)
- ✅ Updated: `apps/app/src/renderer/src/hooks/useScreenShare.ts` (added session tracking)

**Issues Identified & Resolved:**
- ✅ **Issue #1 (AI actions missing session_id):** RESOLVED with wrapper pattern
- ✅ **Issue #2 (user_sessions not logging):** RESOLVED - wrong session tracking location
- ✅ **Issue #3 (session tracking architecture):** RESOLVED - moved from app-level to screen-share sessions
- ✅ **Issue #4 (redundant feature tracking):** RESOLVED - removed screen-share from feature_usage
- ✅ **Issue #5 (dead code in analytics service):** RESOLVED - removed 134 lines of unused code

**Architecture Clarifications:**

**Session Tracking (user_sessions table):**
- ❌ OLD: One session per app runtime (login to logout)
- ✅ NEW: One session per screen-share (start to stop)
- Location: `useScreenShare.ts` (not App.tsx)
- Creates row when screen-share starts, updates when it ends

**Feature Tracking (feature_usage table):**
- Tracked server-side in Edge Functions only
- Tracks AI actions DURING a session:
  - ai-action-chat
  - ai-action-summarize
  - ai-action-keyword-search
  - ai-action-screenshot-analysis
  - ai-action-recommend-response
  - ai-transcription-enhance
- Does NOT track screen-share (that's the session itself)

**Client-Side Analytics Service Responsibilities:**
- ✅ Session lifecycle (start/end)
- ✅ Heartbeat (60s interval)
- ✅ Session metrics (transcription_count, ai_actions_count, errors_count)
- ✅ Provide session_id for Edge Function injection
- ❌ Feature usage tracking (handled server-side)

**Next Steps:**
1. ✅ Test analytics end-to-end with fresh login
2. ✅ Update useScreenShare with analytics tracking
3. ✅ Fix analytics session ID mismatch for transcription-enhance
4. ⏭️ Verify all feature tracking is working correctly in production
5. ⏭️ Create Grafana dashboards

**Status:** ✅ Complete - Architecture fixed, dead code removed, session ID unified, ready for production testing

### Phase 3c: Analytics Session ID Fix (Day 4) ✅ COMPLETED

**Issue:** Analytics session ID mismatch between renderer and main process

**Problem Identified:**
- Two different session IDs in use:
  - **SQLite Session ID** (`currentSessionId`) - Created by main process for local database
  - **Analytics Session ID** - Created by `analyticsService.startSession()` in renderer process
- `transcription-enhance` was receiving SQLite session ID instead of analytics session ID
- This broke the ability to correlate all features within a single analytics session

**Root Cause:**
- Main process had no access to analytics session ID (created in renderer)
- Enhancement service was using `currentSessionId` (SQLite) by default
- Different from other AI actions which use `invokeAIAction()` wrapper with correct session_id

**Solution Implemented:**
1. Added IPC communication to pass analytics session ID from renderer to main process
2. Added new IPC handlers:
   - `analytics:set-session-id` - Set analytics session ID from renderer
   - `analytics:get-session-id` - Get analytics session ID
   - `analytics:clear-session-id` - Clear analytics session ID
3. Updated `useScreenShare.ts`:
   - Sends analytics session ID to main process after `analyticsService.startSession()`
   - Clears analytics session ID in main process on session end
4. Updated `main/index.ts`:
   - Stores `analyticsSessionId` separately from `currentSessionId`
   - Uses analytics session ID for transcription enhancement
   - Falls back to SQLite session ID with warning if analytics ID missing

**Files Modified:**
- ✅ `apps/app/src/main/index.ts` - Added analytics session ID storage and handlers
- ✅ `apps/app/src/preload/index.ts` - Added IPC methods for analytics session ID
- ✅ `apps/app/src/renderer/src/hooks/useScreenShare.ts` - Send/clear analytics session ID

**Result:**
- All features now use the same analytics `session_id` for `feature_usage` entries
- Proper session-based analytics tracking across all AI actions and transcription enhancement
- Can accurately track all features used within a single screen-share session

**Status:** ✅ Complete - All features now use unified analytics session ID

### Phase 4: Grafana Dashboards (Day 4) ⏸️ PENDING

**Tasks:**

1. ⏸️ **Create dashboard definitions**
   - DAU/WAU/MAU dashboard
   - Feature adoption dashboard
   - User engagement dashboard
   - Error monitoring dashboard

2. ⏸️ **Set up Grafana data source**
   - Configure PostgreSQL connection
   - Test queries
   - Optimize for performance

3. ⏸️ **Import dashboards**
   - Create JSON dashboard definitions
   - Import to Grafana
   - Configure refresh rates
   - Set up alerts

**Deliverables:**
- ⏸️ `docs/grafana/dashboards/user-activity.json`
- ⏸️ `docs/grafana/dashboards/feature-adoption.json`
- ⏸️ `docs/grafana/dashboards/user-engagement.json`
- ⏸️ `docs/grafana/dashboards/error-monitoring.json`

**Status:** ⏸️ Pending - Will implement after Phase 3 is complete

**Note:** All analytics queries are ready in the plan (lines 213-372). Can use these directly in Grafana once we have sufficient data from instrumented features.

### Phase 5: User Profile Collection (Future)

**Tasks (Not implemented now, reserved for future):**

1. 🔮 **Design profile collection flow**
   - Update login/onboarding UX
   - Optional vs. required fields
   - Privacy-conscious design

2. 🔮 **Implement profile form**
   - Job title, industry, company size
   - Primary use case
   - Skip option

3. 🔮 **Update session profile endpoint**
   - Return new profile fields
   - Use in app personalization

**Note:** This will be implemented when the improved login flow is designed.

## Privacy & Data Minimization

### What We Collect

**Essential Data (collected now):**
- ✅ Session timing and duration
- ✅ Feature usage patterns
- ✅ Error logs (for debugging)
- ✅ App version and platform

**Demographic Data (collected in future):**
- 🔮 Job title and industry (optional, user-provided)
- 🔮 Company size (optional, user-provided)
- 🔮 Use case (optional, user-provided)

**What We DON'T Collect:**
- ❌ Transcription content (stays local in SQLite)
- ❌ Personal conversations
- ❌ Precise location (only country-level from IP)
- ❌ Tracking across other websites
- ❌ Browser history or personal files

### Data Retention Policy

```sql
-- Auto-cleanup old analytics data (run monthly via cron)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
  -- Keep user_sessions for 1 year
  DELETE FROM user_sessions
  WHERE started_at < NOW() - INTERVAL '1 year';

  -- Keep feature_usage for 1 year
  DELETE FROM feature_usage
  WHERE created_at < NOW() - INTERVAL '1 year';

  -- Keep user_profiles forever (or until user deletes account)

  RAISE NOTICE 'Analytics cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-analytics', '0 2 1 * *', 'SELECT cleanup_old_analytics()');
```

## Admin Dashboard Decision

**Recommendation:** **Defer admin dashboard for now**, use Grafana instead.

**Rationale:**
- ✅ Grafana already set up and working
- ✅ Powerful querying and visualization
- ✅ No maintenance overhead
- ✅ Can add custom admin dashboard later if needed

**Future Admin Dashboard Features (if needed):**
- User search and management
- Manual role assignment
- Detailed user journey view
- Custom reports and exports

## Success Metrics

### Week 1 Goals (MVP)

- ✅ Database migration completed
- ✅ Session tracking operational
- ✅ Feature usage logging working
- ✅ Basic Grafana dashboards live
- ✅ Can answer: "How many DAU do we have?"
- ✅ Can answer: "Which features are most used?"

### Month 1 Goals (Validation)

- ✅ Collecting analytics from 100% of sessions
- ✅ Zero data loss or tracking errors
- ✅ Dashboards used in weekly team reviews
- ✅ First data-driven decision made (e.g., which feature to improve)
- ✅ Engagement score identifies power users vs. churned users

### Month 3 Goals (Iteration)

- ✅ User profile collection integrated into onboarding
- ✅ Cohort analysis shows retention trends
- ✅ Feature adoption funnels identify drop-off points
- ✅ Error tracking prevents 90% of recurring bugs
- 🔮 Consider: Do we need event-sourcing? PostHog? Advanced features?

## Future Evolution Paths

**If we need more advanced analytics:**

1. **Event-Sourcing** - Migrate to full event store if we need detailed event replay
2. **PostHog** - Add if we need advanced features (session replay, funnels, experiments)
3. **Customer Journey Mapping** - Track multi-step flows when conversion optimization matters
4. **Predictive Analytics** - Build churn prediction when we have subscription revenue
5. **Real-Time Streaming** - Add if we need instant alerts and live dashboards

**The Rule:** Only add complexity when we have proven the need with data.

## Appendix: Tracking Examples

### Example 1: Tracking Transcription

```typescript
// When transcription starts
await trackFeature({
  featureName: 'transcription',
  featureCategory: 'transcription',
  metadata: {
    language: userLanguage,
    sourceType: 'microphone',
  },
  sessionId: currentSessionId,
});

// When transcription segment completes
await updateFeature(trackingId, {
  success: true,
  durationMs: 2500,
  metadata: {
    segmentLength: 45,
    detectedLanguage: 'zh-TW',
  },
});
```

### Example 2: Tracking AI Summarize

```typescript
// When AI action starts
const trackingId = await trackFeature({
  featureName: 'ai-summarize',
  featureCategory: 'ai-action',
  metadata: {
    inputLength: transcriptionText.length,
    model: 'gemini-1.5-flash',
  },
  sessionId: currentSessionId,
});

// When AI action completes
await updateFeature(trackingId, {
  success: true,
  durationMs: 3200,
  apiCostUsd: 0.0002, // Estimated cost
  metadata: {
    outputLength: summaryText.length,
    tokensUsed: 450,
  },
});
```

### Example 3: Session Heartbeat

```typescript
// Every 60 seconds
await updateSession(sessionId, {
  lastHeartbeatAt: new Date(),
  transcriptionCount: currentTranscriptionCount,
  aiActionsCount: currentAiActionsCount,
  errorsCount: currentErrorCount,
});
```

---

**Document Version:** 3.0 (Lean Implementation)
**Created:** 2025-10-15
**Status:** Ready for Implementation
**Philosophy:** Start Simple, Measure, Learn, Iterate
**Breaking Changes:** Allowed (pre-release product)
