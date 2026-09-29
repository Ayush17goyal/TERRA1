# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all source files
COPY . .

# Install all dependencies
RUN npm ci

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chmod 755 /app/uploads

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose port - uses PORT env var in main.ts
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application with dumb-init for proper signal propagation
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
