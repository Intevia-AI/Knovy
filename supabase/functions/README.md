# Supabase Edge Functions API Specification

This document outlines the standardized API contract for all AI-driven Edge Functions in this project. To ensure consistency and maintainability, all `ai-action-*` functions MUST adhere to this specification.

## Unified Request Payload

All AI action functions accept a `POST` request with a JSON body containing the following unified structure. All fields are optional, but at least one relevant field must be provided for the action to succeed.

```json
{
  "text_input": "string | null",
  "message_history": "Array<{role: 'user' | 'assistant', content: 'string'}> | null",
  "image_input": "string (Base64-encoded) | null",
  "language": "string (e.g., 'en-US', 'zh-TW') | null"
}
```

### Field Descriptions

- **`text_input`**: Used for single text inputs, such as content for summarization, a query for a keyword search, or a prompt accompanying an image.
- **`message_history`**: An array of message objects representing a conversation history. Used for actions that require conversational context, like `recommend-response`.
- **`image_input`**: A Base64-encoded string representing an image. Used for multi-modal actions like `screenshot-analysis`.
- **`language`**: The locale of the user to help the AI provide culturally and linguistically appropriate responses.

## Action-Specific Payload Mapping

The following table details which fields should be used for each specific AI action.

| Function Name                  | Required Field(s)     | Optional Field(s) | Description                                                                 |
| ------------------------------ | --------------------- | ----------------- | --------------------------------------------------------------------------- |
| `ai-action-summarize`          | `text_input`          | `language`        | Summarizes the text provided in `text_input`.                               |
| `ai-action-keyword-search`     | `text_input`          | `language`        | Extracts keywords from the text provided in `text_input`.                   |
| `ai-action-recommend-response` | `message_history`     | `language`        | Recommends a response based on the provided `message_history`.              |
| `ai-action-screenshot-analysis`| `image_input`         | `text_input`      | Analyzes the image in `image_input`. `text_input` can be used for a prompt. |

## Authentication

All requests to these functions MUST include a valid JWT in the `Authorization` header:

`Authorization: Bearer <SUPABASE_JWT>`

Requests without a valid token will be rejected with a `401 Unauthorized` error.
