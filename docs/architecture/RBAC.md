# RBAC & Administration Architecture

## 1. Overview

This document details the Role-Based Access Control (RBAC) system implemented for the Knovy platform. The system is designed to control user access to features and data based on their assigned role. It is built upon Supabase's database and Edge Functions.

## 2. Data Model

The RBAC system introduces several new tables to the `public` schema in our Supabase database.

#### `profiles`
Stores application-specific user data and links to `auth.users`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key. Foreign key to `auth.users.id`. |
| `role` | `text` | Foreign key to `roles.name`. E.g., 'free', 'pro', 'admin'. |

#### `roles`
Defines the available roles in the system.

| Column | Type | Description |
| :--- | :--- | :--- |
| `name` | `text` | Primary Key. E.g., 'free', 'pro', 'admin', 'beta'. |
| `description`| `text` | A short description of the role. |

#### `permissions`
Defines granular permissions for specific actions.

| Column | Type | Description |
| :--- | :--- | :--- |
| `name` | `text` | Primary Key. E.g., 'ai_action:summarize', 'admin:read_users'. |
| `description`| `text` | A short description of the permission. |

#### `role_permissions`
A join table linking roles to their granted permissions.

| Column | Type | Description |
| :--- | :--- | :--- |
| `role_name` | `text` | Foreign key to `roles.name`. |
| `permission_name` | `text` | Foreign key to `permissions.name`. |

#### `action_logs`
Audits user actions to enforce quotas and for future analytics.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | Primary Key (auto-incrementing). |
| `user_id` | `uuid` | Foreign key to `auth.users.id`. |
| `action` | `text` | The action performed, e.g., 'ai_action:summarize'. |
| `timestamp` | `timestampz` | Defaults to `now()`. |

## 3. Backend Implementation

The backend logic is handled entirely by Supabase Edge Functions.

### 3.1. RBAC Middleware (`_shared/rbac.ts`)

All protected endpoints are wrapped in a `withRBAC` higher-order function. This middleware performs the following steps on every incoming request:

1.  Extracts the JWT from the `Authorization` header.
2.  Verifies the JWT with Supabase to identify the user.
3.  Fetches the user's assigned `role` from the `profiles` table.
4.  Retrieves all `permissions` associated with that role from the `role_permissions` table.
5.  Checks if the required permission for the endpoint is in the user's permission list.
6.  If the user has the permission, the request proceeds. Otherwise, it is rejected with a `403 Forbidden` error.

### 3.2. Admin API (`functions/admin-api`)

This Edge Function provides endpoints for managing the platform. All endpoints are protected by the `withRBAC` middleware.

#### **GET /me/permissions**
- **Description**: Fetches the list of permissions for the currently authenticated user.
- **Permissions**: None (accessible by any authenticated user).
- **Usage**:
  ```bash
  curl 'http://127.0.0.1:54321/functions/v1/admin-api/me/permissions' \
  -H "Authorization: Bearer $SUPABASE_TOKEN"
  ```

#### **GET /users**
- **Description**: Retrieves a list of all users and their assigned roles.
- **Permissions**: `admin:read_users`
- **Usage**:
  ```bash
  curl 'http://127.0.0.1:54321/functions/v1/admin-api/users' \
  -H "Authorization: Bearer $ADMIN_TOKEN"
  ```

#### **POST /users/{id}/role**
- **Description**: Updates the role for a specific user.
- **Permissions**: `admin:update_user_role`
- **Body**: `{ "role": "new_role_name" }`
- **Usage**:
  ```bash
  curl -X POST "http://127.0.0.1:54321/functions/v1/admin-api/users/$USER_ID/role" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "pro"}'
  ```

#### **GET /users/{id}/usage**
- **Description**: Fetches the action audit log for a specific user.
- **Permissions**: `admin:read_users`
- **Usage**:
  ```bash
  curl "http://127.0.0.1:54321/functions/v1/admin-api/users/$USER_ID/usage" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
  ```

## 4. Frontend Implementation

The frontend applications (`apps/app` and `apps/admin-dashboard`) consume the RBAC system via a shared authentication context.

### 4.1. `AuthContext.tsx`

This context provider is responsible for:
1.  Managing the user's session and authentication state.
2.  Upon login or session refresh, calling the `/me/permissions` endpoint to fetch the user's permissions.
3.  Storing the permissions list in a React state.
4.  Exposing the permissions and a helper function, `hasPermission(permission: string)`, to all child components via the `useAuth` hook.

### 4.2. Usage Example (Gating a UI Component)

To conditionally render a component based on the user's permissions, we use the `useAuth` hook inside a client component.

```tsx
// src/components/main/ActionsPanel.tsx

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ListCollapseIcon } from 'lucide-react';

export default function ActionsPanel() {
  const { hasPermission } = useAuth();

  return (
    <div>
      {/* This button will only be rendered if the user has the correct permission */}
      {hasPermission('ai_action:summarize') && (
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

