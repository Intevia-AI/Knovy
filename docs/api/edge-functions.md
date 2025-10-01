# Supabase Edge Function API

This document provides a comprehensive specification for the Supabase Edge Functions that power the Knovy backend. All functions are stateless, secured via JWT, and use a role-based access control (RBAC) system to manage entitlements and quotas.

## 1. Authentication

All requests to protected Edge Functions MUST include a valid Supabase JWT in the `Authorization` header.

```
Authorization: Bearer <SUPABASE_JWT>
```

Requests without a valid token will be rejected with a `401 Unauthorized` error.

## 2. Core Services

### 2.1. Get Session Profile

This function is the cornerstone of the client-side experience, providing the user's role, settings, entitlements, and current quota usage in a single call.

- **Function Name**: `get-session-profile`
- **Method**: `GET`
- **Description**: Fetches a comprehensive session profile for the authenticated user, including their role, application settings, feature entitlements, and real-time quota usage.
- **Entitlement**: None. Accessible by any authenticated user.

**Success Response (200 OK)**

```json
{
  "user_id": "uuid",
  "role": "string", // e.g., \'free\', \'pro\', \'admin\'
  "app_settings": {
    "key": "value"
  },
  "entitlements": {
    "allow_transcription": true,
    "allow_ai_action:summarize": true,
    // ... other entitlements
  },
  "quotas": {
    "daily_transcription_minutes": {
      "limit": 120,
      "used": 45
    },
    "daily_ai_action:summarize_calls": {
      "limit": 100,
      "used": 12
    }
    // ... other quotas
  }
}
```

**`curl` Example**

```bash
curl \'http://127.0.0.1:54321/functions/v1/get-session-profile\' \
-H "Authorization: Bearer $SUPABASE_TOKEN"
```

### 2.2. Session Manager

This function handles logging of user actions and transcription duration for auditing and quota enforcement.

- **Function Name**: `session-manager`
- **Method**: `POST`
- **Description**: Logs different types of events, such as AI actions or transcription duration. The behavior is determined by the `log_type` field.
- **Entitlement**: None. Accessible by any authenticated user.

**Request Body (log_type: \'action\')**

```json
{
  "log_type": "action",
  "action_name": "<string>", // e.g., \'ai_action:summarize\'
  "metadata": {
    "key": "value"
  }
}
```

**Request Body (log_type: \'duration\')**

```json
{
  "log_type": "duration",
  "session_id": "uuid",
  "duration_seconds": "integer"
}
```

**Success Response (201/200 OK)**

```json
{
  "success": true,
  "message": "Action logged" // or "Duration upserted"
}
```

## 3. AI Actions

All AI action functions are protected by the `withEntitlements` middleware, which checks for a specific entitlement and enforces usage quotas.

### 3.1. Chat

- **Function Name**: `ai-action-chat`
- **Method**: `POST`
- **Description**: Answers a user's question based on conversation history.
- **Entitlement**: `allow_ai_action:chat`

**Request Body**

```json
{
  "text_input": "<string>", // User's question
  "previous_summary": "<string>", // Optional: Summary of the conversation so far
  "recent_transcriptions": "<string>", // Optional: Recent raw transcriptions
  "language": "<string>" // e.g., \'en-US\', \'zh-TW\'
}
```

**Success Response (200 OK)**

```json
{
  "response": "<string>", // AI-generated answer
  "usage": {
    "input_tokens": "integer",
    "output_tokens": "integer"
  }
}
```

### 3.2. Keyword Search

- **Function Name**: `ai-action-keyword-search`
- **Method**: `POST`
- **Description**: Provides a brief, concise summary of a given term.
- **Entitlement**: `allow_ai_action:keyword-search`

**Request Body**

```json
{
  "text_input": "<string>" // The term to be defined
}
```

**Success Response (200 OK)**

```json
{
  "response": "<string>", // AI-generated summary of the term
  "usage": {
    "input_tokens": "integer",
    "output_tokens": "integer"
  }
}
```

### 3.3. Recommend Response

- **Function Name**: `ai-action-recommend-response`
- **Method**: `POST`
- **Description**: Recommends a short response to a given piece of text.
- **Entitlement**: `allow_ai_action:recommend-response`

**Request Body**

```json
{
  "text_input": "<string>" // The text to respond to
}
```

**Success Response (200 OK)**

```json
{
  "recommendation": "<string>", // AI-generated response suggestion
  "usage": {
    "input_tokens": "integer",
    "output_tokens": "integer"
  }
}
```

### 3.4. Screenshot Analysis

- **Function Name**: `ai-action-screenshot-analysis`
- **Method**: `POST`
- **Description**: Analyzes a base64-encoded screenshot based on a text prompt.
- **Entitlement**: `allow_ai_action:screenshot-analysis`

**Request Body**

```json
{
  "text_input": "<string>", // The prompt for the analysis
  "image_input": "<string>" // Base64-encoded image string (e.g., \'data:image/jpeg;base64,...squo)
}
```

**Success Response (200 OK)**

```json
{
  "analysis": "<string>", // AI-generated analysis of the image
  "usage": {
    "input_tokens": "integer",
    "output_tokens": "integer"
  }
}
```

### 3.5. Summarize

- **Function Name**: `ai-action-summarize`
- **Method**: `POST`
- **Description**: Summarizes a block of text. Can also refine a previous summary with new transcripts.
- **Entitlement**: `allow_ai_action:summarize`

**Request Body**

```json
{
  "text_input": "<string>", // The text to summarize or new transcripts
  "previous_summary": "<string>" // Optional: The previous summary to refine
}
```

**Success Response (200 OK)**

```json
{
  "summary": "<string>", // The new or updated summary
  "usage": {
    "input_tokens": "integer",
    "output_tokens": "integer"
  }
}
```

### 3.6. Transcription Enhancement

- **Function Name**: `transcription-enhance`
- **Method**: `POST`
- **Description**: Enhances raw transcription text using Gemini API with intention detection, grammar correction, and keyword extraction. Supports smart batching for performance optimization.
- **Entitlement**: `allow_ai_action:transcription_enhance`
- **Quota**: `daily_ai_action:transcription_enhance_calls`

**Request Body**

```json
{
  "segments": [
    {
      "id": "string",           // Unique segment identifier
      "rawText": "string",      // Raw transcription text to enhance
      "timestamp": 1733043661000, // Unix timestamp in milliseconds
      "sourceType": "microphone | system" // Audio source type
    }
  ],
  "sessionContext": {
    "sessionId": "string",      // Session identifier for context tracking
    "conversationHistory": [    // Recent conversation for context (max 10 items)
      "string"
    ],
    "userLanguage": "en | zh-TW" // Target language for enhancement
  }
}
```

**Success Response (200 OK)**

```json
{
  "segments": [
    {
      "id": "string",             // Original segment ID
      "corrected": "string",      // Enhanced and corrected text
      "translation": "string",    // Translation if different from userLanguage (optional)
      "intention": {
        "primary": "question | command | statement | schedule | reminder | concern | request",
        "confidence": 0.95,       // Confidence score (0-1)
        "suggestedActions": [     // Suggested AI actions (optional)
          "ai-action-answer",
          "ai-action-schedule"
        ]
      },
      "keywords": [               // Technical/specialized terms (optional)
        "string"
      ],
      "confidence": 0.95          // Overall enhancement confidence (0-1)
    }
  ],
  "processingTime": 1250,         // Processing time in milliseconds
  "errors": [                     // Partial failures (optional)
    {
      "segmentId": "string",
      "error": "string"
    }
  ]
}
```

**Error Responses**

- **400 Bad Request**: Invalid request payload or missing required fields
- **403 Forbidden**: User lacks `allow_ai_action:transcription_enhance` entitlement
- **429 Too Many Requests**: Daily quota for `transcription_enhance_calls` exceeded
- **500 Internal Server Error**: Enhancement processing failed

**Features**

- **Smart Batching**: Processes up to 5 segments in parallel for optimal performance
- **Retry Logic**: Automatic retry with exponential backoff for API resilience
- **Context Awareness**: Uses conversation history for better enhancement accuracy
- **Intention Detection**: Identifies user intent for suggested AI actions
- **Multi-language Support**: Supports English and Traditional Chinese
- **Error Isolation**: Partial failures don't affect successful segment processing

**Testing**

```bash
# Test the function locally
cd supabase/functions/transcription-enhance
./test.sh local

# Example curl request
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "segments": [
      {
        "id": "test-1",
        "rawText": "hello this is a test with some errors",
        "timestamp": 1733043661000,
        "sourceType": "microphone"
      }
    ],
    "sessionContext": {
      "sessionId": "test-session",
      "conversationHistory": [],
      "userLanguage": "en"
    }
  }' \
  http://localhost:54321/functions/v1/transcription-enhance
```

## 4. Admin API

The Admin API provides endpoints for managing the platform. Access is restricted to users with the `admin` role.

- **Function Name**: `admin-api`
- **Base Path**: `/admin-api`

### 4.1. Get All Users

- **Endpoint**: `/users`
- **Method**: `GET`
- **Description**: Retrieves a list of all users and their assigned roles.
- **Entitlement**: `admin:read_users`

**Success Response (200 OK)**

```json
{
  "users": [
    {
      "id": "uuid",
      "role": "string",
      "email": "string"
    }
  ]
}
```

### 4.2. Update User Role

- **Endpoint**: `/users/{id}/role`
- **Method**: `POST`
- **Description**: Updates the role for a specific user.
- **Entitlement**: `admin:update_user_role`

**Request Body**

```json
{
  "role": "<string>" // The new role name (e.g., \'pro\')
}
```

**Success Response (200 OK)**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "role": "string",
    // ... other profile fields
  }
}
```

### 4.3. Get User Usage

- **Endpoint**: `/users/{id}/usage`
- **Method**: `GET`
- **Description**: Fetches the action audit log for a specific user.
- **Entitlement**: `admin:read_users`

**Success Response (200 OK)**

```json
{
  "logs": [
    {
      "id": "bigint",
      "user_id": "uuid",
      "action": "string",
      "timestamp": "timestamptz",
      "metadata": {}
    }
  ]
}
```

## 5. Public Functions

### 5.1. Add to Waitlist

This function is publicly accessible and does not require authentication.

- **Function Name**: `add-to-waitlist`
- **Method**: `POST`
- **Description**: Adds a user's email to the waitlist and sends a confirmation email.

**Request Body**

```json
{
  "email": "<string>",
  "locale": "<string>" // e.g., \'en\', \'zh-TW\'
}
```

**Success Response (200 OK)**

```json
{
  "message": "Successfully added to waitlist",
  "data": [ /* ... */ ],
  "emailStatus": { /* ... */ }
}
```

**Error Responses**
- `400 Bad Request`: Invalid email format.
- `409 Conflict`: Email is already on the waitlist.
```