# ---- stage 1: build the React frontend --------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- stage 2: runtime = backend + built assets only -------------------------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev --no-audit --no-fund
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/build ./frontend/build
EXPOSE 38765
USER node
CMD ["node", "backend/server.js"]
