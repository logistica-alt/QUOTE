# ============================================================
# Forest Coffee Logistics — Production Docker Image
# Next.js 14 + Playwright Chromium (headless automation)
# Deploy on: Railway, Render, or any Docker host
# ============================================================

FROM node:20-slim

# ── Chromium system dependencies (required by Playwright) ──
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcb1 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libglib2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install Node dependencies ──────────────────────────────
COPY package*.json ./
RUN npm ci

# ── Download Playwright's Chromium into the image ──────────
# Use a fixed path so the browser is always found at runtime
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright install chromium

# ── Copy source & build ────────────────────────────────────
COPY . .

# Build Next.js production bundle
RUN npm run build

# Compile automation TypeScript → JavaScript
RUN npm run build:scripts

# ── Runtime ───────────────────────────────────────────────
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers

# Railway / Render inject PORT automatically; Next.js reads it
EXPOSE 3000
CMD ["npm", "start"]
