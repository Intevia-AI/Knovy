# =========================================================================
# Dockerfile for Intevia AI Proxy Server
# =========================================================================
# This Dockerfile builds a container for the WebSocket proxy server that
# connects clients to Google's Gemini AI API for real-time audio transcription.
# 
# The container is based on Node.js 18 Alpine for a small footprint and
# exposes port 4567 for WebSocket connections.
# =========================================================================

# Use an official Node.js runtime as a parent image
# Alpine version is chosen for its small footprint and security benefits
FROM node:18-alpine

# Set the working directory in the container
# All subsequent commands will run in this directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
# This layer will only rebuild when package files change, not when code changes
COPY package*.json ./

# Install app dependencies
# Production flag ensures dev dependencies are not installed
RUN npm install --production
# Alternative for yarn users: RUN yarn install --frozen-lockfile --production

# Bundle app source code
# This copies all files from the current directory to the container
COPY . .

# Make port 4567 available to the world outside this container
# Note: This is informational; the actual port mapping happens in docker-compose.yml
EXPOSE 4567

# Define environment variables with default values
# These can be overridden at runtime via docker-compose.yml or docker run command
ENV NODE_ENV=production
ENV PROXY_PORT=4567

# Command to run when the container starts
# Executes the proxy server using Node.js
CMD [ "node", "startProxy.js" ]

