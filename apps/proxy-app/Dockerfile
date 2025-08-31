# Stage 1: Build Environment
# Use a standard Node.js image to build the application.
FROM node:18-alpine AS builder

# Set the working directory in the container.
WORKDIR /app

# Copy the package.json and install dependencies.
# This creates a package-lock.json file inside the container.
COPY package.json ./
RUN npm install --only=production

# Copy the rest of the application source code.
COPY . .

# ---

# Stage 2: Production Environment
# Use a lightweight Alpine image for the final production container.
FROM node:18-alpine

# Set the working directory.
WORKDIR /app

# Create a non-root user for security.
RUN addgroup -S proxygroup && adduser -S proxyuser -G proxygroup

# Copy dependencies and source code from the builder stage.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/startProxy.js .

# Change ownership of the application files to the non-root user.
RUN chown -R proxyuser:proxygroup /app

# Switch to the non-root user.
USER proxyuser

# Expose the port the server will run on.
EXPOSE 4568

# Add a health check for Cloud Run.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4567/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Define the command to start the application.
CMD ["node", "startProxy.js"]