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

3.  **Set up environment variables**

    For each application in the `apps/` directory, you need to create a `.env` file. Manually copy the contents of `.env.example` to a new `.env` file within the same directory.
    - `apps/app/.env.example` -> `apps/app/.env`
    - `apps/web/.env.example` -> `apps/web/.env`

    After creating the files, edit them to add your actual API keys and configuration values.

## 3. API Keys and Services

### Supabase

Supabase is used for authentication in the desktop app and for backend services.

1.  Create a new project at [Supabase](https://supabase.com/).
2.  Navigate to **Project Settings > API**.
3.  Copy the **Project URL** and **Project API Keys** (the `anon` key).
4.  Add them to `apps/app/.env` and `apps/web/.env`:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### OAuth Configuration for Desktop App

To enable Google/GitHub login in the Electron app, you must configure the redirect URL in Supabase.

1.  Navigate to your Supabase Project.
2.  Go to **Authentication** -> **URL Configuration**.
3.  In the **Redirect URLs** section, add the following URL:
    ```
    http://localhost:3000/auth/callback
    ```
4.  Click **Save**.

## 4. Running the Applications

### Web Application (Demo)

```bash
pnpm --filter web dev
```

Access the web application at `http://localhost:3000`.

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

### Supabase

1. For local development, you can run a full Supabase stack on your machine.
   - **Start local Supabase services:**

     ```bash
     supabase start
     ```

   - **View status and API keys:**

     ```bash
     supabase status
     ```

   - **Stop local Supabase services:**

     ```bash
     supabase stop
     ```

   - **Start the Supabase functions:**

   ```bash
   supabase functions serve --env-file supabase/.env.development
   ```

   - **Reset the local database:**
     ```bash
     supabase db reset
     ```

2. For production deployment

   Check this [doc](https://supabase.com/docs/guides/deploy/multi-env-deployment) to deploy the Supabase project.
   - **Deploy edge functions:**

     ```bash
     supabase functions deploy
     ```

   - **Deploy secrets:**
     ```bash
     supabase secrets set --env-file ./supabase/.env.production
     ```

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
