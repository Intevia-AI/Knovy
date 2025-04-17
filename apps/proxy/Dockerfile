# Use an official Node.js runtime as a parent image (choose a version compatible with your code)
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install
# If you are using yarn, use: RUN yarn install --frozen-lockfile

# Bundle app source
COPY . .

# Make port 8080 available to the world outside this container (if PROXY_PORT is 8080)
# This is informational; the actual mapping happens in docker-compose.yml
EXPOSE 8080

# Define environment variables (defaults, can be overridden by .env.local via docker-compose volume)
ENV NODE_ENV=production
ENV PROXY_PORT=8080

# Run startProxy.js when the container launches
CMD [ "node", "startProxy.js" ]

