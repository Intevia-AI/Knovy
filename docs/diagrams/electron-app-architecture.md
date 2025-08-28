# Electron App Architecture Diagram

> > [!IMPORTANT]
> > This document is AI generated. Please verify the information before using it.

## Overall Architecture

```mermaid
graph TB
    subgraph "Electron Main Process"
        MP[Main Process<br/>main.mjs]
        PS[Preload Script<br/>preload.mjs]
        IPC[IPC Handlers]
        WM[Window Management]
        SM[System Integration]
    end

    subgraph "Electron Renderer Process"
        UI[Next.js UI<br/>React Components]
        RH[React Hooks]
        CTX[Context Providers]
        API[Electron APIs]
    end

    subgraph "External Services"
        GA[Google Gemini AI]
        SB[Supabase Auth]
        PS_EXT[Proxy Server]
    end

    subgraph "System Resources"
        SC[Screen Capture]
        AU[Audio Recording]
        FS[File System]
        OS[OS Integration]
    end

    MP --> PS
    PS --> UI
    UI --> RH
    RH --> CTX
    CTX --> API

    MP --> IPC
    MP --> WM
    MP --> SM

    SM --> SC
    SM --> AU
    SM --> FS
    SM --> OS

    UI --> GA
    UI --> SB
    UI --> PS_EXT

    style MP fill:#e1f5fe
    style UI fill:#f3e5f5
    style GA fill:#fff3e0
    style SC fill:#e8f5e8
```

## Component Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant R as Renderer Process
    participant P as Preload Script
    participant M as Main Process
    participant S as System APIs
    participant G as Gemini AI

    U->>R: Interact with UI
    R->>P: Call Electron API
    P->>M: Send IPC Message
    M->>S: Access System Resources
    S-->>M: Return Data
    M-->>P: IPC Response
    P-->>R: Return Result
    R->>G: Send AI Request
    G-->>R: AI Response
    R-->>U: Update UI
```

## Key Components Detail

```mermaid
graph LR
    subgraph "Main Components"
        MC[Main Component]
        HP[Header Bar]
        CP[Control Panel]
        CH[Chat Panel]
        SM[Source Modal]
    end

    subgraph "Custom Hooks"
        UE[useElectron]
        USS[useScreenShare]
        UAA[useAudioAnalysis]
        UAI[useAIInteraction]
    end

    subgraph "Context Providers"
        AC[AuthContext]
        LC[LanguageContext]
        TC[ThemeContext]
    end

    MC --> HP
    MC --> CP
    MC --> CH
    MC --> SM

    MC --> UE
    MC --> USS
    MC --> UAA
    MC --> UAI

    MC --> AC
    MC --> LC
    MC --> TC

    style MC fill:#e3f2fd
    style UE fill:#f1f8e9
    style AC fill:#fce4ec
```

## IPC Communication Flow

```mermaid
graph TD
    subgraph "Renderer Process"
        RC[React Components]
        EA[Electron APIs]
    end

    subgraph "Preload Script"
        CB[Context Bridge]
        IR[IPC Renderer]
    end

    subgraph "Main Process"
        IM[IPC Main]
        WC[Window Controls]
        SC[Screen Capture]
        AU[Audio Processing]
        ST[Settings Management]
        SS[Screenshot Tools]
    end

    RC --> EA
    EA --> CB
    CB --> IR
    IR --> IM

    IM --> WC
    IM --> SC
    IM --> AU
    IM --> ST
    IM --> SS

    style RC fill:#e8eaf6
    style CB fill:#fff8e1
    style IM fill:#e0f2f1
```
