# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy root package.json and package-lock.json
COPY package.json package-lock.json* ./

# Install root dependencies
RUN npm install

# Copy server files
COPY server/ ./server/
# Install server dependencies
WORKDIR /app/server
RUN npm install

# Copy client files
WORKDIR /app
COPY client/ ./client/
# Install client dependencies
WORKDIR /app/client
RUN npm install

# Return to the root directory
WORKDIR /app

# Copy the rest of the application code
COPY . .

# Make port 5000 available (assuming server runs on 5000, adjust if needed)
# Make port 3000 available (client runs on 3000)
EXPOSE 5000 3000

# Define the command to run the app using the start script from package.json
CMD [ "npm", "start" ] 