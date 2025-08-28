# Web Application Architecture Diagram

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

## Overall Architecture

```mermaid
graph TB
    subgraph "Client Side (Browser)"
        LP[Landing Page]
        DI[Demo Interface]
        RC[React Components]
        RH[React Hooks]
        WA[Web Audio API]
        MR[MediaRecorder API]
    end

    subgraph "Next.js Server"
        AR[API Routes]
        AI_EP[AI Endpoint]
        FB_EP[Feedback Endpoint]
        PA_EP[Process Audio]
        MW[Middleware]
    end

    subgraph "External Services"
        GA[Google Gemini AI]
        GM[Gmail SMTP]
        PS[Proxy Server]
    end

    subgraph "Browser APIs"
        SS[Screen Share API]
        AU[Audio Capture]
        WS[WebSocket]
        ST[Storage APIs]
    end

    LP --> RC
    DI --> RC
    RC --> RH
    RH --> WA
    RH --> MR

    RC --> AR
    AR --> AI_EP
    AR --> FB_EP
    AR --> PA_EP
    AR --> MW

    AI_EP --> GA
    FB_EP --> GM
    DI --> PS

    RH --> SS
    RH --> AU
    RH --> WS
    RH --> ST

    style LP fill:#e3f2fd
    style DI fill:#f3e5f5
    style AR fill:#fff3e0
    style GA fill:#e8f5e8
```

## Demo Interface Flow

```mermaid
sequenceDiagram
    participant U as User
    participant D as Demo Component
    participant H as Audio Hooks
    participant A as Audio APIs
    participant AI as AI Service
    participant P as Proxy Server

    U->>D: Start Screen Share
    D->>H: Initialize Recording
    H->>A: Request Permissions
    A-->>H: Grant Access
    H->>A: Start Recording

    loop Audio Processing
        A->>H: Audio Chunks
        H->>D: Process Segments
        D->>AI: Send to AI
        AI->>P: Forward to Proxy
        P-->>AI: AI Response
        AI-->>D: Return Results
        D-->>U: Update UI
    end

    U->>D: Stop Recording
    D->>H: Cleanup
    H->>A: Stop Streams
```

## Component Structure

```mermaid
graph TD
    subgraph "Landing Page Components"
        HS[Hero Section]
        FS[Features Section]
        IS[Integrations Section]
        TS[Team Section]
        CTA[Call to Action]
    end

    subgraph "Demo Components"
        DC[Demo Component]
        AV[Audio Visualizer]
        RTA[Real Time Analysis]
        CP[Control Panel]
        CH[Chat Interface]
    end

    subgraph "Shared Components"
        MD[Markdown Renderer]
        UI[UI Components]
        TH[Theme Provider]
        PR[Providers]
    end

    subgraph "Custom Hooks"
        USR[useSegmentRecorder]
        UAA[useAudioAnalysis]
        UWS[useWebSocket]
    end

    DC --> AV
    DC --> RTA
    DC --> CP
    DC --> CH

    DC --> USR
    DC --> UAA
    DC --> UWS

    CH --> MD
    DC --> UI
    DC --> TH

    style DC fill:#e1f5fe
    style USR fill:#f1f8e9
    style UI fill:#fce4ec
```

## API Routes Architecture

```mermaid
graph LR
    subgraph "API Routes"
        AI[/api/ai]
        FB[/api/feedback]
        PA[/api/process-audio]
    end

    subgraph "AI Processing"
        GM[Gemini Model]
        TG[Text Generation]
        IG[Image Processing]
        SG[Search Grounding]
    end

    subgraph "Email Service"
        NM[Nodemailer]
        SMTP[Gmail SMTP]
        EM[Email Templates]
    end

    subgraph "Audio Processing"
        FF[FFmpeg]
        WA[Web Audio]
        AC[Audio Conversion]
    end

    AI --> GM
    GM --> TG
    GM --> IG
    GM --> SG

    FB --> NM
    NM --> SMTP
    NM --> EM

    PA --> FF
    PA --> WA
    PA --> AC

    style AI fill:#e8f5e8
    style FB fill:#fff3e0
    style PA fill:#f3e5f5
```

## Real-time Audio Processing Flow

```mermaid
flowchart TD
    subgraph "Audio Capture"
        MC[Microphone Capture]
        SC[System Audio Capture]
        SS[Screen Share Audio]
    end

    subgraph "Processing Pipeline"
        NF[Noise Filter]
        SEG[Segmentation]
        B64[Base64 Encoding]
        BUF[Buffer Management]
    end

    subgraph "Analysis & Visualization"
        FFT[FFT Analysis]
        VIS[Visualizer]
        LEV[Level Detection]
        ACT[Activity Detection]
    end

    subgraph "AI Processing"
        API[AI API Call]
        TRANS[Transcription]
        KW[Keyword Extraction]
        RESP[Response Generation]
    end

    MC --> NF
    SC --> NF
    SS --> NF

    NF --> SEG
    SEG --> B64
    B64 --> BUF

    NF --> FFT
    FFT --> VIS
    FFT --> LEV
    LEV --> ACT

    BUF --> API
    API --> TRANS
    API --> KW
    API --> RESP

    style MC fill:#e3f2fd
    style API fill:#e8f5e8
    style VIS fill:#fff3e0
```
