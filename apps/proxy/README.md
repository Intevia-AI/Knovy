# Knovy Web Demo Proxy

This is a rate-limited WebSocket proxy server for the Knovy web demo. It uses the Google Gemini API's real-time streaming capabilities to provide transcription services while protecting the backend from abuse by limiting usage per IP address.

## Prerequisites

- Node.js (v20 or later recommended)
- pnpm (or npm/yarn)

## Installation

1.  Navigate to this directory:
    ```bash
    cd apps/proxy
    ```
2.  Install the dependencies:
    ```bash
    pnpm install
    ```

## Configuration

This service requires a Google Gemini API key.

1.  Create a `.env` file in this directory:
    ```bash
    touch .env
    ```
2.  Add your API key to the `.env` file:
    ```
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```

## Running the Server

### Development Mode

To run the server in development mode with hot-reloading, use:

```bash
pnpm dev
```

The server will start on `http://localhost:4568`.

### Production Mode

1.  First, build the TypeScript code:
    ```bash
    pnpm build
    ```
2.  Then, start the server:
    ```bash
    pnpm start
    ```

The server will start on `http://localhost:4568`.

## Health Check

A health check endpoint is available at `http://localhost:4568/health`.
