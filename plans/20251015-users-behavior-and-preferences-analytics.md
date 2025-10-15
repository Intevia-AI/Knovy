# User Behavior and Preferences Analytics - Lean Implementation Plan

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
- Session starts when app opens or user logs in
- Heartbeat every 60 seconds updates `last_heartbeat_at` and metrics
- Session ends when app closes or after 30 minutes of inactivity
- Metrics (`transcription_count`, `ai_actions_count`) increment as features are used

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

### Phase 1: Database Migration (Day 1)

**Tasks:**

1. ✅ **Create migration file**
   - Drop old tables (`action_logs`, `transcription_ledger`)
   - Create new tables (`user_sessions`, `feature_usage`, `subscription_events`)
   - Extend `user_profiles` with new fields
   - Add all indexes and triggers

2. ✅ **Test migration locally**
   - Run migration on local Supabase
   - Verify schema with sample data
   - Test all indexes

3. ✅ **Deploy to production**
   - Run migration
   - Verify no errors

**Deliverables:**
- Migration SQL file: `supabase/migrations/YYYYMMDDHHMMSS_analytics_lean_implementation.sql`

**Commit Message:**
```
Feat(backend): Implement lean analytics database schema

- Replace action_logs with feature_usage table
- Replace transcription_ledger with user_sessions table
- Extend user_profiles with demographics
- Add subscription_events table (reserved for future)
- Create indexes for common analytics queries
- Add trigger to update user last_active timestamp

Breaking changes: Removes action_logs and transcription_ledger tables
```

### Phase 2: Session Tracking (Day 2)

**Tasks:**

1. ✅ **Create session manager service**
   - Add to `apps/app/src/renderer/src/services/analytics-service.ts`
   - Start session on app launch
   - Heartbeat every 60 seconds
   - End session gracefully
   - Handle crash/timeout scenarios

2. ✅ **Integrate with desktop app**
   - Initialize session on app start (in main process)
   - Track session metrics via IPC
   - Clean session end on app close

**Deliverables:**
- `apps/app/src/renderer/src/services/analytics-service.ts`
- `apps/app/src/main/ipc/analytics.ts` (IPC handlers)
- `apps/app/src/preload/index.ts` (expose analytics API)

**Commit Message:**
```
Feat(app): Add analytics session tracking

- Create analytics service for session and feature tracking
- Implement session manager with 60-second heartbeat
- Track transcription and AI action counts in session
- Add IPC handlers for analytics operations
- Handle graceful shutdown and session cleanup
- Log session metrics to user_sessions table
```

### Phase 3: Feature Usage Tracking (Day 3)

**Tasks:**

1. ✅ **Add feature tracking to analytics service**
   - Add methods: `trackFeatureStart()`, `trackFeatureComplete()`, `trackFeatureError()`
   - Auto-track start/end times
   - Error capture
   - Cost tracking for AI features

2. ✅ **Instrument transcription features**
   - Track transcription start/end in `RealTimeAnalysis.tsx`
   - Log language, duration, source type
   - Track enhancement usage

3. ✅ **Instrument AI actions**
   - Track all AI action calls in existing Edge Functions
   - Log input/output sizes in metadata
   - Track API costs
   - Monitor success/failure rates

4. ✅ **Add error tracking**
   - Catch and log all errors via analytics service
   - Include error type and message
   - Link to session and user

**Deliverables:**
- Updated `apps/app/src/renderer/src/services/analytics-service.ts`
- Updated AI action Edge Functions with tracking
- Updated transcription components with tracking

**Commit Message:**
```
Feat(app): Instrument features with analytics tracking

- Add feature tracking methods to analytics service
- Track transcription sessions with metadata (language, source type)
- Track AI action usage with input/output sizes
- Log errors with context and session linkage
- Monitor API costs for each AI feature
- Update Edge Functions to log feature usage
```

### Phase 4: Grafana Dashboards (Day 4)

**Tasks:**

1. ✅ **Create dashboard definitions**
   - DAU/WAU/MAU dashboard
   - Feature adoption dashboard
   - User engagement dashboard
   - Error monitoring dashboard

2. ✅ **Set up Grafana data source**
   - Configure PostgreSQL connection
   - Test queries
   - Optimize for performance

3. ✅ **Import dashboards**
   - Create JSON dashboard definitions
   - Import to Grafana
   - Configure refresh rates
   - Set up alerts

**Deliverables:**
- `docs/grafana/dashboards/user-activity.json`
- `docs/grafana/dashboards/feature-adoption.json`
- `docs/grafana/dashboards/user-engagement.json`
- `docs/grafana/dashboards/error-monitoring.json`

**Commit Message:**
```
Feat(analytics): Add Grafana dashboards for user insights

- DAU/WAU/MAU tracking dashboard
- Feature adoption and usage distribution
- User engagement scoring
- Error rate monitoring
- Include dashboard JSON definitions
```

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
