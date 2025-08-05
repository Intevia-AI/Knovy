#!/bin/bash

# This script deploys the WebSocket proxy server to Google Cloud Run.

# --- Configuration ---
# The GCP Project ID to deploy to.
PROJECT_ID="your-gcp-project-id"
# The name of the Cloud Run service.
SERVICE_NAME="intevia-proxy"
# The region to deploy the service in.
REGION="asia-east1"
# The name of the Docker image to build.
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# --- Script ---

echo "Starting deployment to Google Cloud Run..."

# 1. Configure gcloud to use your project.
echo "Configuring gcloud CLI to use project: ${PROJECT_ID}"
gcloud config set project ${PROJECT_ID}

# 2. Build the Docker container image using Cloud Build.
# This command builds the image from the Dockerfile in the apps/proxy directory
# and tags it with the name defined in IMAGE_NAME.
echo "Building Docker image: ${IMAGE_NAME}"
gcloud builds submit ./apps/proxy --tag=${IMAGE_NAME}

# 3. Deploy the container to Cloud Run.
echo "Deploying container to Cloud Run service: ${SERVICE_NAME}"
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --platform=managed \
  --region=${REGION} \
  --port=4567 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key-here" \
  --timeout=3600

echo "Deployment complete."
