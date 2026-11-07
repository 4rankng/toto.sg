# syntax=docker/dockerfile:1
# toto.sg — self-host image: build the SPA, serve it with the zero-dep
# server.mjs (static dist + /api/latest). linux/amd64 (bot.tingting.vip).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
COPY --from=build /app/dist ./dist
COPY server.mjs ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
