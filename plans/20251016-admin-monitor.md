# Admin Dashboard Analytics - Implementation Plan

> **Built-in analytics dashboards for Knovy admin-dashboard app**
> Replaces external Grafana setup with integrated Next.js solution

---

## 📋 Executive Summary

**Decision:** Build analytics dashboards directly into `apps/admin-dashboard` instead of using external Grafana.

**Rationale:**
- ✅ No network/firewall issues (uses existing Supabase client)
- ✅ Same authentication system (admin-only access)
- ✅ Full control over UI/UX and features
- ✅ Better integration with existing admin tools
- ✅ No external dependencies or infrastructure
- ✅ Can customize analytics specific to Knovy needs

**Timeline:** 2-3 days for complete implementation
**Effort:** ~16-24 hours of development

---

## 🎯 Project Goals

### Primary Goals
1. **Visualize user behavior** - DAU/WAU/MAU, engagement scores, retention
2. **Monitor feature adoption** - Which features users love, usage trends
3. **Track system health** - Error rates, success rates, crash reports
4. **Identify power users** - Top engaged users for customer success
5. **Data-driven decisions** - Export data, custom queries, insights

### Non-Goals (Not in Scope)
- ❌ Real-time streaming analytics (minute-level refresh is sufficient)
- ❌ Session replay or user recordings
- ❌ A/B testing framework
- ❌ Public-facing analytics (admin-only)
- ❌ Mobile app for analytics (desktop web only)

---

## 🏗️ Architecture Overview

### Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Radix UI (from @workspace/ui)
- **Tremor** (charting library - NEW)

**Backend:**
- Supabase PostgreSQL (existing)
- Server Components for data fetching
- API routes for dynamic queries (if needed)

**Authentication:**
- Existing AuthContext
- Admin role verification
- Redirect non-admins to https://intevia.app

**Data Source:**
- Same analytics tables from Phase 1-3:
  - `user_sessions`
  - `feature_usage`
  - `profiles`

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Admin Dashboard (Next.js)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Authentication Layer                              │    │
│  │  - Check if user has admin role                    │    │
│  │  - Redirect non-admins to https://intevia.app     │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────┐    │
│  │  Analytics Pages (/analytics/*)                    │    │
│  │  - Overview (landing page)                         │    │
│  │  - Users (DAU/WAU/MAU)                             │    │
│  │  - Features (adoption, usage)                      │    │
│  │  - Engagement (scores, sessions)                   │    │
│  │  - Errors (monitoring, reliability)                │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────┐    │
│  │  Analytics Components                              │    │
│  │  - Chart components (LineChart, BarChart, etc.)    │    │
│  │  - Metric cards (KPIs, stats)                      │    │
│  │  - Data tables (sortable, filterable)              │    │
│  │  - Date range pickers                              │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────┐    │
│  │  Analytics Queries (lib/analytics/queries.ts)     │    │
│  │  - 30+ SQL queries from Grafana plan               │    │
│  │  - TypeScript-safe with Zod schemas                │    │
│  │  - Cached with React Server Components             │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────┐
          │  Supabase PostgreSQL    │
          │  - user_sessions        │
          │  - feature_usage        │
          │  - profiles             │
          └─────────────────────────┘
```

---

## 🔐 Security & Access Control

### Admin-Only Access

**Requirement:** Only users with `admin` role can access analytics dashboards.

**Implementation:**

```typescript
// middleware.ts or layout.tsx check
async function checkAdminAccess(userId: string): Promise<boolean> {
  const { data } = await supabase
    .rpc('check_user_role', { user_id: userId, required_role: 'admin' });

  return data === true;
}

// Redirect logic
if (!isAdmin) {
  redirect('https://intevia.app');
}
```

**Flow:**
1. User visits `/analytics/*`
2. AuthContext checks if user is logged in
3. If not logged in → redirect to `/login`
4. If logged in but not admin → redirect to `https://intevia.app`
5. If admin → show analytics dashboards

---

### RLS Policies

Analytics tables already have RLS policies that allow service_role access. Admin dashboard uses authenticated client, so we need to ensure admins can query analytics tables:

```sql
-- Allow admins to read analytics tables
CREATE POLICY "Admins can read user_sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read feature_usage"
  ON feature_usage FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
```

---

## 📊 Dashboard Pages

### 1. Overview Dashboard (`/analytics`)

**Purpose:** High-level snapshot of key metrics

**Metrics:**
- Current DAU/WAU/MAU (big numbers)
- Active users now (real-time count)
- Today's feature usage (top 5 features)
- Today's error rate (%)
- Recent sessions (last 10)
- Quick links to detailed dashboards

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Analytics Overview                    [Date: Last 7 days] │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  DAU     │  │  WAU     │  │  MAU     │  │ Error %  │ │
│  │   127    │  │   456    │  │  1,234   │  │   2.3%   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐  ┌────────────────────┐  │
│  │  Feature Usage (Today)    │  │ Active Users Now   │  │
│  │  [Bar Chart]              │  │  15 users online   │  │
│  └───────────────────────────┘  └────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Recent Sessions [Table]                                 │
│  User | Platform | Duration | Features Used | Status    │
└─────────────────────────────────────────────────────────┘
```

---

### 2. User Activity Dashboard (`/analytics/users`)

**Purpose:** Track DAU/WAU/MAU trends and user growth

**Metrics:**
- Daily Active Users (last 30 days) - Line chart
- Weekly Active Users (last 12 weeks) - Line chart
- Monthly Active Users (last 12 months) - Line chart
- DAU/WAU/MAU summary stats
- New users per day (growth rate)
- User retention cohort analysis

**Queries:**
- DAU trend: `SELECT DATE(started_at), COUNT(DISTINCT user_id) FROM user_sessions...`
- WAU trend: `SELECT DATE_TRUNC('week', started_at), COUNT(DISTINCT user_id)...`
- MAU trend: `SELECT DATE_TRUNC('month', started_at), COUNT(DISTINCT user_id)...`

---

### 3. Feature Adoption Dashboard (`/analytics/features`)

**Purpose:** Understand which features users engage with

**Metrics:**
- Feature adoption rate (% of users who tried each feature)
- Feature usage trends (last 30 days) - Multi-line chart
- Success rate by feature (% of successful operations)
- Feature category distribution (pie chart)
- Transcription source type (mic vs system) - Bar chart
- Top languages used - Bar chart
- Average duration by feature

**Queries:**
- Feature adoption: `SELECT feature_name, COUNT(DISTINCT user_id)...`
- Usage trends: `SELECT DATE(created_at), feature_name, COUNT(*)...`
- Success rates: `SELECT feature_name, AVG(success::int)...`

---

### 4. User Engagement Dashboard (`/analytics/engagement`)

**Purpose:** Identify power users and understand engagement patterns

**Metrics:**
- Top engaged users (engagement score 0-100) - Table
- Engagement score distribution - Histogram
- Session duration distribution - Histogram
- Sessions per user - Bar chart
- Transcription activity trends - Line chart
- AI actions activity trends - Line chart
- At-risk users (engagement score < 30) - Table

**Queries:**
- Engagement scores: Complex query with days_active, features_used, sessions
- Session duration: `SELECT duration_seconds, COUNT(*) FROM user_sessions...`
- At-risk users: Engagement score < 30 filter

---

### 5. Error Monitoring Dashboard (`/analytics/errors`)

**Purpose:** Monitor system health and identify issues

**Metrics:**
- Error rate by feature (% failed) - Table with red/yellow/green indicators
- Error trends over time - Line chart with 10% threshold line
- Errors by feature (stacked) - Stacked area chart
- Success rate by feature - Bar chart
- Recent error messages (last 24h) - Table with search
- Session errors trend - Line chart
- Exit reasons distribution (normal/crash/timeout) - Pie chart

**Queries:**
- Error rate: `SELECT feature_name, COUNT(*) FILTER (WHERE success = FALSE) / COUNT(*)...`
- Recent errors: `SELECT * FROM feature_usage WHERE success = FALSE ORDER BY created_at DESC...`
- Exit reasons: `SELECT exit_reason, COUNT(*) FROM user_sessions GROUP BY exit_reason...`

---

## 🎨 UI/UX Design

### Navigation

Add "Analytics" to admin dashboard sidebar:

```
Admin Dashboard
├── Overview
├── Users
├── Settings
└── Analytics          ← NEW
    ├── Overview
    ├── User Activity
    ├── Feature Adoption
    ├── Engagement
    └── Error Monitoring
```

---

### Chart Components (Tremor)

**Tremor Charts to Use:**

| Chart Type | Use Case | Tremor Component |
|------------|----------|------------------|
| Line Chart | DAU/WAU/MAU trends, time series | `<LineChart>` |
| Bar Chart | Feature usage, comparisons | `<BarChart>` |
| Area Chart | Cumulative metrics, stacked data | `<AreaChart>` |
| Donut Chart | Category distribution, percentages | `<DonutChart>` |
| Metric Card | Big numbers (DAU, error rate) | `<Card>` + `<Metric>` |
| Table | User lists, error logs | `<Table>` |
| Progress Bar | Success rates, completion | `<ProgressBar>` |

**Color Scheme:**
- Success (>95%): Green
- Warning (80-95%): Yellow
- Critical (<80%): Red
- Neutral: Blue/Gray

---

### Responsive Design

**Desktop (primary):**
- Full dashboard layout
- Charts side-by-side (2 columns)
- Large metric cards

**Tablet:**
- Single column layout
- Stacked charts
- Slightly smaller metric cards

**Mobile (optional, low priority):**
- Simplified metrics only
- Tables become scrollable
- Charts stack vertically

---

## 🛠️ Implementation Plan

### Phase 0: Authentication Refinement (Completed - 2025-10-16)

**Status:** ✅ **COMPLETED**

**Tasks Completed:**

1. ✅ **Install Sonner notification system**
   ```bash
   pnpm add sonner
   ```
   - Added toast notification library for better UX feedback
   - Integrated `<Toaster>` component in root layout

2. ✅ **Refine login flow**
   - Login page now auto-redirects logged-in admins to dashboard
   - Prevents unnecessary login attempts for already-authenticated admins
   - Added loading states during auth checks

3. ✅ **Improve non-admin handling**
   - Non-admin users are now **force logged out** with notification
   - Error message: "Access denied. Admin privileges required."
   - Redirects to `/login` instead of external website
   - Allows users to try logging in with a different account

4. ✅ **Update AuthContext**
   - Added `logout()` function with notification support
   - Function signature: `logout(showNotification?: boolean, message?: string)`
   - Clears user state, permissions, and local storage
   - Shows toast notification when requested

5. ✅ **Update AuthGuard**
   - Implements force logout for non-admins
   - Shows "Access denied..." message during logout
   - 1.5 second delay before redirect to show notification

6. ✅ **Update pages**
   - `/login`: Auto-redirects admins
   - `/unauthorized`: Force logout with notification
   - `/logout`: Uses new logout function with success message

7. ✅ **Add logout button to DashboardLayout**
   - Added user email display in sidebar
   - Logout button at bottom of sidebar
   - Navigates to `/logout` page for clean logout flow

**Deliverables:**
- ✅ Sonner installed and configured
- ✅ Improved authentication UX with notifications
- ✅ Force logout for non-admins (no external redirects)
- ✅ Auto-redirect for already-logged-in admins
- ✅ Logout button in dashboard layout

**Additional Fixes:**

8. ✅ **Fix CORS configuration**
   - Created symlink from `.env` to `.env.development`
   - Enabled wildcard CORS for local development
   - Allows admin dashboard to call admin-api Edge Function

9. ✅ **Fix RBAC system compatibility**
   - Updated `withRBAC` function to work with entitlements-based system
   - Admin permissions (prefixed with `admin:`) check for admin role
   - Non-admin permissions check entitlements JSONB config

10. ✅ **Fix permissions endpoint**
    - Updated `handleGetMyPermissions` to use entitlements table
    - Admin users get: `admin:read_users`, `admin:update_user_role`, `admin:view_analytics`
    - All users get their enabled entitlements from config

11. ✅ **Prevent admin self-role-change**
    - Added check in `EditRoleDialog` to detect when admin is editing their own profile
    - Disabled role selection and save button when editing self
    - Shows error toast: "You cannot change your own role"
    - Located in: `components/EditRoleDialog.tsx:53-57`

**Commit:**
```
Feat(admin-dashboard): Refine authentication with auto-redirect and force logout

Improved admin dashboard authentication flow with better UX:
- Added sonner notification system for toast messages
- Login page now auto-redirects logged-in admins to dashboard
- Non-admins are force logged out with notification instead of redirect
- Updated AuthContext with logout function supporting notifications
- AuthGuard handles force logout for non-admins
- Added logout button with user email to DashboardLayout
- All flows redirect to /login (no external redirects)
- Admin self-role-change prevention implemented in EditRoleDialog

Fixed admin-api backend integration:
- Created .env symlink to .env.development for CORS configuration
- Updated withRBAC to work with entitlements-based RBAC system
- Fixed handleGetMyPermissions to use entitlements instead of role_permissions
- Admin dashboard can now successfully fetch users from admin-api
```

---

### Phase 1: Setup & Dependencies (Day 1 - 2 hours)

**Tasks:**

1. ✅ **Install Tremor**
   ```bash
   cd apps/admin-dashboard
   pnpm add @tremor/react
   ```

2. ✅ **Create analytics folder structure**
   ```bash
   mkdir -p app/analytics/{users,features,engagement,errors}
   mkdir -p components/analytics/{charts,metrics,tables}
   mkdir -p lib/analytics
   ```

3. ✅ **Set up route protection**
   - Create middleware or layout check for admin role
   - Add redirect to https://intevia.app for non-admins

4. ✅ **Configure Tremor with Tailwind**
   - Update `tailwind.config.js` to include Tremor

**Deliverables:**
- Dependencies installed
- Folder structure created
- Admin-only access enforced

---

### Phase 2: Analytics Query Library (Day 1 - 4 hours)

**Tasks:**

1. ✅ **Create query utilities** (`lib/analytics/queries.ts`)
   - Port all 30+ SQL queries from Grafana plan
   - Add TypeScript types for query results
   - Create reusable query functions

2. ✅ **Create type definitions** (`lib/analytics/types.ts`)
   - Define interfaces for all analytics data
   - Zod schemas for runtime validation

3. ✅ **Add query helpers**
   - Date range utilities
   - Aggregation helpers
   - Caching strategies

**Example:**

```typescript
// lib/analytics/queries.ts
export async function getDailyActiveUsers(
  startDate: Date,
  endDate: Date
): Promise<DauData[]> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('started_at, user_id')
    .gte('started_at', startDate.toISOString())
    .lte('started_at', endDate.toISOString());

  // Aggregate to DAU
  const dauMap = new Map<string, Set<string>>();
  data?.forEach(({ started_at, user_id }) => {
    const date = new Date(started_at).toISOString().split('T')[0];
    if (!dauMap.has(date)) {
      dauMap.set(date, new Set());
    }
    dauMap.get(date)!.add(user_id);
  });

  return Array.from(dauMap.entries()).map(([date, users]) => ({
    date,
    dau: users.size,
  }));
}
```

**Deliverables:**
- `lib/analytics/queries.ts` (30+ functions)
- `lib/analytics/types.ts` (TypeScript interfaces)
- Query tests (optional)

---

### Phase 3: Reusable Chart Components (Day 1 - 2 hours)

**Tasks:**

1. ✅ **Create chart wrapper components**
   - `<DauChart>` - Line chart for DAU/WAU/MAU
   - `<FeatureUsageChart>` - Bar chart for feature comparison
   - `<EngagementHistogram>` - Distribution chart
   - `<ErrorTrendChart>` - Line chart with threshold line
   - `<MetricCard>` - Big number with trend indicator

2. ✅ **Add chart configuration**
   - Default colors and themes
   - Loading states
   - Empty state handling
   - Error boundaries

**Example:**

```typescript
// components/analytics/charts/DauChart.tsx
import { LineChart } from '@tremor/react';

export function DauChart({ data }: { data: DauData[] }) {
  return (
    <LineChart
      data={data}
      index="date"
      categories={["dau"]}
      colors={["blue"]}
      valueFormatter={(value) => `${value} users`}
      yAxisWidth={48}
      showLegend={false}
    />
  );
}
```

**Deliverables:**
- 8-10 reusable chart components
- Consistent styling and error handling

---

### Phase 4: Dashboard Pages (Completed - 2025-10-16)

**Status:** ✅ **COMPLETED**

All 5 analytics dashboard pages have been implemented with proper Server/Client component architecture to handle Next.js 15 + React 19 + Tremor compatibility.

#### 4.1 Overview Dashboard ✅

**Files:** `app/analytics/overview/page.tsx` + `client-view.tsx`

**Implemented:**
- ✅ Server Component for async data fetching
- ✅ Client Component for Tremor UI rendering
- ✅ DAU/WAU/MAU/Error Rate metric cards
- ✅ Daily Active Users chart (last 30 days)
- ✅ Engagement score distribution histogram
- ✅ Loading skeletons for better UX

---

#### 4.2 User Activity Dashboard ✅

**Files:** `app/analytics/users/page.tsx` + `client-view.tsx`

**Implemented:**
- ✅ Server/Client split architecture
- ✅ DAU/WAU/MAU trend charts
- ✅ Currently active users table
- ✅ Session performance metrics card
- ✅ User growth tracking (new vs returning)
- ✅ Retention cohort analysis (Day 1/7/14/30)
- ✅ Recent sessions table with platform details
- ✅ Export functionality for session data

---

#### 4.3 Feature Adoption Dashboard ✅

**Files:** `app/analytics/features/page.tsx` + `client-view.tsx`

**Implemented:**
- ✅ Server/Client component separation
- ✅ Feature usage trends visualization
- ✅ Top 50 features ranking
- ✅ Feature adoption charts
- ✅ Error tracking by feature
- ✅ Success rate indicators
- ✅ Feature category distribution

---

#### 4.4 User Engagement Dashboard ✅

**Files:** `app/analytics/engagement/page.tsx` + `client-view.tsx`

**Implemented:**
- ✅ Engagement score distribution histogram
- ✅ Top engaged users table (power users)
- ✅ User activity metrics (days active, sessions, features)
- ✅ Retention cohorts by signup date
- ✅ User segmentation by behavior patterns
- ✅ Inactive users tracking (at-risk identification)
- ✅ Engagement trends over time
- ✅ Churn rate monitoring
- ✅ Export functionality for user data

---

#### 4.5 Error Monitoring Dashboard ✅

**Files:** `app/analytics/errors/page.tsx` + `client-view.tsx`

**Implemented:**
- ✅ System health status indicator
- ✅ Total errors and error rate metrics
- ✅ Critical errors highlighting (last 24h)
- ✅ Error trends chart (last 30 days)
- ✅ Errors by feature visualization
- ✅ Error type analysis and breakdown
- ✅ Recent error details table (last 100)
- ✅ Affected users and features tracking
- ✅ Severity indicators (critical/high/medium/low)
- ✅ Export functionality for error data

---

**Key Technical Achievements:**

1. **Server/Client Component Architecture**
   - All pages split into async Server Components (data fetching) and Client Components (UI rendering)
   - Resolves React Context errors with Tremor library
   - Improved performance with parallel data fetching using `Promise.all`
   - Better separation of concerns and code organization

2. **Database Query Fixes**
   - Fixed `display_name` column references (removed from all queries)
   - Resolved cross-schema join issues (auth.users vs public.profiles)
   - Replaced missing RPC functions with client-side aggregation logic
   - Standardized DateRange type: `{ from: Date; to: Date }`
   - Implemented WAU aggregation (week starts Sunday)
   - Implemented MAU aggregation (YYYY-MM format)

3. **Analytics Query Implementation**
   - 40+ query functions fully typed with TypeScript
   - Client-side aggregation for complex metrics
   - Proper error handling and empty state management
   - Optimized with parallel fetching patterns

**Known Limitations:**
- Some functions return stub data (need implementation):
  - `getUserRetention()` - needs complete cohort analysis
  - `getEngagementTrends()` - needs time-series aggregation
- User email not available in some views (cross-schema join limitation)
- No real-time updates (data refreshes on page load)

---

### Phase 5: Navigation & Polish (Day 3 - 2 hours)

**Tasks:**

1. ✅ **Add analytics to sidebar navigation**
   - Update `components/layout/sidebar.tsx`
   - Add "Analytics" menu item with sub-items

2. ✅ **Create analytics layout** (`app/analytics/layout.tsx`)
   - Shared header with date range selector
   - Breadcrumb navigation
   - Refresh button

3. ✅ **Add loading states**
   - Skeleton loaders for charts
   - Loading spinners for tables

4. ✅ **Error handling**
   - Error boundaries for each dashboard
   - Fallback UI for failed queries

**Deliverables:**
- Integrated navigation
- Polished UI with loading states
- Error handling

---

### Phase 6: Testing & Optimization (Day 3 - 4 hours)

**Tasks:**

1. ✅ **Test admin access control**
   - Verify admins can access all dashboards
   - Verify non-admins redirect to https://intevia.app
   - Test logged-out redirect to /login

2. ✅ **Test data accuracy**
   - Compare query results with manual SQL queries
   - Verify metrics match expected values

3. ✅ **Performance optimization**
   - Add React Server Component caching
   - Optimize slow queries
   - Add pagination for large tables

4. ✅ **Cross-browser testing**
   - Test in Chrome, Firefox, Safari
   - Verify responsive design

**Deliverables:**
- Fully tested analytics dashboards
- Performance optimizations applied

---

## 📁 File Structure

```
apps/admin-dashboard/
├── app/
│   ├── analytics/
│   │   ├── layout.tsx                    # Shared analytics layout
│   │   ├── page.tsx                      # Overview dashboard
│   │   ├── users/
│   │   │   └── page.tsx                  # User activity dashboard
│   │   ├── features/
│   │   │   └── page.tsx                  # Feature adoption dashboard
│   │   ├── engagement/
│   │   │   └── page.tsx                  # User engagement dashboard
│   │   └── errors/
│   │       └── page.tsx                  # Error monitoring dashboard
│   └── middleware.ts                     # Admin access check
├── components/
│   ├── analytics/
│   │   ├── charts/
│   │   │   ├── DauChart.tsx              # DAU/WAU/MAU line chart
│   │   │   ├── FeatureUsageChart.tsx     # Feature comparison bar chart
│   │   │   ├── EngagementHistogram.tsx   # Engagement distribution
│   │   │   ├── ErrorTrendChart.tsx       # Error rate line chart
│   │   │   └── SuccessRateChart.tsx      # Success rate bar chart
│   │   ├── metrics/
│   │   │   ├── MetricCard.tsx            # Big number metric card
│   │   │   ├── TrendIndicator.tsx        # Up/down trend arrow
│   │   │   └── StatGrid.tsx              # Grid of metrics
│   │   ├── tables/
│   │   │   ├── UserTable.tsx             # User list table
│   │   │   ├── ErrorTable.tsx            # Error messages table
│   │   │   └── SessionTable.tsx          # Recent sessions table
│   │   └── shared/
│   │       ├── DateRangePicker.tsx       # Date range selector
│   │       ├── LoadingSkeleton.tsx       # Loading placeholder
│   │       └── EmptyState.tsx            # No data placeholder
│   └── layout/
│       └── sidebar.tsx                   # Updated with analytics nav
└── lib/
    ├── analytics/
    │   ├── queries.ts                    # All SQL query functions
    │   ├── types.ts                      # TypeScript interfaces
    │   ├── utils.ts                      # Helper utilities
    │   └── constants.ts                  # Colors, thresholds, etc.
    └── supabase/
        └── client.ts                     # Existing Supabase client
```

---

## 🔄 Migration from Grafana

### What Changes

| Aspect | Grafana (Old) | Admin Dashboard (New) |
|--------|---------------|----------------------|
| **Access** | External Grafana URL | `/analytics` in admin-dashboard |
| **Authentication** | Separate Grafana login | Same as admin dashboard |
| **Data Source** | PostgreSQL direct connection | Supabase client (existing) |
| **Charts** | Grafana panels | Tremor React components |
| **Queries** | Raw SQL in Grafana | TypeScript functions |
| **Customization** | JSON dashboard export | Direct code changes |
| **Deployment** | Separate Grafana instance | Part of admin-dashboard |

---

### What Stays the Same

- ✅ **Database schema** - No changes to `user_sessions`, `feature_usage`, `profiles`
- ✅ **SQL queries** - Same logic, ported to TypeScript
- ✅ **Metrics** - Same KPIs (DAU/WAU/MAU, engagement scores, etc.)
- ✅ **Business logic** - Engagement score formula, success rate thresholds

---

### Deprecating Grafana

**Actions:**

1. ✅ **Archive Grafana documentation**
   ```bash
   mv docs/setup/grafana docs/archive/grafana-deprecated
   ```

2. ✅ **Update analytics plan** (`plans/20251015-users-behavior-and-preferences-analytics.md`)
   - Mark Phase 4 (Grafana Dashboards) as deprecated
   - Reference new plan: `plans/20251016-admin-monitor.md`

3. ✅ **Update README** (if mentions Grafana)
   - Remove Grafana setup instructions
   - Add admin dashboard analytics section

---

## 🚀 Deployment & Rollout

### Local Development

```bash
# Start admin-dashboard
cd apps/admin-dashboard
pnpm dev

# Visit analytics
open http://localhost:3000/analytics
```

---

### Production Deployment

**Checklist:**

1. ✅ **Deploy admin-dashboard** with analytics pages
2. ✅ **Verify admin role** is set for admin users in database
3. ✅ **Test access control** - Non-admins redirect to https://intevia.app
4. ✅ **Monitor performance** - Check query execution times
5. ✅ **Set up alerts** (optional) - Email notifications for high error rates

---

### Rollback Plan

If issues arise:
1. Remove `/analytics` route from admin-dashboard
2. Deploy previous version without analytics
3. Debug issues in staging environment
4. Redeploy with fixes

---

## 📊 Success Metrics

### Week 1 (MVP Complete)
- ✅ All 5 dashboard pages deployed
- ✅ Admin-only access working
- ✅ Data accuracy verified (matches SQL queries)
- ✅ No performance issues (<2s page load)

### Month 1 (Adoption)
- ✅ Admin team using analytics weekly
- ✅ At least one data-driven decision made
- ✅ No critical bugs reported
- ✅ Positive feedback from admin users

### Month 3 (Maturity)
- ✅ Custom queries added for specific insights
- ✅ Analytics informing product roadmap
- ✅ Power users identified and engaged
- ✅ Error rates trending down (insights actionable)

---

## 🔧 Maintenance & Future Enhancements

### Regular Maintenance
- **Weekly:** Review dashboard performance
- **Monthly:** Optimize slow queries if needed
- **Quarterly:** Add new metrics based on team needs

### Future Enhancements (Backlog)

**Short-term (Next quarter):**
1. **Export functionality** - Download charts as images, tables as CSV
2. **Custom date ranges** - Beyond preset ranges
3. **User detail pages** - Click user to see individual journey
4. **Saved views** - Bookmark specific date ranges and filters

**Medium-term (6 months):**
1. **Alert system** - Email notifications for high error rates
2. **Cohort analysis** - User retention by signup week
3. **Funnel analysis** - Feature adoption funnels
4. **A/B test tracking** (if implemented)

**Long-term (1 year):**
1. **Predictive analytics** - Churn prediction, LTV estimation
2. **Real-time updates** - WebSocket-based live dashboards
3. **Mobile app** - Native iOS/Android for on-the-go monitoring
4. **API access** - External tools can query analytics

---

## 📚 Related Documentation

- [Analytics Implementation Plan](./20251015-users-behavior-and-preferences-analytics.md) - Database schema and instrumentation
- [Database Schema](../supabase/migrations/20251015181639_analytics_lean_implementation.sql) - Analytics tables
- ~~[Grafana Setup Guide](../docs/setup/grafana/README.md)~~ - **DEPRECATED** (archived)
- [Admin Dashboard README](../apps/admin-dashboard/README.md) - Admin app documentation

---

## 🎓 Learning Resources

### Tremor Documentation
- [Tremor Docs](https://www.tremor.so/docs/getting-started/installation)
- [Chart Components](https://www.tremor.so/docs/visualizations/chart-elements)
- [Example Dashboards](https://www.tremor.so/docs/getting-started/example-dashboard)

### Next.js Best Practices
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Caching](https://nextjs.org/docs/app/building-your-application/caching)

---

## ✅ Implementation Checklist

### Phase 1: Setup (Day 1 - 2h)
- [ ] Install Tremor: `pnpm add @tremor/react`
- [ ] Create folder structure
- [ ] Set up admin-only middleware
- [ ] Configure Tremor with Tailwind

### Phase 2: Query Library (Day 1 - 4h)
- [ ] Create `lib/analytics/queries.ts`
- [ ] Port all SQL queries from Grafana plan
- [ ] Create TypeScript types
- [ ] Add date range utilities

### Phase 3: Chart Components (Day 1 - 2h)
- [ ] Create `DauChart.tsx`
- [ ] Create `FeatureUsageChart.tsx`
- [ ] Create `EngagementHistogram.tsx`
- [ ] Create `ErrorTrendChart.tsx`
- [ ] Create `MetricCard.tsx`
- [ ] Add loading and error states

### Phase 4: Dashboard Pages (Day 2 - 8h)
- [x] Create `app/analytics/overview/page.tsx` + `client-view.tsx` (Overview)
- [x] Create `app/analytics/users/page.tsx` + `client-view.tsx` (User Activity)
- [x] Create `app/analytics/features/page.tsx` + `client-view.tsx` (Feature Adoption)
- [x] Create `app/analytics/engagement/page.tsx` + `client-view.tsx` (User Engagement)
- [x] Create `app/analytics/errors/page.tsx` + `client-view.tsx` (Error Monitoring)
- [x] Implement Server/Client component architecture for all pages
- [x] Fix database query issues (display_name, cross-schema joins)
- [x] Implement client-side aggregation for WAU/MAU
- [x] Add export functionality to dashboards

### Phase 5: Navigation & Polish (Day 3 - 2h)
- [ ] Add analytics to sidebar navigation
- [ ] Create analytics layout with date picker
- [ ] Add breadcrumb navigation
- [ ] Implement loading skeletons

### Phase 6: Testing & Optimization (Day 3 - 4h)
- [ ] Test admin access control
- [ ] Verify data accuracy
- [ ] Optimize slow queries
- [ ] Cross-browser testing
- [ ] Deploy to production

### Post-Launch
- [ ] Archive Grafana documentation
- [ ] Update main analytics plan
- [ ] Document new analytics access
- [ ] Train admin team on new dashboards

---

**Document Version:** 1.8
**Created:** 2025-10-16
**Last Updated:** 2025-10-17
**Status:** Complete - Authentication & Data Display Issues Resolved
**Approach:** Integrated Next.js Dashboards (Grafana Replacement)
**Owner:** Knovy Team

---

## 📝 Changelog

### Version 1.9 (2025-10-17) - User Activity Data Display & Token Tracking Fixes
- ✅ **Critical Query Bug Fixed**:
  - Fixed PostgreSQL parsing error in `getUserActivityData` function (`user-activity-queries.ts:78`)
  - Issue: `.eq("", "")` when `userId` was undefined, causing `PGRST100` error
  - Solution: Properly conditionally apply `.eq("id", userId)` filter only when userId exists
  - Admin dashboard `/analytics/users` page now loads successfully
- ✅ **Recent Sessions Data Calculation Fixed**:
  - Fixed AI actions count: Now properly counts both `ai-action` and `ai` category features
  - Fixed transcriptions count: Counts both `ai-transcription-enhance` and raw `transcription` features
  - Uses `segment_count` from metadata when available, defaults to 1 transcription per enhancement
  - Calculates transcription minutes from `audio_duration_seconds` metadata
  - Handles missing metadata fields gracefully with fallback values
- ✅ **Platform Version Display Fixed**:
  - Now handles 'unknown', 'vunknown', or any variant containing 'unknown'
  - Displays as "version unknown" instead of showing raw 'vunknown' string
  - Case-insensitive matching for robustness
- ✅ **Token Usage Tracking Verified**:
  - Confirmed token metadata is properly structured in database with `tokens.input`, `tokens.output`, `tokens.total`
  - Token extraction utilities working correctly with existing data
  - Cost calculations accurate based on Gemini 2.0 Flash pricing ($0.075/1M input, $0.30/1M output)
  - Token summary, cost estimation, and usage breakdown components functional
- 📝 **Files Modified**:
  - `apps/admin-dashboard/lib/analytics/user-activity-queries.ts` - Fixed query parsing bug
  - `apps/admin-dashboard/lib/analytics/queries.ts` - Enhanced data calculation logic (42 lines changed)
- 📝 **Database Queries Tested**: Validated calculations with direct PostgreSQL queries, confirmed accurate data aggregation

### Version 1.8 (2025-10-17) - Authentication & Analytics Data Display Fixes
- ✅ **Critical Authentication Fixes Implemented**:
  - Upgraded to `@supabase/ssr` for Next.js 15 compatibility
  - Updated `lib/supabase-server.ts` to use async `createServerClient` with proper cookie handling
  - Updated `lib/supabase-client.ts` to use `createBrowserClient` for SSR compatibility
  - Made all 18 analytics query functions await the async server client
  - Created `/test-auth` debugging page for server-side authentication verification
- ✅ **Logout Redirect Loop Resolved**:
  - Created dedicated `/logout` page with proper state management
  - Fixed race conditions by clearing state BEFORE `supabase.auth.signOut()`
  - Changed `router.push()` to `router.replace()` to avoid history stack issues
  - Added `useRef` to prevent multiple simultaneous logout attempts
  - Increased delay to 1.5s for complete session clearing
  - Enhanced login page auto-redirect validation
- ✅ **Features Page Data Display Fixed**:
  - Fixed data source to use `featureAdoption` (complete data) instead of `topFeatures` (limited fields)
  - Added `feature_category` to query response in `lib/analytics/queries.ts`
  - Standardized `success_rate` to decimal format (0-1) across entire codebase
  - Added null safety checks for all numeric properties (`total_uses`, `successful_uses`, etc.)
  - Fixed success rate calculations to handle decimal format correctly
  - All features now display real usage data from database (61 ai-transcription-enhance uses, 12 ai-summarize uses, etc.)
- ✅ **Overview Page Engagement Chart Fixed**:
  - Added histogram transformation for User Engagement Distribution chart
  - Transform individual engagement scores into 5 ranges (0-20, 21-40, 41-60, 61-80, 81-100)
  - Chart now displays proper distribution instead of being empty
- ✅ **Database & RLS Verification**:
  - Applied RLS migration `20251017000000_add_admin_rls_policies.sql` for admin analytics access
  - Verified admin role permissions for all analytics queries
  - Confirmed actual data exists: 77 feature_usage records, 2 user sessions
- 📝 **All Analytics Pages Working**: Dashboard now displays real data from local Supabase database

### Version 1.7 (2025-10-16) - Security Fixes & Design System Applied
- ✅ **Phase 1: Critical Security Fixes Implemented**:
  - Removed all console.log statements exposing sensitive user data from:
    - `context/AuthContext.tsx` - User profiles and roles no longer logged
    - `components/AuthGuard.tsx` - Auth status logging removed
    - `app/login/page.tsx` - Admin redirect logging removed
  - Added environment variable validation:
    - `lib/supabase-client.ts` - Runtime validation with helpful error messages
    - `lib/supabase-server.ts` - Prevents crashes when env vars are missing
- ✅ **Phase 2: Glassmorphism Design System Applied**:
  - Updated `DashboardLayout.tsx` with glassmorphism effects:
    - Sidebar: `bg-background/40 backdrop-blur-xl border-white/10`
    - Nav items: `bg-accent/70 backdrop-blur-sm` when active
    - Smooth transitions: `transition-all duration-200`
  - Converted `overview-metrics-grid.tsx` from Tremor to custom glassmorphic cards
  - Updated login page with gradient background and glass card
  - Design now consistent with main Knovy app settings window
- ✅ **Settings Page Decision**: Confirmed NO settings page needed (analytics-focused tool should remain simple)
- 📝 **Ready for Production**: Security vulnerabilities fixed, design system unified

### Version 1.6 (2025-10-16) - Code Review Complete
- ✅ **Comprehensive Code Review Conducted**:
  - **Critical Issues Found:**
    - Security: Excessive console logging exposing user data and roles
    - Security: Missing environment variable validation causing potential crashes
    - Performance: Client-side data aggregation for large datasets
  - **Design System Analysis:**
    - Partial Modern Design System implementation (mixed Tremor/custom components)
    - Inconsistent with main Knovy app design (missing glassmorphism, different navigation)
    - Missing dark mode support
  - **Settings Page Recommendation:** Do NOT add (not needed for analytics-focused dashboard)
  - **Action Plan Created:**
    - Phase 1: Critical security fixes (remove console.logs, validate env vars)
    - Phase 2: Performance optimization (server-side aggregation, pagination)
    - Phase 3: Design system unification (complete Tremor removal, align with main app)
    - Phase 4: UX improvements (date range picker, refresh button, better tables)
    - Phase 5: Testing & documentation
- 📝 **Next Steps:** Implement critical security fixes immediately, then proceed with optimization

### Version 1.5 (2025-10-16)
- ✅ **Modern Design System Implemented**:
  - Created comprehensive design system with modern color palette, typography, and animations
  - Replaced Tremor with Recharts for better customization and modern aesthetics
  - Built reusable components: ModernMetricCard, ModernLineChart, ModernBarChart, ModernDataTable
  - Updated all analytics pages with new design system:
    - **Overview**: Modern metrics with trend indicators, area charts with gradients
    - **User Activity**: Multi-section dashboard with interactive data tables and charts
    - **Error Monitoring**: Health status indicators, critical error highlighting, comprehensive error analysis
  - Added interactive features: search, pagination, export functionality
  - Improved visual hierarchy with proper spacing, shadows, and hover effects
- ✅ **UI/UX Improvements**:
  - Professional color scheme: Deep Blue primary, semantic colors for status
  - Consistent border radius (8px) and shadow system
  - Smooth animations and transitions
  - Responsive grid layouts
  - Enhanced data visualization with Recharts customization
- 📝 **Next Steps**: Testing, performance optimization, and production deployment

### Version 1.4 (2025-10-16)
- ✅ **Critical Security Fixes Applied**:
  - Removed exposed debug page that was publicly accessible without authentication
  - Fixed database query errors: removed all references to non-existent `display_name` column
  - Removed broken settings page link from navigation sidebar
- ✅ **Code Review Complete**: Identified and documented all critical, high, and medium priority issues
- ✅ **UI/UX Analysis Complete**: Created comprehensive modern design system specification

### Version 1.3 (2025-10-16)
- ✅ **Phase 4 Complete**: All 5 analytics dashboard pages implemented
  - **Server/Client Architecture**: Split all pages into Server Components (data fetching) and Client Components (UI rendering)
  - **Overview Dashboard**: DAU/WAU/MAU metrics, engagement distribution, loading states
  - **User Activity Dashboard**: Activity trends, active users, growth tracking, retention cohorts, sessions table
  - **Feature Adoption Dashboard**: Usage trends, top features, error tracking, adoption charts
  - **User Engagement Dashboard**: Engagement scores, power users, segmentation, inactive users, churn monitoring
  - **Error Monitoring Dashboard**: System health, error trends, critical errors, error type analysis, export functionality
  - **Database Fixes**: Removed `display_name` column references, fixed cross-schema joins, standardized DateRange type
  - **Query Improvements**: Implemented WAU/MAU client-side aggregation, replaced missing RPC functions with application logic
  - **40+ Query Functions**: All fully typed with TypeScript, proper error handling, optimized parallel fetching
- ✅ **Admin Self-Role-Change Prevention**: Admins cannot change their own role (EditRoleDialog)
- 📝 **Next**: Phase 5 polish (add date range picker), Phase 6 testing & optimization

### Version 1.2 (2025-10-16)
- ✅ **Phase 0 Complete**: Authentication refinement with sonner notifications
  - Added force logout for non-admins with notifications
  - Implemented auto-redirect for logged-in admins on login page
  - Added logout button to dashboard layout
  - Updated all auth flows to redirect to /login (no external redirects)
  - Fixed CORS configuration with .env symlink
  - Fixed RBAC system to work with entitlements-based schema
  - Fixed admin-api permissions endpoint
- 📝 Next: Proceed with Phase 4 (Dashboard Pages)

### Version 1.0 (2025-10-16)
- Initial plan created
- Phases 1-3 completed (Setup, Query Library, Chart Components)
- Analytics pages folder structure created
- Navigation and layout completed
