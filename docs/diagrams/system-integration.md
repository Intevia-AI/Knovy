# System Integration Diagram

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

## Complete System Architecture

```mermaid
graph TB
    subgraph "User Interfaces"
        DESKTOP[Desktop App<br/>Electron]
        WEB[Web App<br/>Next.js]
        MOBILE[Mobile<br/>Future]
    end
    
    subgraph "Core Services"
        PROXY[Proxy Server<br/>WebSocket]
        API[Web API<br/>REST/HTTP]
        AUTH[Authentication<br/>Supabase]
    end
    
    subgraph "AI Services"
        GEMINI[Google Gemini AI<br/>Real-time Model]
        SEARCH[Search Grounding]
        VISION[Vision Processing]
    end
    
    subgraph "Infrastructure"
        DOCKER[Docker Containers]
        NGINX[Nginx Proxy]
        SSL[SSL/TLS]
        MONITOR[Monitoring]
    end
    
    subgraph "External APIs"
        GOOGLE[Google AI Studio]
        GMAIL[Gmail SMTP]
        SUPABASE[Supabase Backend]
    end
    
    DESKTOP --> PROXY
    DESKTOP --> API
    DESKTOP --> AUTH
    
    WEB --> PROXY
    WEB --> API
    WEB --> AUTH
    
    MOBILE --> PROXY
    MOBILE --> API
    MOBILE --> AUTH
    
    PROXY --> GEMINI
    API --> GEMINI
    GEMINI --> SEARCH
    GEMINI --> VISION
    
    PROXY --> DOCKER
    API --> DOCKER
    DOCKER --> NGINX
    NGINX --> SSL
    DOCKER --> MONITOR
    
    GEMINI --> GOOGLE
    API --> GMAIL
    AUTH --> SUPABASE
    
    style DESKTOP fill:#e3f2fd
    style WEB fill:#f3e5f5
    style PROXY fill:#e8f5e8
    style GEMINI fill:#fff3e0
```

## Data Flow Diagram

```mermaid
flowchart TD
    subgraph "Input Sources"
        MIC[Microphone Audio]
        SYS[System Audio]
        SCREEN[Screen Content]
        TEXT[Text Input]
    end
    
    subgraph "Processing Pipeline"
        CAPTURE[Audio Capture]
        FILTER[Noise Filtering]
        SEGMENT[Segmentation]
        ENCODE[Encoding]
    end
    
    subgraph "AI Processing"
        PROXY_AI[Proxy Server]
        GEMINI_AI[Gemini AI]
        TRANSCRIBE[Transcription]
        ANALYZE[Analysis]
        RESPOND[Response Generation]
    end
    
    subgraph "Output & Storage"
        UI_UPDATE[UI Updates]
        CHAT[Chat Messages]
        KEYWORDS[Keywords]
        SETTINGS[User Settings]
    end
    
    MIC --> CAPTURE
    SYS --> CAPTURE
    SCREEN --> CAPTURE
    TEXT --> ENCODE
    
    CAPTURE --> FILTER
    FILTER --> SEGMENT
    SEGMENT --> ENCODE
    
    ENCODE --> PROXY_AI
    PROXY_AI --> GEMINI_AI
    GEMINI_AI --> TRANSCRIBE
    GEMINI_AI --> ANALYZE
    GEMINI_AI --> RESPOND
    
    TRANSCRIBE --> UI_UPDATE
    ANALYZE --> CHAT
    RESPOND --> KEYWORDS
    UI_UPDATE --> SETTINGS
    
    style MIC fill:#e8f5e8
    style PROXY_AI fill:#e1f5fe
    style GEMINI_AI fill:#fff3e0
    style UI_UPDATE fill:#f3e5f5
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_DESKTOP[Desktop Dev<br/>localhost:3000]
        DEV_WEB[Web Dev<br/>localhost:3000]
        DEV_PROXY[Proxy Dev<br/>localhost:4567]
    end
    
    subgraph "Production Environment"
        PROD_WEB[Web Production<br/>Vercel/Docker]
        PROD_PROXY[Proxy Production<br/>Docker/Cloud]
        PROD_DESKTOP[Desktop Distribution<br/>.dmg/.exe/.AppImage]
    end
    
    subgraph "Infrastructure Services"
        CDN[Content Delivery Network]
        LB[Load Balancer]
        SSL_TERM[SSL Termination]
        MONITORING[Application Monitoring]
    end
    
    subgraph "External Services"
        GOOGLE_AI[Google AI Services]
        SUPABASE_PROD[Supabase Production]
        EMAIL_SERVICE[Email Service]
    end
    
    DEV_DESKTOP --> DEV_PROXY
    DEV_WEB --> DEV_PROXY
    
    PROD_DESKTOP --> PROD_PROXY
    PROD_WEB --> PROD_PROXY
    
    PROD_WEB --> CDN
    PROD_PROXY --> LB
    LB --> SSL_TERM
    PROD_WEB --> MONITORING
    PROD_PROXY --> MONITORING
    
    PROD_PROXY --> GOOGLE_AI
    PROD_WEB --> SUPABASE_PROD
    PROD_WEB --> EMAIL_SERVICE
    
    style DEV_DESKTOP fill:#e8f5e8
    style PROD_WEB fill:#e1f5fe
    style GOOGLE_AI fill:#fff3e0
    style MONITORING fill:#f3e5f5
```

## Security & Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App (Desktop/Web)
    participant S as Supabase Auth
    participant P as Proxy Server
    participant G as Google AI
    
    U->>A: Launch Application
    A->>S: Check Auth Status
    S-->>A: Auth State
    
    alt Not Authenticated
        A->>S: Initiate OAuth
        S->>U: OAuth Provider Login
        U->>S: Provide Credentials
        S-->>A: Auth Token
    end
    
    A->>P: Connect WebSocket
    P->>P: Validate Connection
    P->>G: Establish AI Connection
    
    U->>A: Start Audio Recording
    A->>P: Send Audio Data
    P->>G: Forward to AI
    G-->>P: AI Response
    P-->>A: Return Results
    A-->>U: Display Results
    
    Note over P,G: API Key managed securely in proxy
    Note over A,S: User tokens managed by Supabase
```

## Performance & Scaling Considerations

```mermaid
graph LR
    subgraph "Performance Bottlenecks"
        AUDIO[Audio Processing]
        NETWORK[Network Latency]
        AI_RESP[AI Response Time]
        MEMORY[Memory Usage]
    end
    
    subgraph "Scaling Solutions"
        HORIZONTAL[Horizontal Scaling]
        CACHING[Response Caching]
        CDN_SCALE[CDN Distribution]
        LOAD_BAL[Load Balancing]
    end
    
    subgraph "Monitoring Metrics"
        LATENCY[Response Latency]
        THROUGHPUT[Request Throughput]
        ERROR_RATE[Error Rates]
        RESOURCE[Resource Usage]
    end
    
    subgraph "Optimization Strategies"
        COMPRESSION[Audio Compression]
        BATCHING[Request Batching]
        POOLING[Connection Pooling]
        PREFETCH[Response Prefetching]
    end
    
    AUDIO --> COMPRESSION
    NETWORK --> CDN_SCALE
    AI_RESP --> CACHING
    MEMORY --> HORIZONTAL
    
    HORIZONTAL --> LOAD_BAL
    CACHING --> BATCHING
    CDN_SCALE --> POOLING
    LOAD_BAL --> PREFETCH
    
    COMPRESSION --> LATENCY
    BATCHING --> THROUGHPUT
    POOLING --> ERROR_RATE
    PREFETCH --> RESOURCE
    
    style AUDIO fill:#ffebee
    style HORIZONTAL fill:#e8f5e8
    style LATENCY fill:#e1f5fe
    style COMPRESSION fill:#fff3e0
```