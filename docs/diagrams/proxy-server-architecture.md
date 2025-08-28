# Proxy Server Architecture Diagram

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

## Overall Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        EA[Electron App]
        WA[Web App]
        OC[Other Clients]
    end

    subgraph "Proxy Server Core"
        WSS[WebSocket Server]
        CM[Client Manager]
        RL[Rate Limiter]
        AM[Activity Monitor]
        EV[Environment Validator]
    end

    subgraph "Connection Management"
        CC[Client Connections]
        GC[Gemini Connections]
        HB[Heartbeat Monitor]
        CL[Connection Cleanup]
    end

    subgraph "Message Processing"
        MP[Message Parser]
        MR[Message Router]
        MF[Message Forwarder]
        ER[Error Handler]
    end

    subgraph "Google Gemini AI"
        GA[Gemini API]
        RT[Real-time Model]
        TR[Transcription]
        CV[Conversation]
    end

    EA --> WSS
    WA --> WSS
    OC --> WSS

    WSS --> CM
    WSS --> RL
    WSS --> AM
    WSS --> EV

    CM --> CC
    CM --> GC
    CM --> HB
    CM --> CL

    WSS --> MP
    MP --> MR
    MR --> MF
    MR --> ER

    MF --> GA
    GA --> RT
    RT --> TR
    RT --> CV

    style WSS fill:#e1f5fe
    style CM fill:#f3e5f5
    style GA fill:#e8f5e8
    style MP fill:#fff3e0
```

## WebSocket Communication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant P as Proxy Server
    participant G as Gemini AI

    C->>P: WebSocket Connection
    P->>P: Rate Limit Check
    P->>P: Generate Client ID
    P->>P: Setup Activity Monitor

    C->>P: Set Mode/Language/Prompt
    P->>P: Store Client Config

    C->>P: Send Audio Chunk
    P->>G: Connect to Gemini (if needed)
    P->>G: Forward Audio Data
    G-->>P: AI Response
    P-->>C: Forward Response

    loop Continuous Processing
        C->>P: Audio Chunks
        P->>G: Process Audio
        G-->>P: Transcription/Response
        P-->>C: Real-time Results
    end

    C->>P: Disconnect
    P->>P: Cleanup Client
    P->>G: Close Gemini Connection
```

## Client Management System

```mermaid
graph TD
    subgraph "Client Lifecycle"
        NC[New Connection]
        ID[Generate ID]
        RL[Rate Limit Check]
        REG[Register Client]
        MON[Monitor Activity]
        CL[Cleanup]
    end

    subgraph "Client State"
        CS[Client Settings]
        GS[Gemini Connection]
        AM[Activity Metrics]
        CF[Configuration]
    end

    subgraph "Connection Pool"
        AC[Active Clients]
        IC[Inactive Clients]
        GC[Gemini Connections]
        CC[Connection Count]
    end

    NC --> ID
    ID --> RL
    RL --> REG
    REG --> MON
    MON --> CL

    REG --> CS
    REG --> GS
    REG --> AM
    REG --> CF

    CS --> AC
    AM --> IC
    GS --> GC
    REG --> CC

    style NC fill:#e3f2fd
    style CS fill:#f1f8e9
    style AC fill:#fce4ec
```

## Message Processing Pipeline

```mermaid
flowchart TD
    subgraph "Incoming Messages"
        WS[WebSocket Message]
        JSON[JSON Parse]
        VAL[Validation]
    end

    subgraph "Message Types"
        MODE[Mode Setting]
        PROMPT[Custom Prompt]
        LANG[Language Setting]
        AUDIO[Audio Chunk]
        DISC[Disconnect]
    end

    subgraph "Processing Logic"
        CONFIG[Update Config]
        SETUP[Setup Gemini]
        FORWARD[Forward to Gemini]
        CLEANUP[Cleanup Client]
    end

    subgraph "Gemini Integration"
        CONN[Gemini Connection]
        SEND[Send Message]
        RECV[Receive Response]
        PARSE[Parse Response]
    end

    subgraph "Response Handling"
        TRANS[Transcription]
        KEYWORDS[Keywords]
        ERROR[Error Handling]
        FORWARD_RESP[Forward to Client]
    end

    WS --> JSON
    JSON --> VAL

    VAL --> MODE
    VAL --> PROMPT
    VAL --> LANG
    VAL --> AUDIO
    VAL --> DISC

    MODE --> CONFIG
    PROMPT --> CONFIG
    LANG --> CONFIG
    AUDIO --> FORWARD
    DISC --> CLEANUP

    CONFIG --> SETUP
    FORWARD --> CONN
    CONN --> SEND
    SEND --> RECV
    RECV --> PARSE

    PARSE --> TRANS
    PARSE --> KEYWORDS
    PARSE --> ERROR
    TRANS --> FORWARD_RESP
    KEYWORDS --> FORWARD_RESP
    ERROR --> FORWARD_RESP

    style WS fill:#e1f5fe
    style AUDIO fill:#e8f5e8
    style CONN fill:#fff3e0
    style TRANS fill:#f3e5f5
```

## Rate Limiting & Security

```mermaid
graph LR
    subgraph "Rate Limiting"
        IP[Client IP]
        TC[Time Window]
        CC[Connection Count]
        TH[Threshold Check]
    end

    subgraph "Security Measures"
        ENV[Environment Validation]
        API[API Key Security]
        CORS[CORS Headers]
        SSL[SSL/TLS]
    end

    subgraph "Monitoring"
        ACT[Activity Tracking]
        LOG[Logging]
        MET[Metrics Collection]
        ALT[Alerts]
    end

    subgraph "Cleanup"
        IDLE[Idle Detection]
        AUTO[Auto Cleanup]
        RES[Resource Management]
        GC[Garbage Collection]
    end

    IP --> TC
    TC --> CC
    CC --> TH

    ENV --> API
    API --> CORS
    CORS --> SSL

    ACT --> LOG
    LOG --> MET
    MET --> ALT

    IDLE --> AUTO
    AUTO --> RES
    RES --> GC

    style IP fill:#ffebee
    style ENV fill:#e8f5e8
    style ACT fill:#fff3e0
    style IDLE fill:#f3e5f5
```

## Docker Deployment Architecture

```mermaid
graph TB
    subgraph "Docker Container"
        APP[Node.js App]
        ENV[Environment Config]
        PORT[Port 4567]
        LOG[Logging]
    end

    subgraph "Container Features"
        ALPINE[Alpine Linux]
        USER[Non-root User]
        HEALTH[Health Checks]
        VOL[Volumes]
    end

    subgraph "External Connections"
        CLIENT[Client Apps]
        GEMINI[Gemini API]
        NET[Network]
    end

    subgraph "Production Setup"
        LB[Load Balancer]
        NGINX[Nginx Proxy]
        SSL[SSL Termination]
        MON[Monitoring]
    end

    APP --> ENV
    APP --> PORT
    APP --> LOG

    APP --> ALPINE
    APP --> USER
    APP --> HEALTH
    APP --> VOL

    PORT --> CLIENT
    APP --> GEMINI
    PORT --> NET

    NET --> LB
    LB --> NGINX
    NGINX --> SSL
    LB --> MON

    style APP fill:#e1f5fe
    style ALPINE fill:#e8f5e8
    style CLIENT fill:#fff3e0
    style LB fill:#f3e5f5
```
