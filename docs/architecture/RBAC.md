# RBAC & Entitlements Architecture

## 1. Overview

This document details the Role-Based Access Control (RBAC) and entitlements system for the Knovy platform. It is designed to provide granular control over user access to features, enforce usage quotas, and manage application settings dynamically. The entire system is built on Supabase, leveraging its database and Edge Functions.

## 2. Data Model

The system is defined by a set of interconnected tables in our Supabase database. This model replaces a legacy permission-based system with a more flexible entitlement and quota-based approach.

#### `roles`
Defines the primary user roles available in the system.

| Column      | Type | Description                                         |
| :---------- | :--- | :-------------------------------------------------- |
| `name`      | `text` | Primary Key. E.g., 'free', 'pro', 'admin', 'beta'.  |
| `description`| `text` | A short description of the role's purpose.          |

#### `profiles`
Stores application-specific user data, linking `auth.users` to a specific role.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key. Foreign key to `auth.users.id`. |
| `role` | `text` | Foreign key to `roles.name`. Defaults to 'free'. |

#### `entitlements`
Defines feature access and configuration for each role. This is the core of the RBAC system, determining what a user *can do*.

| Column | Type | Description |
| :--- | :--- | :--- |
| `role` | `text` | Primary Key. Foreign key to `roles.name`. |
| `config` | `jsonb` | A JSON object where keys are feature flags (e.g., `allow_ai_action:summarize`) and values are booleans. |

#### `quotas`
Defines all numeric, consumable limits for each role, such as API calls or data usage.

| Column | Type | Description |
| :--- | :--- | :--- |
| `role` | `text` | Part of the composite Primary Key. Foreign key to `roles.name`. |
| `metric` | `text` | Part of the composite Primary Key. The specific metric being tracked (e.g., `daily_transcription_minutes`). |
| `limit` | `numeric` | The numeric limit for the metric. A value of `-1` signifies unlimited usage. |

#### `action_logs`
Audits user actions to enforce quotas and for future analytics.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | Primary Key (auto-incrementing). |
| `user_id` | `uuid` | Foreign key to `auth.users.id`. |
| `action` | `text` | The action performed, matching an entitlement key (e.g., `ai_action:summarize`). |
| `timestamp` | `timestampz` | Defaults to `now()`. |

#### `transcription_ledger`
Tracks transcription duration usage specifically for quota enforcement.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | Primary Key. |
| `session_id` | `uuid` | A unique identifier for a transcription session. |
| `user_id` | `uuid` | Foreign key to `auth.users.id`. |
| `duration_seconds` | `integer` | The duration of the transcription in seconds. |

## 3. Backend Implementation

The backend logic is primarily handled by Supabase Edge Functions, with a shared middleware for enforcing entitlements and quotas.

### 3.1. Entitlement Middleware (`_shared/rbac.ts`)

All protected AI action endpoints are wrapped in a `withEntitlements` higher-order function. This middleware is the gatekeeper for premium features and performs the following steps on every incoming request:

1.  Extracts and verifies the user's JWT from the `Authorization` header.
2.  Invokes a database function (`get_session_profile_data`) to efficiently fetch the user's complete session profile, including their role, entitlements, and current quota usage.
3.  **Check Entitlement**: It checks if the user's `entitlements` object contains the required flag for the requested action (e.g., `allow_ai_action:summarize: true`). If not, it rejects the request with a `403 Forbidden` error.
4.  **Check Quota**: It checks the user's `quotas` object to see if the usage for the requested metric has exceeded the limit. If so, it rejects the request with a `429 Too Many Requests` error.
5.  If all checks pass, the request proceeds to the main function handler.

### 3.2. Session Profile Function (`get-session-profile`)

This critical endpoint allows the frontend to fetch all necessary user data in a single, efficient call upon login or session refresh. It returns a comprehensive JSON object containing the user's role, all application settings, all their entitlements, and their current usage for all quota-tracked metrics.

### 3.3. Admin API (`admin-api`)

This Edge Function provides secure endpoints for managing the platform. Access to these endpoints is restricted to users with the `admin` role, a check performed within each handler.

- **`GET /admin-api/users`**: Lists all users and their roles.
- **`POST /admin-api/users/{id}/role`**: Updates the role for a specific user.
- **`GET /admin-api/users/{id}/usage`**: Fetches the action audit log for a specific user.

## 4. Frontend Implementation

The frontend applications (`apps/app` and `apps/admin-dashboard`) consume the RBAC system via a shared authentication context.

### 4.1. `AuthContext.tsx`

This context provider is responsible for:
1.  Managing the user's session and authentication state.
2.  Upon login, calling the `get-session-profile` endpoint to fetch the complete user profile.
3.  Storing the `sessionProfile` object (containing entitlements and quotas) in a React state.
4.  Exposing the profile and a helper function, `hasEntitlement(entitlement: string)`, to all child components via a `useAuth` hook.

### 4.2. Usage Example (Gating a UI Component)

To conditionally render a UI element based on the user's entitlements, components use the `useAuth` hook. This allows the UI to dynamically adapt to the user's subscription level.

```tsx
// src/components/main/ActionsPanel.tsx

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ListCollapseIcon } from 'lucide-react';

export default function ActionsPanel() {
  const { sessionProfile } = useAuth();

  // Check for the entitlement directly from the session profile
  const canSummarize = sessionProfile?.entitlements['allow_ai_action:summarize'] === true;

  return (
    <div>
      {/* This button will only be rendered if the user has the correct entitlement */}
      {canSummarize && (
        <Button>
          <ListCollapseIcon />
          Summarize
        </Button>
      )}
      {/* Other actions... */}
    </div>
  );
}
```