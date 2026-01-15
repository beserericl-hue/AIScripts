# Build stage for React frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY upwork-proposal-generator/package*.json ./

# Clean npm cache and install dependencies
RUN npm cache clean --force && npm install

# Copy source code
COPY upwork-proposal-generator/ ./

# Build the React frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY upwork-proposal-generator/package*.json ./

# Install only production dependencies
RUN npm cache clean --force && npm install --omit=dev

# Copy server code
COPY upwork-proposal-generator/server ./server

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server/index.js"]
