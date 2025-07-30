# API Reference Documentation

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

This document provides detailed information about the API endpoints available in the Intevia AI application.

## Table of Contents

1. [AI Service](#ai-service)
2. [Process Audio](#process-audio)
3. [Feedback](#feedback)
4. [WebSocket Proxy](#websocket-proxy)

## AI Service

> 【產品專用 | App Only】
> 此區塊API僅供AI產品（Web App/Electron App）使用，負責與Google Gemini AI互動。

The AI Service provides an interface to interact with Google's Gemini AI model.

### POST /api/ai

Processes messages and generates responses using Google's Gemini model.

#### Request

```json
{
  "messages": [{ "role": "user", "content": "What is machine learning?" }],
  "data": {
    "text": "Optional text data",
    "timestamp": 1626984512345,
    "screenshot": "base64-encoded-image-data"
  },
  "action": "analyze"
}
```

| Field             | Type   | Description                                               |
| ----------------- | ------ | --------------------------------------------------------- |
| `messages`        | Array  | Array of message objects with role and content properties |
| `data`            | Object | Optional additional data for the request                  |
| `data.text`       | String | Optional text data                                        |
| `data.timestamp`  | Number | Optional timestamp for the request                        |
| `data.screenshot` | String | Optional base64-encoded screenshot image                  |
| `action`          | String | Optional action to perform (e.g., "analyze", "summarize") |

#### Response

```json
{
  "id": "ai-1626984512345",
  "role": "assistant",
  "content": "Machine learning is a subset of artificial intelligence..."
}
```

| Field     | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `id`      | String | Unique identifier for the response  |
| `role`    | String | Always "assistant" for AI responses |
| `content` | String | The AI-generated text response      |

#### Error Response

```json
{
  "error": "Failed to process AI request: Invalid message format"
}
```

| Status Code | Description                                    |
| ----------- | ---------------------------------------------- |
| 500         | Internal server error or AI processing failure |

#### CORS Support

The endpoint supports CORS with the OPTIONS method for preflight requests.

## Process Audio

> 【產品專用 | App Only】
> 此區塊API僅供AI產品（Web App/Electron App）使用，負責音訊處理與格式轉換。

The Process Audio service handles audio file processing, including trimming and format conversion.

### POST /api/process-audio

Processes audio files by trimming and converting to WAV format.

#### Request

```json
{
  "audioData": "base64-encoded-audio-data",
  "originalMimeType": "audio/webm"
}
```

| Field              | Type   | Description                          |
| ------------------ | ------ | ------------------------------------ |
| `audioData`        | String | Base64 encoded audio blob            |
| `originalMimeType` | String | MIME type of the original audio blob |

#### Response

```json
{
  "processedAudioData": "base64-encoded-wav-data",
  "processedMimeType": "audio/wav"
}
```

| Field                | Type   | Description                                           |
| -------------------- | ------ | ----------------------------------------------------- |
| `processedAudioData` | String | Base64 encoded processed audio data in WAV format     |
| `processedMimeType`  | String | MIME type of the processed audio (always "audio/wav") |

#### Error Response

```json
{
  "error": "Audio processing failed: Missing audioData"
}
```

| Status Code | Description                                 |
| ----------- | ------------------------------------------- |
| 400         | Bad request (missing required fields)       |
| 500         | Internal server error or processing failure |

## Feedback

> 【官網專用 | Web Only】
> 此區塊API僅供公司首頁（官網）用戶回饋功能使用，與AI產品無關。

The Feedback service handles user feedback submissions via email.

### POST /api/feedback

Submits user feedback via email.

#### Request

```json
{
  "feedback": "I really like the new feature, but I found a bug when..."
}
```

| Field      | Type   | Description                     |
| ---------- | ------ | ------------------------------- |
| `feedback` | String | The feedback text from the user |

#### Response

```json
{
  "message": "Feedback sent successfully"
}
```

| Field     | Type   | Description     |
| --------- | ------ | --------------- |
| `message` | String | Success message |

#### Error Response

```json
{
  "message": "Error sending feedback"
}
```

| Status Code | Description                                    |
| ----------- | ---------------------------------------------- |
| 500         | Internal server error or email sending failure |

## WebSocket Proxy

> 【產品專用 | App Only】
> 此區塊API僅供AI產品（Web App/Electron App）使用，負責即時語音串流與AI互動。

The WebSocket Proxy service provides real-time communication with Google's Gemini AI model for audio transcription and analysis.

### WebSocket Connection

Connect to the WebSocket proxy server at the configured URL (typically `wss://intevia-api.adastra.tw` or a local development URL).

#### Connection Messages

##### Mode

Changes the AI operation mode.

```json
{
  "type": "mode",
  "mode": "transcription"
}
```

| Field  | Type   | Description                                           |
| ------ | ------ | ----------------------------------------------------- |
| `type` | String | Message type, must be "mode"                          |
| `mode` | String | AI operation mode ("transcription" or "conversation") |

##### Custom Prompt

Sets a custom system prompt for the AI.

```json
{
  "type": "custom_prompt",
  "prompt": "You are a helpful assistant."
}
```

| Field    | Type   | Description                           |
| -------- | ------ | ------------------------------------- |
| `type`   | String | Message type, must be "custom_prompt" |
| `prompt` | String | The custom prompt for the AI          |

##### Language

Sets the preferred language for responses.

```json
{
  "type": "language",
  "language": "en-US"
}
```

| Field      | Type   | Description                             |
| ---------- | ------ | --------------------------------------- |
| `type`     | String | Message type, must be "language"        |
| `language` | String | The preferred language for AI responses |

##### Media Chunk

Forwards audio data to Gemini.

```json
{
  "type": "media_chunk",
  "mimeType": "audio/pcm",
  "chunk": "base64-encoded-audio-data"
}
```

| Field      | Type   | Description                         |
| ---------- | ------ | ----------------------------------- |
| `type`     | String | Message type, must be "media_chunk" |
| `mimeType` | String | MIME type of the audio data         |
| `chunk`    | String | Base64 encoded audio data           |

##### Disconnect

Closes the connection to the Gemini API.

```json
{
  "type": "disconnect"
}
```

| Field  | Type   | Description                        |
| ------ | ------ | ---------------------------------- |
| `type` | String | Message type, must be "disconnect" |

#### Response Messages

##### Setup Complete

Indicates that the connection to Gemini has been established and the initial setup is complete.

```json
{
  "setupComplete": true
}
```

##### Transcription/Analysis Result

The server will send messages with transcription results.

```json
{
  "text": "TRANSCRIPTION: [transcribed text]\nKEYWORDS: [keywords]",
  "turnComplete": false
}
```

| Field          | Type    | Description                       |
| -------------- | ------- | --------------------------------- |
| `text`         | String  | The transcribed text and keywords |
| `turnComplete` | Boolean | Whether the AI's turn is complete |

##### Error

Sent if Gemini returns an error.

```json
{
  "error": "Error message from Gemini"
}
```
