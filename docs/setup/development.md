# Development Environment Setup

This guide provides detailed instructions for setting up your development environment for the Knovy project.

## 1. Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.0.0 or later (`node --version`)
- **pnpm**: Version 10.0.0 or later (`pnpm --version`)
- **Git**: Latest version recommended (`git --version`)

## 2. Repository Setup

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-org/knovy.git
    cd knovy
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    ```

3.  **Set up environment variables** (optional)

    The desktop app requires no cloud credentials. If an `apps/app/.env.example` file exists, copy it to `apps/app/.env`. The app runs without any API keys — Ollama is accessed over local HTTP and whisper.cpp is bundled.

## 3. Optional Local Services

### Ollama (AI features)

Ollama powers transcription enhancement and all AI actions (chat, summarize, etc.). It is optional — the app runs without it, showing raw transcriptions and disabling AI actions.

1. Install [Ollama](https://ollama.com) and start it (it runs at `http://localhost:11434` by default).
2. Pull a model from the app's **AI Models** settings page.
3. Enhancement and AI actions activate automatically once a model is available.

## 4. Running the Applications

### Desktop Application

This command starts the Electron application and its development server. The desktop app uses **local whisper.cpp transcription** for offline, privacy-focused speech-to-text.

```bash
# In a separate terminal
pnpm --filter app dev
```

**First Launch**: The app will automatically download the base whisper model (142MB) on first startup. Ensure you have an internet connection for the initial model download.

**Transcription Enhancement**: The desktop app can optionally enhance raw transcriptions using a local Ollama model. To enable this feature:
1. Install [Ollama](https://ollama.com) and ensure it is running (default `http://localhost:11434`)
2. Pull/select an enhancement model from the app's AI Models settings
3. Enhancement runs automatically and on-device; if the model is unavailable, the raw transcription is shown unchanged

## 5. Code Style and Linting

This project uses ESLint and Prettier to maintain a consistent code style.

- **Check for linting errors:**
  ```bash
  pnpm lint
  ```
- **Automatically format all files:**
  ```bash
  pnpm format
  ```
