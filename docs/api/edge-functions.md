# Supabase Edge Function API Contracts

This document defines the API contracts for the stateless AI action Edge Functions. All functions require a valid Supabase JWT in the `Authorization` header.

---

## 1. Summarize Text

- **Function Name**: `ai-action-summarize`
- **Method**: `POST`
- **Description**: Receives a block of text and returns a concise summary.

### Request Body

```json
{
  "text": "<string>"
}
```

### Success Response (200 OK)

```json
{
  "summary": "<string>"
}
```

### Error Response (400/500)

```json
{
  "error": "<string>"
}
```

---

## 2. Keyword Search

- **Function Name**: `ai-action-keyword-search`
- **Method**: `POST`
- **Description**: Receives a block of text and extracts key terms and concepts.

### Request Body

```json
{
  "text": "<string>"
}
```

### Success Response (200 OK)

```json
{
  "keywords": [
    "<string>",
    "<string>"
  ]
}
```

---

## 3. Recommend Response

- **Function Name**: `ai-action-recommend-response`
- **Method**: `POST`
- **Description**: Receives a conversation history and provides a suggested next response.

### Request Body

```json
{
  "messages": [
    {
      "role": "user",
      "content": "<string>"
    },
    {
      "role": "assistant",
      "content": "<string>"
    }
  ]
}
```

### Success Response (200 OK)

```json
{
  "recommendation": "<string>"
}
```

---

## 4. Screenshot Analysis

- **Function Name**: `ai-action-screenshot-analysis`
- **Method**: `POST`
- **Description**: Receives a text prompt and a base64-encoded screenshot for analysis.

### Request Body

```json
{
  "prompt": "<string>",
  "screenshot": "<string (base64)>"
}
```

### Success Response (200 OK)

```json
{
  "analysis": "<string>"
}
```
