# Development Environment Setup

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

This guide provides detailed instructions for setting up your development environment for the Intevia AI project.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.0.0 or later

  - [Download Node.js](https://nodejs.org/)
  - Verify with: `node --version`

- **pnpm**: Version 10.0.0 or later

  - Install with: `npm install -g pnpm`
  - Verify with: `pnpm --version`

- **Git**: Latest version recommended

  - [Download Git](https://git-scm.com/downloads)
  - Verify with: `git --version`

- **Code Editor**: VSCode, Cursor or Kiro
  - Recommended extensions:
    - ESLint
    - Prettier
    - TypeScript and JavaScript Language Features
    - Docker

## Setting Up the Repository

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/intevia-ai.git
   cd intevia-ai
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

   This will install all dependencies for the monorepo, including all applications and shared packages.

3. **Set up environment variables**

   ```bash
   bash scripts/setup-env.sh
   ```

   This script will copy all `.env.example` files to `.env` files in each application directory. You'll need to edit these files with your actual values.

## Required API Keys and Services

### Google Generative AI (Gemini)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Add the key to:
   - `apps/web/.env`: `GOOGLE_GENERATIVE_AI_API_KEY`
   - `apps/proxy/.env`: `GOOGLE_GENERATIVE_AI_API_KEY`

### Supabase (Optional for Authentication)

1. Create a new project at [Supabase](https://supabase.com/)
2. Navigate to Project Settings > API
3. Copy the URL and anon key
4. Add to `apps/app/.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### OAuth Configuration for Desktop App

To enable OAuth providers (like Google or GitHub) to work correctly with the Electron desktop application, you must configure the correct redirect URL in your Supabase project settings.

1.  **Navigate to your Supabase Project.**
2.  Go to **Authentication** -> **URL Configuration**.
3.  In the **Redirect URLs** section, ensure the following URL is present:

    ```
    http://localhost:3000/auth/callback
    ```

4.  **Important**: Make sure to **remove** the old `intevia://auth/callback` URL if it exists. Only the `http://localhost:3001` URL should be used for the development environment.
5.  Click **Save**.

This URL points to the web-based callback page that handles the authentication flow and redirects back to the desktop app. It is a required step for the login process to function correctly.

### Gmail (For Feedback System)

1. Create a Gmail account or use an existing one
2. Enable 2-Step Verification
3. Generate an App Password:
   - Go to Google Account > Security > 2-Step Verification > App passwords
4. Add to `apps/web/.env`:
   - `GMAIL_USER`: Your Gmail address
   - `GMAIL_PASS`: The generated app password

## Running the Applications

### Web Application

1. **Start the Next.js development server**

   ```bash
   cd apps/web
   pnpm dev
   ```

   The web application will be available at http://localhost:3000

2. **Start the WebSocket proxy server**

   ```bash
   # In a separate terminal
   cd apps/web
   pnpm proxy
   ```

   The proxy server will be available at ws://localhost:4567

### Desktop Application

```bash
cd apps/app
pnpm dev
```

This will start both the Next.js development server and the Electron application.

### Proxy Server (Standalone)

```bash
cd apps/proxy
pnpm start
```

## Backend Deployment (Google Cloud Run)

The WebSocket proxy server (`apps/proxy`) is designed for deployment to Google Cloud Run.

### Prerequisites

1.  **Google Cloud SDK**: Ensure the `gcloud` CLI is [installed and authenticated](httpss://cloud.google.com/sdk/docs/install).
2.  **APIs**: Enable the **Cloud Build API**, **Cloud Run API**, and **Secret Manager API** in your GCP project.
3.  **Permissions**: Your GCP user or service account needs `roles/run.admin`, `roles/storage.admin`, and `roles/secretmanager.admin` permissions.

### Storing the API Key Securely

Before deploying, you must store your Google AI API key in **Google Secret Manager** for security.

1.  **Navigate to Secret Manager** in the Google Cloud Console.
2.  Click **"Create Secret"**.
3.  **Name**: `intevia-google-ai-key` (this name is used in the deployment script).
4.  **Secret value**: Paste your Google AI API key.
5.  Click **"Create secret"**.
6.  **Grant Access**: On the secret's details page, go to the **Permissions** tab and grant the **Compute Engine default service account** the **"Secret Manager Secret Accessor"** role.

### Deployment Steps

A deployment script is provided at `scripts/deploy-proxy.sh` to automate the process. This is the recommended method for the **initial deployment**.

1.  **Make the script executable:**

    ```bash
    # chmod means change mode, +x means make the script executable. Used to make the script executable.
    chmod +x scripts/deploy-proxy.sh
    ```

2.  **Configure the script:**

    Open `scripts/deploy-proxy.sh` and update the following variables:

    - `PROJECT_ID`: Your Google Cloud Project ID.
    - `SERVICE_NAME`: The desired name for your Cloud Run service (e.g., `intevia-proxy`).
    - `REGION`: The GCP region for deployment (e.g., `us-central1`).
    - `GOOGLE_GENERATIVE_AI_API_KEY`: Your Google AI API key.

3.  **Run the deployment script:**

    ```bash
    ./scripts/deploy-proxy.sh
    ```

The script will build the Docker image using Cloud Build and deploy it to Cloud Run.

### Automated Deployment with GitHub (CI/CD)

For a more efficient workflow, you can set up continuous deployment to automatically update your service every time you push to your GitHub repository. This is the recommended approach for all subsequent deployments after the initial one.

1.  **Navigate to your Service**: In the Google Cloud Console, go to your Cloud Run service (e.g., `intevia-proxy`).
2.  **Edit and Deploy**: Click **"Edit & Deploy New Revision"**.
3.  **Configure Source**:
    *   Under the "Source" section, select **"Continuously deploy new revisions from a source repository"**.
    *   Click **"Set up with Cloud Build"**.
4.  **Connect Repository**:
    *   Authenticate with your GitHub account and select the `intevia-ai` repository.
    *   In the trigger settings, choose the branch that will trigger deployments (e.g., `main`).
5.  **Configure Build Settings**:
    *   **Build Type**: Select `Dockerfile`.
    *   **Source Location**: This is critical for a monorepo. Set the path to your proxy's `Dockerfile` to: `/apps/proxy/Dockerfile`.
6.  **Save**: Save the trigger configuration.

Once saved, any new commits pushed to the specified branch will automatically build and deploy a new revision to your Cloud Run service.

### Using a Custom Domain (Recommended)

For a professional setup, you should map a custom subdomain (e.g., `proxy.intevia.app`) to your Cloud Run service.

1.  **Deploy the Service**: Complete the deployment steps above to get your service running.
2.  **Map Custom Domain in GCP**:
    - In the Google Cloud Console, navigate to **Cloud Run**.
    - Click **"Manage custom domains"**.
    - Click **"Add Mapping"**.
    - Select your deployed service (e.g., `intevia-proxy`) and enter the subdomain you want to use (e.g., `proxy.intevia.app`).
3.  **Update DNS Records**:
    - Google will provide you with the necessary DNS records (e.g., `A`, `AAAA`, or `CNAME`).
    - Add these records in your domain provider's DNS settings (e.g., Cloudflare).
4.  **Wait for Propagation**: It may take a few minutes for the SSL certificate to be provisioned and for DNS changes to take effect.

### Updating the Frontend

Once your backend is deployed and the custom domain is mapped, you must update the frontend to use the new production URL.

1.  Open the environment file for the web application: `apps/web/.env`.
2.  Set the `PROXY_SERVER_URL` variable to your custom domain, making sure to use the secure WebSocket protocol (`wss://`):

    ```env
    PROXY_SERVER_URL=wss://proxy.intevia.app
    ```

3.  Redeploy your web application to Vercel for the changes to take effect.

## Development Workflow

### Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for a specific application
cd apps/web
pnpm test
```

### Linting and Formatting

```bash
# Run linting across the monorepo
pnpm lint

# Format code across the monorepo
pnpm format
```

### Building for Production

```bash
# Build all applications
pnpm build

# Build a specific application
cd apps/web
pnpm build
```

## Troubleshooting Common Issues

See [troubleshooting.md](./troubleshooting.md) for solutions to common development issues.

## Next Steps

- Review the [architecture overview](../architecture/overview.md) to understand the system design
- Check out the [CONTRIBUTING.md](../../CONTRIBUTING.md) file for development guidelines
- Explore the codebase to familiarize yourself with the project structure

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://reactjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Google Generative AI Documentation](https://ai.google.dev/docs)
