# Use an official Node.js v20 runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root package manifest and lockfile
COPY package.json pnpm-lock.yaml ./

# Copy client and server package manifests
# This helps pnpm understand the workspace structure implicitly
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install all dependencies (root, client, server) using pnpm
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Make port 5000 available (server)
# Make port 3000 available (client)
EXPOSE 5000 3000

# Define the command to run the app using the start script from package.json
CMD [ "pnpm", "start" ] 