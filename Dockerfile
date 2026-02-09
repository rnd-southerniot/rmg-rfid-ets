# ── Build stage ────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
COPY scripts/ scripts/
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist/ dist/
COPY public/ public/
COPY db/ db/
COPY scripts/ scripts/

# tsx needed for migrate + seed scripts at runtime
RUN npm install tsx

EXPOSE 3000
CMD ["node", "dist/src/server.js"]
