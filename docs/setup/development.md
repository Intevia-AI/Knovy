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
    - `apps/proxy/.env.example` -> `apps/proxy/.env`

    After creating the files, edit them to add your actual API keys and configuration values.

## 3. API Keys and Services

### Google Generative AI (Gemini)

1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Create a new API key.
3.  Add the key to:
    - `apps/web/.env`: `GOOGLE_GENERATIVE_AI_API_KEY`
    - `apps/proxy/.env`: `GOOGLE_GENERATIVE_AI_API_KEY`

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

The web app requires both the Next.js server and the proxy server to be running.

```bash
# Terminal 1: Start the Next.js development server
pnpm --filter web dev

# Terminal 2: Start the WebSocket proxy server
pnpm --filter web proxy
```

Access the web application at `http://localhost:3000`.

### Desktop Application

This command starts the Electron application and its development server.

```bash
# In a separate terminal
pnpm --filter app dev
```

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

## 5. Backend Deployment (Proxy Server)

The WebSocket proxy server (`apps/proxy`) is designed for deployment as a container to **Google Cloud Run**.

### Storing the API Key Securely

Before deploying, store your Google AI API key in **Google Secret Manager**.

1.  In the Google Cloud Console, navigate to **Secret Manager**.
2.  Create a new secret named `intevia-google-ai-key`.
3.  Set the secret value to your Google AI API key.
4.  Grant the **Default compute service account** the **Secret Manager Secret Accessor** role for this secret.

### Deployment to Cloud Run

While you can deploy manually, the recommended approach is to set up continuous deployment from your GitHub repository.

1.  In the Google Cloud Console, go to your Cloud Run service.
2.  Click **Edit & Deploy New Revision**.
3.  Under "Source", select **Continuously deploy new revisions from a source repository** and set up a Cloud Build trigger connected to your `main` branch.
4.  **Crucially**, in the build settings, set the **Build Type** to `Dockerfile` and the **Source Location** to `/apps/proxy/Dockerfile` to ensure it builds the correct application from the monorepo.
5.  Save the trigger. Future pushes to your selected branch will automatically deploy.

## 6. Code Style and Linting

This project uses ESLint and Prettier to maintain a consistent code style.

- **Check for linting errors:**
  ```bash
  pnpm lint
  ```
- **Automatically format all files:**
  ```bash
  pnpm format
  ```
