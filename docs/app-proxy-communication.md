# App/Proxy Communication Architecture

This document outlines the real-time communication pipeline between the frontend application (`@apps/app_old`) and the WebSocket server (`@apps/proxy`), which is responsible for handling audio streaming and AI transcription.

## 1. Overview: WebSocket-Based Pipeline

The architecture relies on a persistent WebSocket connection for low-latency, bidirectional communication. The client captures audio, sends it to the proxy, which then forwards it to the Google Gemini AI streaming API. The AI's transcription results are then streamed back to the client through the same WebSocket connection.

## 2. Client-Side Audio Capture and Processing

The client-side logic is primarily managed by React hooks and a dedicated WebSocket client.

### 2.1. `useScreenShare.ts` & `useSegmentRecorder.ts`

- **Audio Source**: The process begins in the `useScreenShare` hook, which uses the standard Web API `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` to capture both screen content and system audio.
- **Microphone**: A separate call to `navigator.mediaDevices.getUserMedia({ audio: true })` is made by `useSegmentRecorder` to capture the user's microphone.
- **Segmentation**: The `useSegmentRecorder` hook uses the `MediaRecorder` API to record audio. It is configured to slice the audio into segments of a fixed duration (e.g., every 20 seconds, defined by `SEGMENT_MS`).
- **Chunking**: Internally, the `MediaRecorder` provides data in smaller chunks (e.g., every 1 second). These chunks are collected, and when a full segment is ready, it is dispatched as a custom browser event (`mic_segment`).

### 2.2. `geminiClient.ts`

This class encapsulates all WebSocket communication logic.

- **Connection**: It establishes and maintains a WebSocket connection to the proxy server (e.g., `ws://localhost:4567`). It includes logic for automatic reconnection with exponential backoff.
- **Configuration**: Upon connecting, it sends initial configuration messages to the proxy, including the desired `mode` (e.g., 'transcription'), `language`, and any custom prompts.
- **Sending Audio**: It exposes a `sendMediaChunk` method. The React components listen for the audio segment events, read the audio `Blob` as a base64-encoded string, and send it to the proxy via this method.
- **Message Format**: The audio data is sent as a JSON string with the following structure:
  ```json
  {
    "type": "media_chunk",
    "mimeType": "audio/pcm", // Or another supported format
    "chunk": "base64-encoded-audio-data"
  }
  ```
- **Receiving Transcriptions**: The client listens for `onmessage` events from the WebSocket. The proxy server sends back JSON objects containing the transcription text. The client then parses this and updates the UI.

## 3. Proxy Server (`startProxy.js`)

The proxy server is a crucial intermediary that protects the Google AI API key and manages the streaming connection.

- **WebSocket Server**: It runs a Node.js WebSocket server (using the `ws` library) to accept client connections.
- **Client Management**: It maintains a map of connected clients, tracking their state (mode, language, etc.) and last activity time to clean up inactive connections.
- **Connection to Gemini**: For each connected client, the proxy establishes its own persistent WebSocket connection to the Google Gemini streaming API (`wss://generativelanguage.googleapis.com/...`).
- **Audio Forwarding**: When the proxy receives a `media_chunk` message from a client, it forwards the base64 audio data to the corresponding Gemini WebSocket connection.
- **Response Streaming**: As the Gemini API processes the audio and sends back real-time transcription results, the proxy server receives these messages, wraps them in its own JSON structure, and forwards them immediately to the appropriate client.

This architecture effectively decouples the frontend from the AI service provider, enhances security by hiding the API key, and provides a robust real-time communication channel for transcription.
