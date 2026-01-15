# Build stage for React frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY upwork-proposal-generator/package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY upwork-proposal-generator/ ./

# Build the React frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY upwork-proposal-generator/package*.json ./

# Install only production dependencies (--omit=dev is the modern syntax)
RUN npm ci --omit=dev

# Copy server code
COPY upwork-proposal-generator/server ./server

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check - Railway uses its own health checks, disable Docker's
# HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
#   CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start the server
CMD ["node", "server/index.js"]
