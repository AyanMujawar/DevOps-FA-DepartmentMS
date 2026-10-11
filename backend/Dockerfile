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
# npm is only needed to install; it is removed afterwards because the running app does not use it and
# the copy bundled in the base image carries vulnerable libraries (flagged by the Trivy scan in CI).
RUN npm ci --omit=dev && npm cache clean --force     && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build /app/dist ./dist

# Run as the unprivileged "node" user instead of root (safer if the app is ever compromised).
# uploads/ is where lecturers' course materials are stored; compose mounts a volume here.
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1

CMD ["node", "dist/app.js"]
