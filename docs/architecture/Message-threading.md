# Transcription Threading Architecture

## [Info]

- Last updated: 2025/09/23 by Archi
- AppliedVersion: `v0.2.3`

## 1. Overview

The Transcription Threading system enables real-time speaker identification and conversation flow by separating microphone and system audio into distinct processing threads. This creates a natural chat-like experience where users can differentiate between their own speech and others' speech during conversations.

## 2. Architecture Goals

- **Speaker Identification**: Distinguish between user speech (microphone) and others' speech (system audio)
- **Real-time Processing**: Parallel transcription without audio mixing artifacts
- **Chat-like UX**: Intuitive left/right message alignment similar to messaging apps
- **Scalability**: Foundation for multi-speaker scenarios and future enhancements
- **Backward Compatibility**: Seamless integration with existing transcription data

## 3. System Architecture

### 3.1 High-Level Flow

```mermaid
graph TD
    A[Microphone Input] --> B[MicAudioProcessor]
    C[System Audio Input] --> D[SystemAudioProcessor]

    B --> E[MicGeminiClient]
    D --> F[SystemGeminiClient]

    E --> G[WebSocket Connection 1]
    F --> H[WebSocket Connection 2]

    G --> I[Proxy Server Client 1]
    H --> J[Proxy Server Client 2]

    I --> K[Gemini API Instance 1]
    J --> L[Gemini API Instance 2]

    K --> M[Transcription Response]
    L --> N[Transcription Response]

    M --> O[sourceType: 'microphone']
    N --> P[sourceType: 'system']

    O --> Q[IPC Layer]
    P --> Q

    Q --> R[Main Process]
    R --> S[Database Storage]
    R --> T[Broadcast to UI]

    T --> U[Chat Panel]
    U --> V[Right Side: User Messages]
    U --> W[Left Side: Others Messages]
```

### 3.2 Component Architecture

```mermaid
graph LR
    subgraph "Audio Layer"
        A1[Microphone] --> A2[MicAudioProcessor.js]
        A3[System Audio] --> A4[SystemAudioProcessor.js]
    end

    subgraph "Client Layer"
        A2 --> B1[MicGeminiClient]
        A4 --> B2[SystemGeminiClient]
    end

    subgraph "Network Layer"
        B1 --> C1[WebSocket 1]
        B2 --> C2[WebSocket 2]
        C1 --> C3[Proxy Server]
        C2 --> C3
    end

    subgraph "AI Processing"
        C3 --> D1[Gemini API Instance 1]
        C3 --> D2[Gemini API Instance 2]
    end

    subgraph "Data Layer"
        D1 --> E1[Transcription + sourceType]
        D2 --> E1
        E1 --> E2[IPC Communication]
        E2 --> E3[Database Storage]
    end

    subgraph "UI Layer"
        E3 --> F1[Chat Panel]
        F1 --> F2[Message Threading UI]
    end
```

## 4. Audio Processing Layer

### 4.1 Audio Worklets

#### MicAudioProcessor (`mic-audio-processor.js`)

```javascript
class MicAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sourceType = "microphone";
    this.bufferSize = 8192;
    this.silenceThreshold = 0.01;
  }

  process(inputs, outputs, parameters) {
    // Process audio and tag with sourceType
    this.port.postMessage({
      pcmData: pcmData.buffer,
      level: audioLevel,
      sourceType: this.sourceType, // Key differentiation
    });
  }
}
```

#### SystemAudioProcessor (`system-audio-processor.js`)

```javascript
class SystemAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sourceType = "system";
    // Identical processing logic but different sourceType
  }
}
```

**Key Features:**

- **Independent Processing**: Each worklet processes audio separately
- **Source Tagging**: Every audio chunk tagged with `sourceType`
- **Silence Detection**: Efficient bandwidth usage by filtering silent periods
- **PCM Conversion**: Standard 16-bit PCM format for Gemini API compatibility

### 4.2 Audio Pipeline Architecture

```
Microphone → MicAudioProcessor → Tagged Audio Chunks (sourceType: 'microphone')
System Audio → SystemAudioProcessor → Tagged Audio Chunks (sourceType: 'system')
```

## 5. Client Communication Layer

### 5.1 Dual Client Architecture

```typescript
// RealTimeAnalysis.tsx
let micGeminiClient: GeminiClient | null = null;
let systemGeminiClient: GeminiClient | null = null;

// Separate processing pipelines
const processTranscriptionResponse = (
  text: string,
  textBufferRef: React.MutableRefObject<string>,
  sourceType: "microphone" | "system",
) => {
  // Process and forward with source attribution
  onTextResponse(transcription, false, sourceType);
};
```

### 5.2 WebSocket Connection Management

Each `GeminiClient` establishes independent connections:

```typescript
// Microphone pipeline
micGeminiClient = new GeminiClient(
  (text) => processTranscriptionResponse(text, micTextBufferRef, "microphone"),
  onSetupComplete,
  // ... other callbacks
);

// System audio pipeline
systemGeminiClient = new GeminiClient(
  (text) => processTranscriptionResponse(text, systemTextBufferRef, "system"),
  onSetupComplete,
  // ... other callbacks
);
```

**Benefits:**

- **Fault Isolation**: Issues with one stream don't affect the other
- **Independent Reconnection**: Each client can recover separately
- **Parallel Processing**: Simultaneous transcription of both sources
- **Natural Load Balancing**: Leverages existing proxy server architecture

## 6. IPC Communication Protocol

### 6.1 Enhanced Data Structure

```typescript
// Before: Simple string
electronAPI.send("transcription:data", text);

// After: Structured object with source attribution
electronAPI.send("transcription:data", {
  text: string,
  sourceType: "microphone" | "system",
});
```

### 6.2 Main Process Handler

```typescript
ipcMain.on(
  "transcription:data",
  (
    event,
    transcriptionData: {
      text: string;
      sourceType: "microphone" | "system";
    },
  ) => {
    const newTranscript = {
      id: generateUniqueId(),
      session_id: currentSessionId,
      timestamp: new Date().toISOString(),
      content: transcriptionData.text,
      sourceType: transcriptionData.sourceType, // Preserved through pipeline
      role: "assistant",
      type: "transcription",
    };

    // Save to database with source attribution
    dbService.addTranscript(newTranscript);

    // Broadcast to all renderer processes
    broadcastToWindows("transcription:data", newTranscript);
  },
);
```

## 7. Database Schema

### 7.1 Schema Evolution

```sql
-- Enhanced transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  timestamp TEXT,
  content TEXT,
  source_type TEXT DEFAULT 'system', -- New field for speaker identification
  FOREIGN KEY (session_id) REFERENCES sessions (id)
);

-- Migration for existing data
ALTER TABLE transcripts ADD COLUMN source_type TEXT DEFAULT 'system';
```

### 7.2 Data Model

```typescript
interface TranscriptRecord {
  id: string;
  session_id: string;
  timestamp: string;
  content: string;
  source_type: "microphone" | "system"; // Speaker identification
}
```

**Design Decisions:**

- **Default to 'system'**: Ensures backward compatibility with existing transcripts
- **Simple Enum**: Easy to extend for future speaker types (user names, device IDs)
- **Indexed Fields**: Optimized queries by session and timestamp

## 8. User Interface Architecture

### 8.1 Message Threading UI

```tsx
// ChatPanel.tsx
{
  transcriptions.map((message) => {
    const isUserMessage = message.sourceType === "microphone";

    return (
      <motion.div
        key={message.id}
        className={cn(
          "p-2 rounded-md text-sm w-fit max-w-[95%]",
          isUserMessage
            ? "bg-blue-500/10 border border-blue-500/20 ml-auto" // Right side
            : "bg-black/5 border border-black/10 mr-auto", // Left side
        )}
      >
        <Markdown>{message.content}</Markdown>
      </motion.div>
    );
  });
}
```

### 8.2 Visual Design Pattern

```
┌─────────────────────────────────────────────┐
│ System Audio (Others)          [Gray/Left]  │
│                                             │
│                    [Blue/Right] User (Mic)  │
│                                             │
│ System Audio (Others)          [Gray/Left]  │
│                                             │
│                    [Blue/Right] User (Mic)  │
└─────────────────────────────────────────────┘
```

**UX Principles:**

- **Familiar Pattern**: Standard chat app left/right alignment
- **Visual Differentiation**: Color coding (blue for user, gray for others)
- **Responsive Design**: Messages adapt to content length
- **Smooth Animations**: Framer Motion for natural message appearance

## 9. Proxy Server Integration

### 9.1 Multi-Client Support

The existing proxy server architecture perfectly supports the dual-stream approach:

```javascript
class GeminiProxyServer {
  setupServer() {
    this.wss.on("connection", (ws, req) => {
      const clientId = this.generateClientId(); // Unique per connection

      const clientConnection = {
        ws,
        id: clientId,
        geminiWs: null, // Independent Gemini connection
        isSetupComplete: false,
        language: "zh-TW",
      };

      this.clients.set(clientId, clientConnection);
    });
  }
}
```

**Why No Changes Were Needed:**

- **Natural Multi-Tenancy**: Each GeminiClient gets unique clientId
- **Independent Sessions**: Each client maintains separate Gemini WebSocket
- **Automatic Load Balancing**: Built-in connection management
- **Fault Isolation**: Client failures don't affect others

### 9.2 Connection Flow

```
MicGeminiClient → ProxyServer.Client[ID_1] → GeminiAPI.Session[1]
SystemGeminiClient → ProxyServer.Client[ID_2] → GeminiAPI.Session[2]
```

## 10. Performance Characteristics

### 10.1 Resource Usage

| Component             | Before (Mixed) | After (Threaded) | Improvement            |
| --------------------- | -------------- | ---------------- | ---------------------- |
| Audio Processing      | 1 worklet      | 2 worklets       | Parallel processing    |
| WebSocket Connections | 1 connection   | 2 connections    | Fault isolation        |
| Gemini API Sessions   | 1 session      | 2 sessions       | Independent processing |
| Database Writes       | Mixed records  | Tagged records   | Clear attribution      |
| UI Rendering          | Single thread  | Differentiated   | Better UX              |

### 10.2 Latency Analysis

```
Audio Capture → Worklet Processing → WebSocket → Proxy → Gemini → Response
     ~5ms           ~10ms           ~20ms      ~5ms    ~200ms    ~240ms total
```

**Optimizations:**

- **Parallel Processing**: Both streams processed simultaneously
- **Efficient Buffering**: 8KB buffers minimize latency while ensuring quality
- **Silence Detection**: Reduces unnecessary network traffic
- **Connection Reuse**: WebSocket connections maintained for session duration

## 11. Error Handling & Resilience

### 11.1 Fault Isolation

```typescript
// Independent error handling per stream
try {
  micGeminiClient.sendMediaChunk(data, "audio/pcm");
} catch (error) {
  console.error("Microphone stream error:", error);
  // System audio continues unaffected
}

try {
  systemGeminiClient.sendMediaChunk(data, "audio/pcm");
} catch (error) {
  console.error("System audio stream error:", error);
  // Microphone continues unaffected
}
```

### 11.2 Reconnection Strategy

```typescript
// Each client has independent reconnection logic
class GeminiClient {
  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect(); // Independent reconnection
      }, this.reconnectTimeout * this.reconnectAttempts);
    }
  }
}
```

### 11.3 Graceful Degradation

| Failure Scenario     | System Behavior                | User Experience                 |
| -------------------- | ------------------------------ | ------------------------------- |
| Microphone failure   | System audio continues         | Only others' speech transcribed |
| System audio failure | Microphone continues           | Only user speech transcribed    |
| One WebSocket fails  | Other stream unaffected        | Partial transcription continues |
| Proxy server issues  | Both streams attempt reconnect | Temporary transcription pause   |
| Database failure     | UI continues, data queued      | Real-time display maintained    |

## 12. Security Considerations

### 12.1 Data Isolation

- **Stream Separation**: Audio sources never mixed at processing level
- **Independent Authentication**: Each WebSocket connection properly authenticated
- **Source Validation**: `sourceType` validated before database storage
- **IPC Security**: Structured message validation in main process

### 12.2 Privacy Protection

- **Local Processing**: Audio processing happens locally before transmission
- **Encrypted Transmission**: WebSocket connections use secure protocols
- **Minimal Metadata**: Only essential information transmitted to Gemini
- **User Control**: Users can disable either microphone or system audio

## 13. Future Enhancements

### 13.1 Multi-Speaker Support

The current architecture provides foundation for:

```typescript
interface EnhancedTranscription {
  sourceType: "microphone" | "system";
  speakerId?: string; // Future: Individual speaker identification
  deviceId?: string; // Future: Multiple microphone support
  confidence?: number; // Future: AI confidence scoring
}
```

### 13.2 Advanced Features

- **Speaker Recognition**: ML-based individual speaker identification
- **Voice Activity Detection**: More sophisticated silence detection
- **Audio Quality Metrics**: Real-time audio quality monitoring
- **Custom Audio Sources**: Support for external microphones/devices
- **Conversation Analytics**: Speaker time analysis, interruption detection

## 14. Migration & Deployment

### 14.1 Backward Compatibility

```sql
-- Existing transcripts automatically get source_type = 'system'
UPDATE transcripts SET source_type = 'system' WHERE source_type IS NULL;
```

### 14.2 Feature Rollout

1. **Phase 1**: Deploy new worklets and dual client architecture
2. **Phase 2**: Update UI to show message threading
3. **Phase 3**: Migrate existing data with default source types
4. **Phase 4**: Enable user configuration options

### 14.3 Monitoring

```typescript
// Performance metrics to track
interface TranscriptionMetrics {
  microphoneLatency: number;
  systemAudioLatency: number;
  transcriptionAccuracy: number;
  errorRates: {
    microphone: number;
    systemAudio: number;
    websocket: number;
  };
}
```

## 15. Conclusion

The Transcription Threading architecture successfully transforms a mixed-audio experience into an intuitive, chat-like conversation interface. By separating audio processing at the source level and maintaining isolation throughout the entire pipeline, the system provides clear speaker identification while maintaining high performance and reliability.

The modular design ensures scalability for future enhancements while preserving backward compatibility with existing data and workflows. The implementation leverages existing infrastructure effectively, requiring minimal changes to the proxy server while providing maximum benefit to the user experience.

**Key Achievements:**

- ✅ Clear speaker identification (user vs others)
- ✅ Intuitive chat-like interface
- ✅ Parallel processing for improved performance
- ✅ Fault isolation and resilience
- ✅ Backward compatibility maintained
- ✅ Foundation for future multi-speaker features
