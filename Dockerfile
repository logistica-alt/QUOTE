# ============================================================
# Forest Coffee Logistics — Production Docker Image
# Next.js 14 + Playwright Chromium (headless automation)
# Deploy on: Railway, Render, or any Docker host
# ============================================================

FROM node:20-bookworm-slim

# Install system tools needed by Playwright's dependency installer
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install Node dependencies ──────────────────────────────
COPY package*.json ./
RUN npm ci

# ── Download Playwright Chromium + all its system deps ─────
# --with-deps installs the correct OS packages automatically
# (handles Debian Bookworm's libasound2t64 rename, etc.)
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright install --with-deps chromium

# ── Copy source & build ────────────────────────────────────
COPY . .

# Build Next.js production bundle
RUN npm run build

# Compile automation TypeScript → JavaScript
RUN npm run build:scripts

# ── Runtime ───────────────────────────────────────────────
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers

# Railway injects PORT automatically; Next.js reads it
EXPOSE 3000
CMD ["npm", "start"]
