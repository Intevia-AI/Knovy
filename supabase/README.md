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

### Step 3: Test the Admin API

1.  **Make your user an admin:**
    - In the `profiles` table in Supabase Studio, change your test user's `role` to `admin`.
2.  **Execute the admin request:**
    ```bash
    curl 'http://127.0.0.1:54321/functions/v1/admin-api/users' \
    -H "Authorization: Bearer $SUPABASE_TOKEN"
    ```
3.  **Expected Result:** A `200 OK` response with a JSON array of all users in your database.

If you repeat this last step with a non-admin user's token, you will correctly receive a `403 Forbidden` error.
