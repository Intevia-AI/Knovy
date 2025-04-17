# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS base

# Set the working directory in the container
WORKDIR /app

# Install dependencies
# Copy package.json and lock file
COPY package.json ./
# Assuming you use npm, copy package-lock.json if it exists
# COPY package-lock.json ./
# If using pnpm, copy pnpm-lock.yaml
# COPY pnpm-lock.yaml ./
# If using yarn, copy yarn.lock
# COPY yarn.lock ./

# Install dependencies based on your package manager
# Use npm ci for cleaner installs if you have a lock file
RUN npm install --omit=dev
# Or use pnpm install --prod
# Or use yarn install --production

# Copy the rest of the application code
# Copy the specific proxy script and any other required files/folders
COPY app/api/ai/proxy/startProxy.js ./app/api/ai/proxy/startProxy.js
# If the proxy depends on other local modules within apps/web, copy them too.
# Example: COPY lib/ ./lib/

# Make port 8080 available to the world outside this container (default, can be overridden by PROXY_PORT env var)
EXPOSE 8080

# Define environment variable for the Node environment
ENV NODE_ENV=production
# The startProxy.js script uses dotenv, but it's better to pass env vars via docker-compose
# GOOGLE_GENERATIVE_AI_API_KEY and PROXY_PORT will be injected by docker-compose

# Run startProxy.js when the container launches
CMD ["node", "app/api/ai/proxy/startProxy.js"]

