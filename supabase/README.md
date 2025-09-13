# Supabase Backend Testing Guide

This guide explains how to manually test the Supabase backend, including the Role-Based Access Control (RBAC) system for Edge Functions.

## How to Test the RBAC Implementation

Since the frontend is not yet connected to these features, you must use a command-line tool like `curl` to interact with the API directly.

### Step 1: Get a User's Authentication Token (JWT)

You need a valid JSON Web Token (JWT) to make authenticated requests. The easiest way to get one is from your browser:

1. Open your web application (e.g., `http://localhost:3000`) in your browser.
2. Log in with a test user account.
3. Open the browser's Developer Tools (usually F12 or Ctrl+Shift+I).
4. Go to the **Application** tab (in Chrome) or **Storage** tab (in Firefox).
5. Under **Local Storage**, find the entry for your Supabase URL. The key will look something like `sb-your-project-ref-auth-token`.
6. Copy the large string value. This is your JWT.
7. Save this token in your terminal as an environment variable for convenience:
   ```bash
   export SUPABASE_TOKEN="paste_your_long_jwt_here"
   ```

### Step 2: Test Protected AI Actions

This section provides `curl` commands to test each of the protected AI action endpoints. For each command, you can test the "Success" and "Fail" scenarios as described above by changing the user's role in the `profiles` table.

#### `ai-action-chat`

```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/ai-action-chat' \
-H "Authorization: Bearer $SUPABASE_TOKEN" \
-H "Content-Type: application/json" \
-d '{"text_input": "hello world"}'
```

#### `ai-action-summarize`

```bash
cURL -X POST 'http://127.0.0.1:54321/functions/v1/ai-action-summarize' \
-H "Authorization: Bearer $SUPABASE_TOKEN" \
-H "Content-Type: application/json" \
-d '{"text_input": "This is a long piece of text that needs to be summarized into a few key points."}'
```

#### `ai-action-keyword-search`

```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/ai-action-keyword-search' \
-H "Authorization: Bearer $SUPABASE_TOKEN" \
-H "Content-Type: application/json" \
-d '{"text_input": "The quick brown fox jumps over the lazy dog."}'
```

#### `ai-action-recommend-response`

```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/ai-action-recommend-response' \
-H "Authorization: Bearer $SUPABASE_TOKEN" \
-H "Content-Type: application/json" \
-d '{"text_input": "I am not sure how to reply to the customer\'s complaint about pricing."}'
```

#### `ai-action-screenshot-analysis`

**Note:** For this command, you need to provide a real base64-encoded image string. You can use an online converter to get one from a sample image.

```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/ai-action-screenshot-analysis' \
-H "Authorization: Bearer $SUPABASE_TOKEN" \
-H "Content-Type: application/json" \
-d {
  "text_input": "What is the main title in this screenshot?",
  "image_input": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ... (paste your base64 string here)"}
```

### Step 3: Test Scenarios

#### Scenario A: User with Permission (Should Succeed)

By default, all new users have the `free` role, which has all AI action permissions.

1.  **Execute the request:** Run any of the `curl` commands above.
2.  **Expected Result:** A `200 OK` response with the corresponding JSON payload.
3.  **Verify in Database:** Check the `action_logs` table in Supabase Studio to ensure a new row was created for the action.

#### Scenario B: User without Permission (Should Fail)

1.  **Modify User Role:** In Supabase Studio, go to the `role_permissions` table and `DELETE` the row that grants the permission you want to test (e.g., delete the row where `role_name` is `free` and `permission_name` is `ai_action:chat`).
2.  **Execute the request:** Run the `curl` command for the action you just revoked.
3.  **Expected Result:** A **`403 Forbidden`** error with the body `{"error":"Forbidden"}`.
4.  **Verify in Database:** Check the `action_logs` table again. **No new row** should have been created.

### Step 4: Test Client-Side Permissions Endpoint

The `admin-api` also includes an endpoint for the client to fetch its own permissions. This is not an admin-only endpoint and can be called by any authenticated user.

#### `GET /me/permissions`

This endpoint is crucial for the frontend application to dynamically show or hide features based on the user's role.

```bash
curl 'http://127.0.0.1:54321/functions/v1/admin-api/me/permissions' \
-H "Authorization: Bearer $SUPABASE_TOKEN"
```

- **Expected Result:** A `200 OK` response with a JSON object containing a list of the user's permissions, like `{"permissions":["ai_action:chat", "ai_action:summarize", ...]}`.

### Step 5: Test the Admin API

These endpoints are protected and can only be accessed by users with the `admin` role.

1.  **Make your user an admin:**
    - In the `profiles` table in Supabase Studio, change your test user's `role` to `admin`. Ensure you are using the JWT for this admin user.

#### `GET /users`

This endpoint lists all users and their assigned roles.

```bash
curl 'http://127.0.0.1:54321/functions/v1/admin-api/users' \
-H "Authorization: Bearer $SUPABASE_TOKEN"
```

- **Expected Result:** A `200 OK` response with a JSON array of all users. Note the `id` of a non-admin user from this list to use in the next steps. Let's call it `TARGET_USER_ID`.
- **For non-admin users:** A `403 Forbidden` error.

#### `POST /users/{id}/role`

This endpoint updates the role of a specific user.

1.  Get a `TARGET_USER_ID` from the `GET /users` output.
2.  Execute the request to change the user's role (e.g., to `pro`).

```bash
# Replace TARGET_USER_ID with a real user ID
export TARGET_USER_ID="paste_the_user_id_here"

curl -X POST "http://127.0.0.1:54321/functions/v1/admin-api/users/${TARGET_USER_ID}/role" \
-H "Authorization: Bearer $SUPABASE_TOKEN" \
-H "Content-Type: application/json" \
-d '{"role": "pro"}'
```

- **Expected Result:** A `200 OK` response with `{"success":true}` and the updated user profile object. You can verify the change in the `profiles` table in Supabase Studio.
- **For non-admin users:** A `403 Forbidden` error.

#### `GET /users/{id}/usage`

This endpoint retrieves the action logs for a specific user.

1.  Get a `TARGET_USER_ID` from the `GET /users` output.
2.  Execute the request:

```bash
# Replace TARGET_USER_ID with a real user ID
export TARGET_USER_ID="paste_the_user_id_here"

curl "http://127.0.0.1:54321/functions/v1/admin-api/users/${TARGET_USER_ID}/usage" \
-H "Authorization: Bearer $SUPABASE_TOKEN"
```

- **Expected Result:** A `200 OK` response with a JSON array of the user's action logs.
- **For non-admin users:** A `403 Forbidden` error.

