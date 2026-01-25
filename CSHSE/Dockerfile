# Build stage for client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci

# Copy client source
COPY client/ ./

# Build client
RUN npm run build

# Build stage for server
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy server source code and build script
COPY server/tsconfig.json ./
COPY server/build.js ./
COPY server/src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy server package files
COPY server/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built server files from server-builder stage
COPY --from=server-builder /app/dist ./dist

# Copy built client files from client-builder stage
COPY --from=client-builder /app/client/dist ./public

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port 8080 for Railway
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the server with dumb-init for proper PID 1 behavior
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
