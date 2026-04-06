FROM node:22-alpine

# Install dependencies needed for some native modules or binaries
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the Vite frontend
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the server
# Using npx ensures tsx is found even if not in the PATH
CMD ["npx", "tsx", "server.ts"]
