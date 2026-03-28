FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src
COPY config ./config

# Copy shared types
COPY ../shared /app/shared 2>/dev/null || true

RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001
EXPOSE 3002

CMD ["node", "dist/backend/src/index.js"]
