FROM node:20-alpine AS base

# ── Build stage ──────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy shared types (used by @types/* path alias)
COPY types/ ./types/

# Install dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# Copy source & Prisma schema
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts
COPY backend/src ./src

# Generate Prisma client
RUN npx prisma generate

# Build NestJS
RUN npm run build

# ── Production stage ─────────────────────────────────
FROM base AS runner
WORKDIR /app

# Install only production deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema & generate client for production
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts
RUN npx prisma generate

# Copy compiled app from builder
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
