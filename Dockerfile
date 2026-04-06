FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the Vite frontend
RUN npm run build

# Set production environment so Express serves the Vite build
ENV NODE_ENV=production

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
