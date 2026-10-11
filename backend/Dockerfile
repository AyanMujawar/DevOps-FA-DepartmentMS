# ---- stage 1: compile the TypeScript (needs the dev dependencies) ----
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first so Docker can cache this layer when only code changes
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- stage 2: the image that actually runs (production dependencies only) ----
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Run as the unprivileged "node" user instead of root (safer if the app is ever compromised).
# uploads/ is where lecturers' course materials are stored; compose mounts a volume here.
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1

CMD ["node", "dist/app.js"]
